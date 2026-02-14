document.addEventListener('DOMContentLoaded', async () => {
    let supabase = window.supabaseClient;
    if (!supabase) {
        const provider = window.supabase || window.Supabase;
        if (provider && provider.createClient && window.SUPABASE_URL && window.SUPABASE_KEY) {
            try {
                window.supabaseClient = provider.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
                supabase = window.supabaseClient;
            } catch (e) {
                console.error(e);
            }
        }
    }
    if (!supabase) return;

    // --- PWA Standalone Detection ---
    const isPWA = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

    // PWA初回起動: 強制ログアウトしてログイン画面へ
    if (isPWA && !localStorage.getItem('sodre_pwa_initialized')) {
        localStorage.setItem('sodre_pwa_initialized', 'true');
        try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
        window.location.replace('login.html');
        return;
    }

    // --- DOM Elements ---
    const displayNameEl = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const tabBtns = document.querySelectorAll('.m-tab-btn');
    const viewAll = document.getElementById('view-all');
    const viewGroups = document.getElementById('view-groups');

    // Feeds
    const allFeed = document.getElementById('all-board-feed');
    const groupFeed = document.getElementById('group-board-feed');
    const groupsList = document.getElementById('my-groups-list');
    const groupBoardView = document.getElementById('group-board-view');
    const currentGroupName = document.getElementById('current-group-name');
    const backToGroupsBtn = document.getElementById('back-to-groups-btn');

    // FAB & Modal Elements
    const fabPost = document.getElementById('fab-post');
    const postModal = document.getElementById('post-modal');
    const modalClose = document.getElementById('modal-close');
    const modalTitle = document.getElementById('modal-title');
    const modalPostContent = document.getElementById('modal-post-content');
    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    // --- Firebase & Notifications ---
    // Initialize Firebase (Compat)
    let messaging = null;
    try {
        if (firebase.messaging.isSupported()) {
            firebase.initializeApp(window.FIREBASE_CONFIG);
            messaging = firebase.messaging();
        }
    } catch (e) {
        console.error('Firebase Init Error:', e);
    }


    // New Schedule Elements
    const scheduleToggle = document.getElementById('schedule-toggle');
    const scheduleOptions = document.getElementById('schedule-options');
    const scheduleDateInput = document.getElementById('schedule-date');
    const scheduleTimeInput = document.getElementById('schedule-time');

    // --- State ---
    let currentPostContext = 'all'; // 'all' or 'group'
    let currentGroupId = null;
    let currentGroupCanPost = false;
    // Pagination State
    let allPostsOffset = 0;
    let groupPostsOffset = 0;
    const POST_LIMIT = 50;
    let selectedFiles = []; // Store selected files for upload
    let isAdmin = false; // Admin State
    let isSuperAdmin = false; // Superadmin State
    let isEditingPostId = null; // Track if we are editing a post

    // --- Auth Check (PWA: セッション自動更新) ---
    let currentSession;
    if (isPWA) {
        // PWAではセッションを自動更新して維持する
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
            // リフレッシュ失敗 → 再ログイン
            const { data: fallback } = await supabase.auth.getSession();
            if (!fallback.session) {
                window.location.href = 'login.html';
                return;
            }
            currentSession = fallback.session;
        } else {
            currentSession = data.session;
        }
    } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        currentSession = session;
    }
    const session = currentSession;
    const user = session.user;
    loadProfile(user.id);

    // --- Firebase: Token refresh & Foreground message handling (after session is ready) ---
    async function refreshFCMToken() {
        if (!messaging || Notification.permission !== 'granted') return;
        try {
            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) registration = await navigator.serviceWorker.ready;
            const token = await messaging.getToken({
                vapidKey: window.FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration
            });
            if (token) {
                const ua = navigator.userAgent;
                let deviceType = 'web';
                if (/android/i.test(ua)) deviceType = 'android';
                else if (/iPad|iPhone|iPod/.test(ua)) deviceType = 'ios';
                await supabase.from('user_fcm_tokens').upsert({
                    user_id: session.user.id,
                    token: token,
                    device_type: deviceType
                }, { onConflict: 'user_id,token' });
            }
        } catch (err) {
            console.error('FCM token refresh error:', err);
        }
    }

    // Token refresh (permission is managed on login.js)
    await refreshFCMToken();

    // Periodic token refresh (every 30 minutes)
    setInterval(refreshFCMToken, 30 * 60 * 1000);

    // Handle foreground messages as proper push notifications
    if (messaging) {
        messaging.onMessage((payload) => {
            console.log('Foreground message received:', payload);
            const title = payload.data?.title || 'SoDRé';
            const body = payload.data?.body || '';
            if (Notification.permission === 'granted') {
                const notif = new Notification(title, {
                    body: body,
                    icon: 'https://lh3.googleusercontent.com/a/ACg8ocKrevxxn-jyPFTJ3zy5r6EFRGmv0Tp8-qWyb3bMaXduuMzHS0Y=s400-c',
                    data: payload.data
                });
                notif.onclick = () => {
                    window.focus();
                    const url = payload.data?.url;
                    if (url) window.location.href = url;
                };
            }
        });
    }

    // --- Profile Logic ---
    async function loadProfile(uid) {
        const { data, error } = await supabase
            .from('profiles')
            .select('display_name, is_admin, is_superadmin')
            .eq('id', uid)
            .maybeSingle();

        if (data && data.display_name) {
            displayNameEl.textContent = `ようこそ、 ${data.display_name} さん`;
        } else {
            // Prioritize Display Name but fallback to email if empty
            displayNameEl.textContent = `ようこそ、 ${user.email} さん`;
            // If display_name is retrieved but empty, logic holds.
        }

        if (data) {
            if (data.is_admin) {
                isAdmin = true;
                console.log('User is Admin');
            }
            if (data.is_superadmin) {
                isSuperAdmin = true;
                console.log('User is Superadmin');
            }
        }

        // セッションタイムアウトは無効化（自動ログアウトなし）
        // setupSessionTimeout();
    }

    // --- Session Expiration Logic (60 mins) - PWAでは無効 ---
    function setupSessionTimeout() {
        const TIMEOUT_DURATION = 60 * 60 * 1000; // 60 minutes
        const STORAGE_KEY = 'sodre_last_activity';

        // Initialize or update last activity
        const updateActivity = () => {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        };

        // Check timeout
        const checkTimeout = async () => {
            // If already on login page, do nothing (safety)
            if (window.location.pathname.endsWith('login.html')) return;

            const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
            const now = Date.now();

            // If lastActivity is 0 (not set) or difference > duration
            if (lastActivity > 0 && (now - lastActivity > TIMEOUT_DURATION)) {
                console.log('Session expired due to inactivity');
                // Clear storage to prevent loops
                localStorage.removeItem(STORAGE_KEY);

                try {
                    await supabase.auth.signOut();
                } catch (e) { console.error('SignOut error', e); }

                alert('一定時間操作がなかったため、ログアウトしました。');
                window.location.href = 'login.html';
            }
        };

        // Set initial time if not set
        if (!localStorage.getItem(STORAGE_KEY)) {
            updateActivity();
        }

        // Periodic check (every 1 minute)
        // This is still needed for desktop/active users
        setInterval(checkTimeout, 60 * 1000);

        // Immediate check on visibility change (Mobile wake up)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkTimeout();
                // Optionally update activity here if simply looking counts as activity
                // But safer to wait for interaction
            }
        });

        // Also check on pageshow (Back/Forward cache restore)
        window.addEventListener('pageshow', () => {
            checkTimeout();
        });

        // Listen for user activity to update timestamp
        // Throttle to avoid excessive writes
        let throttleTimer;
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        const throttledUpdate = () => {
            if (!throttleTimer) {
                // Update and reset timer
                updateActivity();
                throttleTimer = setTimeout(() => {
                    throttleTimer = null;
                }, 30000); // Update max once per 30 seconds
            }
        };

        events.forEach(event => {
            document.addEventListener(event, throttledUpdate);
        });

        // Initial update
        updateActivity();
    }

    // --- Logout ---
    logoutBtn.addEventListener('click', async () => {
        // Delete FCM Token from DB before logout
        try {
            if (messaging) {
                let registration = await navigator.serviceWorker.getRegistration();
                if (!registration) registration = await navigator.serviceWorker.ready;
                if (registration) {
                    const token = await messaging.getToken({
                        vapidKey: window.FIREBASE_VAPID_KEY,
                        serviceWorkerRegistration: registration
                    });
                    if (token) {
                        await supabase.from('user_fcm_tokens').delete().eq('token', token);
                    }
                }
            }
        } catch (e) {
            console.error('Token cleanup error:', e);
        }
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    // --- Tab Switching ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            if (tab === 'all') {
                viewAll.style.display = 'block';
                viewGroups.style.display = 'none';

                // Update Context
                currentPostContext = 'all';
                fabPost.style.display = 'flex'; // Show FAB for All Board
                loadAllPosts();
            } else {
                viewAll.style.display = 'none';
                viewGroups.style.display = 'block';

                // Explicitly Reset View to List
                groupsList.style.display = 'grid'; // or block/flex depending on css, grid seems used in loadMyGroups
                groupBoardView.style.display = 'none';
                currentGroupId = null;

                // Update Context (Initially Group List)
                currentPostContext = 'group_list';
                fabPost.style.display = 'none'; // Hide FAB in Group List
                loadMyGroups();
            }
        });
    });

    // --- Initial Load (with URL parameter routing) ---
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const groupIdParam = urlParams.get('group_id');

    if (tabParam === 'group' && groupIdParam) {
        // URLパラメータでグループ指定 → グループビューを開く
        viewAll.style.display = 'none';
        viewGroups.style.display = 'block';
        tabBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.tab === 'groups');
        });

        // グループ情報を取得して開く
        (async () => {
            const { data: membership } = await supabase
                .from('group_members')
                .select('can_post, groups(id, name)')
                .eq('group_id', groupIdParam)
                .eq('user_id', user.id)
                .single();

            if (membership && membership.groups) {
                window.openGroup(membership.groups.id, membership.groups.name, membership.can_post);
            } else {
                // メンバーでない場合、管理者チェック
                if (isAdmin) {
                    const { data: grp } = await supabase
                        .from('groups')
                        .select('id, name')
                        .eq('id', groupIdParam)
                        .single();
                    if (grp) {
                        window.openGroup(grp.id, grp.name, true);
                    } else {
                        loadAllPosts();
                    }
                } else {
                    loadAllPosts();
                }
            }
        })();

        // URLパラメータをクリーン
        window.history.replaceState({}, '', window.location.pathname);
    } else {
        loadAllPosts();
        // URLにパラメータがあればクリーン
        if (tabParam) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    // --- Modal / FAB Logic ---
    fabPost.addEventListener('click', () => {
        openPostModal();
    });

    function openPostModal(postToEdit = null) {
        // Reset State
        selectedFiles = [];
        document.getElementById('modal-post-image').value = '';
        document.getElementById('modal-image-preview').innerHTML = '';

        if (postToEdit) {
            // Edit Mode
            isEditingPostId = postToEdit.id;
            modalTitle.textContent = '投稿を編集';
            modalPostContent.value = postToEdit.content;
            document.getElementById('modal-allow-comments').checked = postToEdit.allow_comments;

            // Handle Schedule - only enable toggle if actually scheduled in future
            if (postToEdit.scheduled_at && new Date(postToEdit.scheduled_at) > new Date()) {
                const d = new Date(postToEdit.scheduled_at);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const hh = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');

                scheduleDateInput.value = `${yyyy}-${mm}-${dd}`;
                scheduleTimeInput.value = `${hh}:${min}`;

                scheduleToggle.checked = true;
                scheduleOptions.classList.add('active');
            } else {
                scheduleToggle.checked = false;
                scheduleOptions.classList.remove('active');
                scheduleDateInput.value = '';
                scheduleTimeInput.value = '';
            }

            // Existing images
            if (postToEdit.images && postToEdit.images.length > 0) {
                const previewArea = document.getElementById('modal-image-preview');
                postToEdit.images.forEach(url => {
                    const container = document.createElement('div');
                    container.style.position = 'relative';
                    container.style.display = 'inline-block';
                    container.style.marginRight = '5px';

                    if (isImageUrl(url)) {
                        const img = document.createElement('img');
                        img.src = url;
                        img.style.width = '80px';
                        img.style.height = '80px';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '4px';
                        container.appendChild(img);
                    } else {
                        container.innerHTML = createFilePreviewHTML(url);
                    }

                    previewArea.appendChild(container);
                });
            }
            modalSubmitBtn.textContent = '更新する';

        } else {
            // New Post Mode
            isEditingPostId = null;
            modalPostContent.value = '';
            if (currentPostContext === 'all') {
                modalTitle.textContent = '全体掲示板に投稿';
            } else if (currentPostContext === 'group') {
                modalTitle.textContent = `${currentGroupName.innerText} に投稿`;
            }

            document.getElementById('modal-allow-comments').checked = true; // Default to true

            // Reset Schedule
            scheduleToggle.checked = false;
            scheduleOptions.classList.remove('active');
            scheduleDateInput.value = '';
            scheduleTimeInput.value = '';

            modalSubmitBtn.textContent = '投稿する';
        }

        postModal.classList.add('show'); // .show for standard modal
        setTimeout(() => { modalPostContent.focus(); }, 100);
    }

    modalClose.addEventListener('click', () => {
        postModal.classList.remove('show');
    });

    // Schedule Toggle Logic
    scheduleToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            scheduleOptions.classList.add('active');
            // Set default date/time to now + 1 hour approx if empty
            if (!scheduleDateInput.value) {
                const now = new Date();
                scheduleDateInput.valueAsDate = now;
            }
        } else {
            scheduleOptions.classList.remove('active');
            // Clear inputs when toggled off to be explicit
            scheduleDateInput.value = '';
            scheduleTimeInput.value = '';
        }
    });

    // File Selection
    document.getElementById('modal-post-image').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const previewArea = document.getElementById('modal-image-preview');
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = document.createElement('img');
                        img.src = ev.target.result;
                        img.style.width = '80px';
                        img.style.height = '80px';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '4px';
                        previewArea.appendChild(img);
                    }
                    reader.readAsDataURL(file);
                } else {
                    const filePreview = document.createElement('div');
                    filePreview.style.display = 'inline-flex';
                    filePreview.style.alignItems = 'center';
                    filePreview.style.gap = '5px';
                    filePreview.style.padding = '8px 12px';
                    filePreview.style.background = '#f5f5f5';
                    filePreview.style.borderRadius = '6px';
                    filePreview.style.fontSize = '0.85rem';
                    filePreview.style.marginRight = '5px';
                    filePreview.innerHTML = `<i class="${getFileIcon(file.name)}" style="color:var(--primary-color);"></i> ${file.name}`;
                    previewArea.appendChild(filePreview);
                }
                selectedFiles.push(file);
            });
        }
    });

    // Close on click outside
    postModal.addEventListener('click', (e) => {
        if (e.target === postModal) {
            postModal.classList.remove('show');
        }
    });

    modalSubmitBtn.addEventListener('click', async () => {
        const content = modalPostContent.value.trim();
        if (!content) return;

        const allowComments = document.getElementById('modal-allow-comments').checked;
        const isScheduled = scheduleToggle.checked;
        let scheduledAt = new Date().toISOString(); // Default to now

        if (isScheduled) {
            const dateVal = scheduleDateInput.value;
            const timeVal = scheduleTimeInput.value;
            if (!dateVal || !timeVal) {
                alert('予約日時を設定してください。');
                return;
            }
            scheduledAt = new Date(`${dateVal}T${timeVal}`).toISOString();

            // Validate future date ONLY for NEW posts
            if (!isEditingPostId && new Date(scheduledAt) <= new Date()) {
                alert('予約日時は現在より未来の日時を指定してください。');
                return;
            }
        }

        modalSubmitBtn.disabled = true;
        modalSubmitBtn.textContent = '送信中...';

        // Upload Files via PHP API
        let imageUrls = [];
        if (selectedFiles.length > 0) {
            const formData = new FormData();
            for (const file of selectedFiles) {
                formData.append('files[]', file);
            }
            try {
                const uploadRes = await fetch(window.UPLOAD_API_URL, {
                    method: 'POST',
                    headers: { 'X-API-KEY': window.UPLOAD_API_KEY },
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success && uploadData.urls) {
                    imageUrls = uploadData.urls;
                } else {
                    console.error('Upload error:', uploadData.error);
                    alert('ファイルのアップロードに失敗しました: ' + (uploadData.error || '不明なエラー'));
                    modalSubmitBtn.disabled = false;
                    modalSubmitBtn.textContent = isUpdate ? '更新する' : '投稿する';
                    return; // Abort post creation
                }
            } catch (uploadErr) {
                console.error('Upload fetch error:', uploadErr);
                alert('ファイルのアップロードに失敗しました。');
                modalSubmitBtn.disabled = false;
                modalSubmitBtn.textContent = isUpdate ? '更新する' : '投稿する';
                return; // Abort post creation
            }
        }

        if (isEditingPostId) {
            // UPDATE
            let updateData = {
                content: content,
                allow_comments: allowComments,
                scheduled_at: scheduledAt
            };

            if (imageUrls.length > 0) {
                const { data: currentPost } = await supabase.from('board_posts').select('images').eq('id', isEditingPostId).single();
                const currentImages = currentPost?.images || [];
                updateData.images = [...currentImages, ...imageUrls];
            }

            const { error } = await supabase
                .from('board_posts')
                .update(updateData)
                .eq('id', isEditingPostId);

            modalSubmitBtn.disabled = false;
            modalSubmitBtn.textContent = '送信';

            if (error) {
                alert('更新に失敗しました: ' + error.message);
            } else {
                postModal.classList.remove('show');
                if (currentPostContext === 'all') loadAllPosts();
                else loadGroupPosts(currentGroupId);
            }

        } else {
            // INSERT
            let insertData = {
                user_id: user.id,
                content: content,
                allow_comments: allowComments,
                scheduled_at: scheduledAt
            };

            if (currentPostContext === 'all') {
                insertData.group_id = null;
            } else if (currentPostContext === 'group') {
                if (!currentGroupId) return;
                insertData.group_id = currentGroupId;
            } else {
                return; // Should not happen
            }

            insertData.images = imageUrls;

            const { error } = await supabase
                .from('board_posts')
                .insert([insertData]);

            modalSubmitBtn.disabled = false;
            modalSubmitBtn.textContent = '送信';

            if (error) {
                alert('投稿に失敗しました: ' + error.message);
            } else {
                postModal.classList.remove('show');
                if (currentPostContext === 'all') {
                    loadAllPosts();
                } else {
                    loadGroupPosts(currentGroupId);
                }

                // --- Auto Notification ---
                if (window.GAS_NOTIFICATION_URL) {
                    try {
                        const truncatedContent = content.length > 50 ? content.substring(0, 50) + '...' : content;
                        let notifPayload;

                        if (currentPostContext === 'group' && currentGroupId) {
                            // グループ投稿 → グループメンバーのみに通知
                            notifPayload = {
                                group_id: currentGroupId,
                                exclude_user_id: user.id,
                                title: 'グループに新しい投稿があります',
                                body: truncatedContent,
                                url: `/members-area.html?tab=group&group_id=${currentGroupId}`
                            };
                        } else {
                            // 全体掲示板 → 全ユーザーに通知
                            notifPayload = {
                                broadcast: true,
                                exclude_user_id: user.id,
                                title: '新しい投稿があります',
                                body: truncatedContent,
                                url: '/members-area.html?tab=all'
                            };
                        }

                        fetch(window.GAS_NOTIFICATION_URL, {
                            method: 'POST',
                            body: JSON.stringify(notifPayload),
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    } catch (notifErr) {
                        console.error('Auto notification error:', notifErr);
                    }
                }
            }
        }
    });


    // --- All Board Logic ---
    async function loadAllPosts(isSilent = false, offset = 0) {
        if (offset === 0) {
            allPostsOffset = 0;
            if (!isSilent) allFeed.innerHTML = '<p>読み込み中...</p>';
        }

        const { data, error } = await supabase
            .from('board_posts')
            .select(`
                *,
                profiles(display_name),
                board_comments(count)
            `)
            .is('group_id', null)
            .or(`scheduled_at.lte.${new Date().toISOString()},user_id.eq.${user.id}`)
            .order('is_pinned', { ascending: false })
            .order('scheduled_at', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + POST_LIMIT - 1);

        if (error) {
            console.error(error);
            allFeed.innerHTML = '<p>投稿の読み込みに失敗しました。</p>';
            return;
        }

        if (offset === 0) allFeed.innerHTML = ''; // Clear for fresh load (if silent was used, innerHTML might be old or blank)

        renderPosts(data, allFeed, offset > 0);

        // Load More Button
        const hasMore = data && data.length === POST_LIMIT;
        updateLoadMoreButton(allFeed, hasMore, () => {
            allPostsOffset += POST_LIMIT;
            loadAllPosts(true, allPostsOffset);
        });
    }

    // --- Group Logic ---
    backToGroupsBtn.addEventListener('click', () => {
        groupBoardView.style.display = 'none';
        groupsList.style.display = 'grid';
        currentGroupId = null;

        // Context Update
        currentPostContext = 'group_list';
        fabPost.style.display = 'none'; // Hide FAB
    });

    async function loadMyGroups() {
        let data = [];
        let error = null;

        if (isAdmin) {
            // Admin sees ALL groups
            const { data: groupsData, error: groupsError } = await supabase
                .from('groups')
                .select('id, name, description')
                .order('created_at', { ascending: false });

            if (groupsData) {
                // Map to same structure as group_members query for template compatibility
                data = groupsData.map(g => ({
                    groups: g,
                    can_post: true // Admins can always post
                }));
            }
            error = groupsError;

        } else {
            // Normal user: fetch joined groups
            const response = await supabase
                .from('group_members')
                .select(`
                    group_id,
                    can_post,
                    groups (
                        id, name, description
                    )
                `)
                .eq('user_id', user.id);
            data = response.data;
            error = response.error;
        }

        if (error) {
            console.error(error);
            groupsList.innerHTML = '<p>グループの読み込みに失敗しました。</p>';
            return;
        }

        if (data.length === 0) {
            groupsList.innerHTML = '<p>参加しているグループはありません。</p>';
            return;
        }

        groupsList.innerHTML = data.map(item => `
            <div class="group-card" onclick="openGroup('${item.groups.id}', '${item.groups.name}', ${item.can_post})">
                <h4 style="color:var(--primary-color); font-size:1.1rem; margin-bottom:0.5rem;">${item.groups.name}</h4>
                <p style="font-size:0.9rem; color:#666;">${item.groups.description || ''}</p>
            </div>
        `).join('');
    }

    // Expose to window for onclick
    window.openGroup = (gid, gname, canPost) => {
        currentGroupId = gid;
        currentGroupCanPost = canPost;

        groupsList.style.display = 'none';
        groupBoardView.style.display = 'block';
        currentGroupName.innerText = gname;

        // Context Update
        currentPostContext = 'group';

        if (canPost) {
            fabPost.style.display = 'flex'; // Show FAB
        } else {
            fabPost.style.display = 'none'; // Hide FAB if read-only
        }

        loadGroupPosts(gid);
    };

    async function loadGroupPosts(gid, isSilent = false, offset = 0) {
        if (offset === 0) {
            groupPostsOffset = 0;
            if (!isSilent) groupFeed.innerHTML = '<p>読み込み中...</p>';
        }

        const { data, error } = await supabase
            .from('board_posts')
            .select(`
                *,
                profiles(display_name),
                board_comments(count)
            `)
            .eq('group_id', gid)
            .or(`scheduled_at.lte.${new Date().toISOString()},user_id.eq.${user.id}`)
            .order('is_pinned', { ascending: false })
            .order('scheduled_at', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + POST_LIMIT - 1);

        if (error) {
            // renderPosts([], groupFeed); // This would clear errors. Better to show error or empty.
            if (offset === 0) renderPosts([], groupFeed);
            return;
        }

        if (offset === 0) groupFeed.innerHTML = '';

        renderPosts(data, groupFeed, offset > 0);

        // Load More Button View
        const hasMore = data && data.length === POST_LIMIT;
        updateLoadMoreButton(groupFeed, hasMore, () => {
            groupPostsOffset += POST_LIMIT;
            loadGroupPosts(gid, true, groupPostsOffset);
        });
    }

    // --- Header Scroll Logic ---
    const header = document.getElementById('global-header');
    let lastScrollTop = 0;

    if (header) {
        const headerHeight = header.offsetHeight;
        window.addEventListener('scroll', () => {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > lastScrollTop && scrollTop > headerHeight) {
                // Scroll Down -> Hide
                header.classList.add('hide');
            } else {
                // Scroll Up -> Show
                header.classList.remove('hide');
            }
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        });
    }

    // --- Lightbox Logic ---
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');

    window.openLightbox = (url) => {
        lightboxImg.src = url;
        lightboxModal.style.display = 'flex';
        setTimeout(() => lightboxModal.style.opacity = '1', 10);
    };

    const closeLightbox = () => {
        lightboxModal.style.opacity = '0';
        setTimeout(() => {
            lightboxModal.style.display = 'none';
            lightboxImg.src = '';
        }, 300);
    };

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
            closeLightbox();
        }
    });

    window.deleteMemberPost = async (postId) => {
        if (!confirm('この投稿を削除しますか？')) return;

        try {
            // 1. Get post data to find images
            const { data: post, error: fetchError } = await supabase
                .from('board_posts')
                .select('images')
                .eq('id', postId)
                .single();

            if (fetchError) {
                console.error('Error fetching post for deletion:', fetchError);
                // Continue to delete from DB even if fetch fails, to avoid zombie posts
            } else if (post && post.images && post.images.length > 0) {
                // 2. Delete files from X-server
                try {
                    await fetch('https://data.sodre.jp/api/delete.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-KEY': window.UPLOAD_API_KEY
                        },
                        body: JSON.stringify({ urls: post.images })
                    });
                } catch (deleteErr) {
                    console.error('Physical file delete error:', deleteErr);
                    // Continue to delete from DB
                }
            }

            // 3. Delete from DB
            const { error } = await supabase
                .from('board_posts')
                .delete()
                .eq('id', postId);

            if (error) {
                alert('削除に失敗しました: ' + error.message);
            } else {
                if (currentPostContext === 'all') loadAllPosts(true);
                else if (currentPostContext === 'group' && currentGroupId) loadGroupPosts(currentGroupId, true);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('削除中にエラーが発生しました。');
        }
    };

    window.togglePin = async (postId, currentPinState) => {
        const newState = !currentPinState;
        const { error } = await supabase.rpc('toggle_post_pin', { post_id: postId, pin_state: newState });

        if (error) {
            alert('ピン留めの変更に失敗しました: ' + error.message);
        } else {
            if (currentPostContext === 'all') loadAllPosts(true);
            else if (currentPostContext === 'group' && currentGroupId) loadGroupPosts(currentGroupId, true);
        }
    };

    // Edit function attached to window
    window.editMemberPost = async (postId) => {
        // Fetch full post details to populate modal
        const { data, error } = await supabase
            .from('board_posts')
            .select('*')
            .eq('id', postId)
            .single();

        if (error || !data) {
            alert('投稿情報の取得に失敗しました。');
            return;
        }
        openPostModal(data);
    };

    // --- Components ---
    function updateLoadMoreButton(container, hasMore, onClick) {
        // Remove existing button if any
        let existing = container.querySelector('.load-more-container');
        if (existing) existing.remove();

        if (hasMore) {
            const wrapper = document.createElement('div');
            wrapper.className = 'load-more-container';
            const btn = document.createElement('button');
            btn.className = 'load-more-btn';
            btn.innerText = 'さらに表示';
            btn.onclick = onClick;
            wrapper.appendChild(btn);
            container.appendChild(wrapper);
        }
    }

    function renderPosts(posts, container, append = false) {
        if (!append) {
            container.innerHTML = ''; // Clear if not appending
        } else {
            // If appending, remove "No posts" message if it exists (unlikely if appending but good safety)
            const noPosts = container.querySelector('.no-posts-msg');
            if (noPosts) noPosts.remove();

            // Remove old Load More button before appending new posts
            // (It will be re-added by updateLoadMoreButton)
            const oldBtn = container.querySelector('.load-more-container');
            if (oldBtn) oldBtn.remove();
        }

        if ((!posts || posts.length === 0) && !append) {
            container.innerHTML = '<p class="no-posts-msg">まだ投稿はありません。</p>';
            return;
        }

        if (!posts || posts.length === 0) return; // Nothing to append

        const now = new Date();

        const html = posts.map(post => {
            const scheduledDate = new Date(post.scheduled_at);
            const isScheduledFuture = scheduledDate > now;
            const isMyPost = post.user_id === user.id;

            // If it's a future post but NOT mine (shouldn't happen via API but safety), hide it
            if (isScheduledFuture && !isMyPost && !isAdmin) return '';

            // Edit Permission: Own post OR Superadmin
            const canEdit = isMyPost || isSuperAdmin;
            const canDelete = isMyPost || isAdmin; // Admin can delete any post (existing logic)

            return `
            <div class="board-post ${isScheduledFuture ? 'scheduled-post-container' : ''}" style="position:relative;">
                ${isScheduledFuture ?
                    `<div class="scheduled-badge"><i class="far fa-clock"></i> 予約投稿: ${scheduledDate.toLocaleString()}</div>`
                    : ''}
                <div class="bp-header" style="justify-content:space-between; align-items:center;">
                    <span class="bp-author">${post.profiles?.display_name || 'Unknown'}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="bp-date">${scheduledDate.toLocaleString()}</span>
                        
                        ${post.is_pinned ? `<i class="fas fa-thumbtack" style="color:var(--primary-color); margin-right:5px;" title="固定された投稿"></i>` : ''}

                        ${isAdmin ?
                    `<button onclick="togglePin('${post.id}', ${post.is_pinned})" style="background:none; border:none; color:${post.is_pinned ? '#666' : 'var(--primary-color)'}; cursor:pointer; font-size:0.8rem; text-decoration:underline;">
                                ${post.is_pinned ? '固定解除' : '固定する'}
                            </button>`
                    : ''}

                        ${canEdit ?
                    `<button onclick="editMemberPost('${post.id}')" style="background:none; border:none; color:var(--primary-color); cursor:pointer; font-size:0.8rem; text-decoration:underline;">編集</button>`
                    : ''}
                        
                        ${canDelete ?
                    `<button onclick="deleteMemberPost('${post.id}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:0.8rem; text-decoration:underline;">削除</button>`
                    : ''}
                    </div>
                </div>
                ${post.images && post.images.length > 0 ? `
                    <div style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
                        ${post.images.map(url => {
                        if (isImageUrl(url)) {
                            return `<img src="${url}" 
                                    onclick="openLightbox('${url}')"
                                    style="max-width:100%; height:auto; max-height:200px; border-radius:4px; cursor:pointer; transition:opacity 0.2s; object-fit: contain;" 
                                    onmouseover="this.style.opacity=0.8" 
                                    onmouseout="this.style.opacity=1"
                                >`;
                        } else {
                            // Extract original name from query param if available
                            let fname = url.split('/').pop();
                            try {
                                const urlObj = new URL(url);
                                const originalName = urlObj.searchParams.get('name');
                                if (originalName) {
                                    fname = originalName;
                                } else {
                                    // Fallback: strip query string from physical filename
                                    fname = fname.split('?')[0];
                                }
                            } catch (e) {
                                fname = fname.split('?')[0];
                            }

                            return `<a href="${url}" target="_blank" download="${fname}" 
                                    style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#f5f5f5; border-radius:6px; text-decoration:none; color:#333; font-size:0.85rem; transition:background 0.2s;"
                                    onmouseover="this.style.background='#eee'" onmouseout="this.style.background='#f5f5f5'">
                                    <i class="${getFileIconFromUrl(url)}" style="color:var(--primary-color); font-size:1.1rem;"></i>
                                    <span>${decodeURIComponent(fname)}</span>
                                    <i class="fas fa-download" style="color:#999; font-size:0.8rem;"></i>
                                </a>`;
                        }
                    }).join('')}
                    </div>
                ` : ''}
                <div class="bp-content">${formatContent(post.content)}</div>
                
                <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                    ${post.allow_comments ? (() => {
                    const commentCount = post.board_comments && post.board_comments[0] ? post.board_comments[0].count : 0;
                    const btnStyle = commentCount > 0 ? "color:var(--primary-color); font-weight:bold;" : "color:#666;";
                    const iconClass = commentCount > 0 ? "fas fa-comment" : "far fa-comment";
                    return `<button onclick="toggleComments('${post.id}')" style="background:none; border:none; cursor:pointer; font-size:0.9rem; ${btnStyle}">
                            <i class="${iconClass}"></i> コメント ${commentCount > 0 ? `(${commentCount})` : ''}
                        </button>`;
                })() : '<span style="color:#999; font-size:0.8rem;">コメント無効</span>'}
                </div>

                <!-- Comments Section -->
                <div id="comments-${post.id}" class="comments-section">
                    <div id="comments-list-${post.id}">
                        <!-- Comments loaded here -->
                        <p style="font-size:0.8rem; color:#999;">読み込み中...</p>
                    </div>
                    
                    ${post.allow_comments ? `
                        <div class="comment-form">
                            <textarea id="comment-input-${post.id}" class="comment-input" placeholder="コメントを書く..." rows="2" style="resize:vertical;"></textarea>
                            <button onclick="submitComment('${post.id}')" class="btn-comment-submit">送信</button>
                        </div>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');

        container.insertAdjacentHTML('beforeend', html);
    }

    // --- Comment Logic ---
    window.toggleComments = async (postId) => {
        const section = document.getElementById(`comments-${postId}`);
        if (section.style.display === 'block') {
            section.style.display = 'none';
        } else {
            section.style.display = 'block';
            await loadComments(postId);
        }
    };

    window.loadComments = async (postId) => {
        const listEl = document.getElementById(`comments-list-${postId}`);

        const { data, error } = await supabase
            .from('board_comments')
            .select(`
                *,
                profiles(display_name)
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error(error);
            listEl.innerHTML = '<p style="color:red;">コメントの読み込みに失敗しました。</p>';
            return;
        }

        renderComments(postId, data);
    };

    function renderComments(postId, comments) {
        const listEl = document.getElementById(`comments-list-${postId}`);
        if (!comments || comments.length === 0) {
            listEl.innerHTML = '<p style="font-size:0.8rem; color:#999;">まだコメントはありません。</p>';
            return;
        }

        listEl.innerHTML = comments.map(comment => {
            const canEditComment = (comment.user_id === user.id || isSuperAdmin);
            const canDeleteComment = (comment.user_id === user.id || isAdmin);
            return `
            <div class="comment-item" id="comment-item-${comment.id}">
                <div class="comment-header">
                    <span class="comment-author">${comment.profiles?.display_name || 'Unknown'}</span>
                    <div class="comment-actions">
                        <span>${new Date(comment.created_at).toLocaleString()}</span>
                        ${canEditComment ? `<button onclick="editComment('${comment.id}', '${postId}')" title="編集" style="background:none;border:none;cursor:pointer;color:var(--primary-color);"><i class="fas fa-edit"></i></button>` : ''}
                        ${canDeleteComment ?
                    `<button onclick="deleteComment('${comment.id}', '${postId}')" title="削除"><i class="fas fa-trash"></i></button>`
                    : ''}
                    </div>
                </div>
                <div id="comment-content-${comment.id}">${formatCommentContent(comment.content)}</div>
                <div id="comment-edit-form-${comment.id}" style="display:none; margin-top:8px;">
                    <textarea id="comment-edit-input-${comment.id}" class="comment-input" rows="2" style="resize:vertical; width:100%;">${escapeHtml(comment.content)}</textarea>
                    <div style="display:flex; gap:8px; margin-top:5px;">
                        <button onclick="saveCommentEdit('${comment.id}', '${postId}')" class="btn-comment-submit">保存</button>
                        <button onclick="cancelCommentEdit('${comment.id}')" style="background:none; border:1px solid #ccc; border-radius:4px; padding:4px 12px; cursor:pointer; color:#666;">キャンセル</button>
                    </div>
                </div>
            </div>
        `}).join('');
    }

    // --- Comment Edit Functions ---
    window.editComment = (commentId, postId) => {
        document.getElementById(`comment-content-${commentId}`).style.display = 'none';
        document.getElementById(`comment-edit-form-${commentId}`).style.display = 'block';
    };

    window.cancelCommentEdit = (commentId) => {
        document.getElementById(`comment-content-${commentId}`).style.display = 'block';
        document.getElementById(`comment-edit-form-${commentId}`).style.display = 'none';
    };

    window.saveCommentEdit = async (commentId, postId) => {
        const inputEl = document.getElementById(`comment-edit-input-${commentId}`);
        const content = inputEl.value.trim();
        if (!content) return;

        const { error } = await supabase
            .from('board_comments')
            .update({ content: content })
            .eq('id', commentId);

        if (error) {
            alert('コメントの更新に失敗しました: ' + error.message);
        } else {
            await loadComments(postId);
        }
    };

    window.submitComment = async (postId) => {
        const inputEl = document.getElementById(`comment-input-${postId}`);
        const content = inputEl.value.trim();

        if (!content) return;

        const { error } = await supabase
            .from('board_comments')
            .insert([{
                post_id: postId,
                user_id: user.id,
                content: content
            }]);

        if (error) {
            alert('コメントの送信に失敗しました: ' + error.message);
        } else {
            inputEl.value = '';
            await loadComments(postId); // Reload comments
        }
    };

    window.deleteComment = async (commentId, postId) => {
        if (!confirm('本当に削除しますか？')) return;

        const { error } = await supabase
            .from('board_comments')
            .delete()
            .eq('id', commentId);

        if (error) {
            alert('削除に失敗しました: ' + error.message);
        } else {
            await loadComments(postId); // Reload
        }
    };

    // --- File Type Helpers ---
    function isImageUrl(url) {
        const ext = url.split('.').pop().split('?')[0].toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fas fa-file-pdf',
            'doc': 'fas fa-file-word', 'docx': 'fas fa-file-word',
            'xls': 'fas fa-file-excel', 'xlsx': 'fas fa-file-excel', 'csv': 'fas fa-file-excel',
            'ppt': 'fas fa-file-powerpoint', 'pptx': 'fas fa-file-powerpoint',
            'txt': 'fas fa-file-alt',
            'zip': 'fas fa-file-archive', 'rar': 'fas fa-file-archive',
            'mp3': 'fas fa-file-audio', 'wav': 'fas fa-file-audio', 'ogg': 'fas fa-file-audio', 'm4a': 'fas fa-file-audio',
            'mp4': 'fas fa-file-video', 'mov': 'fas fa-file-video', 'avi': 'fas fa-file-video', 'webm': 'fas fa-file-video',
        };
        return iconMap[ext] || 'fas fa-file';
    }

    function getFileIconFromUrl(url) {
        const filename = url.split('/').pop().split('?')[0];
        return getFileIcon(filename);
    }

    function createFilePreviewHTML(url) {
        let fname = decodeURIComponent(url.split('/').pop());
        try {
            const urlObj = new URL(url);
            const originalName = urlObj.searchParams.get('name');
            if (originalName) {
                fname = originalName;
            } else {
                fname = fname.split('?')[0];
            }
        } catch (e) {
            fname = fname.split('?')[0];
        }

        return `<div style="display:inline-flex; align-items:center; gap:5px; padding:8px 12px; background:#f5f5f5; border-radius:6px; font-size:0.85rem;">
            <i class="${getFileIconFromUrl(url)}" style="color:var(--primary-color);"></i> ${fname}
        </div>`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatContent(text) {
        if (!text) return '';
        // 1. Escape HTML first to prevent XSS
        let escaped = escapeHtml(text);

        // 2. Linkify URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let linked = escaped.replace(urlRegex, function (url) {
            return `<a href="${url}" class="external-link" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
        });

        return linked;
    }

    function formatCommentContent(text) {
        if (!text) return '';
        let escaped = escapeHtml(text);

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let linked = escaped.replace(urlRegex, function (url) {
            return `<a href="${url}" class="external-link" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
        });

        // Explicitly replace newlines with <br> for comments
        return linked.replace(/\n/g, '<br>');
    }

    // --- External Link Warning Logic ---
    const extModal = document.getElementById('external-link-modal');
    const extUrlDisplay = document.getElementById('external-link-url');
    const extCancelBtn = document.getElementById('external-link-cancel');
    const extProceedBtn = document.getElementById('external-link-proceed');
    let targetExternalUrl = '';

    // Delegate click event for dynamically added links
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('external-link')) {
            e.preventDefault();
            targetExternalUrl = e.target.href;
            extUrlDisplay.textContent = targetExternalUrl;
            extModal.classList.add('show');
        }
    });

    extCancelBtn.addEventListener('click', () => {
        extModal.classList.remove('show');
        targetExternalUrl = '';
    });

    extProceedBtn.addEventListener('click', () => {
        if (targetExternalUrl) {
            window.open(targetExternalUrl, '_blank', 'noopener,noreferrer');
            extModal.classList.remove('show');
            targetExternalUrl = '';
        }
    });

    // --- Realtime Subscription ---
    // --- Realtime Subscription ---
    const channel = supabase
        .channel('board_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'board_posts' },
            (payload) => {
                const eventType = payload.eventType; // INSERT, UPDATE, DELETE
                const newPost = payload.new;

                // Logic to decide whether to reload posts
                if (eventType === 'INSERT') {
                    // Check if the new post is relevant to current view
                    if (currentPostContext === 'all') {
                        if (!newPost.group_id) {
                            loadAllPosts(true);
                        }
                    } else if (currentPostContext === 'group') {
                        if (newPost.group_id === currentGroupId) {
                            loadGroupPosts(currentGroupId, true);
                        }
                    }
                } else {
                    // UPDATE or DELETE - safer to just reload
                    if (currentPostContext === 'all') loadAllPosts(true);
                    else if (currentPostContext === 'group' && currentGroupId) loadGroupPosts(currentGroupId, true);
                }
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'board_comments' },
            (payload) => {
                // When comments change, reload comments if the section is open
                // And ideally update the comment count on the post
                const newComment = payload.new;
                const oldComment = payload.old;
                const postId = newComment?.post_id || oldComment?.post_id;

                if (postId) {
                    // 1. Reload comments if open
                    const commentsList = document.getElementById(`comments-list-${postId}`);
                    if (commentsList && commentsList.offsetParent !== null) { // visible check
                        loadComments(postId);
                    }

                    // 2. Reload posts to update comment count (Silent)
                    // This might be heavy, but ensures consistency
                    if (currentPostContext === 'all') loadAllPosts(true);
                    else if (currentPostContext === 'group' && currentGroupId) loadGroupPosts(currentGroupId, true);
                }
            }
        )
        .subscribe();
});
