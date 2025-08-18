// This file is part of Zunalita's website project
// It initializes Umami analytics based on user preferences
// and handles the loading of the Umami script dynamically

(function () {
    // Read saved analytics preferences from localStorage
    const prefs = JSON.parse(localStorage.getItem('analyticsPreferences'));
    const useAll = !prefs;

    if (!useAll && prefs && !prefs.umami) {
        console.log('[Analytics] Umami disabled by user preferences.');
        return;
    }

    console.log('[analytics] Enabling Umami…');

    // Create a script element to load the Umami script
    // This script will be loaded asynchronously to avoid blocking the page load
    // It will also ensure that Umami is only loaded if the user has opted in
    // to Umami tracking
    const umamiScript = document.createElement('script');
    umamiScript.src = 'https://cloud.umami.is/script.js';
    umamiScript.defer = true;
    umamiScript.setAttribute(
        // This attribute is used to identify the website in Umami
        // This ID is from https://zunalita.github.io
        'data-website-id',
        'ca91f314-bce5-44a2-85d5-f747eebf5e55'
    );
    document.head.appendChild(umamiScript);

    // Wait for the script to load and then initialize Umami tracking
    // This ensures that the tracker is ready before we call it
    umamiScript.onload = () => {
        setTimeout(() => {
            // Check if Umami is defined and has the track function
            if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
                umami.track();
                console.log('[analytics] Umami loaded and tracking.');
            } else {
                console.warn('[analytics] Umami loaded but tracker not detected.');
            }
        }, 500);
    };

    // Handle script load error
    // This will log a warning if the script fails to load
    umamiScript.onerror = () => {
        console.warn('[analytics] Failed to load Umami script.');
    };
})();
