const FORM_STORAGE_KEY = 'zunalita-form-draft';
const saveStatusEl = document.getElementById('save-status-text');

let saveTimeout = null;
let lastSavedDraft = null;

function setSaveStatus(status) {
    saveStatusEl.textContent = status;
}

// Get current form state
function getCurrentDraft() {
    return {
        title: document.getElementById('title').value,
        tags: document.getElementById('tags').value,
        content: document.getElementById('content').value,
        agreement: document.getElementById('agreement').checked,
    };
}

// Actual save function
// This will save the current draft to localStorage
function saveDraft() {
    const draft = getCurrentDraft();
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(draft));
    lastSavedDraft = draft;
}

async function saveDraftWithStatus() {
    // Status messages before saving
    try {
        setSaveStatus('Saving your post...');
        saveDraft();
        setSaveStatus('Saved – even if you go offline.');
    } catch (e) {
        setSaveStatus("Couldn't save your draft. Changes might be lost.");
    }
}

function scheduleAutoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveDraftWithStatus();
    }, 2000); // save every 2 seconds after typing stops
}

// Load draft from localStorage
// This will populate the form fields with saved data
// and set the last saved draft for comparison
// ---
// If no draft exists, it will leave the fields empty
// and set the last saved draft to null
// ---
// This allows the user to start fresh if needed
// It also sets the save status to indicate that the post is protected
// and can be continued at any time
function loadDraft() {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (!saved) return;
    try {
        const draft = JSON.parse(saved);
        document.getElementById('title').value = draft.title || '';
        document.getElementById('tags').value = draft.tags || '';
        document.getElementById('content').value = draft.content || '';
        document.getElementById('agreement').checked = !!draft.agreement;
        lastSavedDraft = draft;
    } catch (e) {
        console.warn("Couldn't load draft:", e);
    }
}

function clearDraft() {
    localStorage.removeItem(FORM_STORAGE_KEY);
    lastSavedDraft = null;
    setSaveStatus('');
}

function hasUnsavedChanges() {
    const current = getCurrentDraft();
    return JSON.stringify(current) !== JSON.stringify(lastSavedDraft);
}

// Warn user about unsaved changes on page unload
window.addEventListener('beforeunload', function (e) {
    if (hasUnsavedChanges()) {
        e.returnValue = '';
        return '';
    }
});

// Attach event listeners to form fields for auto-saving
['title', 'tags', 'content', 'agreement'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', scheduleAutoSave);
    if (el.type === 'checkbox') {
        el.addEventListener('change', scheduleAutoSave);
    }
});

// Auto-load draft on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDraft();
    setSaveStatus('Your post is protected. You can continue anytime.');
});
