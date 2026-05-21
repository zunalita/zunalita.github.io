// ====== Import dependencies ======
import { sendPost } from './postSender.js';
import { loadDraft, saveDraft, clearDraft, watchDraft } from './draft.js';
import { getTagSuggestions } from './tagSuggestions.js';

// ====== Cache =====
let cachedAuthor = { name: 'User', login: 'user' };
let lastToken = null;

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

function normalizeEditorHtml(html) {
    if (!html) return '';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const textValue = wrapper.textContent.replace(/\u00A0/g, ' ').trim();
    if (!textValue && !wrapper.querySelector('img')) {
        return '';
    }
    return html;
}

function getFormValues() {
    const contentElement = getElement('content');
    const rawContentHtml = contentElement?.innerHTML || '';
    return {
        title: getFieldValue(getElement('title')),
        imageUrl: getFieldValue(getElement('image')),
        imageAlt: getFieldValue(getElement('image_alt')),
        contentHtml: normalizeEditorHtml(rawContentHtml),
        contentText: contentElement?.innerText || '',
        agree: getElement('agreement')?.checked || false
    };
}

function renderTitleState() {
    const titleLabel = getElement('extractedTitle');
    const title = getFormValues().title;
    if (!titleLabel) return;
    titleLabel.textContent = title ? `${title}` : 'First line becomes the title automatically.';
}

function ensureFirstLineBlock() {
    const editor = getElement('content');
    if (!editor || !editor.firstChild) return;
    const first = editor.firstChild;

    if (first.nodeType === Node.TEXT_NODE && first.textContent.trim()) {
        const paragraph = document.createElement('p');
        paragraph.textContent = first.textContent;
        editor.replaceChild(paragraph, first);
    }
}

