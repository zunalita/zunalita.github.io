// This file is part of Zunalita's website project.
// It handles user privacy choices for optional analytics.

const form = document.getElementById("privacy-form");
const status = document.getElementById("privacy-status");
const acceptAll = document.getElementById("privacy-accept-all");
const rejectAll = document.getElementById("privacy-reject-all");

const STORAGE_KEY = "analyticsPreferences";

function safeParsePreferences() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function getPreferences() {
    const saved = safeParsePreferences();

    return {
        // Default: disabled until the user opts in.
        umami: Boolean(saved?.umami)
    };
}

function loadPreferences() {
    const prefs = getPreferences();

    if (form?.umami) {
        form.umami.checked = prefs.umami;
    }
}

function savePreferences(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));

    if (status) {
        status.textContent = "Your privacy choices have been saved.";
        status.style.color = "green";
    }

    setTimeout(() => {
        location.reload();
    }, 700);
}

form?.addEventListener("submit", (event) => {
    event.preventDefault();

    savePreferences({
        umami: Boolean(form.umami.checked)
    });
});

acceptAll?.addEventListener("click", () => {
    if (form?.umami) form.umami.checked = true;

    savePreferences({
        umami: true
    });
});

rejectAll?.addEventListener("click", () => {
    if (form?.umami) form.umami.checked = false;

    savePreferences({
        umami: false
    });
});

window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
        loadPreferences();
    }
});

loadPreferences();