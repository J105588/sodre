/**
 * SoDRé Experimental Water Opening Animation — 2D Ripple Effect
 * 
 * Pure WebGL fragment shader for 2D ripple distortion
 * overlaid on the existing aurora CSS background.
 * 
 * - No 3D water surface or droplet
 * - Auto-triggered ripples from multiple points
 * - Mouse/touch interaction creates additional ripples
 * - Ripples distort refraction + add highlight rings
 * - Edge reflections via mirror sources
 */
(function () {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    const MAX_RIPPLES = 16;
    const BOUNDARY = 0.9; // Normalized boundary for edge reflections (0-1 range)
    const REFL_COEFF = 0.4; // Reflection strength
    const TEXT_DELAY = 1.5; // Seconds before text appears
    const SUBTITLE_DELAY = 3.5; // Seconds before subtitle appears

    // Auto-trigger ripple schedule: [time, x (0-1), y (0-1)]
    // Randomize positions on each load based on aspect ratio
    const AUTO_RIPPLES = [];

    (function initLayout() {
        const isPortrait = window.innerHeight > window.innerWidth;

        if (isPortrait) {
            // PORTRAIT: Vertical distribution
            // 1. Top zone
            AUTO_RIPPLES.push([
                0.4,
                0.3 + Math.random() * 0.4,
                0.15 + Math.random() * 0.1
            ]);
            // 2. Middle zone
            AUTO_RIPPLES.push([
                0.6,
                0.2 + Math.random() * 0.6,
                0.5 + (Math.random() - 0.5) * 0.1
            ]);
            // 3. Bottom zone
            AUTO_RIPPLES.push([
                0.5,
                0.3 + Math.random() * 0.4,
                0.8 + Math.random() * 0.1
            ]);
        } else {
            // LANDSCAPE: Triangular distribution
            // 1. Top-Left zone
            AUTO_RIPPLES.push([
                0.4,
                0.1 + Math.random() * 0.2,
                0.15 + Math.random() * 0.2
            ]);
            // 2. Top-Right zone
            AUTO_RIPPLES.push([
                0.6,
                0.7 + Math.random() * 0.2,
                0.15 + Math.random() * 0.2
            ]);
            // 3. Bottom-Center zone
            AUTO_RIPPLES.push([
                0.5,
                0.3 + Math.random() * 0.4,
                0.75 + Math.random() * 0.2
            ]);
        }
    })();

    // =========================================================================
    // CANVAS + WebGL SETUP
    // =========================================================================
    const canvas = document.getElementById('ripple-canvas');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

    // Adaptive highlight intensity for mobile
    let highlightFactor = 120.0;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Reduce intensity on mobile (< 768px approx)
        if (window.innerWidth < 768) {
            highlightFactor = 50.0; // Much lower for small screens
        } else {
            highlightFactor = 120.0;
        }
    }
    resize();
    window.addEventListener('resize', resize);

    // =========================================================================
    // SHADERS
    // =========================================================================
    const vertSrc = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragSrc = `
        precision highp float;
        varying vec2 v_uv;

        uniform float u_time;
        uniform vec2 u_resolution;
        uniform float u_intensity; // New uniform for highlight strength
        uniform vec4 u_ripples[${MAX_RIPPLES}];  // x, y, birthTime, strength
        uniform int u_rippleCount;

        // Compute ripple height at a point from a single source
        // uv and src are in aspect-corrected coordinates (x scaled by aspect)
        float rippleFrom(vec2 uv, vec2 src, float age, float strength) {
            float dist = length(uv - src);
            float speed = 0.30;
            float waveR = age * speed;
            float ringDist = abs(dist - waveR);
            
            // Reduced amplitude slightly and increased distance decay
            float amp = 0.015 * strength 
                      * exp(-age * 0.05)      
                      * exp(-ringDist * 10.0) 
                      * exp(-dist * 0.15);
            return amp * sin(dist * 25.0 - age * 7.5);
        }

        // Get total ripple height including boundary reflections
        float getHeight(vec2 uv, float aspect) {
            float h = 0.0;
            float reflCoeff = 0.4; // Stronger reflections again (0.3 -> 0.4)

            // Boundaries in aspect-corrected space
            float left = 0.0;
            float right = aspect;
            float top = 1.0;
            float bottom = 0.0;

            for (int i = 0; i < ${MAX_RIPPLES}; i++) {
                if (i >= u_rippleCount) break;

                // Scale source x by aspect to match uv space
                vec2 src = u_ripples[i].xy;
                src.x *= aspect;

                float birthTime = u_ripples[i].z;
                float strength = u_ripples[i].w;
                float age = u_time - birthTime;
                if (age < 0.0 || age > 30.0) continue;

                // Direct wave
                h += rippleFrom(uv, src, age, strength);

                // Boundary reflections (mirror sources)
                float rs = strength * reflCoeff;
                h += rippleFrom(uv, vec2(2.0 * right - src.x, src.y), age, rs);  // Right wall reflection
                h += rippleFrom(uv, vec2(2.0 * left - src.x, src.y), age, rs);   // Left wall reflection
                h += rippleFrom(uv, vec2(src.x, 2.0 * top - src.y), age, rs);    // Top wall reflection
                h += rippleFrom(uv, vec2(src.x, 2.0 * bottom - src.y), age, rs); // Bottom wall reflection
            }
            return h;
        }

        void main() {
            vec2 uv = v_uv;
            float aspect = u_resolution.x / u_resolution.y;

            // Aspect-corrected UV for ripple calculation
            vec2 ruv = vec2(uv.x * aspect, uv.y);

            // Sample heights for gradient (normal approximation)
            float eps = 0.002;
            float hC = getHeight(ruv, aspect);
            float hR = getHeight(vec2(ruv.x + eps, ruv.y), aspect);
            float hU = getHeight(vec2(ruv.x, ruv.y + eps), aspect);

            // ... (rest of main) ...

            // Gradient (surface normal in 2D)
            float dx = (hR - hC) / eps;
            float dy = (hU - hC) / eps;

            // Refraction distortion strength
            float distortStr = 8.0;

            // Ring highlight: bright where the ripple ring passes
            float highlight = abs(hC) * u_intensity;
            highlight = pow(min(highlight, 1.0), 1.5);

            // Subtle refraction lines (caustic-like)
            float caustic = pow(abs(dx * dy) * u_intensity * 4.0, 0.8);
            caustic = min(caustic, 0.3);

            // Final color: mostly transparent with highlight and slight tint
            float alpha = highlight * 0.35 + caustic * 0.2;

            // Ripple ring color — subtle blue-white
            vec3 ringColor = mix(
                vec3(0.7, 0.85, 1.0),   // Light blue
                vec3(1.0, 1.0, 1.0),     // White
                highlight
            );

            // Add slight distortion effect via color shift
            float distortion = length(vec2(dx, dy)) * distortStr;
            ringColor += vec3(0.1, 0.15, 0.25) * distortion;

            gl_FragColor = vec4(ringColor, alpha);
        }
    `;

    // =========================================================================
    // COMPILE SHADERS & LINK PROGRAM
    // =========================================================================
    function compileShader(src, type) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error('Shader error:', gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    }

    const vs = compileShader(vertSrc, gl.VERTEX_SHADER);
    const fs = compileShader(fragSrc, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, 1, 1
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uIntensity = gl.getUniformLocation(program, 'u_intensity');
    const uRippleCount = gl.getUniformLocation(program, 'u_rippleCount');
    const uRipples = [];
    for (let i = 0; i < MAX_RIPPLES; i++) {
        uRipples.push(gl.getUniformLocation(program, `u_ripples[${i}]`));
    }

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // =========================================================================
    // RIPPLE STATE
    // =========================================================================
    const ripples = []; // { x, y, time, strength }

    function addRipple(x, y, time, strength) {
        ripples.push({ x, y, time, strength: strength || 1.0 });
        if (ripples.length > MAX_RIPPLES) ripples.shift();
    }

    // =========================================================================
    // MOUSE / TOUCH INTERACTION
    // =========================================================================
    let lastMouseTime = 0;
    const MOUSE_INTERVAL = 250;

    function onPointerMove(e) {
        const now = performance.now();
        if (now - lastMouseTime < MOUSE_INTERVAL) return;
        if (!startTime) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Normalize to 0-1 range (y inverted for WebGL)
        const nx = clientX / window.innerWidth;
        const ny = 1.0 - clientY / window.innerHeight;

        const elapsed = (now - startTime) / 1000;
        addRipple(nx, ny, elapsed, 0.8);
        lastMouseTime = now;
    }

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    // Click/tap creates a stronger ripple
    function onPointerDown(e) {
        if (!startTime) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const nx = clientX / window.innerWidth;
        const ny = 1.0 - clientY / window.innerHeight;
        const elapsed = (performance.now() - startTime) / 1000;
        addRipple(nx, ny, elapsed, 1.2);
    }

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('touchstart', onPointerDown, { passive: true });

    // =========================================================================
    // TEXT TRIGGERS
    // =========================================================================
    let textTriggered = false;
    let subtitleTriggered = false;

    // =========================================================================
    // ANIMATION LOOP
    // =========================================================================
    let startTime = null;
    let autoRippleIndex = 0;

    function animate(now) {
        if (!startTime) startTime = now;
        const elapsed = (now - startTime) / 1000;

        // Auto-trigger ripples based on schedule
        while (autoRippleIndex < AUTO_RIPPLES.length && elapsed >= AUTO_RIPPLES[autoRippleIndex][0]) {
            const [t, x, y] = AUTO_RIPPLES[autoRippleIndex];
            addRipple(x, y, t, 1.0);
            autoRippleIndex++;
        }

        // Text trigger
        if (!textTriggered && elapsed >= TEXT_DELAY) {
            textTriggered = true;
            const logoEl = document.getElementById('logo-text');
            if (logoEl) logoEl.classList.add('active');
        }

        if (!subtitleTriggered && elapsed >= SUBTITLE_DELAY) {
            subtitleTriggered = true;
            const fadeEl = document.getElementById('fade-text');
            if (fadeEl) fadeEl.classList.add('active');
        }

        // Clear with transparent
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Update uniforms
        gl.uniform1f(uTime, elapsed);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uIntensity, highlightFactor);
        gl.uniform1i(uRippleCount, ripples.length);

        for (let i = 0; i < MAX_RIPPLES; i++) {
            if (i < ripples.length) {
                const r = ripples[i];
                gl.uniform4f(uRipples[i], r.x, r.y, r.time, r.strength);
            } else {
                gl.uniform4f(uRipples[i], 0, 0, -100, 0);
            }
        }

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

})();
