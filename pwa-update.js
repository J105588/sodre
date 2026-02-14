// pwa-update.js - Mandatory Update Modal Implementation

// 1. CSS for the Modal
const modalStyles = `
#pwa-update-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.85);
    z-index: 99999;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}

#pwa-update-modal .modal-content {
    background-color: #fff;
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    max-width: 95%;
    width: 360px; /* Slightly wider */
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}

#pwa-update-modal h3 {
    margin-top: 0;
    color: #333;
    font-size: 1.2rem;
    margin-bottom: 1rem;
    white-space: nowrap; /* Prevent title break */
}

#pwa-update-modal p {
    color: #666;
    margin-bottom: 1.5rem;
    line-height: 1.6;
    word-break: keep-all; /* Prevent awkward Japanese breaks */
    overflow-wrap: break-word;
}

#pwa-update-btn {
    background-color: #007bff; /* Primary Color */
    color: white;
    border: none;
    padding: 12px 24px;
    font-size: 1rem;
    border-radius: 50px;
    cursor: pointer;
    width: 100%;
    font-weight: bold;
    transition: background-color 0.3s;
    white-space: nowrap; /* Prevent button text break */
}

#pwa-update-btn:hover {
    background-color: #0056b3;
}
`;

// 2. Inject CSS
const styleSheet = document.createElement("style");
styleSheet.innerText = modalStyles;
document.head.appendChild(styleSheet);

// 3. Inject HTML
// 3. Inject HTML (Wait for Body)
const modalHTML = `
<div id="pwa-update-modal">
    <div class="modal-content">
        <h3>新しいバージョンが利用可能です</h3>
        <p>最新の機能をご利用いただくため、アップデートが必要です。</p>
        <button id="pwa-update-btn">今すぐアップデート</button>
    </div>
</div>
`;

function injectModal() {
    if (document.getElementById('pwa-update-modal')) return;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Re-attach listener if injection delayed
    const btn = document.getElementById('pwa-update-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            // Logic is below, but we need to ensure newWorker is accessible
            // We'll handle click event delegation or re-attach in the main logic
            window.dispatchEvent(new CustomEvent('pwa-update-clicked'));
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectModal);
} else {
    injectModal();
}

// 4. Logic
if ('serviceWorker' in navigator) {
    let newWorker;

    // Helper to show modal
    function showUpdateModal() {
        const modal = document.getElementById('pwa-update-modal');
        if (modal) modal.style.display = 'flex';
    }

    // Handle Update Click (via Custom Event)
    window.addEventListener('pwa-update-clicked', () => {
        if (newWorker) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    });

    // Check for updates
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW Registered:', reg.scope);

            // Handle updates found
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New update available
                        showUpdateModal();
                    }
                });
            });

            // If we reload and there's already a waiting worker (e.g. from previous visit), show update
            if (reg.waiting) {
                newWorker = reg.waiting;
                showUpdateModal();
            }

        }).catch(err => console.error('SW Register Error:', err));
    });

    // Reload when the new SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
    });
}

// --- Manifest Version Check & Forced Update ---
(async function checkManifestVersion() {
    try {
        // Fetch manifest with cache-busting
        const response = await fetch('/manifest.json?t=' + Date.now());
        if (!response.ok) return;

        const manifest = await response.json();
        const serverVersion = manifest.version;

        if (!serverVersion) return; // No version defined, skip logic

        const storedVersion = localStorage.getItem('app_version');

        if (!storedVersion) {
            // First time initialize
            localStorage.setItem('app_version', serverVersion);
            return;
        }

        // Simple string comparison for versions (1.0.0 < 1.0.1)
        // If server version is GREATER than stored, force update
        if (serverVersion > storedVersion) {
            console.log(`New version detected: ${serverVersion} (Current: ${storedVersion})`);
            showForcedUpdateModal();
        }
    } catch (e) {
        console.error('Manifest version check failed:', e);
    }
})();

function showForcedUpdateModal() {
    // Create a modal that covers everything and cannot be closed
    const modal = document.createElement('div');
    modal.id = 'forced-update-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.9)'; // Dark overlay
    modal.style.zIndex = '999999'; // Toppest
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '20px';
    modal.style.color = 'white';
    modal.style.textAlign = 'center';
    modal.style.fontFamily = 'sans-serif';

    modal.innerHTML = `
        <div style="background:white; color:#333; padding:30px; border-radius:12px; max-width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <div style="font-size:3rem; margin-bottom:10px;">⚠️</div>
            <h2 style="margin-top:0; color:#145ab4;">アプリの更新が必要です</h2>
            <p style="margin:20px 0; line-height:1.6;">新しいバージョンが公開されました。<br>ご利用を続けるには、アプリの再インストールが必要です。</p>
            <button id="go-to-update-btn" style="background:#145ab4; color:white; border:none; padding:12px 24px; font-size:1rem; border-radius:30px; cursor:pointer; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                更新手順へ進む
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden'; // Lock scroll

    document.getElementById('go-to-update-btn').onclick = () => {
        window.location.href = 'update.html';
    };
}
