// This file is part of Zunalita's website project.
// It initializes optional analytics only when the user has opted in.

(function () {
    const STORAGE_KEY = "analyticsPreferences";

    function safeParsePreferences() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    const prefs = safeParsePreferences();

    // Default: disabled until the user opts in.
    if (!prefs?.umami) {
        console.log("[analytics] Umami disabled or not consented.");
        return;
    }

    console.log("[analytics] Enabling Umami…");

    const umamiScript = document.createElement("script");

    umamiScript.src = "https://cloud.umami.is/script.js";
    umamiScript.defer = true;
    umamiScript.setAttribute(
        "data-website-id",
        "ca91f314-bce5-44a2-85d5-f747eebf5e55"
    );

    umamiScript.onload = () => {
        console.log("[analytics] Umami loaded.");
    };

    umamiScript.onerror = () => {
        console.warn("[analytics] Failed to load Umami script.");
    };

    document.head.appendChild(umamiScript);
})();