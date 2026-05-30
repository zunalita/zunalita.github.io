const FORM_STORAGE_KEY = 'createDraft';
const FIELD_IDS = ['title', 'tags', 'content', 'agreement', 'image', 'image_alt'];

function getField(id) {
    return document.getElementById(id);
}

function getFieldValue(field) {
    if (!field) return '';
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
        const imageField = getField('image');
        const imageAltField = getField('image_alt');
        const agreementField = getField('agreement');

        if (titleField) titleField.value = draft.title || '';
        if (imageField) imageField.value = draft.image || '';
        if (imageAltField) imageAltField.value = draft.image_alt || '';
        if (agreementField) agreementField.checked = !!draft.agreement;

        const contentField = getField('content');
        if (contentField) {
            if (window.easyMDEInstance) {
                window.easyMDEInstance.value(draft.content || '');
            } else {
                contentField.value = draft.content || '';
            }
        }
    } catch (error) {
        console.warn("Couldn't load draft:", error);
    }
}

export function saveDraft(draftOverride = null) {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(draftOverride || getDraft()));
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
        const savedDraft = JSON.parse(saved);
        const currentDraft = getDraft();

        return (
            currentDraft.title !== (savedDraft.title || '') ||
            currentDraft.tags !== (savedDraft.tags || '') ||
            currentDraft.content !== (savedDraft.content || '') ||
            currentDraft.agreement !== !!savedDraft.agreement ||
            currentDraft.image !== (savedDraft.image || '') ||
            currentDraft.image_alt !== (savedDraft.image_alt || '')
        );
    } catch {
        return false;
    }
}

window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedChanges()) return;
    event.returnValue = '';
});
