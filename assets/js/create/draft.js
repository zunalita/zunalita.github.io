const FORM_STORAGE_KEY = 'zunalita-form-draft';
const FIELD_IDS = ['title', 'tags', 'content', 'agreement', 'image', 'image_alt'];

function getField(id) {
    return document.getElementById(id);
}

function getFieldValue(field) {
    if (!field) return '';
    if (field.isContentEditable) return field.innerHTML;
    if ('value' in field) return field.value;
    return field.innerText;
}

function getDraft() {
    return {
        title: getFieldValue(getField('title')) || '',
        tags: getFieldValue(getField('tags')) || '',
        content: getFieldValue(getField('content')) || '',
        agreement: getField('agreement')?.checked || false,
        image: getFieldValue(getField('image')) || '',
        image_alt: getFieldValue(getField('image_alt')) || '',
    };
}

export function loadDraft() {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (!saved) return;

    try {
        const draft = JSON.parse(saved);
        const titleField = getField('title');
        const tagsField = getField('tags');
        const contentField = getField('content');
        const agreementField = getField('agreement');
        const imageField = getField('image');
        const imageAltField = getField('image_alt');

        if (titleField) titleField.value = draft.title || '';
        if (tagsField) tagsField.value = draft.tags || '';
        if (contentField) contentField.textContent = draft.content || '';
        if (agreementField) agreementField.checked = !!draft.agreement;
        if (imageField) imageField.value = draft.image || '';
        if (imageAltField) imageAltField.value = draft.image_alt || '';
    } catch (error) {
        console.warn("Couldn't load draft:", error);
    }
}

export function saveDraft() {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(getDraft()));
}

export function clearDraft() {
    localStorage.removeItem(FORM_STORAGE_KEY);
}

export function watchDraft(onChange) {
    FIELD_IDS.forEach((id) => {
        const field = getField(id);
        if (!field) return;

        const eventName = field.type === 'checkbox' ? 'change' : 'input';
        field.addEventListener(eventName, onChange);
    });
}

export function hasUnsavedChanges() {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (!saved) return false;

    try {
        return JSON.stringify(getDraft()) !== saved;
    } catch {
        return false;
    }
}

window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedChanges()) return;
    event.returnValue = '';
});
