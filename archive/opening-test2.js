/**
 * SoDRé Experimental Water Opening Animation
 * 
 * Three.js + Custom GLSL shaders
 * - 3D water surface with physics-based wave simulation
 * - Falling water droplet with splash
 * - SoDRé text reflection on rippling water
 * - Aurora background (white + conic-gradient, matching current opening)
 */
(function () {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    const WATER_Y = -0.2;           // Water plane Y position
    const WATER_SIZE = 50;           // Water mesh size
    const WATER_SEGMENTS = 256;      // Mesh resolution
    const CAM_HEIGHT = 3.5;
    const CAM_DIST = 5.5;
    const CAM_LOOK_Y = -0.5;

    const TIMELINE = {
        DROP_START: 1.0,
        DROP_DURATION: 1.2,
        DROP_IMPACT: 2.2,
        TEXT_START: 2.3,
        SUBTITLE_START: 4.3,
        END: 10.0,
    };

    // =========================================================================
    // THREE.JS SETUP — transparent so aurora background shows through
    // =========================================================================
    const container = document.getElementById('three-container');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // No scene.background — let CSS aurora show through

    // Camera angled down to see more water surface
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, CAM_HEIGHT, CAM_DIST);
    camera.lookAt(0, CAM_LOOK_Y, 0);

    // =========================================================================
    // LIGHTING — brighter for light background
    // =========================================================================
    const ambientLight = new THREE.AmbientLight(0x88aacc, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(3, 8, 5);
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0x88bbff, 0.5);
    dirLight2.position.set(-5, 4, -3);
    scene.add(dirLight2);

    const pointLight1 = new THREE.PointLight(0x145ab4, 1.8, 25);
    pointLight1.position.set(-3, 2, 2);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xfab43c, 1.0, 20);
    pointLight2.position.set(4, 1.5, -1);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x3c7800, 0.8, 15);
    pointLight3.position.set(0, 1, -4);
    scene.add(pointLight3);

    // =========================================================================
    // TEXT REFLECTION TEXTURE
    // =========================================================================
    let textTexture = null;

    function createTextReflectionTexture() {
        const w = 1024;
        const h = 512;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const ctx = offCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        const fontSize = Math.min(w * 0.15, h * 0.6);
        const letters = ['S', 'o', 'D', 'R', 'é'];
        const colors = ['#fab43c', '#1a4a7c', '#145ab4', '#3c7800', '#1a4a7c'];

        ctx.font = `700 ${fontSize}px "Shippori Mincho", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let totalWidth = 0;
        const widths = letters.map(l => {
            const m = ctx.measureText(l);
            totalWidth += m.width;
            return m.width;
        });

        let x = (w - totalWidth) / 2;
        const y = h / 2;

        letters.forEach((letter, i) => {
            ctx.shadowColor = colors[i];
            ctx.shadowBlur = 25;
            ctx.fillStyle = colors[i];
            ctx.fillText(letter, x + widths[i] / 2, y);
            x += widths[i];
        });
        ctx.shadowBlur = 0;

        if (!textTexture) {
            textTexture = new THREE.CanvasTexture(offCanvas);
            textTexture.wrapS = THREE.ClampToEdgeWrapping;
            textTexture.wrapT = THREE.ClampToEdgeWrapping;
        } else {
            textTexture.image = offCanvas;
        }
        textTexture.needsUpdate = true;
    }

    // =========================================================================
    // WATER SHADER MATERIAL
    // =========================================================================
    const waterVertexShader = `
        uniform float u_time;
        uniform vec4 u_ripples[8];
        uniform int u_rippleCount;

        varying vec3 v_worldPos;
        varying vec3 v_normal;
        varying vec2 v_uv;

        // Simplex-style noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                              -0.577350269189626, 0.024390243902439);
            vec2 i = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m * m;
            m = m * m;
            vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x_) - 0.5;
            vec3 ox = floor(x_ + 0.5);
            vec3 a0 = x_ - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            vec3 g;
            g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        // Helper: compute wave contribution from a single source
        float rippleWave(vec2 posXZ, vec2 rpos, float age, float str) {
            float dist = length(posXZ - rpos);
            float speed = 2.5;
            float waveR = age * speed;
            float ringDist = abs(dist - waveR);
            float amp = 0.18 * str * exp(-age * 0.28) * exp(-ringDist * 1.8) * exp(-dist * 0.08);
            return amp * sin(dist * 4.0 - age * 10.0);
        }

        float getWaveHeight(vec3 pos) {
            float t = u_time;
            float h = 0.0;

            // Wave activation mask: waves only exist where the ripple has reached
            // Impact at (0,0) at t=2.2s. Speed approx 2.5 units/s.
            float impactT = 2.2;
            float waveSpeed = 2.5;
            float distFromCenter = length(pos.xz);
            float waveFront = max(0.0, (t - impactT) * waveSpeed);
            
            // Smooth transition at the wavefront
            float calm = smoothstep(waveFront + 1.0, waveFront - 2.0, distFromCenter);
            
            // Time-based decay: waves should settle down after the impact
            // Decay faster to return to initial calm state by t=10
            if (t > impactT) {
                float timeSinceImpact = t - impactT;
                // Faster decay: reaches ~0.05 at 6s post-impact (t=8.2s)
                float settle = exp(-timeSinceImpact * 0.5); 
                calm *= settle;
            } else {
                calm = 0.0;
            }

            // Large slow swells (reduced amplitude)
            h += sin(pos.x * 0.35 + t * 0.5) * 0.07 * calm;
            h += sin(pos.z * 0.25 + t * 0.35 + 1.0) * 0.06 * calm;
            h += sin(pos.x * 0.15 - pos.z * 0.25 + t * 0.4) * 0.05 * calm;

            // Medium waves (reduced)
            h += sin(pos.x * 1.0 + t * 1.1) * 0.025 * calm;
            h += sin(pos.z * 1.3 - t * 0.9 + pos.x * 0.3) * 0.02 * calm;
            h += sin(pos.x * 0.6 + pos.z * 0.9 + t * 1.3) * 0.015 * calm;

            // Detailed surface ripples (reduced)
            h += snoise(pos.xz * 1.2 + t * 0.4) * 0.02 * calm;
            h += snoise(pos.xz * 2.5 - t * 0.6) * 0.01 * calm;
            h += snoise(pos.xz * 5.0 + t * 0.8) * 0.005 * calm;

            // Ripple contributions from impacts + boundary reflections
            vec2 bnd = vec2(7.0, 7.0); // boundary edges (x=±7, z=±7)
            float reflCoeff = 0.4;     // energy loss on reflection

            for (int i = 0; i < 8; i++) {
                if (i >= u_rippleCount) break;
                float rtime = u_ripples[i].z;
                float age = t - rtime;
                if (age < 0.0 || age > 10.0) continue;

                float strength = u_ripples[i].w;
                vec2 rpos = u_ripples[i].xy;

                // Direct wave
                h += rippleWave(pos.xz, rpos, age, strength);

                // Boundary reflections via mirror sources (weaker)
                float rs = strength * reflCoeff;
                h += rippleWave(pos.xz, vec2( 2.0*bnd.x - rpos.x, rpos.y), age, rs); // Right
                h += rippleWave(pos.xz, vec2(-2.0*bnd.x - rpos.x, rpos.y), age, rs); // Left
                h += rippleWave(pos.xz, vec2(rpos.x,  2.0*bnd.y - rpos.y), age, rs); // Near
                h += rippleWave(pos.xz, vec2(rpos.x, -2.0*bnd.y - rpos.y), age, rs); // Far
            }

            return h;
        }

        void main() {
            v_uv = uv;
            vec3 pos = position;
            pos.y += getWaveHeight(pos);

            // Compute normal
            float eps = 0.1;
            vec3 posR = vec3(position.x + eps, position.y, position.z);
            posR.y += getWaveHeight(posR);
            vec3 posF = vec3(position.x, position.y, position.z + eps);
            posF.y += getWaveHeight(posF);

            vec3 tangent = normalize(posR - pos);
            vec3 bitangent = normalize(posF - pos);
            v_normal = normalize(cross(bitangent, tangent));

            v_worldPos = pos;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    const waterFragmentShader = `
        precision highp float;

        uniform float u_time;
        uniform vec3 u_cameraPos;
        uniform sampler2D u_textTexture;
        uniform float u_hasText;
        uniform float u_textOpacity;

        varying vec3 v_worldPos;
        varying vec3 v_normal;
        varying vec2 v_uv;

        float fresnel(vec3 viewDir, vec3 normal, float power) {
            return pow(1.0 - max(dot(viewDir, normal), 0.0), power);
        }

        void main() {
            vec3 normal = normalize(v_normal);
            vec3 viewDir = normalize(u_cameraPos - v_worldPos);

            float fres = fresnel(viewDir, normal, 3.5);

            // Water body color — vibrant blue, visible on light background
            vec3 shallowColor = vec3(0.15, 0.50, 0.80);  // Vivid blue
            vec3 deepColor = vec3(0.05, 0.20, 0.50);      // Deep blue 
            vec3 surfaceColor = vec3(0.25, 0.60, 0.90);    // Bright surface

            float depth = clamp(length(v_worldPos.xz) * 0.04, 0.0, 1.0);
            vec3 bodyColor = mix(shallowColor, deepColor, depth);

            // Reflection direction
            vec3 reflDir = reflect(-viewDir, normal);

            // Sky reflection — pick up the aurora tones
            float skyGrad = max(reflDir.y, 0.0);
            vec3 skyColor = mix(
                vec3(0.85, 0.90, 0.95),  // Near-white
                vec3(0.95, 0.95, 1.0),   // White
                skyGrad
            );
            // Add aurora color tints to reflection
            skyColor += vec3(0.05, 0.08, 0.15) * sin(u_time * 0.3 + reflDir.x * 2.0);
            skyColor += vec3(0.1, 0.06, 0.0) * sin(u_time * 0.2 + reflDir.z * 3.0 + 1.5);

            // Text reflection
            vec3 reflColor = skyColor;
            if (u_hasText > 0.5) {
                float textPlaneY = 3.5;
                if (reflDir.y > 0.01) {
                    float t = (textPlaneY - v_worldPos.y) / reflDir.y;
                    vec3 hitPoint = v_worldPos + reflDir * t;

                    float texU = hitPoint.x / 8.0 + 0.5;
                    float texV = hitPoint.z / 4.0 + 0.5;

                    // Wave distortion on reflection (subtle for clarity)
                    texU += normal.x * 0.03;
                    texV += normal.z * 0.03;

                    if (texU > 0.0 && texU < 1.0 && texV > 0.0 && texV < 1.0) {
                        vec4 texSample = texture2D(u_textTexture, vec2(texU, texV));
                        if (texSample.a > 0.01) {
                            float textAlpha = texSample.a * u_textOpacity * 0.95;
                            reflColor = mix(reflColor, texSample.rgb * 1.8, textAlpha);
                        }
                    }
                }
            }

            // Combine body + reflection with Fresnel
            vec3 color = mix(bodyColor, reflColor, fres * 0.75 + 0.2);

            // Strong specular highlights — make water sparkle
            vec3 lightDir1 = normalize(vec3(3.0, 8.0, 5.0));
            vec3 halfVec1 = normalize(lightDir1 + viewDir);
            float spec1 = pow(max(dot(normal, halfVec1), 0.0), 256.0);
            color += vec3(1.0, 0.98, 0.9) * spec1 * 0.8;

            vec3 lightDir2 = normalize(vec3(-4.0, 6.0, -2.0));
            vec3 halfVec2 = normalize(lightDir2 + viewDir);
            float spec2 = pow(max(dot(normal, halfVec2), 0.0), 128.0);
            color += vec3(0.9, 0.85, 0.7) * spec2 * 0.35;

            // Broader diffuse-like specular for overall brightness
            vec3 lightDir3 = normalize(vec3(0.0, 5.0, 3.0));
            vec3 halfVec3 = normalize(lightDir3 + viewDir);
            float spec3 = pow(max(dot(normal, halfVec3), 0.0), 16.0);
            color += vec3(0.15, 0.25, 0.4) * spec3 * 0.3;

            // Sub-surface scattering — blue-green glow at glancing angles
            float sss = pow(max(dot(viewDir, -normal), 0.0), 2.5);
            color += vec3(0.05, 0.15, 0.25) * sss * 0.5;

            // Caustic shimmer (suppressed when calm)
            float impactT = 2.2;
            float calm = smoothstep(0.0, 2.5, u_time - impactT);
            
            float shimmer = sin(v_worldPos.x * 10.0 + u_time * 2.0)
                          * sin(v_worldPos.z * 8.0 - u_time * 1.5) * 0.5 + 0.5;
            shimmer = pow(shimmer, 3.0);
            color += vec3(0.08, 0.12, 0.18) * shimmer * 0.25 * calm;

            // Edge transparency — water fades at distant edges
            float edgeFade = 1.0 - smoothstep(8.0, 18.0, length(v_worldPos.xz));
            float alpha = mix(0.6, 0.92, fres) * edgeFade;

            gl_FragColor = vec4(color, alpha);
        }
    `;

    // Create water mesh
    const waterGeom = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
    waterGeom.rotateX(-Math.PI / 2);

    const waterUniforms = {
        u_time: { value: 0 },
        u_cameraPos: { value: camera.position.clone() },
        u_ripples: { value: new Array(8).fill(null).map(() => new THREE.Vector4(0, 0, -100, 1.0)) },
        u_rippleCount: { value: 0 },
        u_textTexture: { value: null },
        u_hasText: { value: 0 },
        u_textOpacity: { value: 0 },
    };

    const waterMaterial = new THREE.ShaderMaterial({
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        uniforms: waterUniforms,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const waterMesh = new THREE.Mesh(waterGeom, waterMaterial);
    waterMesh.position.y = WATER_Y;
    scene.add(waterMesh);

    // =========================================================================
    // WATER DROPLET
    // =========================================================================
    const dropletGroup = new THREE.Group();
    dropletGroup.visible = false;

    const dropGeom = new THREE.SphereGeometry(0.1, 32, 32);
    const dropMat = new THREE.MeshPhongMaterial({
        color: 0x4499dd,
        specular: 0xffffff,
        shininess: 200,
        transparent: true,
        opacity: 0.8,
    });
    const dropMesh = new THREE.Mesh(dropGeom, dropMat);
    dropletGroup.add(dropMesh);

    // Teardrop tail
    const tailGeom = new THREE.SphereGeometry(0.05, 16, 16);
    tailGeom.scale(1, 3.5, 1);
    const tailMat = dropMat.clone();
    tailMat.opacity = 0.4;
    const tailMesh = new THREE.Mesh(tailGeom, tailMat);
    tailMesh.position.y = 0.25;
    dropletGroup.add(tailMesh);

    scene.add(dropletGroup);

    // =========================================================================
    // SPLASH PARTICLES
    // =========================================================================
    const splashParticles = [];
    const splashGeom = new THREE.SphereGeometry(0.03, 8, 8);
    const splashBaseMat = new THREE.MeshPhongMaterial({
        color: 0x88ccee,
        specular: 0xffffff,
        shininess: 150,
        transparent: true,
        opacity: 0.75,
    });

    function createSplash(x, z, time) {
        for (let i = 0; i < 25; i++) {
            const mesh = new THREE.Mesh(splashGeom, splashBaseMat.clone());
            const angle = (i / 25) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 1.2 + Math.random() * 3.5;
            const upSpeed = 3.0 + Math.random() * 4.5;
            mesh.position.set(x, WATER_Y + 0.15, z);
            scene.add(mesh);
            splashParticles.push({
                mesh,
                vx: Math.cos(angle) * speed,
                vy: upSpeed,
                vz: Math.sin(angle) * speed,
                birthTime: time,
                life: 1.4 + Math.random() * 0.8,
            });
        }
    }

    // =========================================================================
    // RIPPLE SYSTEM
    // =========================================================================
    const ripples = [];

    function addRipple(x, z, t, strength = 1.0) {
        ripples.push(new THREE.Vector4(x, z, t, strength));
        if (ripples.length > 8) ripples.shift();
        for (let i = 0; i < 8; i++) {
            if (i < ripples.length) {
                waterUniforms.u_ripples.value[i].copy(ripples[i]);
            } else {
                waterUniforms.u_ripples.value[i].set(0, 0, -100, 0);
            }
        }
        waterUniforms.u_rippleCount.value = ripples.length;
    }

    // =========================================================================
    // ANIMATION STATE
    // =========================================================================
    let startTime = null;
    let dropletPhase = 0;
    let textTriggered = false;

    // =========================================================================
    // RESIZE
    // =========================================================================
    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // =========================================================================
    // MOUSE / TOUCH INTERACTION — ripples follow cursor on water surface
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
    let lastMouseRippleTime = 0;
    const MOUSE_RIPPLE_INTERVAL = 200; // ms between mouse ripples

    function onPointerMove(e) {
        const now = performance.now();
        if (now - lastMouseRippleTime < MOUSE_RIPPLE_INTERVAL) return;
        if (startTime === null) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hitPoint = new THREE.Vector3();
        const hit = raycaster.ray.intersectPlane(waterPlane, hitPoint);

        if (hit) {
            const elapsed = (now - startTime) / 1000;
            addRipple(hitPoint.x, hitPoint.z, elapsed);
            lastMouseRippleTime = now;
        }
    }

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    // =========================================================================
    // MAIN ANIMATION LOOP
    // =========================================================================
    function animate(now) {
        if (startTime === null) startTime = now;
        const elapsed = (now - startTime) / 1000;

        waterUniforms.u_time.value = elapsed;
        waterUniforms.u_cameraPos.value.copy(camera.position);

        // Subtle camera sway
        camera.position.x = Math.sin(elapsed * 0.15) * 0.4;
        camera.position.y = CAM_HEIGHT + Math.sin(elapsed * 0.2) * 0.15;
        camera.lookAt(0, CAM_LOOK_Y, 0);

        // --- Droplet ---
        if (elapsed >= TIMELINE.DROP_START && dropletPhase === 0) {
            dropletPhase = 1;
            dropletGroup.visible = true;
        }

        if (dropletPhase === 1) {
            const dropProgress = (elapsed - TIMELINE.DROP_START) / TIMELINE.DROP_DURATION;
            if (dropProgress >= 1.0) {
                dropletPhase = 2;
                dropletGroup.visible = false;

                // Add main ripples (shader handles edge reflections automatically)
                addRipple(0, 0, elapsed);
                setTimeout(() => addRipple(0.8, 0.5, (performance.now() - startTime) / 1000), 150);
                setTimeout(() => addRipple(-0.7, -0.4, (performance.now() - startTime) / 1000), 280);
                setTimeout(() => addRipple(0.4, -0.8, (performance.now() - startTime) / 1000), 400);

                createSplash(0, 0, elapsed);
            } else {
                const easeIn = dropProgress * dropProgress;
                const startY = 5.0;
                const endY = WATER_Y + 0.15;
                dropletGroup.position.set(0, startY - easeIn * (startY - endY), 0);
                tailMesh.scale.y = 1.0 + dropProgress * 2.5;
                tailMesh.position.y = 0.12 + dropProgress * 0.35;
            }
        }

        // --- Splash ---
        for (let i = splashParticles.length - 1; i >= 0; i--) {
            const p = splashParticles[i];
            const age = elapsed - p.birthTime;
            if (age > p.life) {
                scene.remove(p.mesh);
                splashParticles.splice(i, 1);
                continue;
            }
            const dt = 0.016;
            p.vy -= 9.8 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.mesh.material.opacity = 0.75 * (1.0 - age / p.life);

            if (p.mesh.position.y < WATER_Y - 0.3) {
                scene.remove(p.mesh);
                splashParticles.splice(i, 1);
            }
        }

        // --- Text ---
        if (!textTriggered && elapsed >= TIMELINE.TEXT_START) {
            textTriggered = true;
            const logoEl = document.getElementById('logo-text');
            if (logoEl) logoEl.classList.add('active');

            setTimeout(() => {
                createTextReflectionTexture();
                waterUniforms.u_textTexture.value = textTexture;
                waterUniforms.u_hasText.value = 1.0;
            }, 300);

            setTimeout(() => {
                const fadeEl = document.getElementById('fade-text');
                if (fadeEl) fadeEl.classList.add('active');
            }, (TIMELINE.SUBTITLE_START - TIMELINE.TEXT_START) * 1000);
        }

        // Text reflection fade-in
        if (waterUniforms.u_hasText.value > 0.5) {
            const textAge = elapsed - TIMELINE.TEXT_START - 0.3;
            waterUniforms.u_textOpacity.value = Math.min(Math.max(textAge / 0.8, 0), 1.0);
        }

        // Animate lights
        pointLight1.position.x = -3 + Math.sin(elapsed * 0.3) * 2.0;
        pointLight1.position.z = 2 + Math.cos(elapsed * 0.2) * 1.5;
        pointLight2.position.x = 4 + Math.cos(elapsed * 0.25) * 1.5;
        pointLight3.position.z = -4 + Math.sin(elapsed * 0.15) * 2.0;

        renderer.render(scene, camera);

        if (elapsed >= TIMELINE.END) {
            setTimeout(() => location.reload(), 1500);
        } else {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);

})();
