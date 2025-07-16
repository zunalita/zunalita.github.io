(function () {
  const prefs = JSON.parse(localStorage.getItem('analyticsPreferences'));
  const useAll = !prefs;

  console.log('[Analytics] Checking… (useAll:', useAll, ')');

  if (shouldRun('gtag')) {
    loadGtag();
    return;
  } else if (shouldRun('umami')) {
    loadUmami();
    return;
  } else if (shouldRun('goat')) {
    loadGoatCounter();
    return;
  } else {
    console.warn('[Analytics] No analytics allowed or configured.');
  }

  function shouldRun(service) {
    return useAll || (prefs && prefs[service]);
  }

  function loadGtag() {
    console.log('[Analytics] Enabling Google Analytics');

    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-2YFGN42PX8';
    document.head.appendChild(gtagScript);

    gtagScript.onload = () => {
      console.log('[Analytics] gtag.js loaded');
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;

      gtag('js', new Date());
      gtag('config', 'G-2YFGN42PX8');
    };
  }

  function loadUmami() {
    console.log('[Analytics] Enabling Umami');

    const umamiScript = document.createElement('script');
    umamiScript.src = 'https://cloud.umami.is/script.js';
    umamiScript.defer = true;
    umamiScript.setAttribute('data-website-id', 'ca91f314-bce5-44a2-85d5-f747eebf5e55');

    umamiScript.onload = function () {
      console.log('[Analytics] Umami script loaded.');
      setTimeout(() => {
        if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
          umami.track();
          console.log('[Analytics] umami.track() called.');
        } else {
          console.warn('[Analytics] Umami loaded but inactive.');
        }
      }, 500);
    };

    umamiScript.onerror = function () {
      console.error('[Analytics] Umami failed to load.');
    };

    document.head.appendChild(umamiScript);
  }

  function loadGoatCounter() {
    console.log('[Analytics] Enabling GoatCounter');

    const goat = document.createElement('script');
    goat.async = true;
    goat.src = 'https://zunalita.github.io/assets/js/analytics.js';
    goat.setAttribute('data-goatcounter', 'https://zunalita.goatcounter.com/count');

    goat.onload = function () {
      console.log('[Analytics] GoatCounter script loaded');

      setTimeout(() => {
        const pixel = document.querySelector('img[src*="goatcounter.com/count"]');
        if (pixel) {
          pixel.addEventListener('error', () => {
            console.error('[Analytics] GoatCounter tracking blocked');
          });
          pixel.addEventListener('load', () => {
            console.log('[Analytics] GoatCounter tracking OK');
          });
        } else {
          console.warn('[Analytics] No GoatCounter tracking pixel found');
        }
      }, 500);
    };

    goat.onerror = function () {
      console.error('[Analytics] GoatCounter failed to load.');
    };

    document.head.appendChild(goat);
  }
})();
