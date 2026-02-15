const CACHE_NAME = 'sodre-cache-v1'; // Increment version
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

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBst9EF5I70uhKqzbg6ajOod6lLa4e6o_Q",
    authDomain: "sodre-6081d.firebaseapp.com",
    projectId: "sodre-6081d",
    storageBucket: "sodre-6081d.firebasestorage.app",
    messagingSenderId: "528869542420",
    appId: "1:528869542420:web:67377332a10bc75dd7b501",
    measurementId: "G-EB765G7NE9"
};

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
    const urlToOpen = event.notification.data?.url || '/members-area.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                const clientUrl = new URL(client.url);
                if (clientUrl.origin === self.location.origin && 'focus' in client) {
                    client.focus();
                    if (client.url !== new URL(urlToOpen, self.location.origin).href) {
                        client.navigate(urlToOpen);
                    }
                    return;
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
