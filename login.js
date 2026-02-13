document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginForm = document.getElementById('member-login-form'); // Renamed from 'form' in edit to match original
    const errorMsg = document.getElementById('login-error');
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

        const { data, error } = await supabase.auth.signInWithPassword({
            email, password
        });

        if (error) {
            console.error('Login error:', error);
            errorMsg.textContent = 'ログインに失敗しました: ' + error.message;
            errorMsg.style.display = 'block';
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
                    // Success - Redirect to Members Area
                    // Set initial activity timestamp to prevent immediate logout from stale data
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