function updateTitleFromContent() {
    const { contentText, contentHtml } = getFormValues();
    const title = extractTitleFromContent(contentHtml || contentText);
    const titleInput = getElement('title');
    if (!titleInput) return;
    titleInput.value = title;
    renderTitleState();
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

function extractTitleFromContent(content) {
    if (!content) return '';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = content;
    const blockSelectors = 'p, div, h1, h2, h3, blockquote, li';
    const blocks = Array.from(wrapper.querySelectorAll(blockSelectors));
    let firstText = '';

    for (const block of blocks) {
        const text = block.textContent.replace(/\u00A0/g, ' ').trim();
        if (text) {
            firstText = text;
            break;
        }
    }

    if (!firstText) {
        firstText = wrapper.textContent.replace(/\u00A0/g, ' ').trim();
    }

    const firstLine = firstText.replace(/\r\n?/g, '\n').split('\n')[0].trim();
    return firstLine.replace(/^#+\s*/, '').trim();
}

// Tag suggestions are handled in a separate module to keep the editor focused on suggested topics only.

function generateContentId(content) {
    let hash = 5381;
    for (let i = 0; i < content.length; i += 1) {
        hash = ((hash << 5) + hash) + content.charCodeAt(i);
    }
    return `post-${Math.abs(hash).toString(36)}`;
}

function getEditorText() {
    const editor = getElement('content');
    return editor?.innerText || '';
}

function getEditorHtml() {
    const editor = getElement('content');
    return editor?.innerHTML || '';
}

function escapeInline(text) {
    let html = escapeHTML(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return html;
}

function execToolbarCommand(command, value = null) {
    if (command === 'insertLink') {
        const url = window.prompt('Enter the link URL');
        if (!url) return;
        document.execCommand('createLink', false, url);
        return;
    }

    if (command === 'formatBlock' && value) {
        document.execCommand('formatBlock', false, value);
        return;
    }

    document.execCommand(command, false, value);
}

function htmlToMarkdown(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    function serializeNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue.replace(/\s+/g, ' ');
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tag = node.tagName.toLowerCase();
        const children = Array.from(node.childNodes).map(serializeNode).join('');
        const trimmed = children.replace(/\s+$/, '');

        switch (tag) {
            case 'strong':
            case 'b':
                return `**${trimmed}**`;
            case 'em':
            case 'i':
                return `*${trimmed}*`;
            case 'code':
                return `\`${trimmed.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``;
            case 'a':
                return `[${trimmed}](${node.getAttribute('href') || ''})`;
            case 'h1':
                return trimmed ? `# ${trimmed}\n\n` : '';
            case 'h2':
                return trimmed ? `## ${trimmed}\n\n` : '';
            case 'h3':
                return trimmed ? `### ${trimmed}\n\n` : '';
            case 'blockquote':
                if (!trimmed) return '';
                return trimmed.split('\n').map(line => line ? `> ${line}` : '>').join('\n') + '\n\n';
            case 'ul':
                return Array.from(node.children).map(li => `- ${serializeNode(li).trim()}`).join('\n') + '\n\n';
            case 'ol':
                return Array.from(node.children).map((li, index) => `${index + 1}. ${serializeNode(li).trim()}`).join('\n') + '\n\n';
            case 'li':
                return `${trimmed}\n`;
            case 'div':
            case 'p':
                return trimmed ? `${trimmed}\n\n` : '';
            case 'br':
                return '\n';
            case 'img':
                return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
            default:
                return trimmed;
        }
    }

    return Array.from(wrapper.childNodes).map(node => serializeNode(node)).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function removeTitleFromHtml(html, title) {
    if (!title) return html;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    let first = null;
    for (const node of Array.from(wrapper.childNodes)) {
        const text = node.nodeType === Node.TEXT_NODE
            ? node.textContent.replace(/\u00A0/g, ' ').trim()
            : node.textContent.replace(/\u00A0/g, ' ').trim();

        if (text || (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'img')) {
            first = node;
            break;
        }
    }

    if (!first) return html;

    const text = first.textContent.replace(/\u00A0/g, ' ').trim();
    const normalized = text.replace(/^#+\s*/, '').trim();
    if (!normalized.startsWith(title.trim())) return html;

    const lines = text.split('\n');
    const rest = lines.slice(1).join('\n').trim();

    if (!rest) {
        first.remove();
    } else if (first.nodeType === Node.TEXT_NODE || (first.childNodes.length === 1 && first.firstChild.nodeType === Node.TEXT_NODE)) {
        first.textContent = rest;
    } else {
        const replacement = document.createElement(first.tagName);
        for (const attr of first.attributes) {
            replacement.setAttribute(attr.name, attr.value);
        }
        replacement.textContent = rest;
        first.replaceWith(replacement);
    }

    while (wrapper.firstChild && wrapper.firstChild.nodeType === Node.ELEMENT_NODE && !wrapper.firstChild.textContent.trim() && wrapper.firstChild.tagName.toLowerCase() !== 'img') {
        wrapper.firstChild.remove();
    }

    return wrapper.innerHTML;
}

function renderEditorMarkup() {
    const { title, imageUrl, imageAlt, contentText, contentHtml } = getFormValues();
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

        const bodyHtml = title ? removeTitleFromHtml(contentHtml, title) : contentHtml || '<p></p>';
        renderedEl.innerHTML = `${headerParts.join('')}<div class="post-content e-content">${bodyHtml}</div>`;
    }
}

function validateForm() {
    const submitBtn = getElement('submitBtn');
    const charcount = getElement('charcount');
    if (!submitBtn || !charcount) return;

    const { title, imageUrl, imageAlt, contentText, contentHtml, agree } = getFormValues();
    const markdown = htmlToMarkdown(contentHtml);
    const bodyMarkdown = removeTitleFromMarkdown(markdown, title);
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
    const editor = getElement('content');
    const imageField = getElement('image');
    const altField = getElement('image_alt');

    const onContentChange = () => {
        updateTitleFromContent();
        saveDraft();
        renderEditorMarkup();
        validateForm();
    };

    if (editor) {
        document.execCommand('defaultParagraphSeparator', false, 'p');
        editor.addEventListener('input', onContentChange);
        editor.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                document.execCommand('insertText', false, '\t');
            }
        });
        editor.addEventListener('paste', (event) => {
            const clipboardData = event.clipboardData || window.clipboardData;
            const pastedText = clipboardData?.getData('text/plain');
            if (!pastedText) return;
            event.preventDefault();
            const cleanText = pastedText.replace(/\r\n?/g, '\n');
            if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
                document.execCommand('insertText', false, cleanText);
            } else {
                const selection = window.getSelection();
                if (!selection || !selection.rangeCount) return;
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(cleanText));
                selection.removeAllRanges();
                selection.addRange(range);
            }
            onContentChange();
        });
    }

    const toolbar = document.querySelectorAll('.toolbar-button');
    toolbar.forEach((button) => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');
            const value = button.getAttribute('data-value');
            execToolbarCommand(command, value);
            onContentChange();
        });
    });

    if (imageField) imageField.addEventListener('input', onContentChange);
    if (altField) altField.addEventListener('input', onContentChange);

    watchDraft(onContentChange);
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
        const { title, imageUrl, imageAlt, contentText, contentHtml } = getFormValues();
        const tags = getTagSuggestions(contentText);
        const markdown = htmlToMarkdown(contentHtml);
        const bodyMarkdown = removeTitleFromMarkdown(markdown, title);
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

document.addEventListener('DOMContentLoaded', initCreatePage);
