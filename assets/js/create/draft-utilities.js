const FORM_STORAGE_KEY = "zunalita-form-draft";
const saveStatusEl = document.getElementById("save-status-text");

let saveTimeout = null;
let lastSavedDraft = null;

function setSaveStatus(status) {
  saveStatusEl.textContent = status;
}

// Get current form state
function getCurrentDraft() {
  return {
    title: document.getElementById("title").value,
    tags: document.getElementById("tags").value,
    content: document.getElementById("content").value,
    agreement: document.getElementById("agreement").checked,
  };
}

function saveDraft() {
  const draft = getCurrentDraft();
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(draft));
  lastSavedDraft = draft;
}

async function saveDraftWithStatus() {
  try {
    setSaveStatus("Saving your post...");
    saveDraft();
    setSaveStatus("Saved – even if you go offline.");
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

function loadDraft() {
  const saved = localStorage.getItem(FORM_STORAGE_KEY);
  if (!saved) return;
  try {
    const draft = JSON.parse(saved);
    document.getElementById("title").value = draft.title || "";
    document.getElementById("tags").value = draft.tags || "";
    document.getElementById("content").value = draft.content || "";
    document.getElementById("agreement").checked = !!draft.agreement;
    lastSavedDraft = draft;
  } catch (e) {
    console.warn("Couldn't load draft:", e);
  }
}

function clearDraft() {
  localStorage.removeItem(FORM_STORAGE_KEY);
  lastSavedDraft = null;
  setSaveStatus("");
}

function hasUnsavedChanges() {
  const current = getCurrentDraft();
  return JSON.stringify(current) !== JSON.stringify(lastSavedDraft);
}

window.addEventListener("beforeunload", function (e) {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
});

["title", "tags", "content", "agreement"].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener("input", scheduleAutoSave);
  if (el.type === "checkbox") {
    el.addEventListener("change", scheduleAutoSave);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadDraft();
  setSaveStatus("Your post is protected. You can continue anytime.");
});
