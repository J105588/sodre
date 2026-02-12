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

    // New Schedule Elements
    const scheduleToggle = document.getElementById('schedule-toggle');
    const scheduleOptions = document.getElementById('schedule-options');
    const scheduleDateInput = document.getElementById('schedule-date');
    const scheduleTimeInput = document.getElementById('schedule-time');

    // --- State ---
    let currentPostContext = 'all'; // 'all' or 'group'
    let currentGroupId = null;
    let currentGroupCanPost = false;
    let selectedImages = []; // Store selected files for upload
    let isAdmin = false; // New Admin State

    // --- Auth Check ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    const user = session.user;
    loadProfile(user.id);

    // --- Profile Logic ---
    async function loadProfile(uid) {
        const { data, error } = await supabase
            .from('profiles')
            .select('display_name, is_admin')
            .eq('id', uid)
            .maybeSingle();

        if (data && data.display_name) {
            displayNameEl.textContent = `ようこそ、 ${data.display_name} さん`;
        } else {
            // Prioritize Display Name but fallback to email if empty
            displayNameEl.textContent = `ようこそ、 ${user.email} さん`;
            // If display_name is retrieved but empty, logic holds.
        }

        if (data && data.is_admin) {
            isAdmin = true;
            console.log('User is Admin');
        }

        setupSessionTimeout(); // Start inactivity timer
    }

    // --- Session Expiration Logic (60 mins) ---
    function setupSessionTimeout() {
        const TIMEOUT_DURATION = 60 * 60 * 1000; // 60 minutes
        let timeout;

        const resetTimer = () => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                alert('Session expired due to inactivity.');
                await supabase.auth.signOut();
                window.location.href = 'login.html';
            }, TIMEOUT_DURATION);
        };

        // Listen for activity
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, resetTimer);
        });

        resetTimer(); // Start timer
    }

    // --- Logout ---
    logoutBtn.addEventListener('click', async () => {
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

                // Update Context (Initially Group List)
                currentPostContext = 'group_list';
                fabPost.style.display = 'none'; // Hide FAB in Group List
                loadMyGroups();
            }
        });
    });

    // --- Initial Load ---
    loadAllPosts();

    // --- Modal / FAB Logic ---
    fabPost.addEventListener('click', () => {
        modalPostContent.value = '';
        if (currentPostContext === 'all') {
            modalTitle.textContent = '全体掲示板に投稿';
        } else if (currentPostContext === 'group') {
            modalTitle.textContent = `${currentGroupName.innerText} に投稿`;
        }

        // Reset Images
        selectedImages = [];
        document.getElementById('modal-post-image').value = '';
        document.getElementById('modal-image-preview').innerHTML = '';
        document.getElementById('modal-allow-comments').checked = true; // Default to true

        // Reset Schedule
        scheduleToggle.checked = false;
        scheduleOptions.classList.remove('active');
        scheduleDateInput.value = '';
        scheduleTimeInput.value = '';

        postModal.classList.add('show'); // .show for standard modal
        setTimeout(() => { modalPostContent.focus(); }, 100);
    });

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
        }
    });

    // Image Selection
    document.getElementById('modal-post-image').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const previewArea = document.getElementById('modal-image-preview');
            files.forEach(file => {
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
                selectedImages.push(file);
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

            // Validate future date
            if (new Date(scheduledAt) <= new Date()) {
                alert('予約日時は現在より未来の日時を指定してください。');
                return;
            }
        }

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

        modalSubmitBtn.disabled = true;
        modalSubmitBtn.textContent = '送信中...';

        // Upload Images
        let imageUrls = [];
        if (selectedImages.length > 0) {
            for (const file of selectedImages) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
                const filePath = `${fileName}`;
                const { data, error } = await supabase.storage.from('images').upload(filePath, file);
                if (!error) {
                    const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
                    imageUrls.push(publicUrl);
                }
            }
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
        }
    });


    // --- All Board Logic ---
    async function loadAllPosts(isSilent = false) {
        if (!isSilent) allFeed.innerHTML = '<p>読み込み中...</p>';
        const { data, error } = await supabase
            .from('board_posts')
            .select(`
                *,
                profiles(display_name),
                board_comments(count)
            `)
            .is('group_id', null)
            .is('group_id', null)
            // Show posts that are (published AND <= now) OR (my future posts)
            // Note: OR filter syntax in JS client: .or('condition1,condition2')
            // condition1: scheduled_at.lte.NOW
            // condition2: user_id.eq.MY_ID  <-- Actually this logic is tricky with single .or() because it might show ALL my posts regardless of time (which is fine)
            // Let's try: (scheduled_at <= NOW) OR (user_id == ME)
            // But we only want filtering on time.
            // Actually, for a simple board:
            // "Show all posts where scheduled_at <= NOW"
            // UNION
            // "Show my posts where scheduled_at > NOW"

            // Supabase .or() with filters on different columns:
            // .or(`scheduled_at.lte.${new Date().toISOString()},and(user_id.eq.${user.id},scheduled_at.gt.${new Date().toISOString()})`)
            // This complex query string might be fragile. 

            // Simpler approach: Fetch ALL and filter in JS? No, pagination/performance.
            // Let's use the .or syntax carefully.
            // .or('scheduled_at.lte.NOW, user_id.eq.ME') means "Time is past OR User is Me".
            // If User is Me, I see all my posts (past and future). CORRECT.
            // If Time is Past, I see everyone's posts. CORRECT.
            .or(`scheduled_at.lte.${new Date().toISOString()},user_id.eq.${user.id}`)
            .order('scheduled_at', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            allFeed.innerHTML = '<p>投稿の読み込みに失敗しました。</p>';
            return;
        }
        renderPosts(data, allFeed);
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

    async function loadGroupPosts(gid, isSilent = false) {
        if (!isSilent) groupFeed.innerHTML = '<p>読み込み中...</p>';
        const { data, error } = await supabase
            .from('board_posts')
            .select(`
                *,
                profiles(display_name),
                board_comments(count)
            `)
            .eq('group_id', gid)
            .or(`scheduled_at.lte.${new Date().toISOString()},user_id.eq.${user.id}`)
            .order('scheduled_at', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            renderPosts([], groupFeed);
            return;
        }
        renderPosts(data, groupFeed);
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
        if (!confirm('本当にこの投稿を削除しますか？')) return;

        const { error } = await supabase
            .from('board_posts')
            .delete()
            .eq('id', postId);

        if (error) {
            alert('削除に失敗しました: ' + error.message);
        } else {
            if (currentPostContext === 'all') {
                loadAllPosts();
            } else {
                // If we are in group view, reload group posts
                // currentGroupId must be accessible
                if (currentGroupId) {
                    loadGroupPosts(currentGroupId);
                } else {
                    // Fallback if context is weird, reload all or what? 
                    // If context is group_list, actually we shouldn't be seeing posts usually?
                    // Actually tab switching sets context.
                    // If in group board view:
                    loadGroupPosts(currentGroupId);
                }
            }
        }
    };

    // --- Components ---
    function renderPosts(posts, container) {
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p>まだ投稿はありません。</p>';
            return;
        }

        const now = new Date();

        container.innerHTML = posts.map(post => {
            const scheduledDate = new Date(post.scheduled_at);
            const isScheduledFuture = scheduledDate > now;
            const isMyPost = post.user_id === user.id;

            // If it's a future post but NOT mine (shouldn't happen via API but safety), hide it
            if (isScheduledFuture && !isMyPost && !isAdmin) return '';

            return `
            <div class="board-post ${isScheduledFuture ? 'scheduled-post-container' : ''}" style="position:relative;">
                ${isScheduledFuture ?
                    `<div class="scheduled-badge"><i class="far fa-clock"></i> 予約投稿: ${scheduledDate.toLocaleString()}</div>`
                    : ''}
                <div class="bp-header" style="justify-content:space-between; align-items:center;">
                    <span class="bp-author">${post.profiles?.display_name || 'Unknown'}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="bp-date">${scheduledDate.toLocaleString()}</span>
                        ${(isMyPost || isAdmin) ?
                    `<button onclick="deleteMemberPost('${post.id}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:0.8rem; text-decoration:underline;">削除</button>`
                    : ''}
                    </div>
                </div>
                ${post.images && post.images.length > 0 ? `
                    <div style="display:flex; gap:10px; overflow-x:auto; margin-bottom:10px;">
                        ${post.images.map(url => `
                            <img src="${url}" 
                                onclick="openLightbox('${url}')"
                                style="height:100px; width:auto; border-radius:4px; cursor:pointer; transition:opacity 0.2s;" 
                                onmouseover="this.style.opacity=0.8" 
                                onmouseout="this.style.opacity=1"
                            >
                        `).join('')}
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
                            <input type="text" id="comment-input-${post.id}" class="comment-input" placeholder="コメントを書く...">
                            <button onclick="submitComment('${post.id}')" class="btn-comment-submit">送信</button>
                        </div>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');
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

        listEl.innerHTML = comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${comment.profiles?.display_name || 'Unknown'}</span>
                    <div class="comment-actions">
                        <span>${new Date(comment.created_at).toLocaleString()}</span>
                        ${(comment.user_id === user.id || isAdmin) ?
                `<button onclick="deleteComment('${comment.id}', '${postId}')" title="削除"><i class="fas fa-trash"></i></button>`
                : ''}
                    </div>
                </div>
                <div>${escapeHtml(comment.content)}</div>
            </div>
        `).join('');
    }

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
        // Simple regex to catch http/https URLs
        // Note: We do this AFTER escaping so we don't break our own <a> tags, 
        // and because user content won't have HTML tags anymore.
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        return escaped.replace(urlRegex, function (url) {
            // Removed target="_blank" to handle via JS
            return `<a href="${url}" class="external-link" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
        });
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
    const channel = supabase
        .channel('board_posts_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'board_posts' },
            (payload) => {
                const eventType = payload.eventType; // INSERT, UPDATE, DELETE
                const newPost = payload.new;

                // Logic to decide whether to reload
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
        .subscribe();
});
