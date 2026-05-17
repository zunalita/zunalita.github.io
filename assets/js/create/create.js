// ====== Import dependencies ======
import { sendPost } from './postSender.js';
import { loadDraft, saveDraft, clearDraft, watchDraft } from './draft.js';

// ====== Cache =====
let cachedAuthor = { name: 'User', login: 'user' };
let lastToken = null;
let previewTimer = null;

function getElement(id) {
    return document.getElementById(id);
}

function getGitHubToken() {
    return window.githubToken || localStorage.getItem('authorization');
}

function isValidGitHubToken(token) {
    return typeof token === 'string' && token.length > 30;
}

function hasForbiddenContent(content) {
    return /(javascript:|<script|onerror=|onload=)/i.test(content);
}

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

async function fetchAuthor(token) {
    if (!isValidGitHubToken(token)) return cachedAuthor;
    if (token === lastToken) return cachedAuthor;

    const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${token}` }
    });

    if (res.status === 401) {
        localStorage.removeItem('authorization');
        window.location.href = '/login/?next=/create/';
        return cachedAuthor;
    }

    if (!res.ok) return cachedAuthor;

    const data = await res.json();
    cachedAuthor = {
        name: data.name || data.login || 'User',
        login: data.login || 'user'
    };
    lastToken = token;
    return cachedAuthor;
}

function showCreatePage() {
    const section = getElement('content-area');
    if (section) section.style.display = 'block';
}

function updateStatus(message, statusClass = '') {
    const statusEl = getElement('status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = statusClass;
}

function getFormValues() {
    return {
        title: getElement('title')?.value.trim() || '',
        tagsRaw: getElement('tags')?.value.trim() || '',
        contentMarkdown: getElement('content')?.value.trim() || '',
        agree: getElement('agreement')?.checked || false
    };
}

async function renderPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
        const previewEl = getElement('preview');
        if (!previewEl) return;

        const { title, tagsRaw, contentMarkdown } = getFormValues();
        const token = getGitHubToken();
        const author = await fetchAuthor(token);
        const tags = tagsRaw.split(',').map(tag => tag.trim()).filter(Boolean);

        const titleText = title || '(Untitled)';
        const dateText = new Date().toLocaleDateString();

        let html = `<h1>${escapeHTML(titleText)}</h1>`;
        html += `<p>${dateText} • ${escapeHTML(author.name)}</p>`;
        if (tags.length) {
            html += tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join(' ');
        }
        html += `<hr>${DOMPurify.sanitize(marked.parse(contentMarkdown))}`;
        previewEl.innerHTML = html;
    }, 250);
}

function validateForm() {
    const submitBtn = getElement('submitBtn');
    const charcount = getElement('charcount');
    if (!submitBtn || !charcount) return;

    const { title, tagsRaw, contentMarkdown, agree } = getFormValues();
    const token = getGitHubToken();
    const isValid = isValidGitHubToken(token)
        && title.length > 5
        && tagsRaw.length > 0
        && contentMarkdown.length >= 300
        && !hasForbiddenContent(contentMarkdown)
        && agree;

    submitBtn.disabled = !isValid;
    charcount.textContent = `${contentMarkdown.length} / 300`;
}

function bindFormListeners() {
    watchDraft(() => {
        saveDraft();
        renderPreview();
        validateForm();
    });
}

async function submitPost(event) {
    event?.preventDefault();

    const token = getGitHubToken();
    if (!isValidGitHubToken(token)) {
        window.location.href = '/login/?next=/create/';
        return;
    }

    const submitBtn = getElement('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
    }

    updateStatus('Processing...', 'loading');

    try {
        const { title, tagsRaw, contentMarkdown } = getFormValues();
        const prUrl = await sendPost({
            token,
            title,
            tagsRaw,
            contentMarkdown,
            onStatus: (msg) => updateStatus(msg, 'loading')
        });

        clearDraft();
        window.location.href = prUrl;
    } catch (error) {
        updateStatus(`Error: ${error.message}`, 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    }
}

function initCreatePage() {
    const token = getGitHubToken();
    if (!isValidGitHubToken(token)) {
        window.location.href = '/login/?next=/create/';
        return;
    }

    showCreatePage();
    loadDraft();
    bindFormListeners();
    validateForm();
    renderPreview();

    const submitBtn = getElement('submitBtn');
    submitBtn?.addEventListener('click', submitPost);
}

// ====== Public API ======
window.submitPost = submitPost;

document.addEventListener('DOMContentLoaded', initCreatePage);
