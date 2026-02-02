// --- Configuration ---
// REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Dom Elements ---
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const postForm = document.getElementById('post-form');
const tabBtns = document.querySelectorAll('.tab-btn');
const postsContainer = document.getElementById('posts-container');
const editorTitle = document.getElementById('editor-title');
const postCategoryInput = document.getElementById('post-category');

// --- Quill Editor Setup ---
const quill = new Quill('#quill-editor', {
    theme: 'snow',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
            ['blockquote', 'code-block'],
            [{ 'header': 1 }, { 'header': 2 }],               // custom button values
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
            ['link', 'image'],
            ['clean']                                         // remove formatting button
        ]
    }
});

let currentCategory = 'news';

// --- Auth Functions ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert('Login failed: ' + error.message);
    } else {
        checkUser();
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    checkUser();
});

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        loadPosts(currentCategory);
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
}

// --- Tabs ---
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class
        tabBtns.forEach(b => b.classList.remove('active'));
        // Add active class
        btn.classList.add('active');

        currentCategory = btn.dataset.tab;
        postCategoryInput.value = currentCategory;
        editorTitle.textContent = `New Post (${currentCategory.toUpperCase()})`;

        loadPosts(currentCategory);
    });
});

// --- Image Upload ---
async function uploadImages(files) {
    const uploadedUrls = [];
    for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabase.storage
            .from('images')
            .upload(filePath, file);

        if (error) {
            console.error('Upload Error:', error);
            alert('Image upload failed');
            continue;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
    }
    return uploadedUrls;
}

// --- Post Creation ---
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Get Values
    const title = document.getElementById('post-title').value;
    const content = quill.root.innerHTML;
    const category = postCategoryInput.value;
    const imageInput = document.getElementById('post-image');

    if (!title || !content) {
        alert('Title and Content are required');
        return;
    }

    // 2. Upload Images
    let imageUrls = [];
    if (imageInput.files.length > 0) {
        imageUrls = await uploadImages(imageInput.files);
    }

    // 3. Insert into Supabase
    const { data, error } = await supabase
        .from('posts')
        .insert([
            {
                title: title,
                content: content,
                category: category,
                images: imageUrls,
                published: true
            }
        ])
        .select();

    if (error) {
        alert('Error posting: ' + error.message);
    } else {
        alert('Posted successfully!');
        postForm.reset();
        quill.setContents([]); // Clear editor
        document.getElementById('image-preview').innerHTML = '';
        loadPosts(currentCategory); // Reload list
    }
});

// --- Load Posts ---
async function loadPosts(category) {
    postsContainer.innerHTML = '<p>Loading...</p>';

    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false });

    if (error) {
        postsContainer.innerHTML = '<p>Error loading posts.</p>';
        return;
    }

    if (data.length === 0) {
        postsContainer.innerHTML = '<p>No posts found.</p>';
        return;
    }

    let html = '';
    data.forEach(post => {
        html += `
            <div class="post-item">
                <div>
                    <strong>${post.title}</strong>
                    <br>
                    <small>${new Date(post.created_at).toLocaleDateString()}</small>
                </div>
                <div class="post-actions">
                    <button class="btn-delete" onclick="deletePost('${post.id}')">Delete</button>
                </div>
            </div>
        `;
    });

    postsContainer.innerHTML = html;
}

// --- Delete Post ---
window.deletePost = async (id) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Error deleting: ' + error.message);
    } else {
        loadPosts(currentCategory);
    }
};

// Initialize
checkUser();
