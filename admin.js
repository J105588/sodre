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
    const savePagesBtn = document.getElementById('save-pages-btn');
    const pagesSaveMsg = document.getElementById('pages-save-msg');

    // System Elements
    const systemManagerArea = document.getElementById('system-manager-area');
    const maintenanceForm = document.getElementById('maintenance-form');
    const maintenanceToggle = document.getElementById('maintenance-toggle');
    const maintenanceMessageInput = document.getElementById('maintenance-message-input');
    const maintenanceWhitelistInput = document.getElementById('maintenance-whitelist-input');

    // Notification Elements
    const notificationManagerArea = document.getElementById('notification-manager-area');
    const notificationForm = document.getElementById('notification-form');
    const notifTargetSelect = document.getElementById('notif-target-select');
    const notifGroupSelect = document.getElementById('notif-group-select');
    const notifUserSelect = document.getElementById('notif-user-select');
    const notifTargetGroupContainer = document.getElementById('notif-target-group-container');
    const notifTargetUserContainer = document.getElementById('notif-target-user-container');



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
        const STORAGE_KEY = 'sodre_admin_last_activity';

        const updateActivity = () => {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        };

        const checkTimeout = async () => {
            const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
            const now = Date.now();

            if (lastActivity > 0 && (now - lastActivity > TIMEOUT_DURATION)) {
                console.log('Admin session expired due to inactivity');
                localStorage.removeItem(STORAGE_KEY);

                // Clear any auto-login credentials to be safe
                localStorage.removeItem('sodre_user_email');
                localStorage.removeItem('sodre_user_password');
                localStorage.removeItem('sodre_last_activity');

                try {
                    await supabase.auth.signOut();
                } catch (e) { console.error('SignOut error', e); }

                alert('一定時間操作がなかったため、ログアウトしました。');
                window.location.replace('login.html');
            }
        };

        if (!localStorage.getItem(STORAGE_KEY)) {
            updateActivity();
        }

        setInterval(checkTimeout, 60 * 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkTimeout();
            }
        });

        window.addEventListener('pageshow', () => {
            checkTimeout();
        });

        let throttleTimer;
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        const throttledUpdate = () => {
            if (!throttleTimer) {
                updateActivity();
                throttleTimer = setTimeout(() => {
                    throttleTimer = null;
                }, 30000); // 30 seconds throttle
            }
        };

        events.forEach(event => {
            document.addEventListener(event, throttledUpdate);
        });

        updateActivity();
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

        // --- Mobile Menu Collapse Logic ---
        const mainContent = document.querySelector('.main-content');
        const sidebar = document.querySelector('.sidebar');

        if (mainContent && sidebar) {
            mainContent.addEventListener('scroll', () => {
                // Only activate on mobile when sidebar layout changes
                if (window.innerWidth <= 900) {
                    if (mainContent.scrollTop > 50) {
                        sidebar.classList.add('scrolled');
                    } else {
                        sidebar.classList.remove('scrolled');
                    }
                } else {
                    // Reset on desktop
                    sidebar.classList.remove('scrolled');
                }
            });
        }

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
                systemManagerArea.style.display = 'none';
                notificationManagerArea.style.display = 'none';

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
                } else if (currentTab === 'system') {
                    systemManagerArea.style.display = 'block';
                    loadSystemSettings();
                } else if (currentTab === 'notifications') {
                    notificationManagerArea.style.display = 'block';
                    // No initial load needed
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

        // --- Helpers ---
        function isImageUrl(url) {
            if (!url) return false;
            if (url.startsWith('data:image')) return true;
            return /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(url.split('?')[0]);
        }

        function getFileIconHtml(fileName) {
            const ext = fileName.split('.').pop().toLowerCase();
            let iconClass = 'fas fa-file';
            if (['pdf'].includes(ext)) iconClass = 'fas fa-file-pdf';
            if (['doc', 'docx'].includes(ext)) iconClass = 'fas fa-file-word';
            if (['xls', 'xlsx'].includes(ext)) iconClass = 'fas fa-file-excel';
            if (['ppt', 'pptx'].includes(ext)) iconClass = 'fas fa-file-powerpoint';
            if (['zip', 'rar', '7z'].includes(ext)) iconClass = 'fas fa-file-archive';
            if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) iconClass = 'fas fa-file-audio';
            if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) iconClass = 'fas fa-file-video';
            return `<i class="${iconClass}" style="font-size:30px; color:#555;"></i>`;
        }

        // --- Post Management ---
        // Handle Image Selection
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                files.forEach(file => {
                    if (file.type.startsWith('image/')) {
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
                    } else {
                        const div = document.createElement('div');
                        div.style.width = '100px';
                        div.style.height = '100px';
                        div.style.display = 'flex';
                        div.style.flexDirection = 'column';
                        div.style.alignItems = 'center';
                        div.style.justifyContent = 'center';
                        div.style.border = '1px solid #ddd';
                        div.style.borderRadius = '4px';
                        div.style.background = '#f9f9f9';
                        div.innerHTML = `${getFileIconHtml(file.name)}<span style="font-size:0.7rem; margin-top:5px; text-align:center; word-break:break-all; max-width:90%;">${escapeHtml(file.name)}</span>`;
                        imagePreview.appendChild(div);
                    }
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
                imagesHtml = '<div class="post-images" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:1rem;">';
                selectedImages.forEach(file => {
                    if (file.type.startsWith('image/')) {
                        const imgUrl = URL.createObjectURL(file);
                        imagesHtml += `<img src="${imgUrl}" style="max-height:200px; max-width:100%; border-radius:4px;">`;
                    } else {
                        imagesHtml += `
                            <div style="padding:10px; border:1px solid #eee; border-radius:4px; display:flex; align-items:center; gap:5px; background:#f9f9f9;">
                                ${getFileIconHtml(file.name)}
                                <span>${escapeHtml(file.name)}</span>
                            </div>`;
                    }
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
                        ${DOMPurify.sanitize(content)}
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
                const formData = new FormData();
                for (const file of selectedImages) {
                    formData.append('files[]', file);
                }
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const uploadRes = await fetch(window.UPLOAD_API_URL, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${session?.access_token}` },
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData.success && uploadData.urls) {
                        uploadedImageUrls = uploadData.urls;
                    } else {
                        console.error('Upload error', uploadData.error);
                        alert('画像のアップロードに失敗しました: ' + (uploadData.error || ''));
                        return; // Abort post creation
                    }
                } catch (uploadErr) {
                    console.error('Upload error', uploadErr);
                    alert('画像のアップロードに失敗しました。');
                    return; // Abort post creation
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




        // --- System Settings ---
        maintenanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loadingOverlay.style.display = 'flex';

            const enabled = maintenanceToggle.checked;
            const message = maintenanceMessageInput.value;

            // Parse whitelist
            const whitelistRaw = maintenanceWhitelistInput.value;
            const whitelist = whitelistRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);

            // Upsert system_settings (Maintenance Mode)
            const { error: modeError } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'maintenance_mode',
                    value: { enabled, message },
                    updated_at: new Date().toISOString()
                });

            // Upsert system_settings (Whitelist)
            const { error: listError } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'maintenance_whitelist',
                    value: JSON.stringify(whitelist),
                    updated_at: new Date().toISOString()
                });

            if (modeError || listError) {
                console.error('Maintenance save error:', modeError || listError);
                await showAlert('設定の保存に失敗しました:\n' + ((modeError?.message || listError?.message)), 'error');
            } else {
                await showAlert('メンテナンス設定を保存しました！', 'success');
            }
            loadingOverlay.style.display = 'none';
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
                await showAlert('種別の追加に失敗しました: ' + error.message, 'error');
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
                await showAlert('先にイベント種別を作成・選択してください。', 'warning');
                loadingOverlay.style.display = 'none';
                return;
            }

            // Check if event already exists for this date/type (optional, DB handles unique constraint)
            const { error } = await supabase
                .from('calendar_events')
                .insert([{ event_date: date, type_id: typeId }]);

            if (error) {
                await showAlert('イベント追加エラー（重複の可能性があります）: ' + error.message, 'error');
            } else {
                await showAlert('イベントを追加しました！', 'success');
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
                        const div = document.createElement('div');
                        div.style.width = '80px';
                        div.style.height = '80px';
                        div.style.display = 'flex';
                        div.style.flexDirection = 'column';
                        div.style.alignItems = 'center';
                        div.style.justifyContent = 'center';
                        div.style.border = '1px solid #ddd';
                        div.style.borderRadius = '4px';
                        div.style.background = '#f9f9f9';
                        div.innerHTML = `${getFileIconHtml(file.name)}<span style="font-size:0.6rem; margin-top:5px; text-align:center; word-break:break-all; max-width:90%;">${escapeHtml(file.name)}</span>`;
                        previewArea.appendChild(div);
                    }
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
                const formData = new FormData();
                for (const file of editSelectedImages) {
                    formData.append('files[]', file);
                }
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const uploadRes = await fetch(window.UPLOAD_API_URL, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${session?.access_token}` },
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData.success && uploadData.urls) {
                        newImageUrls = uploadData.urls;
                    } else {
                        console.error('Upload error', uploadData.error);
                        await showAlert('画像のアップロードに失敗しました: ' + (uploadData.error || ''), 'error');
                        return; // Abort post update
                    }
                } catch (uploadErr) {
                    console.error('Upload error', uploadErr);
                    await showAlert('画像のアップロードに失敗しました。', 'error');
                    return; // Abort post update
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
                await showAlert('投稿の更新に失敗しました: ' + error.message, 'error');
            } else {
                await showAlert('投稿を更新しました！', 'success');
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
                await showAlert('ユーザー作成リクエストに失敗しました: ' + error.message, 'error');
            } else {
                await showAlert('ユーザー作成リクエストを送信しました。リストでステータスを確認してください。', 'success');
                createUserForm.reset();
                loadAdminUsers();
            }
            loadingOverlay.style.display = 'none';
        });

        // --- Notification Management ---
        notifTargetSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            notifTargetGroupContainer.style.display = 'none';
            notifTargetUserContainer.style.display = 'none';
            if (val === 'group') {
                notifTargetGroupContainer.style.display = 'block';
                loadGroupsForSelect();
            } else if (val === 'user') {
                notifTargetUserContainer.style.display = 'block';
                loadUsersForSelect();
            }
        });

        async function loadGroupsForSelect() {
            const { data } = await supabase.from('groups').select('id, name');
            if (data) {
                notifGroupSelect.innerHTML = '<option value="">グループを選択</option>' +
                    data.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
            }
        }

        async function loadUsersForSelect() {
            const { data } = await supabase.from('profiles').select('id, display_name');
            if (data) {
                notifUserSelect.innerHTML = '<option value="">ユーザーを選択</option>' +
                    data.map(u => `<option value="${u.id}">${escapeHtml(u.display_name)}</option>`).join('');
            }
        }

        notificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            loadingOverlay.style.display = 'flex';

            const targetType = notifTargetSelect.value;
            const title = document.getElementById('notif-title').value;
            const body = document.getElementById('notif-body').value;
            const url = document.getElementById('notif-url').value;

            let targetUserIds = [];

            try {
                if (targetType === 'all') {
                    // Fetch ALL users who have tokens (or let backend handle it)
                    // For safety and transparency, let's fetch IDs of all users
                    const { data: users } = await supabase.from('profiles').select('id');
                    if (users) targetUserIds = users.map(u => u.id);

                } else if (targetType === 'group') {
                    const groupId = notifGroupSelect.value;
                    if (!groupId) throw new Error('グループを選択してください');
                    const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
                    if (members) targetUserIds = members.map(m => m.user_id);

                } else if (targetType === 'user') {
                    const userId = notifUserSelect.value;
                    if (!userId) throw new Error('ユーザーを選択してください');
                    targetUserIds = [userId];
                }

                if (targetUserIds.length === 0) {
                    throw new Error('送信対象のユーザーが見つかりません (または0人です)');
                }

                if (!window.GAS_NOTIFICATION_URL) {
                    throw new Error('通知サーバー(GAS)のURLが設定されていません。config.jsを確認してください。');
                }

                // Call GAS Web App
                const response = await fetch(window.GAS_NOTIFICATION_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8',
                    },
                    body: JSON.stringify({
                        target_user_ids: targetUserIds,
                        title: title,
                        body: body,
                        url: url
                    })
                });

                const result = await response.json();

                if (!result.success) throw new Error(result.error || '送信に失敗しました');

                await showAlert(`送信成功: ${targetUserIds.length}人に送信リクエストを送りました`, 'success');
                notificationForm.reset();

            } catch (err) {
                console.error(err);
                await showAlert('送信エラー: ' + err.message, 'error');
            } finally {
                loadingOverlay.style.display = 'none';
            }
        });

    });

    // --- User Edit Logic ---
    window.editUser = (id, currentName, isAdmin, isSuperadmin) => {
        editUserIdInput.value = id;
        editUserNameInput.value = currentName;
        editUserIsAdminInput.checked = isAdmin;

        // If superadmin, disable admin checkbox to prevent resizing (though trigger protects it too)
        if (isSuperadmin) {
            editUserIsAdminInput.disabled = true;
            // Also maybe disable the name input or save button if we want strict "Direct DB Edit Only" policy?
            // User said "Deleting/Demotion" is the concern. 
            // Let's just disable the admin checkbox.
        } else {
            editUserIsAdminInput.disabled = false;
        }

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
            const isSuper = btn.dataset.isSuperadmin === 'true';

            // If superadmin, verification
            if (isSuper) {
                // For now, allow editing name? Or simple alert?
                // The loadAdminUsers disables the button entirely, so this code might not be reached via UI,
                // but good to have safeguards.
            }
            window.editUser(id, name, isAdmin, isSuper);
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
            await showAlert('ユーザー更新エラー: ' + error.message, 'error');
        } else {
            await showAlert('ユーザーを更新しました！', 'success');
            hideUserEdit();
            loadAdminUsers();
            // Optional: If we edited ourselves and removed admin, we might need to reload/logout, but keep it simple
        }
        loadingOverlay.style.display = 'none';
    });

    // --- Delete User Logic ---
    window.deleteUser = async (userId) => {
        if (!await showConfirm('本当にこのユーザーを削除しますか？\nこの操作は取り消せません。')) return;

        loadingOverlay.style.display = 'flex';

        const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });

        if (error) {
            await showAlert('ユーザー削除エラー: ' + error.message, 'error');
        } else {
            await showAlert('ユーザーを削除しました。', 'success');
            loadAdminUsers();
        }
        loadingOverlay.style.display = 'none';
    };

    // --- Functions ---
    async function loadAdminUsers() {
        adminUsersList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        // We can fetch from profiles to see existing users
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*, is_superadmin') // Explicitly select is_superadmin
            .order('created_at', { ascending: false });

        if (error) {
            adminUsersList.innerHTML = '<p>ユーザーの読み込みに失敗しました。</p>';
            return;
        }

        if (!profiles || profiles.length === 0) {
            adminUsersList.innerHTML = '<p>ユーザーが見つかりません。</p>';
            return;
        }

        adminUsersList.innerHTML = profiles.map(user => {
            const isSuper = user.is_superadmin;
            const isSelf = user.id === currentUserId;
            // Edit: Enabled if NOT superadmin OR (IS superadmin AND IS self)
            const canEdit = !isSuper || (isSuper && isSelf);
            // Delete: Always disabled for superadmin

            return `
            <div class="post-item" style="${isSuper ? 'background:#fff8e1; border-color:#f1c40f;' : ''}">
                <div class="post-info">
                    <strong>${escapeHtml(user.display_name)}</strong>
                    <span style="font-size:0.8rem; color:#666; margin-left:10px;">${escapeHtml(user.email)}</span>
                    ${user.is_admin ? '<span style="background:purple; color:white; font-size:0.7rem; padding:2px 5px; border-radius:3px;">Admin</span>' : ''}
                    ${isSuper ? '<span style="background:#f1c40f; color:#000; font-weight:bold; font-size:0.7rem; padding:2px 5px; border-radius:3px; margin-left:5px;">SUPERADMIN</span>' : ''}
                </div>
                <div class="post-actions">
                    ${currentIsSuperadmin ? `
                    <button class="btn-primary" 
                        onclick="forceUnlockApp('${user.id}', '${escapeHtml(user.display_name || 'ユーザー')}')"
                        style="font-size:0.8rem; padding:6px 12px; margin-right:5px; background:var(--accent-color); border:none; color:white;">
                        <i class="fas fa-unlock"></i> 強制ロック解除
                    </button>` : ''}
                    <button class="btn-primary btn-edit-user" 
                        data-id="${user.id}" 
                        data-name="${escapeHtml(user.display_name || '')}" 
                        data-is-admin="${user.is_admin}"
                        data-is-superadmin="${isSuper}"
                        style="font-size:0.8rem; padding:6px 12px; margin-right:5px;"
                        ${canEdit ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>Edit</button>
                    <button class="btn-delete btn-delete-user" 
                        onclick="${!isSuper ? `deleteUser('${user.id}')` : ''}"
                        style="font-size:0.8rem; padding:6px 12px; ${isSuper ? 'opacity:0.5; cursor:not-allowed;' : ''}"
                        ${isSuper ? 'disabled' : ''}>Delete</button>
                </div>
            </div>
        `;
        }).join('');
    }

    // OTP State for Force Unlock
    let pendingForceUnlockUserId = null;
    let pendingForceUnlockUserName = null;

    // Force unlock function (Exposed to window for inline onclick)
    window.forceUnlockApp = async (userId, userName) => {
        if (!currentIsSuperadmin) {
            await showAlert("この操作は最高管理者権限が必要です。", "error");
            return;
        }

        if (await showConfirm(`本当に ${userName} のApp Lock（生体認証ロック）を強制解除しますか？\n（対象がオンラインの場合、即座にロック画面が解除されます）`)) {
            // Initiate OTP request
            try {
                const targetUrl = window.GAS_OTP_URL || GAS_OTP_URL;
                if (!targetUrl) throw new Error("GAS_OTP_URL is not configured.");

                // Show modal & set pending state
                pendingForceUnlockUserId = userId;
                pendingForceUnlockUserName = userName;
                document.getElementById('admin-otp-modal').style.display = 'flex';

                // Trigger reflow and fade in
                setTimeout(() => {
                    document.getElementById('admin-otp-modal').style.opacity = '1';
                }, 10);

                const msgEl = document.getElementById('admin-otp-msg');
                msgEl.innerHTML = '';
                msgEl.textContent = '送信中...';
                const br1 = document.createElement('br');
                msgEl.appendChild(br1);
                msgEl.appendChild(document.createTextNode('あなたのメールアドレス（' + currentUserEmail + '）へ認証コードを送っています。'));
                msgEl.style.color = '#555';

                // Disable submit while sending
                const submitBtn = document.getElementById('submit-admin-otp');
                submitBtn.disabled = true;

                // Send via GAS (no-cors prevents reading JSON response, but triggers email)
                await fetch(targetUrl, {
                    method: 'POST',
                    body: JSON.stringify({ email: currentUserEmail }),
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });

                msgEl.innerHTML = '';
                msgEl.textContent = '最高管理者権限での操作です。';
                const br2 = document.createElement('br');
                msgEl.appendChild(br2);
                msgEl.appendChild(document.createTextNode('あなたのメールアドレス（' + currentUserEmail + '）に送信された6桁の認証コードを入力して強制解除を実行します。'));
                submitBtn.disabled = false;

            } catch (err) {
                console.error("OTP Request Error:", err);
                // GAS Fetch will often throw a TypeError because the 302 redirect from the POST to GET fails no-cors
                // Due to how no-cors and browser redirect policies work, the POST succeeds (and email sends) but the JS throws.
                // We will NOT hide the modal, so the user can enter the code if the email arrived.
                const msgEl = document.getElementById('admin-otp-msg');
                msgEl.innerHTML = '';
                const span = document.createElement('span');
                span.style.color = 'orange';
                span.textContent = '※送信時にネットワーク警告が発生しましたが、メールが送信されている可能性があります。';
                msgEl.appendChild(span);
                msgEl.appendChild(document.createElement('br'));
                msgEl.appendChild(document.createTextNode('最高管理者権限での操作です。'));
                msgEl.appendChild(document.createElement('br'));
                msgEl.appendChild(document.createTextNode('あなたのメールアドレス（' + currentUserEmail + '）に届いた6桁の認証コードを入力して強制解除を実行します。'));

                const submitBtn = document.getElementById('submit-admin-otp');
                if (submitBtn) submitBtn.disabled = false;
            }
        }
    }; // Closes window.forceUnlockApp

    // Admin OTP Modal Handlers
    document.getElementById('close-admin-otp').addEventListener('click', () => {
        document.getElementById('admin-otp-modal').style.opacity = '0';
        setTimeout(() => document.getElementById('admin-otp-modal').style.display = 'none', 300);
    });
    document.getElementById('cancel-admin-otp').addEventListener('click', () => {
        document.getElementById('admin-otp-modal').style.opacity = '0';
        setTimeout(() => document.getElementById('admin-otp-modal').style.display = 'none', 300);
    });

    document.getElementById('admin-otp-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('admin-otp-code').value;
        const msgEl = document.getElementById('admin-otp-msg');
        const submitBtn = document.getElementById('submit-admin-otp');

        msgEl.innerHTML = '認証コードを確認中...';
        msgEl.style.color = 'blue';
        submitBtn.disabled = true;

        try {
            // Verify OTP via Custom RPC
            const { data: isValid, error } = await supabase.rpc('verify_admin_otp', {
                p_email: currentUserEmail,
                p_otp: code
            });

            if (error) throw error;

            if (!isValid) {
                msgEl.innerHTML = '認証コードが間違っているか、期限切れです。';
                msgEl.style.color = 'red';
                submitBtn.disabled = false;
                return;
            }

            // Valid OTP! Execute Force Unlock Broadcast and Data Update
            const channelName = `user_actions_${pendingForceUnlockUserId}`;
            const channel = supabase.channel(channelName);

            // First, clear the database flag to guarantee unlock even if they miss the broadcast
            const { error: updateError } = await supabase.from('profiles').update({
                app_lock_enabled: false,
                app_lock_credential_id: null
            }).eq('id', pendingForceUnlockUserId);

            if (updateError) {
                console.error("Failed to update profile lock status:", updateError);
                await showAlert("データベースの更新に失敗しました。シグナル送信を中止します。", "error");
                msgEl.style.color = '#555';
                submitBtn.disabled = false;
                return;
            }

            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const sendRes = await channel.send({
                        type: 'broadcast',
                        event: 'force_unlock',
                        payload: {
                            adminRequested: true,
                            requestedAt: new Date().toISOString()
                        }
                    });

                    if (sendRes === 'ok') {
                        await showAlert(`${pendingForceUnlockUserName} へ強制解除シグナルを送信しました。\n対象ユーザーがオンラインであれば即座にロックが解除されます。`, 'success');
                    } else {
                        await showAlert('シグナルの送信に失敗しました。', 'error');
                    }
                    supabase.removeChannel(channel);
                    document.getElementById('admin-otp-modal').style.opacity = '0';
                    setTimeout(() => document.getElementById('admin-otp-modal').style.display = 'none', 300);
                    msgEl.style.color = '#555';
                }
            });

        } catch (err) {
            console.error("OTP Verification Error:", err);
            msgEl.innerHTML = 'エラーが発生しました: ' + err.message;
            msgEl.style.color = 'red';
            submitBtn.disabled = false;
        }
    });

    let currentUserId = null; // Add at top level scope if possible, or inside IIFE
    let currentIsSuperadmin = false;
    let currentUserEmail = null;

    let adminCheckInterval = null;

    async function checkUser() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUserId = session.user.id; // Store ID
            currentUserEmail = session.user.email;

            // Check if admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin, is_superadmin')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.is_admin) {
                currentIsSuperadmin = profile.is_superadmin || false;
                loginSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                loadPosts(currentTab);
                setupSessionTimeout(); // Start Inactivity Timer

                // --- Periodic Admin Verification (Every 5 minutes) ---
                if (adminCheckInterval) clearInterval(adminCheckInterval);
                adminCheckInterval = setInterval(async () => {
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    if (!currentSession) {
                        await showAlert("セッションが切れました。再ログインしてください。", "info");
                        window.location.reload();
                        return;
                    }
                    const { data: checkProfile } = await supabase
                        .from('profiles')
                        .select('is_admin')
                        .eq('id', currentSession.user.id)
                        .single();

                    if (!checkProfile || !checkProfile.is_admin) {
                        await showAlert("管理者権限が失われました。ログアウトします。", "warning");
                        await supabase.auth.signOut();
                        window.location.reload();
                    }
                }, 5 * 60 * 1000); // 5 minutes polling

            } else {
                await showAlert("アクセス拒否: 管理者権限が必要です。", "error");
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
            return;
        }

        postsContainer.innerHTML = data.map(post => `
            <div class="post-item">
                <div class="post-info">
                    <strong>${escapeHtml(post.title)}</strong>
                    <span style="font-size:0.8rem; color:#666;">${new Date(post.created_at).toLocaleString()}</span>
                </div>
                <div class="post-actions">
                     <button class="btn-primary" onclick="editPost('${post.id}')" style="font-size:0.8rem; padding:6px 12px; margin-right:5px;">Edit</button>
                     <button class="btn-delete" onclick="deletePost('${post.id}')" style="font-size:0.8rem; padding:6px 12px;">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async function loadSystemSettings() {
        // Fetch current settings
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

        if (data && data.value) {
            const config = (typeof data.value === 'string') ? JSON.parse(data.value) : data.value;
            maintenanceToggle.checked = config.enabled || false;
            maintenanceMessageInput.value = config.message || '';
        }

        // Fetch current settings (Whitelist)
        const { data: listData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'maintenance_whitelist')
            .single();

        if (listData && listData.value) {
            const list = (typeof listData.value === 'string') ? JSON.parse(listData.value) : listData.value;
            if (Array.isArray(list)) {
                maintenanceWhitelistInput.value = list.join(', ');
            }
        }


    }


    async function deletePost(id) {
        if (!await showConfirm('本当にこの投稿を削除しますか？')) return;

        // Show loader immediately
        postsContainer.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        try {
            // 1. Get post data to find images
            const { data: post, error: fetchError } = await supabase
                .from('posts')
                .select('images')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('Error fetching post for deletion:', fetchError);
            } else if (post && post.images && post.images.length > 0) {
                // 2. Delete files from X-server (files attached to public posts)
                try {
                    await fetch('https://data.sodre.jp/api/delete.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`
                        },
                        body: JSON.stringify({ urls: post.images })
                    });
                } catch (deleteErr) {
                    console.error('Physical file delete error:', deleteErr);
                }
            }

            // 3. Delete from DB
            const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', id);

            if (error) {
                await showAlert('投稿の削除に失敗しました: ' + error.message, 'error');
            }
            // Always reload to restore list or show updates
            loadPosts(currentTab);
        } catch (err) {
            console.error('Delete error:', err);
            alert('削除中にエラーが発生しました。');
            loadPosts(currentTab);
        }
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
                        <strong id="group-name-display-${group.id}">${escapeHtml(group.name)}</strong>
                        <p style="font-size:0.8rem; color:#666;">${escapeHtml(group.description || '')}</p>
                    </div>
                    <div class="post-actions" style="display:flex; gap:5px;">
                        <button onclick="renameGroup('${group.id}', '${escapeHtml(group.name).replace(/'/g, "\\'")}')" class="btn-primary" style="background:var(--accent-color); font-size:0.8rem; padding:6px 12px;">Edit Name</button>
                        <button onclick="manageGroup('${group.id}', '${escapeHtml(group.name).replace(/'/g, "\\'")}')" class="btn-primary" style="background:var(--primary-color); font-size:0.8rem; padding:6px 12px;">Manage Members</button>
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

    window.renameGroup = async (gid, currentName) => {
        document.getElementById('rename-group-id').value = gid;
        document.getElementById('rename-group-name').value = currentName;
        const modal = document.getElementById('group-rename-modal');
        modal.style.display = 'flex';
        setTimeout(() => modal.style.opacity = '1', 10);
    };

    // --- Group Rename Modal Logic ---
    const groupRenameModal = document.getElementById('group-rename-modal');
    const groupRenameForm = document.getElementById('group-rename-form');

    const hideGroupRenameModal = () => {
        groupRenameModal.style.opacity = '0';
        setTimeout(() => groupRenameModal.style.display = 'none', 300);
    };

    document.getElementById('close-group-rename').addEventListener('click', hideGroupRenameModal);
    document.getElementById('cancel-group-rename').addEventListener('click', hideGroupRenameModal);

    groupRenameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const gid = document.getElementById('rename-group-id').value;
        const newName = document.getElementById('rename-group-name').value.trim();
        if (!newName) return;

        loadingOverlay.style.display = 'flex';
        const { error } = await supabase
            .from('groups')
            .update({ name: newName })
            .eq('id', gid);

        if (error) {
            alert('グループ名の更新に失敗しました: ' + error.message);
        } else {
            alert('グループ名を更新しました！');
            hideGroupRenameModal();
            loadAdminGroups();
        }
        loadingOverlay.style.display = 'none';
    });

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
                            <input type="checkbox" class="page-visibility-toggle" data-id="${page.id}" ${page.is_public ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                        <span class="visibility-status-text" style="font-size:0.85rem; width:45px; text-align:right;">${page.is_public ? 'Public' : 'Private'}</span>
                    </div>
                </div>
            `).join('');

            // Add event listeners locally to update the status text (Public/Private)
            document.querySelectorAll('.page-visibility-toggle').forEach(toggle => {
                toggle.addEventListener('change', (e) => {
                    const statusText = e.target.parentElement.parentElement.querySelector('.visibility-status-text');
                    statusText.textContent = e.target.checked ? 'Public' : 'Private';
                    // Clear save message on change
                    if (pagesSaveMsg) pagesSaveMsg.textContent = '';
                });
            });

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

    if (savePagesBtn) {
        savePagesBtn.addEventListener('click', async () => {
            loadingOverlay.style.display = 'flex';
            pagesSaveMsg.textContent = 'Saving...';
            pagesSaveMsg.style.color = '#555';

            const toggles = document.querySelectorAll('.page-visibility-toggle');
            let successCount = 0;
            let errorCount = 0;

            for (const toggle of toggles) {
                const id = toggle.dataset.id;
                const isPublic = toggle.checked;

                const { error } = await supabase
                    .from('page_settings')
                    .update({ is_public: isPublic })
                    .eq('id', id);

                if (error) {
                    console.error(`Error updating page ${id}:`, error);
                    errorCount++;
                } else {
                    successCount++;
                }
            }

            loadingOverlay.style.display = 'none';
            if (errorCount > 0) {
                pagesSaveMsg.textContent = `Error: ${errorCount} items failed to save.`;
                pagesSaveMsg.style.color = 'red';
            } else {
                pagesSaveMsg.textContent = 'Saved successfully!';
                pagesSaveMsg.style.color = 'green';
                setTimeout(() => {
                    pagesSaveMsg.style.opacity = '0';
                    setTimeout(() => {
                        pagesSaveMsg.textContent = '';
                        pagesSaveMsg.style.opacity = '1';
                    }, 300);
                }, 3000);
            }
        });
    }

    // Keep adding page form logic as is


    function renderCurrentImages() {
        const container = document.getElementById('edit-current-images');
        if (!container) return;
        container.innerHTML = currentPostImages.map((url, idx) => {
            if (isImageUrl(url)) {
                return `
                    <div style="position:relative; display:inline-block;">
                        <img src="${url}" style="width:80px; height:80px; object-fit:cover; border-radius:4px;">
                        <button type="button" onclick="window.removeExistingImage(${idx})"
                            style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer;">&times;</button>
                    </div>
                `;
            } else {
                const fileName = url.split('/').pop().split('?')[0];
                return `
                    <div style="position:relative; display:inline-block; width:80px; height:80px; border:1px solid #ddd; border-radius:4px; background:#f9f9f9; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                        ${getFileIconHtml(fileName)}
                        <span style="font-size:0.6rem; word-break:break-all; max-width:90%; text-align:center;">${escapeHtml(fileName)}</span>
                        <button type="button" onclick="window.removeExistingImage(${idx})"
                            style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer;">&times;</button>
                    </div>
                `;
            }
        }).join('');
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

            let statusBadge = '';
            if (member.can_post) {
                statusBadge = `<span style="background:#e8f5e9; color:#2e7d32; font-size:0.75rem; padding:2px 8px; border-radius:12px; border:1px solid #c8e6c9; margin-left:8px;">投稿可能</span>`;
            } else {
                statusBadge = `<span style="background:#ffebee; color:#c62828; font-size:0.75rem; padding:2px 8px; border-radius:12px; border:1px solid #ffcdd2; margin-left:8px;">投稿禁止</span>`;
            }

            let actions = '';
            if (isGlobalAdmin) {
                actions = `<span style="color:#666; font-size:0.8rem; background:#eee; padding:3px 8px; border-radius:4px;">Global Admin(Fixed)</span>`;
            } else {
                // If can_post is true -> Button should say "Disable" (Ban)
                // If can_post is false -> Button should say "Enable" (Allow)
                const toggleBtn = member.can_post ?
                    `<button onclick="togglePostPermission('${member.id}', true)" class="btn-primary" style="background:#f39c12; margin-left:5px; font-size:0.8rem; padding:6px 12px;">投稿を禁止にする</button>` :
                    `<button onclick="togglePostPermission('${member.id}', false)" class="btn-primary" style="background:var(--green-accent); margin-left:5px; font-size:0.8rem; padding:6px 12px;">投稿を許可する</button>`;

                actions = `
                    <button onclick="removeMember('${member.id}')" class="btn-delete" style="font-size:0.8rem; padding:6px 12px;">削除</button>
                    ${toggleBtn}
                `;
            }

            return `
                    <div class="post-item">
                    <div class="post-info" style="display:flex; align-items:center; flex-wrap:wrap; gap:5px;">
                        <strong>${escapeHtml(member.name)}</strong>
                        <span style="font-size:0.85rem; color:#666;">${escapeHtml(member.email)}</span>
                        ${isGlobalAdmin ? '<span style="background:purple; color:white; font-size:0.7rem; padding:2px 5px; border-radius:3px;">Admin</span>' : ''}
                        ${!isGlobalAdmin ? statusBadge : ''}
                    </div>
                    <div class="post-actions" style="margin-top:5px;">
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
            await showAlert('Error updating permission: ' + error.message, 'error');
        }
        loadGroupMembers(currentManagingGroupId);
    };

    window.removeMember = async (memberId) => {
        if (!await showConfirm('Remove this user from the group?')) return;

        // Show loader
        groupMembersList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('id', memberId);

        if (error) {
            await showAlert('Error removing member: ' + error.message, 'error');
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
            await showAlert('Error fetching post details.', 'error');
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
        if (!await showConfirm('Delete this event type? events using it might be affected.')) return;

        calTypesList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase.from('calendar_types').delete().eq('id', id);
        if (error) await showAlert(error.message, 'error');
        loadCalTypes();
    };

    window.deleteCalEvent = async (id) => {
        if (!await showConfirm('Delete this event?')) return;

        calEventsList.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        const { error } = await supabase.from('calendar_events').delete().eq('id', id);
        if (error) await showAlert(error.message, 'error');
        loadCalEvents();
    };

})();
