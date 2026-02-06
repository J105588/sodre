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

    document.addEventListener('DOMContentLoaded', async () => {
        // Ensure Supabase is loaded
        let attempts = 0;
        const checkSupabase = setInterval(async () => {
            attempts++;
            if (window.supabaseClient || (window.supabase && window.supabase.createClient)) {
                clearInterval(checkSupabase);
                await runGuard();
            } else if (attempts > 20 && !document.querySelector('script[src*="supabase.co"]')) {
                // If not loaded after ~1s and no correct script found (generic check), try emergency load
                // (Note: we use jsdelivr now, so checking that)
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

        // Fallback timeout (increased to 10s)
        setTimeout(() => {
            clearInterval(checkSupabase);
            if (!window.supabaseClient && !window.supabase) {
                console.error('Supabase load timeout in page-guard. Client or SDK missing.');
                // Fail open so user isn't stuck slightly better than 404ing valid users, 
                // but strictly this defeats the valid private page. 
                // However, we default to reveal to avoid broken site.
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
            // 1. Fetch Page Settings
            const { data: setting, error } = await supabase
                .from('page_settings')
                .select('is_public')
                .eq('page_path', pageName)
                .maybeSingle();

            if (error) {
                console.error('Guard Check Error:', error);
                revealContent(); // On error, maybe allow? or block? 
                return;
            }

            // If no setting exists, assume public
            if (!setting) {
                revealContent();
                return;
            }

            // 2. Check Visibility
            if (setting.is_public) {
                revealContent();
                return;
            }

            // 3. If Private, Check Admin
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
