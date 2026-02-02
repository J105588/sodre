// --- Configuration ---
// REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on index page
    const newsContainer = document.getElementById('news-list');
    const diaryContainer = document.getElementById('diary-list');
    const topicsContainer = document.getElementById('topics-list');

    // Index Page Loading
    if (newsContainer && diaryContainer && topicsContainer) {
        loadRecentPosts('news', newsContainer, 3);
        loadRecentPosts('diary', diaryContainer, 3);
        loadRecentPosts('topics', topicsContainer, 3);
    }

    // Individual Pages
    const fullListContainer = document.getElementById('full-post-list');
    if (fullListContainer) {
        const pageCategory = fullListContainer.dataset.category; // data-category="news"
        if (pageCategory) {
            loadAllPosts(pageCategory, fullListContainer);
        }
    }
});

// --- Modal Logic ---
function openModal(post) {
    const modal = document.getElementById('post-modal');
    const modalContent = document.getElementById('modal-post-content');

    if (!modal || !modalContent) return;

    let imagesHtml = '';
    if (post.images && post.images.length > 0) {
        imagesHtml = `<div class="post-images">`;
        post.images.forEach(img => {
            imagesHtml += `<img src="${img}" alt="Post Image">`;
        });
        imagesHtml += `</div>`;
    }

    const html = `
        <h2>${post.title}</h2>
        <p class="post-date">${new Date(post.created_at).toLocaleDateString()}</p>
        ${imagesHtml}
        <div class="post-body-text">
            ${post.content}
        </div>
    `;

    modalContent.innerHTML = html;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    const modal = document.getElementById('post-modal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

// Close on outside click
window.onclick = function (event) {
    const modal = document.getElementById('post-modal');
    if (event.target == modal) {
        closeModal();
    }
}


// --- DOM Generators ---
function createPostCard(post) {
    const thumb = (post.images && post.images.length > 0) ? post.images[0] : 'img/logo.webp'; // Fallback image
    // Strip HTML for excerpt
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = post.content;
    const textContent = tempDiv.textContent || tempDiv.innerText || "";
    const excerpt = textContent.slice(0, 80) + '...';

    return `
        <article class="post-card" onclick='openModalInput(${JSON.stringify(post).replace(/'/g, "&#39;")})'>
            <div class="post-img">
                <img src="${thumb}" alt="${post.title}">
            </div>
            <div class="post-content">
                <span class="post-date">${new Date(post.created_at).toLocaleDateString()}</span>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-excerpt">${excerpt}</p>
                <button class="read-more-btn">Read More <i class="fas fa-arrow-right"></i></button>
            </div>
        </article>
    `;
}

// Global wrapper for onclick to avoid quote escaping hell in HTML
window.openModalInput = (post) => {
    openModal(post);
}


// --- Fetchers ---

async function loadRecentPosts(category, container, limit) {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error(error);
        return;
    }

    if (data.length === 0) {
        // Optionally show "No posts" or just hide
        container.innerHTML = '<p class="no-posts">まだ投稿はありません。</p>';
        return;
    }

    container.innerHTML = data.map(post => createPostCard(post)).join('');
}

async function loadAllPosts(category, container) {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        container.innerHTML = '<p>Error loading posts.</p>';
        return;
    }

    if (data.length === 0) {
        container.innerHTML = '<p class="no-posts">まだ投稿はありません。</p>';
        return;
    }

    container.innerHTML = data.map(post => createPostCard(post)).join('');
}
