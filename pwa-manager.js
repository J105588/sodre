/**
 * PWA Manager - Redesigned
 * Optimistic UI: Buttons are always active.
 * Click -> Native Prompt (if available) OR Manual Instructions.
 */

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.newWorker = null;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        // Bind methods
        this.triggerInstall = this.triggerInstall.bind(this);
        this.handleBeforeInstallPrompt = this.handleBeforeInstallPrompt.bind(this);
        this.handleAppInstalled = this.handleAppInstalled.bind(this);

        this.init();
    }

    init() {
        // 1. Standalone Redirect
        this.handleStandaloneRedirect();

        // 2. Setup Listeners
        window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', this.handleAppInstalled);

        // Check for early event captured in app.html
        if (window.deferredPWAEvent) {
            console.log('[PWA] Found early captured event');
            this.handleBeforeInstallPrompt(window.deferredPWAEvent);
            window.deferredPWAEvent = null;
        }

        // 3. Bind Button Clicks (Optimistic - always clickable)
        this.setupButtons();

        // 4. Service Worker
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }

        // 5. Check Version
        this.checkManifestVersion();

        // 6. Inject Styles
        this.injectStyles();
    }

    // --- 1. Standalone ---
    handleStandaloneRedirect() {
        if (this.isStandalone) {
            if (!sessionStorage.getItem('pwa_session_active')) {
                sessionStorage.setItem('pwa_session_active', 'true');
                if (!window.location.pathname.endsWith('/login.html')) {
                    window.location.replace('login.html');
                }
            }
        }
    }

    // --- 2. Install Logic ---
    setupButtons() {
        const btns = document.querySelectorAll('.btn-install-trigger');
        btns.forEach(btn => {
            btn.onclick = this.triggerInstall;
            btn.disabled = false; // Ensure enabled
        });
    }

    handleBeforeInstallPrompt(e) {
        e.preventDefault();
        this.deferredPrompt = e;
        console.log('[PWA] beforeinstallprompt fired. Ready for native prompt.');
        // Optionally pulse the buttons to indicate readiness
        const btns = document.querySelectorAll('.btn-install-trigger');
        btns.forEach(btn => btn.classList.add('pulse-animation'));
    }

    async triggerInstall() {
        console.log('[PWA] Triggering install flow...');
        try {
            if (this.deferredPrompt) {
                // Native Flow
                console.log('[PWA] Using native prompt.');
                await this.deferredPrompt.prompt();
                const choiceResult = await this.deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    console.log('[PWA] User accepted prompt');
                } else {
                    console.log('[PWA] User dismissed prompt');
                }
                this.deferredPrompt = null;
            } else {
                // Fallback / Manual Flow
                console.warn('[PWA] No deferred prompt available. This could mean:\n' +
                    '1. The app is already installed.\n' +
                    '2. The browser does not support A2HS.\n' +
                    '3. The browser has not yet fired beforeinstallprompt (checking requirements).\n' +
                    'Showing manual instructions.');
                this.showManualInstallModal();
            }
        } catch (error) {
            console.error('[PWA] Install trigger error:', error);
            this.showManualInstallModal();
        }
    }

    handleAppInstalled() {
        console.log('[PWA] App Installed');
        this.deferredPrompt = null;
        const btns = document.querySelectorAll('.btn-install-trigger');
        btns.forEach(btn => {
            btn.innerHTML = '<i class="fas fa-check"></i> インストール完了';
            btn.classList.remove('pulse-animation');
            btn.disabled = true;
        });
        this.closeManualInstallModal();

        // Force redirect to login.html after install
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000); // 1 second delay to show "Completed" state
    }

    // --- 3. Service Worker ---
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => {
                        console.log('[PWA] SW registered. Scope:', reg.scope);

                        // Check for updates immediately
                        reg.update();

                        if (reg.waiting) {
                            console.log('[PWA] SW waiting. Showing update modal.');
                            this.newWorker = reg.waiting;
                            this.showUpdateModal();
                        }

                        reg.addEventListener('updatefound', () => {
                            this.newWorker = reg.installing;
                            console.log('[PWA] New SW installing...');
                            this.newWorker.addEventListener('statechange', () => {
                                if (this.newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[PWA] New SW installed. Showing update modal.');
                                    this.showUpdateModal();
                                }
                            });
                        });
                    })
                    .catch(err => console.error('[PWA] SW Reg Failed:', err));
            });

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                console.log('[PWA] Controller changed. Hard reloading...');
                // Force reload from server, bypassing browser cache
                window.location.reload(true);
                refreshing = true;
            });
        }
    }

    // --- 4. Update Logic ---
    showUpdateModal() {
        if (document.getElementById('pwa-update-modal')) return;
        const modalHTML = `
        <div id="pwa-update-modal">
            <div class="modal-content">
                <h3>更新があります</h3>
                <p>アップデートが配信されました。</p>
                <button id="pwa-update-btn">更新する</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('pwa-update-btn').onclick = () => {
            if (this.newWorker) this.newWorker.postMessage({ type: 'SKIP_WAITING' });
        };
    }

    async checkManifestVersion() {
        try {
            const res = await fetch('/manifest.json?t=' + Date.now());
            if (!res.ok) return;
            const data = await res.json();
            const serverVer = data.version;
            if (!serverVer) return;
            const localVer = localStorage.getItem('app_version');
            if (!localVer) {
                localStorage.setItem('app_version', serverVer);
                return;
            }
            if (serverVer > localVer) {
                this.showForcedUpdateModal();
                localStorage.setItem('app_version', serverVer);
            }
        } catch (e) {
            console.error(e);
        }
    }

    showForcedUpdateModal() {
        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: '999999',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontFamily: 'sans-serif'
        });

        modal.innerHTML = `
            <div style="background:white; color:#333; padding:30px; border-radius:12px; max-width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.5); text-align:center;">
                <div style="font-size:3rem; margin-bottom:10px;">⚠️</div>
                <h2 style="margin-top:0; color:#145ab4;">アプリの更新が必要です</h2>
                <p style="margin:20px 0; line-height:1.6;">新しいバージョンが公開されました。<br>ご利用を続けるには、アプリの再インストールが必要です。</p>
                <button id="go-to-update-btn" style="background:#145ab4; color:white; border:none; padding:12px 24px; font-size:1rem; border-radius:30px; cursor:pointer; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                    更新手順へ進む
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        document.getElementById('go-to-update-btn').onclick = () => {
            window.location.href = 'update.html'; // Assuming update.html exists, or redirect to a help page
        };
    }

    // --- 5. UI Helpers ---
    injectStyles() {
        const css = `
        #pwa-update-modal {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.85); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
        }
        #pwa-update-modal .modal-content {
            background-color: #fff; padding: 2rem; border-radius: 12px;
            text-align: center; max-width: 90%; width: 360px;
        }
        #pwa-update-btn {
            background-color: #007bff; color: white; border: none;
            padding: 12px 24px; font-size: 1rem; border-radius: 50px;
            cursor: pointer; width: 100%; margin-top: 1rem;
        }
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 4px 10px rgba(0, 123, 255, 0.3); }
            50% { transform: scale(1.05); box-shadow: 0 4px 20px rgba(0, 123, 255, 0.5); }
            100% { transform: scale(1); box-shadow: 0 4px 10px rgba(0, 123, 255, 0.3); }
        }
        .pulse-animation {
            animation: pulse 2s infinite;
        }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    showManualInstallModal() {
        // Force modal show by directly manipulating DOM if needed, 
        // but assume existing CSS handles #manual-install-modal
        const modal = document.getElementById('manual-install-modal');
        if (modal) {
            modal.style.display = 'block';
            // Ensure it's on top and visible
            modal.style.opacity = '1';
        } else {
            alert('インストール手順：\nブラウザのメニューから「アプリをインストール」を選択してください。');
        }
    }

    closeManualInstallModal() {
        const modal = document.getElementById('manual-install-modal');
        if (modal) modal.style.display = 'none';
    }
}

window.pwaManager = new PWAManager();
window.closeInstallModal = () => window.pwaManager.closeManualInstallModal();
