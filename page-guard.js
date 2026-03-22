(async () => {
    // 1. Hide Content Immediately to prevent flash
    const style = document.createElement('style');
    style.id = 'page-guard-style';
    style.innerHTML = 'body { display: none !important; }';
    document.head.appendChild(style);

    const revealContent = () => {
        const styleEl = document.getElementById('page-guard-style');
        if (styleEl) styleEl.remove();
    };

    const redirectTo404 = () => {
        window.location.href = '404.html';
    };

    // --- Cache Helpers ---
    const CACHE_KEY = 'page_guard_cache';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    function getCachedSetting(pageName) {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const cache = JSON.parse(raw);
            if (Date.now() - cache._ts > CACHE_TTL) {
                sessionStorage.removeItem(CACHE_KEY);
                return null;
            }
            if (pageName in cache) {
                return { is_public: cache[pageName] };
            }
            return null; // Page not in cache yet
        } catch {
            return null;
        }
    }

    function setCachedSetting(pageName, isPublic) {
        try {
            let cache = {};
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (raw) {
                cache = JSON.parse(raw);
                if (Date.now() - cache._ts > CACHE_TTL) {
                    cache = {};
                }
            }
            cache[pageName] = isPublic;
            cache._ts = Date.now();
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch { /* ignore storage errors */ }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        // Ensure Supabase is loaded
        let attempts = 0;
        const checkSupabase = setInterval(async () => {
            attempts++;
            if (window.supabaseClient || (window.supabase && window.supabase.createClient)) {
                clearInterval(checkSupabase);
                await runGuard();
            } else if (attempts > 20 && !document.querySelector('script[src*="supabase.co"]')) {
                if (!window.supabaseLoading) {
                    console.log('Reloading Supabase SDK fallback...');
                    window.supabaseLoading = true;
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
                    script.onload = () => { console.log('Fallback SDK loaded'); };
                    document.head.appendChild(script);
                }
            }
        }, 100);

        // Fallback timeout (10s)
        setTimeout(() => {
            clearInterval(checkSupabase);
            if (!window.supabaseClient && !window.supabase) {
                console.error('Supabase load timeout in page-guard.');
                revealContent();
            }
        }, 10000);
    });

    async function runGuard() {
        const supabase = window.supabaseClient || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

        // Get current filename
        const path = window.location.pathname;
        const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

        try {
            // 1. Check cache first
            const cached = getCachedSetting(pageName);
            let isPublic;

            if (cached !== null) {
                isPublic = cached.is_public;
            } else {
                // 2. Fetch from Supabase
                const { data: setting, error } = await supabase
                    .from('page_settings')
                    .select('is_public')
                    .eq('page_path', pageName)
                    .maybeSingle();

                if (error) {
                    console.error('Guard Check Error:', error);
                    revealContent();
                    return;
                }

                // If no setting exists, assume public
                if (!setting) {
                    revealContent();
                    return;
                }

                isPublic = setting.is_public;
                setCachedSetting(pageName, isPublic);
            }

            // 3. Check Visibility
            if (isPublic) {
                revealContent();
                return;
            }

            // 4. If Private, Check Admin
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                redirectTo404();
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.is_admin) {
                revealContent(); // Admin allowed
            } else {
                redirectTo404(); // Non-admin blocked
            }

        } catch (err) {
            console.error('Guard Exception:', err);
            revealContent();
        }
    }
})();
