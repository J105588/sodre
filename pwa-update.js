// pwa-update.js
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registration successful with scope: ', registration.scope);

            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker == null) {
                    return;
                }
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New update available
                            console.log('New content is available; please refresh.');
                            // Optionally show a "New version available" toast here
                            if (confirm('新しいバージョンが利用可能です。更新しますか？')) {
                                window.location.reload();
                            }
                        } else {
                            // Content is cached for offline use
                            console.log('Content is cached for offline use.');
                        }
                    }
                };
            };
        }).catch(err => {
            console.log('SW registration failed: ', err);
        });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
    });
}
