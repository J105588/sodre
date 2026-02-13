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
const modalHTML = `
<div id="pwa-update-modal">
    <div class="modal-content">
        <h3>新しいバージョンが利用可能です</h3>
        <p>最新の機能をご利用いただくため、アップデートが必要です。</p>
        <button id="pwa-update-btn">今すぐアップデート</button>
    </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', modalHTML);

// 4. Logic
if ('serviceWorker' in navigator) {
    let newWorker;

    // Helper to show modal
    function showUpdateModal() {
        const modal = document.getElementById('pwa-update-modal');
        if (modal) modal.style.display = 'flex';
    }

    // Handle Update Click
    document.getElementById('pwa-update-btn').addEventListener('click', () => {
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
