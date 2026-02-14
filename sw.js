const CACHE_NAME = 'sodre-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/offline.html',
    '/members-area.html',
    '/members-area.js',
    '/config.js',
    '/pwa-install.js',
    '/pwa-update.js'
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

// Install Event
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    // Removed self.skipWaiting() to prevent auto-update
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Listener for SKIP_WAITING message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activate Event
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        Promise.all([
            caches.keys().then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                }));
            }),
            self.clients.claim()
        ])
    );
});

// Fetch Event - ONLY cache same-origin GET requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return;

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) return response;
                return fetch(event.request).catch(() => {
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('/offline.html');
                    }
                });
            })
    );
});

// --- Background message handler (ONLY handler for displaying notifications) ---
// GAS sends data-only messages (no "notification" key) so Firebase SDK
// does NOT auto-display. This is the single place that shows notifications.
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const title = payload.data?.title || 'SoDRé';
    const body = payload.data?.body || '';

    const options = {
        body: body,
        icon: ICON_URL,
        badge: ICON_URL,
        data: payload.data || {}
    };

    return self.registration.showNotification(title, options);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    let urlToOpen = '/members-area.html';
    if (event.notification.data?.url) {
        urlToOpen = event.notification.data.url;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // 1. Try to find a client that is already open to the app (same origin)
            // We match broadly on origin to find ANY open tab of this app
            for (const client of windowClients) {
                const clientUrl = new URL(client.url);
                const targetUrl = new URL(urlToOpen, self.location.origin);

                // If same origin (and roughly the same app scope), focus and navigate
                if (clientUrl.origin === self.location.origin && 'focus' in client) {
                    client.focus();
                    // Navigate only if the URL is different
                    if (client.url !== targetUrl.href) {
                        client.navigate(urlToOpen);
                    }
                    return;
                }
            }
            // 2. If no client found, open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
