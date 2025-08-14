// trust.js
(function() {
    const allowedReferrer = 'https://github.com/';

    // store the original setItem function
    const originalSetItem = localStorage.setItem;

    localStorage.setItem = function(key, value) {
        if (key === 'authorization') {
            if (document.referrer.startsWith(allowedReferrer)) {
                console.log('[trust] valid referrer detected:', document.referrer);
                originalSetItem.apply(this, arguments); // set the item normally
            } else {
                console.warn('[trust] invalid referrer!');
                localStorage.removeItem('authorization');
            }
        } else {
            // another keys can be set normally
            originalSetItem.apply(this, arguments);
        }
    };

    // If someone tries to set 'authorization' directly
    window.addEventListener('storage', (e) => {
        if (e.key === 'authorization' && e.newValue !== null) {
            if (!document.referrer.startsWith(allowedReferrer)) {
                console.warn('[trust] change not signed, removing authorization!');
                localStorage.removeItem('authorization');
            }
        }
    });

})();
