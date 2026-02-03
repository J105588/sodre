// --- Configuration ---
console.log('Loading config.js...');
// REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://qrbayooyblmffolcstgg.supabase.co';
const SUPABASE_KEY = 'sb_publishable__CTkIkbeJ5gDbfJJ17Ll6w_U2NcITAJ';
// REPLACE THIS WITH YOUR GAS WEB APP URL
const GAS_OTP_URL = 'https://script.google.com/macros/s/AKfycbwQliAMYfpYRH0f081gsu1Z8QdpMqq19pgtyfMdAo3pP1g1tC10Lz51Pkgz7PUJfWM/exec';

// Initialize Supabase Client globally if SDK is available
const supabaseProvider = window.supabase || window.Supabase;

// Expose credentials for lazy loading in other scripts if needed
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;

if (supabaseProvider && supabaseProvider.createClient) {
    window.supabaseClient = supabaseProvider.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase Client Initialized');
} else {
    console.error('Supabase SDK not loaded or createClient not found. Checked window.supabase and window.Supabase.');
}
