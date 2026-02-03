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
            errorMsg.textContent = 'Login failed: ' + error.message;
            errorMsg.style.display = 'block';
        } else {
            // Success - Redirect to Members Area
            window.location.href = 'members-area.html';
        }
    });

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
        resetMsg.textContent = 'Sending code... please wait.';
        resetMsg.style.color = 'blue';

        if (GAS_OTP_URL.includes('AKfycbx') || GAS_OTP_URL.includes('YOUR_GAS_WEB_APP_URL_HERE')) {
            // Just a warning, but let them try if they updated config.js partially?
            // Actually, if it includes 'AKfycbx...' but ends in 'exec', it might be valid.
            // Let's just warn if it's the exact placeholder.
            if (GAS_OTP_URL === 'YOUR_GAS_WEB_APP_URL_HERE' || GAS_OTP_URL.includes('macros/s/AKfycbx.../exec')) {
                resetMsg.textContent = 'Error: GAS URL not configured in config.js';
                resetMsg.style.color = 'red';
                return;
            }
        }

        try {
            // Call GAS
            // Note: fetch to GAS might have CORS issues if not set up correctly (Simple Request).
            // Usually need Content-Type: application/x-www-form-urlencoded or text/plain
            const response = await fetch(GAS_OTP_URL, {
                method: 'POST',
                body: JSON.stringify({ email: email }),
                mode: 'no-cors', // Opaque response (can't read success/fail easily) OR cors if supported
                headers: {
                    'Content-Type': 'text/plain' // Avoid preflight
                }
            });

            // Because of 'no-cors' (likely needed for GAS Web App Simple Trigger depending on deployment),
            // we might not get a readable response.
            // Assumption: If it didn't crash network, it worked?

            // Let's assume 'no-cors' for safety and just proceed to Step 2.
            resetMsg.textContent = '';
            step1.style.display = 'none';
            step2.style.display = 'block';

        } catch (err) {
            resetMsg.textContent = 'Network Error: ' + err.message;
            resetMsg.style.color = 'red';
        }
    });

    // Step 2: Verify & Reset
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const otp = document.getElementById('reset-otp').value;
        const newPass = document.getElementById('new-password').value;

        resetMsg.textContent = 'Verifying...';
        resetMsg.style.color = 'blue';

        // Call Supabase RPC
        const { data, error } = await supabase.rpc('reset_password_with_otp', {
            p_email: email,
            p_otp: otp,
            p_new_password: newPass
        });

        if (error) {
            resetMsg.textContent = 'Error: ' + error.message;
            resetMsg.style.color = 'red';
        } else if (data === 'success') {
            alert('Password reset successfully! Please login.');
            resetModal.style.display = 'none';
            step2.style.display = 'none';
            step1.style.display = 'block';
        } else {
            resetMsg.textContent = 'Failed: ' + data; // 'Invalid OTP' etc
            resetMsg.style.color = 'red';
        }
    });
});
