const CACHE_NAME = 'sodre-cache-v1.0.0'; // Increment version
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/offline.html',
    '/members-area.html',
    '/members-area.js',
    '/config.js',
    '/pwa-manager.js',
    '/login.html',
    '/app.html',
    '/img/icon-192.png',
    '/img/icon-512.png',
    '/img/logo.webp'
];

// --- Firebase Cloud Messaging setup ---
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
importScripts('/env.js'); // Inject environment variables

const ENV = self.ENV || {};
const FIREBASE_CONFIG = ENV.FIREBASE_CONFIG || {};

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();
const ICON_URL = 'https://lh3.googleusercontent.com/a/ACg8ocKrevxxn-jyPFTJ3zy5r6EFRGmv0Tp8-qWyb3bMaXduuMzHS0Y=s400-c';

// Install
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Activate & Cleanup
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        Promise.all([
            caches.keys().then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Removing old cache', key);
                        return caches.delete(key);
                    }
                }));
            }),
            self.clients.claim()
        ])
    );
});

// Message Handler (Skip Waiting)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. API - Network Only
    if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
        return;
    }

    // 2. Navigation (HTML) - Network First, allow offline fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request)
                        .then((response) => {
                            if (response) return response;
                            return caches.match('/offline.html');
                        });
                })
        );
        return;
    }

    // 3. Static Assets - Stale While Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Clone the response immediately because the body can only be consumed once.
                // If we wait for caches.open(), the browser might already have started consuming the original response.
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});

// Background Messages (Notifications)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);
    const title = payload.data?.title || 'SoDRé';
    const options = {
        body: payload.data?.body || '',
        icon: ICON_URL,
        badge: ICON_URL,
        data: payload.data || {}
    };
    return self.registration.showNotification(title, options);
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Ensure we have an absolute URL
    let urlToOpen = event.notification.data?.url || '/members-area.html';
    urlToOpen = new URL(urlToOpen, self.location.origin).href;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !self.MSStream;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
            // 1. Try to find an existing window to focus
            for (const client of windowClients) {
                const clientUrl = new URL(client.url);
                // Check if we are on the same origin
                if (clientUrl.origin === self.location.origin && 'focus' in client) {
                    try {
                        const focusedClient = await client.focus();
                        const targetClient = focusedClient || client;

                        if (isIOS) {
                            // iOS: Force navigation to ensure params are processed
                            return targetClient.navigate(urlToOpen);
                        }

                        // Android/Desktop: Use postMessage for smooth transition if on same page
                        // (Only if the path matches exactly, otherwise navigate)
                        if (clientUrl.pathname === new URL(urlToOpen).pathname) {
                            targetClient.postMessage({
                                type: 'NOTIFICATION_CLICK',
                                url: urlToOpen
                            });
                        } else {
                            return targetClient.navigate(urlToOpen);
                        }
                    } catch (e) {
                        console.error('Focus/Navigate failed:', e);
                        // If focus failed, try to open a new window
                        if (clients.openWindow) return clients.openWindow(urlToOpen);
                    }
                    return;
                }
            }

            // 2. If no matching window found, open a new one
            if (clients.openWindow) {
                const newClient = await clients.openWindow(urlToOpen);
                // iOS Edge case: openWindow might bring an existing background app to front
                // without navigating it. We should force navigate if we can get the client handle.
                if (isIOS && newClient) {
                    // Check if it actually needs navigation (though openWindow *should* load the url)
                    // But just in case it merely focused an existing one:
                    if (newClient.url !== urlToOpen) {
                        return newClient.navigate(urlToOpen);
                    }
                }
                return newClient;
            }
        })
    );
});
