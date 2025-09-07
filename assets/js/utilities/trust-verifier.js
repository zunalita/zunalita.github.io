(function() {
    // Check if trust.js is loaded
    const trustScript = Array.from(document.scripts).find(script =>
        script.src.includes("zunalita.github.io/assets/js/utilities/trust.js")
    );

    if (!trustScript) {
        console.warn("Warning: 'trust.js' is not loaded!");
    } else {
        console.log("trust.js is loaded from:", trustScript.src);
    }

    // Verify that all scripts come from the allowed origin
    const allowedOrigin = "https://zunalita.github.io";
    const scripts = document.querySelectorAll("script[src]");

    scripts.forEach(script => {
        const srcOrigin = new URL(script.src, window.location.href).origin;
        if (srcOrigin !== allowedOrigin) {
            console.warn(`script from different origin detected: ${script.src}`);
        }
    });

    // (Optional) Check iframes from external sources
    const iframes = document.querySelectorAll("iframe[src]");
    iframes.forEach(iframe => {
        const srcOrigin = new URL(iframe.src, window.location.href).origin;
        if (srcOrigin !== allowedOrigin) {
            console.warn(`iframe from different origin detected: ${iframe.src}`);
        }
    });
})();
