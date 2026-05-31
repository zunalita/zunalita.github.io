// ====== Import dependencies ======
import { sendPost } from './postSender.js';
import { loadDraft, saveDraft, clearDraft } from './draft.js';
import { getTagSuggestions } from './tagSuggestions.js';

// ====== Cache =====
let cachedAuthor = { name: 'User', login: 'user' };
let lastToken = null;
let easyMDEInstance = null;
let imageValidationTimer = null;
let currentImageValid = false;
let imageEditingMode = false;

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

function testImageUrl(url) {
    return new Promise((resolve) => {
        if (!url) {
            resolve(false);
            return;
        }

        const image = new Image();
        let finished = false;

        const onFinish = (valid) => {
            if (finished) return;
            finished = true;
            image.onload = null;
            image.onerror = null;
            resolve(valid);
        };

        image.onload = () => onFinish(true);
        image.onerror = () => onFinish(false);
        image.src = url;

        setTimeout(() => onFinish(false), 8000);
    });
}

function updateCoverVisibility() {
    const imageFieldRow = document.querySelector('.editor-fields');
    const integrated = document.querySelector('.editor-integrated');
    const imageUrl = getFieldValue(getElement('image'));

    if (imageUrl && currentImageValid && !imageEditingMode) {
        if (imageFieldRow) imageFieldRow.style.display = 'none';
        if (integrated) integrated.classList.add('has-cover-url');
    } else {
        if (imageFieldRow) imageFieldRow.style.display = '';
        if (integrated) integrated.classList.remove('has-cover-url');
    }
}

function attachFullscreenSync() {
    const editorContainer = document.querySelector('.EasyMDEContainer');
    const integrated = document.querySelector('.editor-integrated');
    if (!editorContainer || !integrated) return;

    const syncFullscreen = () => {
        const isFullscreen = editorContainer.classList.contains('fullscreen');
        integrated.classList.toggle('fullscreen', isFullscreen);
    };

    syncFullscreen();

    const observer = new MutationObserver(syncFullscreen);
    observer.observe(editorContainer, { attributes: true, attributeFilter: ['class'] });
}

function renderEditorMarkup() {
    const { title, imageUrl, imageAlt, contentMarkdown } = getFormValues();
    const coverPreview = getElement('coverPreview');
    const renderedEl = getElement('renderedContent');

    if (coverPreview) {
        if (imageUrl && currentImageValid) {
            const caption = imageAlt ? `<figcaption class="cover-caption">${escapeHTML(imageAlt)}</figcaption>` : '';
            coverPreview.innerHTML = `<figure class="cover-figure"><img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(imageAlt || title)}" />${caption}</figure>`;
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
        && currentImageValid
        && imageAlt.length > 0
        && bodyMarkdown.length > 20
        && !hasForbiddenContent(bodyMarkdown)
        && agree;

    submitBtn.disabled = !isValid;
    charcount.textContent = `${contentText.length} characters`;
}

function scheduleImageValidation(url) {
    imageEditingMode = true;
    clearTimeout(imageValidationTimer);
    currentImageValid = false;
    updateCoverVisibility();
    renderEditorMarkup();
    validateForm();

    if (!url) return;

    imageValidationTimer = setTimeout(async () => {
        const valid = await testImageUrl(url);
        currentImageValid = valid;
        imageEditingMode = !valid;
        updateCoverVisibility();
        renderEditorMarkup();
        validateForm();
    }, 2000);
}

function bindFormListeners() {
    const imageField = getElement('image');
    const altField = getElement('image_alt');
    const editorFields = getElement('editorFields');

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

    if (imageField) {
        imageField.addEventListener('input', () => {
            onContentChange();
            scheduleImageValidation(imageField.value.trim());
        });
    }
    if (editorFields) {
        editorFields.addEventListener('dragover', (event) => {
            event.preventDefault();
            editorFields.classList.add('drag-over');
        });
        editorFields.addEventListener('dragleave', () => {
            editorFields.classList.remove('drag-over');
        });
        editorFields.addEventListener('drop', (event) => {
            event.preventDefault();
            editorFields.classList.remove('drag-over');
            const url = event.dataTransfer?.getData('text/plain') || '';
            if (url && imageField) {
                imageField.value = url.trim();
                onContentChange();
                scheduleImageValidation(imageField.value.trim());
            }
        });
    }
    if (altField) altField.addEventListener('input', onContentChange);

    const coverPreview = getElement('coverPreview');
    if (coverPreview) {
        coverPreview.addEventListener('click', () => {
            const imageFieldRow = document.querySelector('.editor-fields');
            if (imageFieldRow) {
                imageEditingMode = true;
                imageFieldRow.style.display = '';
                getElement('image')?.focus();
                updateCoverVisibility();
                renderEditorMarkup();
                validateForm();
            }
        });
    }

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

    // Mark the EasyMDE container as integrated so CSS can blend it with surrounding fields
    const emContainer = document.querySelector('.EasyMDEContainer');
    if (emContainer) emContainer.classList.add('integrated');

    attachFullscreenSync();

    // Move the EasyMDE toolbar above the integrated fields and place the statusbar at the bottom
    const integrated = document.querySelector('.editor-integrated');
    if (emContainer && integrated) {
        const toolbar = emContainer.querySelector('.editor-toolbar');
        const statusbar = emContainer.querySelector('.editor-statusbar');
        if (toolbar) {
            integrated.insertBefore(toolbar, integrated.firstChild);
            toolbar.classList.add('moved-to-integrated');
        }
        if (statusbar) {
            integrated.appendChild(statusbar);
            statusbar.classList.add('moved-to-integrated');
        }
    }

    loadDraft();
    updateTitleFromContent();
    scheduleImageValidation(getFieldValue(getElement('image')));
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
