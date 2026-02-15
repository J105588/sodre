window.ENV = {
    FIREBASE_CONFIG: {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    },
    SUPABASE_URL: 'YOUR_SUPABASE_URL',
    SUPABASE_KEY: 'YOUR_SUPABASE_KEY',
    GAS_OTP_URL: 'YOUR_GAS_OTP_URL',
    UPLOAD_API_URL: 'YOUR_UPLOAD_API_URL',
    UPLOAD_API_KEY: 'YOUR_UPLOAD_API_KEY',
    FIREBASE_VAPID_KEY: "YOUR_VAPID_KEY",
    GAS_NOTIFICATION_URL: 'YOUR_GAS_NOTIFICATION_URL'
};

// For Service Worker compatibility
try { self.ENV = window.ENV; } catch (e) { self.ENV = window.ENV; }
