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

        postModal.classList.add('show'); // .show for standard modal
        setTimeout(() => { modalPostContent.focus(); }, 100);
    });

    modalClose.addEventListener('click', () => {
        postModal.classList.remove('show');
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

        let insertData = {
            user_id: user.id,
            content: content
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
    async function loadAllPosts() {
        allFeed.innerHTML = '<p>読み込み中...</p>';
        const { data, error } = await supabase
            .from('board_posts')
            .select(`
                *,
                profiles(display_name)
            `)
            .is('group_id', null)
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

    async function loadGroupPosts(gid) {
        groupFeed.innerHTML = '<p>読み込み中...</p>';
        const { data, error } = await supabase
            .from('board_posts')
            .select(`
                *,
                profiles(display_name)
            `)
            .eq('group_id', gid)
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

    // --- Components ---
    function renderPosts(posts, container) {
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p>まだ投稿はありません。</p>';
            return;
        }

        container.innerHTML = posts.map(post => `
            <div class="board-post">
                <div class="bp-header">
                    <span class="bp-author">${post.profiles?.display_name || 'Unknown'}</span>
                    <span class="bp-date">${new Date(post.created_at).toLocaleString()}</span>
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
                <div class="bp-content">${escapeHtml(post.content)}</div>
            </div>
        `).join('');
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
});
