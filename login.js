document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const loginForm = document.getElementById('member-login-form');
    const errorMsg = document.getElementById('login-error');
    // Initialize Supabase Client
    let supabase = window.supabaseClient;
    if (!supabase) {
        const provider = window.supabase || window.Supabase;
        if (provider && provider.createClient && window.SUPABASE_URL && window.SUPABASE_KEY) {
            try {
                window.supabaseClient = provider.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
                supabase = window.supabaseClient;
            } catch (e) { console.error(e); }
        }
    }

    // --- Auto-Login: セッションが有効ならログイン画面をスキップ ---
    if (supabase) {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;

        // PWA初回起動時は完全にログアウトして新規ログインを求める
        if (isPWA && !localStorage.getItem('sodre_pwa_initialized')) {
            try {
                await supabase.auth.signOut();
            } catch (e) { /* ignore */ }
            localStorage.setItem('sodre_pwa_initialized', 'true');
            // ログアウト済み → ログインフォームを表示（リダイレクトしない）
        } else {
            try {
                if (isPWA) {
                    // PWA: セッションを自動更新して維持
                    const { data, error } = await supabase.auth.refreshSession();
                    if (!error && data.session) {
                        window.location.replace('members-area.html');
                        return;
                    }
                }
                // ブラウザ/PWAフォールバック: 既存セッション確認
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    window.location.replace('members-area.html');
                    return;
                }
            } catch (e) {
                console.error('Auto-login check error:', e);
            }
        }
    }

    // --- Show Login Form if not redirected ---
    const loader = document.getElementById('login-loading');
    if (loader) loader.style.display = 'none';

    const mainContainer = document.getElementById('main-login-container');
    if (mainContainer) mainContainer.style.display = 'block';

    // --- Firebase Init ---
    let messaging = null;
    try {
        if (window.firebase && firebase.messaging.isSupported()) {
            firebase.initializeApp(window.FIREBASE_CONFIG);
            messaging = firebase.messaging();
        }
    } catch (e) {
        console.error("Firebase Init Error in Login:", e);
    }

    // --- Notification Logic ---
    // --- Notification Logic ---
    async function requestNotificationPermissionAndSave(userId) {
        if (!messaging) return;

        try {
            // Request permission
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                // Get Service Worker Registration for PWA compatibility
                let registration = await navigator.serviceWorker.getRegistration();
                if (!registration) {
                    registration = await navigator.serviceWorker.ready;
                }

                const token = await messaging.getToken({
                    vapidKey: window.FIREBASE_VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    await saveTokenToDatabase(token, userId);
                }
            }
        } catch (err) {
            console.error("Notification Setup Error:", err);
        }
    }

    async function saveTokenToDatabase(token, userId) {
        if (!supabase) return;
        try {
            // Get device type
            const ua = navigator.userAgent;
            let deviceType = 'desktop';
            if (/mobile/i.test(ua)) deviceType = 'mobile';
            if (/iPad|Android|Touch/i.test(ua)) deviceType = 'tablet';

            // Insert or update token
            // Note: Use upsert if you have a unique constraint on token, or just insert
            // Ensure table schema supports this
            const payload = {
                user_id: userId,
                token: token,
                device_type: deviceType
            };
            await supabase.from('user_fcm_tokens').upsert(payload, { onConflict: 'user_id,token' });

        } catch (e) {
            console.error('Token Save Exception:', e);
        }
    }



    // Reset Password Elements

    // Reset Password Elements
    const forgotLink = document.getElementById('forgot-password-link');
    const resetModal = document.getElementById('reset-modal');
    const closeResetBtn = document.getElementById('close-reset-modal');
    const requestOtpForm = document.getElementById('request-otp-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const step1 = document.getElementById('reset-step-1');
    const step2 = document.getElementById('reset-step-2');
    const resetMsg = document.getElementById('reset-msg');

    // CONFIG: GAS Web App URL is now in config.js
    // const GAS_OTP_URL = '...'; 

    // Login Logic
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        errorMsg.style.display = 'none';

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'ログイン中...';
        submitBtn.disabled = true;

        if (!supabase) {
            alert('システムエラー: データベース接続に失敗しました。再読み込みしてください。');
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            return;
        }

        let data, error;
        try {
            const result = await supabase.auth.signInWithPassword({
                email, password
            });
            data = result.data;
            error = result.error;
        } catch (e) {
            console.error('Login Exception:', e);
            error = e;
        }

        if (error) {
            console.error('Login error:', error);
            errorMsg.textContent = 'ログインに失敗しました: ' + error.message;
            errorMsg.style.display = 'block';
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        } else {
            // Check if First Login
            try {
                const user = data.user;
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('is_first_login')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.error('Profile fetch error:', profileError);
                    // Fallback: Proceed to member area if we can't check
                    window.location.href = 'members-area.html';
                    return;
                }

                if (profile && profile.is_first_login) {
                    // Force Password Change
                    document.getElementById('first-login-modal').style.display = 'flex';
                    // Pre-fill email for the reset flow
                    document.getElementById('reset-email').value = email;
                } else {
                    // Success - Setup Notification & Redirect
                    try {
                        await requestNotificationPermissionAndSave(user.id);
                    } catch (e) {
                        console.error('Notif setup skipped or failed', e);
                    }

                    localStorage.setItem('sodre_last_activity', Date.now().toString());
                    window.location.href = 'members-area.html';
                }
            } catch (err) {
                console.error('Unexpected error checking first login:', err);
                window.location.href = 'members-area.html';
            }
        }
    });

    // --- First Login Flow ---
    const startFirstLoginFlowBtn = document.getElementById('start-first-login-flow-btn');
    if (startFirstLoginFlowBtn) {
        startFirstLoginFlowBtn.addEventListener('click', () => {
            document.getElementById('first-login-modal').style.display = 'none';
            // Trigger "Forgot Password" flow automatically
            resetModal.style.display = 'flex';
            step1.style.display = 'block';
            step2.style.display = 'none';
            resetMsg.textContent = '';
            // document.getElementById('reset-email').value is already set in login success
        });
    }

    // --- Password Reset Logic ---
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        resetModal.style.display = 'flex';
        // Reset state
        step1.style.display = 'block';
        step2.style.display = 'none';
        resetMsg.textContent = '';
        document.getElementById('reset-email').value = '';
    });

    closeResetBtn.addEventListener('click', () => {
        resetModal.style.display = 'none';
    });

    // Step 1: Request OTP
    requestOtpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        resetMsg.textContent = '認証コードを送信中... お待ちください。';
        resetMsg.style.color = 'blue';

        // Use window.GAS_OTP_URL to ensure scope access
        const targetUrl = window.GAS_OTP_URL || GAS_OTP_URL;

        if (!targetUrl || targetUrl.includes('YOUR_GAS_WEB_APP_URL_HERE') || targetUrl.includes('AKfycbx...')) {
            resetMsg.textContent = 'Error: GASのURLが設定されていないか、無効です。';
            resetMsg.style.color = 'red';
            alert('Error: GAS_OTP_URLが見つからないか無効です: ' + targetUrl);
            return;
        }

        resetMsg.textContent = 'メールアドレスを確認中...';

        // 1. Check if email exists in Supabase
        // DEBUG: Alerting to confirm execution
        // alert('Debug: Checking email existence for ' + email);

        const { data: emailExists, error: checkError } = await supabase.rpc('check_email_exists', { p_email: email });

        if (checkError) {
            console.error('Check Error:', checkError);
            resetMsg.textContent = 'メール確認エラー: ' + checkError.message;
            resetMsg.style.color = 'red';
            return;
        }

        if (!emailExists) {
            resetMsg.textContent = 'メールアドレスが見つかりません。（入力ミスがないかご確認ください）';
            resetMsg.style.color = 'red';
            return;
        }

        resetMsg.textContent = '認証コードを送信しています...';

        try {
            // Call GAS
            // Debug: Log the URL we are hitting
            console.log('Sending to:', targetUrl);

            const response = await fetch(targetUrl, {
                method: 'POST',
                body: JSON.stringify({ email: email }),
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain'
                }
            });

            // Success assumed if no network error
            resetMsg.textContent = '';
            step1.style.display = 'none';
            step2.style.display = 'block';

        } catch (err) {
            console.error('Fetch Error:', err);
            resetMsg.textContent = '通信エラー: ' + err.message;
            resetMsg.style.color = 'red';
            alert('Error: 送信に失敗しました。詳細はコンソールを確認してください。\n' + err.message);
        }
    });

    // Step 2: Verify & Reset
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const otp = document.getElementById('reset-otp').value;
        const newPass = document.getElementById('new-password').value;

        resetMsg.textContent = '確認中...';
        resetMsg.style.color = 'blue';

        // Call Supabase RPC
        const { data, error } = await supabase.rpc('reset_password_with_otp', {
            p_email: email,
            p_otp: otp,
            p_new_password: newPass
        });

        if (error) {
            resetMsg.textContent = 'エラー: ' + error.message;
            resetMsg.style.color = 'red';
        } else if (data === 'success') {
            alert('パスワードのリセットが完了しました！ログインしてください。');
            resetModal.style.display = 'none';
            step2.style.display = 'none';
            step1.style.display = 'block';
        } else {
            resetMsg.textContent = '失敗しました: ' + data; // 'Invalid OTP' etc
            resetMsg.style.color = 'red';
        }
    });
});

