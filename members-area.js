document.addEventListener('DOMContentLoaded', async () => {
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
    if (!supabase) return;

    // UI Elements
    const displayNameEl = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const tabBtns = document.querySelectorAll('.m-tab-btn');
    const viewAll = document.getElementById('view-all');
    const viewGroups = document.getElementById('view-groups');

    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const user = session.user;
    loadProfile(user.id);

    // --- Layout & Tabs ---
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            if (tab === 'all') {
                viewAll.style.display = 'block';
                viewGroups.style.display = 'none';
                loadAllPosts();
            } else {
                viewAll.style.display = 'none';
                viewGroups.style.display = 'block';
                loadMyGroups();
            }
        });
    });

    // --- Initial Load ---
    loadAllPosts();

    // --- Profile ---
    async function loadProfile(uid) {
        const { data, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', uid)
            .single();

        if (data && data.display_name) {
            displayNameEl.textContent = `Welcome, ${data.display_name}`;
        } else {
            displayNameEl.textContent = `Welcome, ${user.email}`;
            // Optionally prompt to set display name?
            // If profile doesn't exist, Create it? (Should be done by trigger)
        }
    }

    // --- All Members Board ---
    const allPostBtn = document.getElementById('all-post-btn');
    const allPostContent = document.getElementById('all-post-content');
    const allFeed = document.getElementById('all-board-feed');

    allPostBtn.addEventListener('click', async () => {
        const content = allPostContent.value.trim();
        if (!content) return;

        const { error } = await supabase
            .from('board_posts')
            .insert([{
                user_id: user.id,
                group_id: null, // Global
                content: content
            }]);

        if (error) {
            alert('投稿に失敗しました: ' + error.message);
        } else {
            allPostContent.value = '';
            loadAllPosts();
        }
    });

    async function loadAllPosts() {
        allFeed.innerHTML = '<p>Loading...</p>';
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
            allFeed.innerHTML = '<p>Error loading posts.</p>';
            return;
        }

        renderPosts(data, allFeed);
    }

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
                <div class="bp-content">${escapeHtml(post.content)}</div>
            </div>
        `).join('');
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Group Logic ---
    const groupsList = document.getElementById('my-groups-list');
    const groupBoardView = document.getElementById('group-board-view');
    const currentGroupName = document.getElementById('current-group-name');
    const backToGroupsBtn = document.getElementById('back-to-groups-btn');

    const groupPostBtn = document.getElementById('group-post-btn');
    const groupPostContent = document.getElementById('group-post-content');
    const groupFeed = document.getElementById('group-board-feed');
    const groupFormArea = document.getElementById('group-post-form-area');

    let currentGroupId = null;
    let currentGroupCanPost = false; // Initialize safe

    backToGroupsBtn.addEventListener('click', () => {
        groupBoardView.style.display = 'none';
        groupsList.style.display = 'grid';
        currentGroupId = null;
    });

    async function loadMyGroups() {
        const { data, error } = await supabase
            .from('group_members')
            .select(`
                group_id,
                can_post,
                groups (
                    id, name, description
                )
            `)
            .eq('user_id', user.id);

        if (error) {
            console.error(error);
            groupsList.innerHTML = '<p>Error loading groups.</p>';
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

        // Handle posting permission UI
        if (canPost) {
            groupFormArea.style.display = 'block';
        } else {
            groupFormArea.style.display = 'none';
        }

        loadGroupPosts(gid);
    };

    groupPostBtn.addEventListener('click', async () => {
        const content = groupPostContent.value.trim();
        if (!content || !currentGroupId) return;

        const { error } = await supabase
            .from('board_posts')
            .insert([{
                user_id: user.id,
                group_id: currentGroupId,
                content: content
            }]);

        if (error) {
            alert('投稿に失敗しました: ' + error.message);
        } else {
            groupPostContent.value = '';
            loadGroupPosts(currentGroupId);
        }
    });

    async function loadGroupPosts(gid) {
        groupFeed.innerHTML = '<p>Loading...</p>';
        const { data, error } = await supabase
            .from('board_posts')
            .select(`
                *,
                profiles(display_name)
            `)
            .eq('group_id', gid)
            .order('created_at', { ascending: false });

        if (error) {
            renderPosts([], groupFeed); // Empty or error
            return;
        }
        renderPosts(data, groupFeed);
    }
});
