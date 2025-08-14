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
