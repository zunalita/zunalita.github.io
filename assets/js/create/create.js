// ====== Import dependencies ======
import { sendPost } from './postSender.js';
import { loadDraft, saveDraft, clearDraft } from './draft.js';
import { getTagSuggestions } from './tagSuggestions.js';

// ====== Cache =====
let cachedAuthor = { name: 'User', login: 'user' };
let lastToken = null;
let easyMDEInstance = null;

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

function getFieldValue(field) {
    if (!field) return '';
    if ('value' in field) return field.value.trim();
    return field.innerText.trim();
}

function extractTitleFromMarkdown(markdown) {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    for (const line of lines) {
        const trimmed = line.replace(/^#+\s*/, '').trim();
        if (trimmed) return trimmed;
    }
    return '';
}

function removeTitleFromMarkdown(markdown, title) {
    if (!title) return markdown;
    const lines = markdown.split('\n');
    if (!lines.length) return markdown;
    const firstLine = lines[0].replace(/^#+\s*/, '').trim();
    if (firstLine === title.trim()) {
        return lines.slice(1).join('\n').replace(/^\n+/, '');
    }
    return markdown;
}

function generateContentId(content) {
    let hash = 5381;
    for (let i = 0; i < content.length; i += 1) {
        hash = ((hash << 5) + hash) + content.charCodeAt(i);
    }
    return `post-${Math.abs(hash).toString(36)}`;
}

function getFormValues() {
    const markdown = easyMDEInstance?.value() || '';
    return {
        title: getFieldValue(getElement('title')),
        imageUrl: getFieldValue(getElement('image')),
        imageAlt: getFieldValue(getElement('image_alt')),
        contentMarkdown: markdown,
        contentText: markdown.replace(/[#*`[\]()]/g, ''),
        agree: getElement('agreement')?.checked || false
    };
}

function renderTitleState() {
    const titleLabel = getElement('extractedTitle');
    const title = getFormValues().title;
    if (!titleLabel) return;
    titleLabel.textContent = title ? `${title}` : 'First line becomes the title automatically.';
}

function updateTitleFromContent() {
    const { contentMarkdown } = getFormValues();
    const title = extractTitleFromMarkdown(contentMarkdown);
    const titleInput = getElement('title');
    if (!titleInput) return;
    titleInput.value = title;
    renderTitleState();
}

function renderEditorMarkup() {
    const { title, imageUrl, imageAlt, contentMarkdown } = getFormValues();
    const coverPreview = getElement('coverPreview');
    const renderedEl = getElement('renderedContent');

    if (coverPreview) {
        if (imageUrl) {
            coverPreview.innerHTML = `<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(imageAlt || title)}" />`;
        } else {
            coverPreview.innerHTML = '<div class="cover-placeholder">Cover image will show here once selected.</div>';
        }
    }

    if (renderedEl) {
        const headerParts = [];
        if (title) {
            headerParts.push(`<h1>${escapeHTML(title)}</h1>`);
        }

        if (imageUrl) {
            headerParts.push(`<div class="post-hero-image"><img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(imageAlt || title)}"></div>`);
            if (imageAlt) {
                headerParts.push(`<span class="image-caption">${escapeHTML(imageAlt)}</span>`);
            }
        }

        const bodyMarkdown = removeTitleFromMarkdown(contentMarkdown, title);
        const preview = bodyMarkdown.slice(0, 100).replace(/[#*`[\]()]/g, '');
        renderedEl.innerHTML = `${headerParts.join('')}<div class="post-content e-content"><p>${escapeHTML(preview)}</p></div>`;
    }
}

function validateForm() {
    const submitBtn = getElement('submitBtn');
    const charcount = getElement('charcount');
    if (!submitBtn || !charcount) return;

    const { title, imageUrl, imageAlt, contentMarkdown, contentText, agree } = getFormValues();
    const bodyMarkdown = removeTitleFromMarkdown(contentMarkdown, title);
    const token = getGitHubToken();
    const isValid = isValidGitHubToken(token)
        && title.length > 5
        && imageUrl.length > 0
        && imageAlt.length > 0
        && bodyMarkdown.length > 20
        && !hasForbiddenContent(bodyMarkdown)
        && agree;

    submitBtn.disabled = !isValid;
    charcount.textContent = `${contentText.length} characters`;
}

function bindFormListeners() {
    const imageField = getElement('image');
    const altField = getElement('image_alt');

    const onContentChange = () => {
        updateTitleFromContent();
        saveDraft({
            title: getFieldValue(getElement('title')) || '',
            tags: '',
            content: easyMDEInstance?.value() || '',
            agreement: getElement('agreement')?.checked || false,
            image: getFieldValue(getElement('image')) || '',
            image_alt: getFieldValue(getElement('image_alt')) || ''
        });
        renderEditorMarkup();
        validateForm();
    };

    if (easyMDEInstance) {
        easyMDEInstance.codemirror.on('change', onContentChange);
    }

    if (imageField) imageField.addEventListener('input', onContentChange);
    if (altField) altField.addEventListener('input', onContentChange);

    const agreementField = getElement('agreement');
    if (agreementField) agreementField.addEventListener('change', validateForm);
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
        const { title, imageUrl, imageAlt, contentMarkdown, contentText } = getFormValues();
        const tags = getTagSuggestions(contentText);
        const bodyMarkdown = removeTitleFromMarkdown(contentMarkdown, title);
        const author = await fetchAuthor(token);
        const postId = generateContentId(bodyMarkdown);

        const prUrl = await sendPost({
            token,
            title,
            tagsRaw: tags.join(', '),
            imageUrl,
            imageAlt,
            contentMarkdown: bodyMarkdown,
            authorName: author.name,
            authorLogin: author.login,
            postId,
            onStatus: (msg) => updateStatus(msg, 'loading')
        });

        clearDraft();
        window.location.href = prUrl;
    } catch (error) {
        updateStatus(`Error: ${error.message}`, 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publish post';
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

    // Initialize EasyMDE
    easyMDEInstance = new EasyMDE({
        element: getElement('content'),
        spellChecker: false,
        autoDownloadFontAwesome: false,
        toolbar: [
            'bold',
            'italic',
            'heading',
            '|',
            'quote',
            'unordered-list',
            'ordered-list',
            '|',
            'link',
            'image',
            'horizontal-rule',
            '|',
            'preview',
            'side-by-side',
            'fullscreen',
            '|',
            'guide'
        ],
        promptURLs: true
    });

    // Expose EasyMDE instance globally for draft.js to access
    window.easyMDEInstance = easyMDEInstance;

    loadDraft();
    updateTitleFromContent();
    renderEditorMarkup();
    bindFormListeners();
    validateForm();

    const submitBtn = getElement('submitBtn');
    submitBtn?.addEventListener('click', submitPost);
}

// ====== Public API ======
window.submitPost = submitPost;

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCreatePage);
} else {
    initCreatePage();
}
