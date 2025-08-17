// OAuth simple protector
(function() {
    const allowedReferrer = 'https://github.com/';
    let firstAuthAllowed = false;

    // Detect first OAuth callback
    if (window.location.search.includes('code=')) {
        firstAuthAllowed = true;
        console.log('[trust] OAuth callback detected, firstAuthAllowed = true');
    }

    // store original setItem
    const originalSetItem = localStorage.setItem;

    localStorage.setItem = function(key, value) {
        if (key === 'authorization') {
            if (firstAuthAllowed || document.referrer.startsWith(allowedReferrer)) {
                console.log('[trust] authorization allowed:', document.referrer);
                originalSetItem.apply(this, arguments);
                firstAuthAllowed = false;
            } else {
                console.warn('[trust] invalid referrer! removing token.');
                localStorage.removeItem('authorization');
            }
        } else {
            originalSetItem.apply(this, arguments);
        }
    };

    window.addEventListener('storage', (e) => {
        if (e.key === 'authorization' && e.newValue !== null) {
            if (!firstAuthAllowed && !document.referrer.startsWith(allowedReferrer)) {
                console.warn('[trust] external change detected! removing token.');
                localStorage.removeItem('authorization');
            }
        }
    });

})();

// Devtools detection for logging
window.addEventListener("load", () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = prefersDark ? "#ffffff" : "#222222";

    const style = `
        font-family: monospace;
        font-size: 1.4em;
        text-shadow: 0 0 1px #a0f9fa;
        color: ${textColor};
    `;

    console.group(`%c Hello!`, style);
    console.log(`%c Knows how to code? Contribute with a function!`, style);
    console.log(`%c https://zunalita.github.io/developers`, style);
    console.log(`%c Keep track of on-work updates:`, style);
    console.log(`%c https://zunalita.github.io/roadmap`, style);

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            console.log(
                `%cIf someone asked you to paste something here, don't do it — it has a 101% chance of being a scam!`,
                "color: orange; font-weight: bold; font-size: 1.6em;"
            );
        }, i * 2000);
    }
    console.groupEnd();
});
