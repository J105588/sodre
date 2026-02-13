// --- Configuration ---
// REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://qrbayooyblmffolcstgg.supabase.co';
const SUPABASE_KEY = 'sb_publishable__CTkIkbeJ5gDbfJJ17Ll6w_U2NcITAJ';
// REPLACE THIS WITH YOUR GAS WEB APP URL
const GAS_OTP_URL = 'https://script.google.com/macros/s/AKfycbzpwAlodnnKDN0VTQI5nzoOXsdOnN7I962ll6o_6hOlE3WdPFaQNvdXpQJt776ThF8/exec';
// Upload API (X-server disk storage)
const UPLOAD_API_URL = 'https://data.sodre.jp/api/upload.php';
const UPLOAD_API_KEY = 'dJDnv9-8eykjd-KHBVlkb'; // api/.env.php と同じ値にすること

// Initialize Supabase Client globally if SDK is available
const supabaseProvider = window.supabase || window.Supabase;

// Expose credentials for lazy loading in other scripts if needed
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;
window.GAS_OTP_URL = GAS_OTP_URL;
window.UPLOAD_API_URL = UPLOAD_API_URL;
window.UPLOAD_API_KEY = UPLOAD_API_KEY;

// Firebase Configuration
window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyBst9EF5I70uhKqzbg6ajOod6lLa4e6o_Q",
    authDomain: "sodre-6081d.firebaseapp.com",
    projectId: "sodre-6081d",
    storageBucket: "sodre-6081d.firebasestorage.app",
    messagingSenderId: "528869542420",
    appId: "1:528869542420:web:67377332a10bc75dd7b501",
    measurementId: "G-EB765G7NE9"
};

// VAPID Public Key (Web Push Certificate)
window.FIREBASE_VAPID_KEY = "BM942yHYNqVnsOgxPz-CPcZHkECm0xWVwNnYxC-SqNFE2E5xZTXnHnPPBMaA_VbE4ASAw5jhrkg253uqKsHqIDQ";

// GAS Notification URL (Set this after deploying GAS)
window.GAS_NOTIFICATION_URL = 'https://script.google.com/macros/s/AKfycbweGoDxaxHj7bVxDl_hWLdrWILxMjeKdzHGQGpUEkiNH5GwthtSIFesOfQlK9kkt-6hMQ/exec'; // TODO: Paste your GAS Web App URL here



if (supabaseProvider && supabaseProvider.createClient) {
    window.supabaseClient = supabaseProvider.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- Maintenance Mode Check ---
    (async function checkMaintenance() {
        // ページ名を取得（パスの最後の部分）
        const pageName = window.location.pathname.split('/').pop() || 'index.html';

        // デフォルトホワイトリスト（DB取得失敗時のフォールバックなし - 完全DB管理）
        let WHITELIST = [];

        // DBからホワイトリストを取得
        try {
            const { data: wlData } = await window.supabaseClient
                .from('system_settings')
                .select('value')
                .eq('key', 'maintenance_whitelist')
                .single();

            if (wlData && wlData.value) {
                const dbList = (typeof wlData.value === 'string') ? JSON.parse(wlData.value) : wlData.value;
                if (Array.isArray(dbList)) {
                    WHITELIST = dbList;
                }
            }
        } catch (e) {
            // Quiet failure
        }

        const isWhitelisted = WHITELIST.includes(pageName) || pageName === 'maintenance.html';

        if (isWhitelisted) {
            // maintenance.html の場合のみ、OFFなら index に戻す処理が必要
            if (pageName === 'maintenance.html') {
                await checkIfMaintenanceOff();
            }
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('system_settings')
                .select('value')
                .eq('key', 'maintenance_mode')
                .single();

            if (error) {
                return; // 読み取れない場合は通常表示
            }

            if (!data || !data.value) {
                return;
            }

            // TEXTカラムのためJSON.parseが必要
            const config = (typeof data.value === 'string') ? JSON.parse(data.value) : data.value;

            if (config.enabled === true) {
                // 管理者チェック
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session) {
                    const { data: profile } = await window.supabaseClient
                        .from('profiles')
                        .select('is_admin')
                        .eq('id', session.user.id)
                        .single();

                    if (profile && profile.is_admin) {
                        showMaintenanceBanner();
                        return; // 管理者はアクセス許可
                    }
                }

                // 一般ユーザー → リダイレクト (元のURLを保存)
                sessionStorage.setItem('maintenance_return_url', window.location.href);
                window.location.replace('maintenance.html');
                return;
            }

        } catch (err) {
            // Quiet failure
        }

        // Realtime: メンテナンスモード変更を監視
        setupRealtimeWatch(pageName);
    })();

} else {
    // Supabase SDK not loaded
}

// --- ヘルパー関数 ---

function showMaintenanceBanner() {
    if (document.getElementById('maintenance-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'maintenance-banner';
    banner.style.cssText = 'position:fixed; bottom:0; left:0; width:100%; background:#d63031; color:white; text-align:center; padding:10px; z-index:9999; font-weight:bold; box-shadow:0 -2px 10px rgba(0,0,0,0.2);';
    banner.innerHTML = '⚠ 現在メンテナンスモードです (管理者のみアクセス可能) ⚠';
    document.body.appendChild(banner);
}

async function checkIfMaintenanceOff() {
    try {
        const { data } = await window.supabaseClient
            .from('system_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

        if (data && data.value) {
            const config = (typeof data.value === 'string') ? JSON.parse(data.value) : data.value;
            if (config.enabled === false) {
                const returnUrl = sessionStorage.getItem('maintenance_return_url') || 'index.html';
                sessionStorage.removeItem('maintenance_return_url'); // Clear after use
                window.location.replace(returnUrl);
            }
        }
    } catch (e) {
        // Quiet failure
    }
}

function setupRealtimeWatch(pageName) {
    if (!window.supabaseClient) return;

    window.supabaseClient.channel('maintenance-global')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: 'key=eq.maintenance_mode' },
            (payload) => {
                const raw = payload.new.value;
                const newVal = (typeof raw === 'string') ? JSON.parse(raw) : raw;

                if (newVal && newVal.enabled === true) {
                    // メンテナンス開始 → リロードしてチェック通過させる（管理者以外はmaintenance.htmlへ）
                    window.location.reload();
                } else if (newVal && newVal.enabled === false) {
                    // メンテナンス終了 → 即時リロードして通常ページを表示
                    // maintenance.html にいる場合も、他のページにいる場合（バナー表示中）もリロードが確実
                    window.location.reload();
                }
            }
        )
        .subscribe();
}
