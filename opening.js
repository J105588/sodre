/**
 * SoDRé Artistic Opening Animation
 * Canvas2D staff lines (reliable) + WebGL notes (No Clefs)
 */
(function () {
    function init() {
        // Skip if already visited (unless in Test Mode)
        if (!window.isOpeningTest && sessionStorage.getItem('hasTakenIntro')) {
            const overlay = document.getElementById('opening-overlay');
            if (overlay) overlay.style.display = 'none';
            if (window.triggerHeroAnimations) triggerHeroAnimations();
            return;
        }

        const container = document.getElementById('webgl-opening');
        if (!container) return; // Wait for container


        // --- Canvas2D for Staff Lines ---
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        function resizeCanvas() {
            canvas.width = window.innerWidth * window.devicePixelRatio;
            canvas.height = window.innerHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        resizeCanvas();

        // --- Three.js for Notes ---
        const scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 10;
        const camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1, 1000
        );
        camera.position.z = 10;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        // --- Animation State ---
        const leftChord = { notes: [], stem: null };
        const rightChord = { notes: [], stem: null };
        let startTime = null;
        const spacing = 0.18; // Compact Staff (User Request: "Shrink staff")
        const BRAND_BLUE = 0x000000; // Black (User Request)

        // --- Note Head Only (no stem) ---
        function createNoteHead(x, lineIndex, xOffset = 0) {
            const group = new THREE.Group();
            const y = (lineIndex - 2) * spacing;

            // Compact Note Dimensions
            const radiusY = 0.08;
            const radiusX = 0.12;

            const shape = new THREE.Shape();
            shape.absellipse(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, 0);
            const hole = new THREE.Path();
            hole.absellipse(0, 0, radiusX * 0.55, radiusY * 0.55, 0, Math.PI * 2, true, 0);
            shape.holes.push(hole);

            const headGeom = new THREE.ShapeGeometry(shape);
            const headMat = new THREE.MeshBasicMaterial({ color: BRAND_BLUE, side: THREE.DoubleSide });
            const head = new THREE.Mesh(headGeom, headMat);
            head.rotation.z = -0.35;
            group.add(head);

            group.position.set(x + xOffset, y, 0);
            group.scale.set(0, 0, 0);
            scene.add(group);
            return group;
        }

        // --- Shared Stem (from So position going down) ---
        function createStem(x, bottomY) {
            const stemHeight = 1.0; // Shorter stem
            const stemGeom = new THREE.PlaneGeometry(0.02, stemHeight); // Thinner stem
            const stemMat = new THREE.MeshBasicMaterial({ color: BRAND_BLUE, side: THREE.DoubleSide });
            const stem = new THREE.Mesh(stemGeom, stemMat);
            stem.position.set(x - 0.08, bottomY - stemHeight / 2, 0);
            stem.scale.set(0, 0, 0);
            scene.add(stem);
            return stem;
        }

        // --- Create Chords ---
        // Responsive BaseX: Fits within screen width
        // Frustum Height = 10. Width = 10 * aspect. Edge = 5 * aspect.
        const noteBaseX = Math.max(2.0, 3.5 * aspect);
        const soY = (1 - 2) * spacing;  // So position (line 1)

        // Left chord: So (center), Do (left), Re (between)
        leftChord.notes.push(createNoteHead(-noteBaseX, 1, 0));        // So - center
        leftChord.notes.push(createNoteHead(-noteBaseX, 2.3, -0.07));  // Do - left
        leftChord.notes.push(createNoteHead(-noteBaseX, 3, -0.035));   // Re - slightly left
        leftChord.stem = createStem(-noteBaseX, soY);

        // Right chord (mirrored offsets)
        rightChord.notes.push(createNoteHead(noteBaseX, 1, 0));
        rightChord.notes.push(createNoteHead(noteBaseX, 2.3, 0.07));
        rightChord.notes.push(createNoteHead(noteBaseX, 3, 0.035));
        rightChord.stem = createStem(noteBaseX, soY);

        // --- No G-Clefs (Removed) ---

        // --- Staff Line Drawing (Canvas2D) ---
        function drawStaffLines(progress) {
            ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);

            const w = window.innerWidth;
            const h = window.innerHeight;
            const centerY = h / 2;
            const lineSpacing = h * 0.018; // Compact Spacing (User Request)

            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;

            for (let i = 0; i < 5; i++) {
                const y = centerY + (i - 2) * lineSpacing;
                const lineDelay = i * 0.08;
                const lineProgress = Math.min(Math.max((progress - lineDelay) / 0.6, 0), 1);

                if (lineProgress > 0) {
                    const eased = easeOutQuad(lineProgress);
                    const drawWidth = w * eased;

                    ctx.beginPath();

                    // Wave effect
                    const waveAmp = 8 * Math.sin(lineProgress * Math.PI) * (1 - lineProgress * 0.7);
                    const segments = 50;

                    for (let j = 0; j <= segments; j++) {
                        const segX = (drawWidth / segments) * j;
                        const waveY = y + Math.sin((j / segments) * Math.PI * 4 + progress * 5) * waveAmp;

                        if (j === 0) {
                            ctx.moveTo(segX, waveY);
                        } else {
                            ctx.lineTo(segX, waveY);
                        }
                    }
                    ctx.stroke();
                }
            }
        }

        // --- Animation ---
        let textTriggered = false;

        function animate(time) {
            if (!startTime) startTime = time;
            const elapsed = time - startTime;
            const totalDuration = 4000; // Faster overall (User Request)
            const progress = Math.min(elapsed / totalDuration, 1);

            // Staff Lines (0-1500ms)
            const staffProgress = Math.min(elapsed / 1500, 1);
            drawStaffLines(staffProgress);

            // Notes (800ms start) - Earlier (User Request)
            const noteStart = 800;
            [leftChord, rightChord].forEach((chord, chordIdx) => {
                const chordDelay = chordIdx * 300;

                // Stem first
                const stemProgress = Math.min(Math.max((elapsed - noteStart - chordDelay) / 350, 0), 1);
                const stemScale = easeOutBack(stemProgress);
                chord.stem.scale.set(stemScale, stemScale, stemScale);

                // Notes bottom to top
                chord.notes.forEach((note, i) => {
                    const noteDelay = chordDelay + 100 + i * 100;
                    const noteProgress = Math.min(Math.max((elapsed - noteStart - noteDelay) / 300, 0), 1);
                    const scale = easeOutBack(noteProgress);
                    note.scale.set(scale, scale, scale);
                });
            });

            // Text (1000ms start) - Immediately after notes (User Request)
            if (!textTriggered && elapsed > 1000) {
                const textContent = document.querySelector('.opening-content');
                if (textContent) textContent.classList.add('active');
                textTriggered = true;
            }

            renderer.render(scene, camera);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (window.isOpeningTest) {
                    // Loop for test page
                    setTimeout(() => location.reload(), 500);
                } else {
                    // Fade out for normal user
                    const overlay = document.getElementById('opening-overlay');
                    if (overlay) {
                        overlay.style.opacity = '0';
                        overlay.style.visibility = 'hidden';
                        setTimeout(() => {
                            overlay.style.display = 'none';
                            document.body.style.overflow = 'auto';
                            if (window.triggerHeroAnimations) triggerHeroAnimations();
                            sessionStorage.setItem('hasTakenIntro', 'true');
                        }, 1500);
                    }
                }
            }
        }

        function easeOutQuad(t) { return t * (2 - t); }
        function easeOutBack(t) {
            const c1 = 1.70158, c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }

        document.body.style.overflow = 'hidden';
        requestAnimationFrame(animate);

        window.addEventListener('resize', () => {
            resizeCanvas();
            const aspect = window.innerWidth / window.innerHeight;
            camera.left = -frustumSize * aspect / 2;
            camera.right = frustumSize * aspect / 2;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // Run immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
