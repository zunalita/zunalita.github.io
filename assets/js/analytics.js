(function () {
  // Read saved analytics preferences from localStorage
  const prefs = JSON.parse(localStorage.getItem('analyticsPreferences'));
  const useAll = !prefs;

  console.log('[Analytics] Checking… (useAll:', useAll, ')');

  // Define priority order
  const priority = ['gtag', 'umami', 'goat'];
  const allowed = priority.filter(shouldRun);

  // Start trying analytics services
  tryNext(0);

  // Check if a service is allowed (or default to all if no prefs saved)
  function shouldRun(service) {
    return useAll || (prefs && prefs[service]);
  }

  // Try the next service in the list
  function tryNext(index) {
    if (index >= allowed.length) {
      console.warn('[Analytics] No more analytics options available.');
      return;
    }

    const service = allowed[index];
    console.log(`[Analytics] Attempting: ${service}`);

    const loader = {
      gtag: loadGtag,
      umami: loadUmami,
      goat: loadGoatCounter
    }[service];

    loader(
      () => {
        console.log(`[Analytics] ${service} loaded successfully.`);
      },
      () => {
        console.warn(`[Analytics] ${service} failed. Trying next…`);
        tryNext(index + 1);
      }
    );
  }

  // Google Analytics loader
  function loadGtag(success, fail) {
    console.log('[Analytics] Enabling Google Analytics…');

    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-2YFGN42PX8';
    document.head.appendChild(gtagScript);

    gtagScript.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      window.gtag = gtag;

      gtag('js', new Date());
      gtag('config', 'G-2YFGN42PX8');
      success();
    };

    gtagScript.onerror = fail;
  }

  // Umami loader
  function loadUmami(success, fail) {
    console.log('[Analytics] Enabling Umami…');

    const umamiScript = document.createElement('script');
    umamiScript.src = 'https://cloud.umami.is/script.js';
    umamiScript.defer = true;
    umamiScript.setAttribute('data-website-id', 'ca91f314-bce5-44a2-85d5-f747eebf5e55');
    document.head.appendChild(umamiScript);

    umamiScript.onload = () => {
      setTimeout(() => {
        if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
          umami.track();
          success();
        } else {
          console.warn('[Analytics] Umami script loaded but no tracker detected.');
          fail();
        }
      }, 500);
    };

    umamiScript.onerror = fail;
  }

  // GoatCounter loader — simplified (removes pixel check)
  function loadGoatCounter(success, fail) {
    console.log('[Analytics] Enabling GoatCounter…');

    const goatScript = document.createElement('script');
    goatScript.async = true;
    goatScript.src = 'https://zunalita.github.io/assets/js/analytics.js';
    goatScript.setAttribute('data-goatcounter', 'https://zunalita.goatcounter.com/count');
    document.head.appendChild(goatScript);

    goatScript.onload = () => {
      console.log('[Analytics] GoatCounter script loaded.');
      success();
    };

    goatScript.onerror = fail;
  }
})();
