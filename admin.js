// --- Configuration ---
// Config moved to config.js

// Wrapped in IIFE to prevent global scope pollution
(() => {
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

    // --- Dom Elements ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');

    const logoutBtn = document.getElementById('logout-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Post Elements
    const postsEditorArea = document.getElementById('posts-editor-area');
    const postForm = document.getElementById('post-form');
    const postTitleInput = document.getElementById('post-title');
    const postCategoryInput = document.getElementById('post-category'); // Hidden input
    const editorTitle = document.getElementById('editor-title');
    const postsContainer = document.getElementById('posts-container');
    const imageInput = document.getElementById('post-image');
    const imagePreview = document.getElementById('image-preview');

    // Group Elements
    const groupsManagerArea = document.getElementById('groups-manager-area');
    const createGroupForm = document.getElementById('create-group-form');
    const adminGroupsList = document.getElementById('admin-groups-list');
    // const groupDetailPanel = document.getElementById('group-detail-panel'); // Old inline
    const groupManageModal = document.getElementById('group-manage-modal'); // New Modal
    const manageGroupTitle = document.getElementById('manage-group-title');
    const closeGroupPanelBtn = document.getElementById('close-group-panel');
    // const addMemberEmailInfo = document.getElementById('add-member-email'); // REMOVED
    const addMemberSelect = document.getElementById('add-member-select'); // NEW
    const addMemberCanPost = document.getElementById('add-member-can-post'); // NEW
    const btnAddMember = document.getElementById('btn-add-member');
    const groupMembersList = document.getElementById('group-members-list');
    const addMemberMsg = document.getElementById('add-member-msg');

    // Users Elements
    const usersManagerArea = document.getElementById('users-manager-area');
    const createUserForm = document.getElementById('create-user-form');

    const adminUsersList = document.getElementById('admin-users-list');
    // Edit User Modal Elements
    const userEditModal = document.getElementById('user-edit-modal');
    const userEditForm = document.getElementById('user-edit-form');
    const editUserIdInput = document.getElementById('edit-user-id');
    const editUserNameInput = document.getElementById('edit-user-name');
    const editUserIsAdminInput = document.getElementById('edit-user-is-admin');
    const closeUserEdit = document.getElementById('close-user-edit');
    const cancelUserEdit = document.getElementById('cancel-user-edit');

    // Post Edit Modal Elements
    const postEditModal = document.getElementById('post-edit-modal');
    const postEditForm = document.getElementById('post-edit-form');
    const editPostIdInput = document.getElementById('edit-post-id');
    const editPostCategoryInput = document.getElementById('edit-post-category');
    const editPostTitleInput = document.getElementById('edit-post-title');
    const closePostEdit = document.getElementById('close-post-edit');
    const cancelPostEdit = document.getElementById('cancel-post-edit');

    // Calendar Elements
    const calendarManagerArea = document.getElementById('calendar-manager-area');
    const createCalTypeForm = document.getElementById('create-cal-type-form');
    const calTypesList = document.getElementById('cal-types-list');
    const createCalEventForm = document.getElementById('create-cal-event-form');
    const calEventTypeSelect = document.getElementById('cal-event-type-select');
    const calEventsList = document.getElementById('cal-events-list');

    // Pages Elements
    const pagesManagerArea = document.getElementById('pages-manager-area');
    const adminPagesList = document.getElementById('admin-pages-list');
    const addPageForm = document.getElementById('add-page-form');



    let quill;
    let editQuill;
    let currentTab = 'news'; // 'news', 'diary', 'topics', 'groups', 'calendar', 'users'

    let selectedImages = [];
    let editSelectedImages = [];
    let currentPostImages = [];
    let currentManagingGroupId = null;

    // --- Session Expiration Logic (30 mins) ---
    function setupSessionTimeout() {
        const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
        let timeout;

        const resetTimer = () => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                alert('Session expired due to inactivity.');
                await supabase.auth.signOut();
                window.location.reload();
            }, TIMEOUT_DURATION);
        };

        // Listen for activity
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, resetTimer);
        });

        resetTimer(); // Start timer
    }

    document.addEventListener('DOMContentLoaded', () => {

        // Initialize Quill
        quill = new Quill('#quill-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link', 'clean']
                ]
            }
        });

        // Initialize Edit Quill
        editQuill = new Quill('#edit-quill-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link', 'clean']
                ]
            }
        });



        // Check Session
        checkUser();

        // Tabs Logic
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;

                // Hide all areas first
                postsEditorArea.style.display = 'none';
                groupsManagerArea.style.display = 'none';
                calendarManagerArea.style.display = 'none';
                usersManagerArea.style.display = 'none';
                pagesManagerArea.style.display = 'none';

                if (currentTab === 'groups') {
                    groupsManagerArea.style.display = 'block';
                    loadAdminGroups();
                } else if (currentTab === 'calendar') {
                    calendarManagerArea.style.display = 'block';
                    loadCalTypes();
                    loadCalEvents();
                } else if (currentTab === 'users') {
                    usersManagerArea.style.display = 'block';
                    loadAdminUsers();
                } else if (currentTab === 'pages') {
                    pagesManagerArea.style.display = 'block';
                    loadAdminPages();
                } else {
                    postsEditorArea.style.display = 'block';
                    // Reset Post Editor
                    editorTitle.innerText = `新規投稿 (${currentTab.toUpperCase()})`;
                    postCategoryInput.value = currentTab;
                    loadPosts(currentTab);
                }
            });
        });

        // Login
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const { data, error } = await supabase.auth.signInWithPassword({
                email, password
            });

            if (error) {
                alert('ログインに失敗しました: ' + error.message);
            } else {
                checkUser(); // Re-check to verify admin
            }
        });

        // Logout
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });

        // --- Post Management ---
        // Handle Image Selection
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = document.createElement('img');
                        img.src = ev.target.result;
                        img.style.width = '100px';
                        img.style.height = '100px';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '4px';
                        imagePreview.appendChild(img);
                    }
                    reader.readAsDataURL(file);
                    selectedImages.push(file); // Store file object
                });
            }
        });

        // --- Preview Logic ---
        const previewBtn = document.getElementById('preview-btn');
        const previewModal = document.getElementById('preview-modal');
        const closePreview = document.getElementById('close-preview');
        const closePreviewBtn = document.getElementById('close-preview-btn');
        const previewTitle = document.getElementById('preview-title');
        const previewBody = document.getElementById('preview-body');
        const previewContainer = document.getElementById('preview-container');

        previewBtn.addEventListener('click', () => {
            const title = postTitleInput.value;
            const content = quill.root.innerHTML;

            // 1. Set Title
            previewTitle.innerText = title || '(タイトルなし)';

            // 2. Build Images HTML from selectedImages (File objects)
            let imagesHtml = '';
            if (selectedImages && selectedImages.length > 0) {
                imagesHtml = '<div class="post-images" style="display:flex; gap:10px; overflow-x:auto; margin-bottom:1rem;">';
                selectedImages.forEach(file => {
                    const imgUrl = URL.createObjectURL(file);
                    imagesHtml += `<img src="${imgUrl}">`;
                });
                imagesHtml += '</div>';
            }

            // 3. Set Body (Images + Content)
            // Note: We prepend images to body container to match frontend layout approx
            // But frontend puts images *before* .post-body-text. 
            // In admin.html I created #preview-body with class .post-body-text.
            // So I should insert images *before* #preview-body or inside it at the top?
            // posts.js puts images OUTSIDE .post-body-text.

            // Let's reconstruct the container content slightly to match posts.js structure:
            // <h2>Title</h2> <p>Date</p> <images> <body-text>

            // Re-render the container
            previewContainer.innerHTML = `
                <h2 class="post-title">${escapeHtml(title || '(タイトルなし)')}</h2>
                <p class="post-date" style="color:#888; font-size:0.9rem; margin-bottom:1rem;">${new Date().toLocaleDateString()} (Preview)</p>
                ${imagesHtml}
                <div class="ql-snow">
                    <div class="ql-editor post-body-text">
                        ${content}
                    </div>
                </div>
            `;

            previewModal.style.display = 'flex';
            setTimeout(() => previewModal.style.opacity = '1', 10);
        });

        const hidePreview = () => {
            previewModal.style.opacity = '0';
            setTimeout(() => previewModal.style.display = 'none', 300);
        };

        closePreview.addEventListener('click', hidePreview);
        closePreviewBtn.addEventListener('click', hidePreview);

        window.onclick = function (event) {
            if (event.target == previewModal) {
                hidePreview();
            }
        };

        // Create Post
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loadingOverlay.style.display = 'flex'; // Show Overlay
            const title = postTitleInput.value;
            const rawContent = quill.root.innerHTML; // Get HTML
            // const content = quill.getText(); // Plain text if needed
            const category = postCategoryInput.value;

            // Upload Images if any
            let uploadedImageUrls = [];
            if (selectedImages.length > 0) {
                for (const file of selectedImages) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
                    const filePath = `${fileName}`;

                    const { data, error } = await supabase.storage
                        .from('images')
                        .upload(filePath, file);

                    if (error) {
                        console.error('Upload error', error);
                    } else {
                        const { data: { publicUrl } } = supabase.storage
                            .from('images')
                            .getPublicUrl(filePath);
                        uploadedImageUrls.push(publicUrl);
                    }
                }
            }

            const { data, error } = await supabase
                .from('posts')
                .insert([{
                    title: title,
                    content: rawContent,
                    category: category,
                    images: uploadedImageUrls,
                    published: true // Auto publish for now
                }])
                .select();

            if (error) {
                alert('投稿の作成に失敗しました: ' + error.message);
            } else {
                alert('投稿を作成しました！');
                postForm.reset();
                quill.setContents([]);
                imagePreview.innerHTML = '';
                selectedImages = [];
                loadPosts(category);
            }
            loadingOverlay.style.display = 'none'; // Hide Overlay
        });

        // --- Group Management ---
        createGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loadingOverlay.style.display = 'flex';
            const name = document.getElementById('new-group-name').value;
            const desc = document.getElementById('new-group-desc').value;

            const { data, error } = await supabase
                .from('groups')
                .insert([{ name: name, description: desc }])
                .select(); // Fetch created group data

            if (error) {
                alert('グループの作成に失敗しました: ' + error.message);
            } else {
                alert('グループを作成しました！メンバーを追加できます。');
                document.getElementById('new-group-name').value = '';
                document.getElementById('new-group-desc').value = '';

                // Refresh list and wait for it
                await loadAdminGroups();

                // Auto-open management panel for new group
                if (data && data.length > 0) {
                    const newGroup = data[0];
                    manageGroup(newGroup.id, newGroup.name);
                }
            }
            loadingOverlay.style.display = 'none';
        });

        const hideGroupModal = () => {
            groupManageModal.style.opacity = '0';
            setTimeout(() => {
                groupManageModal.style.display = 'none';
                currentManagingGroupId = null;
            }, 300);
        };

        closeGroupPanelBtn.addEventListener('click', hideGroupModal);

        btnAddMember.addEventListener('click', async () => {
            const userId = addMemberSelect.value;
            const canPost = addMemberCanPost.checked;

            addMemberMsg.textContent = '';
            if (!userId || !currentManagingGroupId) {
                addMemberMsg.textContent = 'ユーザーを選択してください。';
                return;
            }

            loadingOverlay.style.display = 'flex'; // Show

            // Direct add using selected ID
            const { error: addError } = await supabase
                .from('group_members')
                .insert([{
                    group_id: currentManagingGroupId,
                    user_id: userId,
                    can_post: canPost
                }]);

            if (addError) {
                // Unique constraint might trigger if already member
                addMemberMsg.textContent = 'メンバー追加エラー（既に追加済みの可能性があります）: ' + addError.message;
            } else {
                addMemberSelect.value = '';
                addMemberCanPost.checked = true; // reset
                loadGroupMembers(currentManagingGroupId);
            }
            loadingOverlay.style.display = 'none'; // Hide
        });

        // --- Calendar Management ---
        createCalTypeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loadingOverlay.style.display = 'flex';
            const label = document.getElementById('cal-type-label').value;
            const color = document.getElementById('cal-type-color').value;

            const { error } = await supabase
                .from('calendar_types')
                .insert([{ label: label, color: color }]);

            if (error) {
                alert('種別の追加に失敗しました: ' + error.message);
            } else {
                document.getElementById('cal-type-label').value = '';
                loadCalTypes(); // Reload types list
            }
            loadingOverlay.style.display = 'none';
        });

        createCalEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loadingOverlay.style.display = 'flex';
            const date = document.getElementById('cal-event-date').value;
            const typeId = document.getElementById('cal-event-type-select').value;

            if (!typeId) {
                alert('先にイベント種別を作成・選択してください。');
                loadingOverlay.style.display = 'none';
                return;
            }

            // Check if event already exists for this date/type (optional, DB handles unique constraint)
            const { error } = await supabase
                .from('calendar_events')
                .insert([{ event_date: date, type_id: typeId }]);

            if (error) {
                alert('イベント追加エラー（重複の可能性があります）: ' + error.message);
            } else {
                alert('イベントを追加しました！');
                loadCalEvents();
            }
            loadingOverlay.style.display = 'none';
        });

        // --- Post Edit Modal Logic ---
        const hidePostEdit = () => {
            postEditModal.style.opacity = '0';
            setTimeout(() => postEditModal.style.display = 'none', 300);
            editSelectedImages = [];
            document.getElementById('edit-image-preview').innerHTML = '';
        };

        closePostEdit.addEventListener('click', hidePostEdit);
        cancelPostEdit.addEventListener('click', hidePostEdit);

        // Edit Image Selection
        document.getElementById('edit-post-image').addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                const previewArea = document.getElementById('edit-image-preview');
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
                    editSelectedImages.push(file);
                });
            }
        });



        postEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loadingOverlay.style.display = 'flex';

            const id = editPostIdInput.value;
            const category = editPostCategoryInput.value;
            const title = editPostTitleInput.value;
            const content = editQuill.root.innerHTML;

            // Upload New Images
            let newImageUrls = [];
            if (editSelectedImages.length > 0) {
                for (const file of editSelectedImages) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
                    const filePath = `${fileName}`;
                    const { data, error } = await supabase.storage.from('images').upload(filePath, file);
                    if (!error) {
                        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
                        newImageUrls.push(publicUrl);
                    }
                }
            }

            // Merge Images
            const finalImages = [...currentPostImages, ...newImageUrls];

            const { error } = await supabase
                .from('posts')
                .update({
                    title: title,
                    content: content,
                    images: finalImages
                })
                .eq('id', id);

            if (error) {
                alert('投稿の更新に失敗しました: ' + error.message);
            } else {
                alert('投稿を更新しました！');
                hidePostEdit();
                loadPosts(category);
            }
            loadingOverlay.style.display = 'none';
        });

        // --- User Management ---
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loadingOverlay.style.display = 'flex';
            const email = document.getElementById('new-user-email').value;
            const name = document.getElementById('new-user-name').value;
            const password = document.getElementById('new-user-password').value;

            // Insert into user_management table
            // The trigger 'on_user_management_insert' will handle auth.users creation
            const { error } = await supabase
                .from('user_management')
                .insert([{
                    email: email,
                    display_name: name,
                    initial_password: password
                }]);

            if (error) {
                alert('ユーザー作成リクエストに失敗しました: ' + error.message);
            } else {
                alert('ユーザー作成リクエストを送信しました。リストでステータスを確認してください。');
                createUserForm.reset();
                loadAdminUsers();
            }
            loadingOverlay.style.display = 'none';
        });

    });

    // --- User Edit Logic ---
    window.editUser = (id, currentName, isAdmin) => {
        editUserIdInput.value = id;
        editUserNameInput.value = currentName;
        editUserIsAdminInput.checked = isAdmin;

        userEditModal.style.display = 'flex';
        setTimeout(() => userEditModal.style.opacity = '1', 10);
    };

    // Event Delegation for User Edit
    adminUsersList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit-user')) {
            const btn = e.target;
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            const isAdmin = btn.dataset.isAdmin === 'true'; // dataset values are strings
            window.editUser(id, name, isAdmin);
        }
    });

    const hideUserEdit = () => {
        userEditModal.style.opacity = '0';
        setTimeout(() => userEditModal.style.display = 'none', 300);
    };

    closeUserEdit.addEventListener('click', hideUserEdit);
    cancelUserEdit.addEventListener('click', hideUserEdit);

    userEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loadingOverlay.style.display = 'flex';

        const id = editUserIdInput.value;
        const newName = editUserNameInput.value;
        const newIsAdmin = editUserIsAdminInput.checked;

        const { error } = await supabase
            .from('profiles')
            .update({
                display_name: newName,
                is_admin: newIsAdmin
            })
            .eq('id', id);

        if (error) {
            alert('ユーザー更新エラー: ' + error.message);
        } else {
            alert('ユーザーを更新しました！');
            hideUserEdit();
            loadAdminUsers();
            // Optional: If we edited ourselves and removed admin, we might need to reload/logout, but keep it simple
        }
        loadingOverlay.style.display = 'none';
    });

    // --- Functions ---
    async function loadAdminUsers() {
        adminUsersList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        // We can fetch from profiles to see existing users
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            adminUsersList.innerHTML = '<p>ユーザーの読み込みに失敗しました。</p>';
            return;
        }

        if (!profiles || profiles.length === 0) {
            adminUsersList.innerHTML = '<p>ユーザーが見つかりません。</p>';
            return;
        }

        adminUsersList.innerHTML = profiles.map(user => `
            <div class="post-item">
                <div class="post-info">
                    <strong>${escapeHtml(user.display_name)}</strong>
                    <span style="font-size:0.8rem; color:#666; margin-left:10px;">${escapeHtml(user.email)}</span>
                    ${user.is_admin ? '<span style="background:purple; color:white; font-size:0.7rem; padding:2px 5px; border-radius:3px;">Admin</span>' : ''}
                </div>
                <div class="post-actions">
                    <button class="btn-primary btn-edit-user" 
                        data-id="${user.id}" 
                        data-name="${escapeHtml(user.display_name || '')}" 
                        data-is-admin="${user.is_admin}"
                        style="font-size:0.8rem; padding:6px 12px; margin-right:5px;">Edit</button>
                    <!-- Delete user is complex (requires auth.users delete), maybe just show info for now -->
                </div>
            </div>
        `).join('');
    }

    async function checkUser() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // Check if admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.is_admin) {
                loginSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                loadPosts(currentTab);
                setupSessionTimeout(); // Start Inactivity Timer
            } else {
                alert("アクセス拒否: 管理者権限が必要です。");
                // Optional: Logout if not admin
                await supabase.auth.signOut();
                loginSection.style.display = 'flex';
                dashboardSection.style.display = 'none';
            }
        } else {
            loginSection.style.display = 'flex';
            dashboardSection.style.display = 'none';
        }
    }

    async function loadPosts(category) {
        if (category === 'groups') return; // Should not happen but safety check

        postsContainer.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('category', category)
            .order('created_at', { ascending: false });

        if (error) {
            postsContainer.innerHTML = '<p>投稿の読み込みに失敗しました。</p>';
            console.error(error);
        } else {
            if (data.length === 0) {
                postsContainer.innerHTML = '<p>投稿はありません。</p>';
                return;
            }

            postsContainer.innerHTML = data.map(post => `
                <div class="post-item">
                    <div class="post-info">
                        <strong>${escapeHtml(post.title)}</strong>
                        <span style="font-size:0.8rem; color:#888; margin-left:10px;">${new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="post-actions">
                        <button onclick="deletePost('${post.id}')" class="btn-delete">Delete</button>
                        <button onclick="editPost('${post.id}')" class="btn-primary" style="margin-left:5px; font-size:0.8rem; padding:8px 16px;">Edit</button>
                    </div>
                </div>
            `).join('');
        }
    }

    async function deletePost(id) {
        if (!confirm('本当にこの投稿を削除しますか？')) return;

        // Show loader immediately
        postsContainer.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', id);

        if (error) {
            alert('投稿の削除に失敗しました: ' + error.message);
        }
        // Always reload to restore list or show updates
        loadPosts(currentTab);
    }

    // Group Functions
    async function loadAdminGroups() {
        adminGroupsList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        const { data, error } = await supabase
            .from('groups')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            adminGroupsList.innerHTML = '<p>グループの読み込みに失敗しました。</p>';
        } else {
            if (!data || data.length === 0) {
                adminGroupsList.innerHTML = '<p>グループが見つかりません。</p>';
                return;
            }

            adminGroupsList.innerHTML = data.map(group => `
                <div class="post-item">
                    <div class="post-info">
                        <strong>${escapeHtml(group.name)}</strong>
                        <p style="font-size:0.8rem; color:#666;">${escapeHtml(group.description || '')}</p>
                    </div>
                    <div class="post-actions">
                        <button onclick="manageGroup('${group.id}', '${escapeHtml(group.name)}')" class="btn-primary" style="background:var(--primary-color);">Manage Members</button>
                    </div>
                </div>
            `).join('');
        }
    }

    window.manageGroup = (gid, gname) => {
        currentManagingGroupId = gid;
        manageGroupTitle.innerText = `Manage Group: ${gname}`;

        // Show Modal
        groupManageModal.style.display = 'flex';
        setTimeout(() => groupManageModal.style.opacity = '1', 10);

        loadGroupMembers(gid);
        loadAllUsersForSelect(); // Populate select
    };

    // Remove Existing Image
    window.removeExistingImage = (index) => {
        if (index > -1) {
            currentPostImages.splice(index, 1);
            renderCurrentImages();
        }
    };

    // --- Page Management ---
    async function loadAdminPages() {
        adminPagesList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        const { data, error } = await supabase
            .from('page_settings')
            .select('*')
            .order('page_path', { ascending: true });

        if (error) {
            adminPagesList.innerHTML = '<p>設定の読み込みに失敗しました。</p>';
        } else {
            if (!data || data.length === 0) {
                adminPagesList.innerHTML = '<p>設定が見つかりません。</p>';
                return;
            }

            adminPagesList.innerHTML = data.map(page => `
                <div class="post-item" style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="post-info" style="flex:1; min-width:0; margin-right:15px;">
                        <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(page.page_path)}</strong>
                        <p style="font-size:0.8rem; color:#666; margin:0; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHtml(page.description || '')}</p>
                    </div>
                    <div class="post-actions" style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                        <label class="switch" style="position:relative; display:inline-block; width:50px; height:26px;">
                            <input type="checkbox" ${page.is_public ? 'checked' : ''} onchange="togglePageVisibility('${page.id}', this.checked)">
                            <span class="slider round"></span>
                        </label>
                        <span style="font-size:0.85rem; width:45px; text-align:right;">${page.is_public ? 'Public' : 'Private'}</span>
                    </div>
                </div>
            `).join('');

            // Add style for toggle switch if not exists
            if (!document.getElementById('toggle-style')) {
                const style = document.createElement('style');
                style.id = 'toggle-style';
                style.innerHTML = `
                    .switch {
                        position: relative;
                        display: inline-block;
                        width: 50px;
                        height: 26px;
                    }
                    .switch input { 
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    .slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: #ccc;
                        transition: .4s;
                        border-radius: 34px;
                        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
                    }
                    .slider:before {
                        position: absolute;
                        content: "";
                        height: 20px;
                        width: 20px;
                        left: 3px;
                        bottom: 3px;
                        background-color: white;
                        transition: .4s;
                        border-radius: 50%;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    input:checked + .slider {
                        background-color: #3c7800; /* Green Accent */
                    }
                    input:checked + .slider:before {
                        transform: translateX(24px);
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    addPageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const path = document.getElementById('new-page-path').value.trim();
        const desc = document.getElementById('new-page-desc').value.trim();

        const { error } = await supabase.from('page_settings').insert([{ page_path: path, description: desc }]);
        if (error) {
            alert('追加に失敗しました: ' + error.message);
        } else {
            alert('追加しました');
            addPageForm.reset();
            loadAdminPages();
        }
    });

    window.togglePageVisibility = async (id, isPublic) => {
        const { error } = await supabase
            .from('page_settings')
            .update({ is_public: isPublic })
            .eq('id', id);

        if (error) {
            alert('更新に失敗しました: ' + error.message);
            loadAdminPages(); // Revert UI
        } else {
            // alert('Updated'); // Too noisy? maybe just refresh
            loadAdminPages();
        }
    };


    function renderCurrentImages() {
        const container = document.getElementById('edit-current-images');
        if (!container) return;
        container.innerHTML = currentPostImages.map((url, idx) => `
                    <div style="position:relative; display:inline-block;">
                        <img src="${url}" style="width:80px; height:80px; object-fit:cover; border-radius:4px;">
                            <button type="button" onclick="window.removeExistingImage(${idx})"
                                style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer;">&times;</button>
                        </div>
                `).join('');
    }

    async function loadAllUsersForSelect() {
        if (!addMemberSelect) return;
        addMemberSelect.innerHTML = '<option value="">Loading...</option>';

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, email, display_name')
            .order('email');

        if (error || !profiles) {
            addMemberSelect.innerHTML = '<option value="">ユーザーの読み込みエラー</option>';
            return;
        }

        addMemberSelect.innerHTML = '<option value="">ユーザーを選択...</option>';
        profiles.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.display_name} (${p.email})`;
            addMemberSelect.appendChild(option);
        });
    }

    async function loadGroupMembers(gid) {
        groupMembersList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        // 1. Fetch Explicit Members
        const { data: members, error: memberError } = await supabase
            .from('group_members')
            .select(`
                id,
                    user_id,
                    can_post,
                    profiles(id, email, display_name, is_admin)
                        `)
            .eq('group_id', gid);

        // 2. Fetch All Global Admins
        const { data: admins, error: adminError } = await supabase
            .from('profiles')
            .select('*')
            .eq('is_admin', true);

        if (memberError || adminError) {
            groupMembersList.innerHTML = '<p>Error loading members.</p>';
            return;
        }

        // 3. Merge Lists
        let displayList = [];

        // Add all explicit members first
        if (members) {
            members.forEach(m => {
                displayList.push({
                    type: 'explicit',
                    id: m.id, // group_member_id
                    user_id: m.user_id,
                    name: m.profiles?.display_name || 'No Name',
                    email: m.profiles?.email || 'No Email',
                    can_post: m.can_post,
                    is_global_admin: m.profiles?.is_admin || false
                });
            });
        }

        // Add implicit admins who are NOT in the list yet
        if (admins) {
            admins.forEach(admin => {
                const exists = displayList.find(m => m.user_id === admin.id);
                if (!exists) {
                    displayList.push({
                        type: 'implicit',
                        id: null,
                        user_id: admin.id,
                        name: admin.display_name || 'No Name',
                        email: admin.email || 'No Email',
                        can_post: true, // Admins implied permission
                        is_global_admin: true
                    });
                } else {
                    exists.is_global_admin = true; // Ensure flag is set
                }
            });
        }

        if (displayList.length === 0) {
            groupMembersList.innerHTML = '<p>No members in this group.</p>';
            return;
        }

        groupMembersList.innerHTML = displayList.map(member => {
            const isGlobalAdmin = member.is_global_admin;

            let actions = '';
            if (isGlobalAdmin) {
                actions = `<span style="color:#666; font-size:0.8rem; background:#eee; padding:3px 8px; border-radius:4px;">Global Admin(Fixed)</span>`;
            } else {
                actions = `
                    <button onclick="removeMember('${member.id}')" class="btn-delete">Remove</button>
                    ${member.can_post ?
                        `<button onclick="togglePostPermission('${member.id}', false)" class="btn-primary" style="background:#f39c12; margin-left:5px;">Disable Posting</button>` :
                        `<button onclick="togglePostPermission('${member.id}', true)" class="btn-primary" style="background:var(--green-accent); margin-left:5px;">Enable Posting</button>`
                    }
                `;
            }

            return `
                    <div class="post-item">
                    <div class="post-info">
                        <strong>${escapeHtml(member.name)}</strong>
                        <span style="font-size:0.85rem; color:#666;">${escapeHtml(member.email)}</span>
                        ${isGlobalAdmin ? '<span style="background:purple; color:white; font-size:0.7rem; padding:2px 5px; border-radius:3px; margin-left:5px;">Admin</span>' : ''}
                    </div>
                    <div class="post-actions">
                        ${actions}
                    </div>
                </div>
                    `;
        }).join('');
    }


    window.togglePostPermission = async (memberId, currentStatus) => {
        // Show loader
        groupMembersList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase
            .from('group_members')
            .update({ can_post: !currentStatus })
            .eq('id', memberId);

        if (error) {
            alert('Error updating permission: ' + error.message);
        }
        loadGroupMembers(currentManagingGroupId);
    };

    window.removeMember = async (memberId) => {
        if (!confirm('Remove this user from the group?')) return;

        // Show loader
        groupMembersList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('id', memberId);

        if (error) {
            alert('Error removing member: ' + error.message);
        }
        loadGroupMembers(currentManagingGroupId);
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

    // Load initial data for Cal/Groups just in case (e.g. if loaded on specific tab refresh)
    async function loadCalTypes() {
        calTypesList.innerHTML = '<p>Loading...</p>';
        calEventTypeSelect.innerHTML = '<option value="">Select Type...</option>';

        const { data, error } = await supabase
            .from('calendar_types')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            calTypesList.innerHTML = '<p>Error loading types.</p>';
            return;
        }

        if (!data || data.length === 0) {
            calTypesList.innerHTML = '<p>No types defined.</p>';
            return;
        }

        calTypesList.innerHTML = data.map(type => `
                    <div class="post-item">
                <div class="post-info" style="display:flex; align-items:center;">
                    <span style="display:inline-block; width:15px; height:15px; background:${type.color}; margin-right:10px; border-radius:3px;"></span>
                    <strong>${escapeHtml(type.label)}</strong>
                </div>
                <div class="post-actions">
                    <button onclick="deleteCalType('${type.id}')" class="btn-delete" style="font-size:0.8rem; padding:6px 12px;">Delete</button>
                </div>
            </div>
                    `).join('');

        // Populate Select
        data.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.label;
            calEventTypeSelect.appendChild(option);
        });
    }

    async function loadCalEvents() {
        calEventsList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        const { data, error } = await supabase
            .from('calendar_events')
            .select(`
                id,
                    event_date,
                    calendar_types(label, color)
                        `)
            .order('event_date', { ascending: false })
            .limit(20);

        if (error) {
            calEventsList.innerHTML = '<p>Error loading events.</p>';
            return;
        }

        if (!data || data.length === 0) {
            calEventsList.innerHTML = '<p>No recent events.</p>';
            return;
        }

        calEventsList.innerHTML = data.map(event => `
                    <div class="post-item">
                <div class="post-info">
                    <strong>${event.event_date}</strong>
                    <span style="color:${event.calendar_types?.color}; font-size:0.9rem;">${escapeHtml(event.calendar_types?.label)}</span>
                </div>
                <div class="post-actions">
                    <button onclick="deleteCalEvent('${event.id}')" class="btn-delete" style="font-size:0.8rem;">Delete</button>
                </div>
            </div>
                    `).join('');
    }

    // Expose helpers globally for onclicks in HTML strings
    window.deletePost = deletePost;
    window.editPost = async (id) => {
        loadingOverlay.style.display = 'flex';
        const { data: post, error } = await supabase
            .from('posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !post) {
            alert('Error fetching post details.');
            loadingOverlay.style.display = 'none';
            return;
        }

        editPostIdInput.value = post.id;
        editPostCategoryInput.value = post.category;
        editPostTitleInput.value = post.title;
        editQuill.root.innerHTML = post.content; // Set content to quill

        // Set Images
        currentPostImages = post.images || [];
        renderCurrentImages();
        editSelectedImages = []; // reset new uploads
        document.getElementById('edit-image-preview').innerHTML = '';

        postEditModal.style.display = 'flex';
        setTimeout(() => postEditModal.style.opacity = '1', 10);
        loadingOverlay.style.display = 'none';
    };
    // window.manageGroup is already defined above at line 649

    window.togglePostPermission = togglePostPermission;
    window.removeMember = removeMember;

    window.deleteCalType = async (id) => {
        if (!confirm('Delete this event type? events using it might be affected.')) return;

        calTypesList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase.from('calendar_types').delete().eq('id', id);
        if (error) alert(error.message);
        loadCalTypes();
    };

    window.deleteCalEvent = async (id) => {
        if (!confirm('Delete this event?')) return;

        calEventsList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase.from('calendar_events').delete().eq('id', id);
        if (error) alert(error.message);
        loadCalEvents();
    };

})();
