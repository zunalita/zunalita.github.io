// This file is part of Zunalita's website project
// It handles user preferences for analytics tracking
// and updates the localStorage accordingly
const form = document.getElementById('privacy-form');
const status = document.getElementById('privacy-status');

function loadPreferences() {
    const saved = JSON.parse(localStorage.getItem('analyticsPreferences'));

    // As of 08/18/2025, Umami is the only analytics used
    // Google Analytics is no longer used to collect data, respecting user privacy
    if (saved) {
        form.umami.checked = !!saved.umami;
    } else {
        // default: enabled
        form.umami.checked = true;
    }
}

loadPreferences();

// Handle form submission to save preferences
// This updates localStorage and reloads the page to apply changes
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const prefs = {
        umami: form.umami.checked
    };

    localStorage.setItem('analyticsPreferences', JSON.stringify(prefs));
    status.textContent =
        '[handler] Preferences saved! Reloading…';

    setTimeout(() => {
        location.reload();
    }, 1000);
});

// Update preferences on storage change
// This allows other tabs to sync preferences without reloading
window.addEventListener('storage', (event) => {
    if (event.key === 'analyticsPreferences') {
        loadPreferences();
    }
});
