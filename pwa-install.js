// pwa-install.js
// --- Standalone Redirect Logic (Force Login on PWA Start) ---
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    // If we are in PWA mode, ensure we are on login.html (unless we are already there)
    // We strictly want to force login.html as the entry point?
    // But if user is navigating WITHIN the app (e.g. members-area), we shouldn't redirect back to login!
    // The user said: "Opened page -> redirect to login.html"
    // This implies "Entry Point".
    // But how to distinguish "Entry Point" from "Navigation"?
    // Session Storage flag?

    // If we simply redirect EVERY page, user can't use the app.
    // The requirement is: "iosなどにおいてPWAならば、どのページを開かれても必ずlogin.htmlに遷移する"
    // likely means "When opening the app", not "Every navigation".
    // BUT since start_url is /login.html, Android/PC is fine.
    // iOS might save the "Last Visited Page" and open it on launch.

    // Strategy: Use Session Storage to detect "First Run in Session".
    // If session storage 'pwa_session_started' is missing, redirect to login.js?
    // But login.js redirects to members-area.js if logged in.
    // So redirecting to login.html is safe (it acts as a router).

    if (!sessionStorage.getItem('pwa_session_active')) {
        sessionStorage.setItem('pwa_session_active', 'true');
        // If not already on login.html, redirect
        if (!window.location.pathname.endsWith('/login.html')) {
            window.location.replace('login.html');
        }
    }
}

let deferredPrompt;

// Initialize deferredPrompt logic
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    console.log('beforeinstallprompt fired');

    // Update UI if DOM is ready, otherwise wait for it
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupInstallButton);
    } else {
        setupInstallButton();
    }
});

function setupInstallButton() {
    // Look for the placeholder button in app.html
    const container = document.getElementById('pwa-install-container');
    if (!container) return; // Not on app.html or container missing

    // If deferredPrompt is missing, we can't enable the button yet
    // (This might happen if called directly, but we only call it from the event or DOM ready if event exists)
    if (!deferredPrompt) return;

    // Find or create button
    let btn = container.querySelector('.btn-install-trigger');
    if (!btn) return; // Should allow fallback? simpler to just require it from HTML

    // Enable button
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-download"></i> アプリをインストール';

    // Add click event (remove old listener to be safe? cloning is easier)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            // Disable button after choice
            newBtn.disabled = true;
            newBtn.innerHTML = '<i class="fas fa-check"></i> インストール完了';
        }
    });
}

window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    const container = document.getElementById('pwa-install-container');
    if (container) {
        const btn = container.querySelector('.btn-install-trigger');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-check"></i> インストール済み';
        }
    }
    deferredPrompt = null;
});

// Fallback: If beforeinstallprompt doesn't fire within 2 seconds, assume installed or not supported
// This fixes the "Preparing..." forever issue
setTimeout(() => {
    if (!deferredPrompt) {
        const container = document.getElementById('pwa-install-container');
        // Only run if on app.html and button is still disabled (preparing)
        if (container) {
            const btn = container.querySelector('.btn-install-trigger');
            if (btn && btn.disabled) {
                // Assume installed
                btn.innerHTML = '<i class="fas fa-check"></i> インストール済み';
                // We keep it disabled because we can't trigger install
            }
        }
    }
}, 2000);
