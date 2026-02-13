// pwa-install.js
let deferredPrompt;

// Initialize deferredPrompt logic
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    showInstallPromotion();
    console.log('beforeinstallprompt fired');
});

function showInstallPromotion() {
    // Check if button already exists
    if (document.getElementById('pwa-install-btn-dynamic')) return;

    // Create a floating install button
    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn-dynamic';
    btn.innerHTML = '<i class="fas fa-download"></i> アプリをインストール';

    // Style the button
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '9999',
        padding: '12px 20px',
        backgroundColor: '#4a90e2', // Standard nice blue
        color: 'white',
        border: 'none',
        borderRadius: '30px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'transform 0.2s, opacity 0.3s',
        opacity: '0', // Start hidden for fade-in
        transform: 'translateY(20px)' // Start slightly down
    });

    // Add click event
    btn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            // Hide button after choice (accepted or dismissed)
            btn.style.opacity = '0';
            setTimeout(() => btn.remove(), 300);
        }
    });

    document.body.appendChild(btn);

    // Fade in animation
    requestAnimationFrame(() => {
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
    });
}

window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    const btn = document.getElementById('pwa-install-btn-dynamic');
    if (btn) btn.remove();
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
});
