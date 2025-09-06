// ====== Import sendPost ======
import { sendPost } from './postSender.js'; // ajuste o caminho se necessário

// ====== Cache & utilities ======
let cachedName = null;
let cachedLogin = null;
let lastUsedToken = null;
let debounceTimer = null;

function generateRandomId() { return Math.random().toString(36).substring(2, 10); }
function containsForbiddenContent(content) { return /(javascript:|<script|onerror=|onload=)/i.test(content); }
function escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

async function fetchAuthorUsername(token) {
    if (!isValidGitHubToken(token)) return { name: 'User', login: 'user' };
    if (token === lastUsedToken && cachedName && cachedLogin) return { name: cachedName, login: cachedLogin };
    try {
        const res = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } });
        if (res.status === 401) {
            // Remove authorization from localstorage and go to login page
            localStorage.removeItem('authorization');
            window.location.href = '/login';
            return;
        }
        if (!res.ok) return { name: 'User', login: 'user' };
        const data = await res.json();
        cachedName = data.name || data.login || 'User';
        cachedLogin = data.login || 'user';
        lastUsedToken = token;
        return { name: cachedName, login: cachedLogin };
    } catch(e) { return { name: 'User', login: 'user' }; }
}

// ====== Post preview ======
async function updatePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const token = window.githubToken;
        const titleEl = document.getElementById('title');
        const tagsEl = document.getElementById('tags');
        const contentEl = document.getElementById('content');
        const previewEl = document.getElementById('preview');

        if (!titleEl || !tagsEl || !contentEl || !previewEl) return;

        const title = titleEl.value.trim() || '(Untitled)';
        const tagsRaw = tagsEl.value.trim();
        const content = contentEl.value.trim();
        const date = new Date().toLocaleDateString();

        const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        const { name } = await fetchAuthorUsername(token);

        let html = `<h1>${escapeHTML(title)}</h1><p>${date} • ${escapeHTML(name)}</p>`;
        if (tags.length) html += tags.map(t => `<span>${escapeHTML(t)}</span>`).join(' ');
        html += `<hr>${DOMPurify.sanitize(marked.parse(content))}`;
        previewEl.innerHTML = html;
    }, 500);
}

// ====== Form validation ======
function validateForm() {
    const token = window.githubToken;
    const titleEl = document.getElementById('title');
    const tagsEl = document.getElementById('tags');
    const contentEl = document.getElementById('content');
    const submitBtn = document.getElementById('submitBtn');
    const charcount = document.getElementById('charcount');
    const agreeEl = document.getElementById('agreement');

    if (!titleEl || !tagsEl || !contentEl || !submitBtn || !charcount || !agreeEl) return;

    const title = titleEl.value.trim();
    const tags = tagsEl.value.trim();
    const content = contentEl.value.trim();
    const agree = agreeEl.checked;

    const ok = isValidGitHubToken(token) && title.length > 5 && tags && content.length >= 300 && !containsForbiddenContent(content) && agree;

    submitBtn.disabled = !ok;
    charcount.textContent = `${content.length} / 300`;
}

// ====== Watch inputs ======
['title','tags','content'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        updatePreview(); validateForm(); saveDraft();
    });
});
document.getElementById('agreement')?.addEventListener('change', validateForm);

// ====== Main submit function ======
async function main() {
    const token = window.githubToken;
    if (!isValidGitHubToken(token)) {
    window.location.href = '/login';
    return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const status = document.getElementById('status');
    if (!submitBtn || !status) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    status.textContent = 'Processing...';
    status.className = 'loading';

    try {
        const title = document.getElementById('title').value.trim();
        const tagsRaw = document.getElementById('tags').value.trim();
        const contentMarkdown = document.getElementById('content').value.trim();

        // ====== Chama sendPost ======
        const prUrl = await sendPost({
            token,
            title,
            tagsRaw,
            contentMarkdown,
            onStatus: (msg) => {
                status.textContent = msg;
            }
        });

        clearDraft();
        window.location.href = prUrl;

    } catch(error) {
        status.textContent = 'Error: ' + error.message;
        status.className = 'error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}

function isValidGitHubToken(token) {
    return typeof token === 'string' && token.length > 30;
}

// ====== Expose main ======
window.submitPost = main;