// --- Helper: Notification Permission & Token Save ---
async function requestNotificationPermissionAndSave(userId) {
    if (!('Notification' in window)) {
        console.log('This browser does not support desktop notification');
        return;
    }

    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Notification permission denied');
    }

    // 2. Get Token
    if (!window.firebase) return; // Safety check
    // Initialize Messaging if not already done (it is done at top of login.js, but let's be safe)
    let messaging = null;
    try {
        if (firebase.messaging.isSupported()) {
            // Already initialized in DOMContentLoaded? We need strictly the instance
            // We can just re-get it since firebase app is singleton-ish or just rely on global if we exposed it
            const app = firebase.app(); // Get default app
            messaging = firebase.messaging(app);
        }
    } catch (e) {
        // initialization might have failed earlier or app not init
        if (!firebase.apps.length) {
            firebase.initializeApp(window.FIREBASE_CONFIG);
        }
        messaging = firebase.messaging();
    }

    if (!messaging) return;

    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return;
    }

    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
        // Explicitly register if not found (Crucial for iOS/Android first launch)
        try {
            registration = await navigator.serviceWorker.register('/sw.js');
            console.log('SW Registered on login:', registration);
        } catch (swErr) {
            console.error('SW Registration failed:', swErr);
            return;
        }
    }

    // Wait for SW to be active/ready (with timeout)
    const swReadyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 5000));

    try {
        registration = await Promise.race([swReadyPromise, timeoutPromise]);
    } catch (e) {
        console.warn('SW ready timed out, skipping token retrieval');
        return;
    }

    // Token Retrieval with Timeout
    const tokenPromise = messaging.getToken({
        vapidKey: window.FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
    });
    const tokenTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('FCM Token retrieval timeout')), 10000));

    let token;
    try {
        token = await Promise.race([tokenPromise, tokenTimeout]);
    } catch (e) {
        console.warn('FCM Token retrieval failed or timed out:', e);
        return;
    }

    if (token) {
        // 3. Save to DB
        let supabase = window.supabaseClient;
        if (!supabase) {
            const provider = window.supabase || window.Supabase;
            supabase = provider.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        }

        const ua = navigator.userAgent;
        let deviceType = 'web';
        if (/android/i.test(ua)) deviceType = 'android';
        else if (/iPad|iPhone|iPod/.test(ua)) deviceType = 'ios';

        const { error } = await supabase.from('user_fcm_tokens').upsert({
            user_id: userId,
            token: token,
            device_type: deviceType
        }, { onConflict: 'user_id,token' });

        if (error) throw error;
        console.log('FCM Token saved successfully');
    }
}
