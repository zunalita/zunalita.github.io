const form = document.getElementById('privacy-form');
const status = document.getElementById('privacy-status');

function loadPreferences() {
    const saved = JSON.parse(localStorage.getItem('analyticsPreferences'));

    if (saved) {
        form.gtag.checked = !!saved.gtag;
        form.umami.checked = !!saved.umami;
    } else {
        // defaults: keep all enabled
        form.gtag.checked = true;
        form.umami.checked = true;
    }
}

loadPreferences();

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const prefs = {
        gtag: form.gtag.checked,
        umami: form.umami.checked,
    };

    localStorage.setItem('analyticsPreferences', JSON.stringify(prefs));
    status.textContent =
        '✅ Thank you! Your preferences have been saved. Reloading…';

    // reload after short delay
    setTimeout(() => {
        location.reload();
    }, 1000);
});

window.addEventListener('storage', (event) => {
    if (event.key === 'analyticsPreferences') {
        loadPreferences();
    }
});
