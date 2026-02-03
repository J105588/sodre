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
    const groupDetailPanel = document.getElementById('group-detail-panel');
    const manageGroupTitle = document.getElementById('manage-group-title');
    const closeGroupPanelBtn = document.getElementById('close-group-panel');
    const addMemberEmailInfo = document.getElementById('add-member-email');
    const btnAddMember = document.getElementById('btn-add-member');
    const groupMembersList = document.getElementById('group-members-list');
    const addMemberMsg = document.getElementById('add-member-msg');

    // Users Elements
    const usersManagerArea = document.getElementById('users-manager-area');
    const createUserForm = document.getElementById('create-user-form');
    const adminUsersList = document.getElementById('admin-users-list');

    // Calendar Elements
    const calendarManagerArea = document.getElementById('calendar-manager-area');
    const createCalTypeForm = document.getElementById('create-cal-type-form');
    const calTypesList = document.getElementById('cal-types-list');
    const createCalEventForm = document.getElementById('create-cal-event-form');
    const calEventTypeSelect = document.getElementById('cal-event-type-select');
    const calEventsList = document.getElementById('cal-events-list');

    let quill;
    let currentTab = 'news'; // 'news', 'diary', 'topics', 'groups', 'calendar', 'users'
    let selectedImages = [];
    let currentManagingGroupId = null;

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
                } else {
                    postsEditorArea.style.display = 'block';
                    // Reset Post Editor
                    editorTitle.innerText = `New Post (${currentTab.toUpperCase()})`;
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
                alert('Login failed: ' + error.message);
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
            previewTitle.innerText = title || '(No Title)';

            // 2. Build Images HTML from selectedImages (File objects)
            let imagesHtml = '';
            if (selectedImages && selectedImages.length > 0) {
                imagesHtml = '<div class="post-images" style="display:flex; gap:10px; overflow-x:auto; margin-bottom:1rem;">';
                selectedImages.forEach(file => {
                    const imgUrl = URL.createObjectURL(file);
                    imagesHtml += `<img src="${imgUrl}" style="max-height:200px; border-radius:4px;">`;
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
                <h2 class="post-title">${escapeHtml(title || '(No Title)')}</h2>
                <p class="post-date" style="color:#888; font-size:0.9rem; margin-bottom:1rem;">${new Date().toLocaleDateString()} (Preview)</p>
                ${imagesHtml}
                <div class="post-body-text">
                    ${content}
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
                alert('Error creating post: ' + error.message);
            } else {
                alert('Post created!');
                postForm.reset();
                quill.setContents([]);
                imagePreview.innerHTML = '';
                selectedImages = [];
                loadPosts(category);
            }
        });

        // --- Group Management ---
        createGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-group-name').value;
            const desc = document.getElementById('new-group-desc').value;

            const { error } = await supabase
                .from('groups')
                .insert([{ name: name, description: desc }]);

            if (error) {
                alert('Error creating group: ' + error.message);
            } else {
                alert('Group created!');
                document.getElementById('new-group-name').value = '';
                document.getElementById('new-group-desc').value = '';
                loadAdminGroups();
            }
        });

        closeGroupPanelBtn.addEventListener('click', () => {
            groupDetailPanel.style.display = 'none';
            currentManagingGroupId = null;
        });

        btnAddMember.addEventListener('click', async () => {
            const email = addMemberEmailInfo.value.trim();
            addMemberMsg.textContent = '';
            if (!email || !currentManagingGroupId) return;

            // 1. Find user by email
            // Note: We can't query auth.users directly from client usually.
            // We rely on 'public.profiles' table which should have emails.
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single();

            if (profileError || !profiles) {
                addMemberMsg.textContent = 'User not found (or profile missing).';
                return;
            }

            // 2. Add to group
            const { error: addError } = await supabase
                .from('group_members')
                .insert([{
                    group_id: currentManagingGroupId,
                    user_id: profiles.id,
                    can_post: true // Default true
                }]);

            if (addError) {
                addMemberMsg.textContent = 'Error adding member: ' + addError.message;
            } else {
                addMemberEmailInfo.value = '';
                loadGroupMembers(currentManagingGroupId);
            }
        });

        // --- Calendar Management ---
        createCalTypeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const label = document.getElementById('cal-type-label').value;
            const color = document.getElementById('cal-type-color').value;

            const { error } = await supabase
                .from('calendar_types')
                .insert([{ label: label, color: color }]);

            if (error) {
                alert('Error adding type: ' + error.message);
            } else {
                document.getElementById('cal-type-label').value = '';
                loadCalTypes(); // Reload types list
            }
        });

        createCalEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = document.getElementById('cal-event-date').value;
            const typeId = document.getElementById('cal-event-type-select').value;

            if (!typeId) {
                alert('Please create and select an event type first.');
                return;
            }

            // Check if event already exists for this date/type (optional, DB handles unique constraint)
            const { error } = await supabase
                .from('calendar_events')
                .insert([{ event_date: date, type_id: typeId }]);

            if (error) {
                alert('Error adding event (maybe duplicate?): ' + error.message);
            } else {
                alert('Event added!');
                loadCalEvents();
            }
        });

        // --- User Management ---
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
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
                alert('Error creating user request: ' + error.message);
            } else {
                alert('User creation request submitted. Check list for status.');
                createUserForm.reset();
                loadAdminUsers();
            }
        });

    });

    // --- Functions ---
    async function loadAdminUsers() {
        adminUsersList.innerHTML = '<p>Loading...</p>';

        // We can fetch from profiles to see existing users
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            adminUsersList.innerHTML = '<p>Error loading users.</p>';
            return;
        }

        if (!profiles || profiles.length === 0) {
            adminUsersList.innerHTML = '<p>No users found.</p>';
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
            } else {
                alert("Access denied. Admin rights required.");
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

        postsContainer.innerHTML = '<p>Loading...</p>';
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('category', category)
            .order('created_at', { ascending: false });

        if (error) {
            postsContainer.innerHTML = '<p>Error loading posts.</p>';
            console.error(error);
        } else {
            if (data.length === 0) {
                postsContainer.innerHTML = '<p>No posts found.</p>';
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
                        <!-- <button onclick="editPost('${post.id}')">Edit</button> -->
                    </div>
                </div>
            `).join('');
        }
    }

    async function deletePost(id) {
        if (!confirm('Are you sure you want to delete this post?')) return;

        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Error deleting post: ' + error.message);
        } else {
            loadPosts(currentTab);
        }
    }

    // Group Functions
    async function loadAdminGroups() {
        adminGroupsList.innerHTML = '<p>Loading...</p>';
        const { data, error } = await supabase
            .from('groups')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            adminGroupsList.innerHTML = '<p>Error loading groups.</p>';
        } else {
            if (!data || data.length === 0) {
                adminGroupsList.innerHTML = '<p>No groups found.</p>';
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
        groupDetailPanel.style.display = 'block';
        loadGroupMembers(gid);
    };

    async function loadGroupMembers(gid) {
        groupMembersList.innerHTML = '<p>Loading members...</p>';
        const { data, error } = await supabase
            .from('group_members')
            .select(`
                id,
                user_id,
                can_post,
                profiles (email, display_name)
            `)
            .eq('group_id', gid);

        if (error) {
            groupMembersList.innerHTML = '<p>Error loading members.</p>';
        } else {
            if (!data || data.length === 0) {
                groupMembersList.innerHTML = '<p>No members in this group.</p>';
                return;
            }

            groupMembersList.innerHTML = data.map(member => `
                <div class="post-item">
                    <div class="post-info">
                        <strong>${escapeHtml(member.profiles?.display_name || 'No Name')}</strong>
                        <span style="font-size:0.85rem; color:#666;">${escapeHtml(member.profiles?.email || 'No Email')}</span>
                    </div>
                    <div class="post-actions">
                        <button onclick="togglePostPermission('${member.id}', ${member.can_post})" style="padding:6px 12px; font-size:0.8rem; margin-right:5px; border:1px solid #ccc; background:${member.can_post ? '#e8f5e9' : '#fff5f5'}; border-radius:4px; cursor:pointer;">
                            ${member.can_post ? 'Can Post' : 'Read Only'}
                        </button>
                        <button onclick="removeMember('${member.id}')" class="btn-delete" style="font-size:0.8rem;">Remove</button>
                    </div>
                </div>
            `).join('');
        }
    }

    window.togglePostPermission = async (memberId, currentStatus) => {
        const { error } = await supabase
            .from('group_members')
            .update({ can_post: !currentStatus })
            .eq('id', memberId);

        if (error) {
            alert('Error updating permission: ' + error.message);
        } else {
            loadGroupMembers(currentManagingGroupId);
        }
    };

    window.removeMember = async (memberId) => {
        if (!confirm('Remove this user from the group?')) return;

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('id', memberId);

        if (error) {
            alert('Error removing member: ' + error.message);
        } else {
            loadGroupMembers(currentManagingGroupId);
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
        calEventsList.innerHTML = '<p>Loading...</p>';
        const { data, error } = await supabase
            .from('calendar_events')
            .select(`
                id,
                event_date,
                calendar_types (label, color)
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
    window.manageGroup = (gid, gname) => {
        currentManagingGroupId = gid;
        manageGroupTitle.innerText = `Manage Group: ${gname}`;
        groupDetailPanel.style.display = 'block';
        loadGroupMembers(gid);
    };
    window.togglePostPermission = togglePostPermission;
    window.removeMember = removeMember;

    window.deleteCalType = async (id) => {
        if (!confirm('Delete this event type? events using it might be affected.')) return;
        const { error } = await supabase.from('calendar_types').delete().eq('id', id);
        if (error) alert(error.message);
        else loadCalTypes();
    };

    window.deleteCalEvent = async (id) => {
        if (!confirm('Delete this event?')) return;
        const { error } = await supabase.from('calendar_events').delete().eq('id', id);
        if (error) alert(error.message);
        else loadCalEvents();
    };

})();
