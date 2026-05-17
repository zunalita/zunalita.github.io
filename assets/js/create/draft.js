const FORM_STORAGE_KEY = 'zunalita-form-draft';
const FIELD_IDS = ['title', 'tags', 'content', 'agreement', 'image', 'image_alt'];

function getField(id) {
    return document.getElementById(id);
}

function getDraft() {
    return {
        title: getField('title')?.value || '',
        tags: getField('tags')?.value || '',
        content: getField('content')?.value || '',
        agreement: getField('agreement')?.checked || false,
        image: getField('image')?.value || '',
        image_alt: getField('image_alt')?.value || '',
    };
}

export function loadDraft() {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (!saved) return;

    try {
        const draft = JSON.parse(saved);
        getField('title').value = draft.title || '';
        getField('tags').value = draft.tags || '';
        getField('content').value = draft.content || '';
        getField('agreement').checked = !!draft.agreement;
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
