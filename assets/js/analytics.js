(function () {
  const prefs = JSON.parse(localStorage.getItem('analyticsPreferences'));
  const useAll = !prefs;

  console.log('[Analytics] Checking… (useAll:', useAll, ')');

  const priority = ['gtag', 'umami', 'goat'];
  const allowed = priority.filter(shouldRun);

  tryNext(0);

  function shouldRun(service) {
    return useAll || (prefs && prefs[service]);
  }

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

    loader(() => {
      console.log(`[Analytics] ${service} loaded successfully.`);
    }, () => {
      console.warn(`[Analytics] ${service} failed. Trying next…`);
      tryNext(index + 1);
    });
  }

  function loadGtag(success, fail) {
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-2YFGN42PX8';
    document.head.appendChild(gtagScript);

    gtagScript.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;

      gtag('js', new Date());
      gtag('config', 'G-2YFGN42PX8');
      success();
    };

    gtagScript.onerror = fail;
  }

  function loadUmami(success, fail) {
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
          fail();
        }
      }, 500);
    };

    umamiScript.onerror = fail;
  }

  function loadGoatCounter(success, fail) {
    const goat = document.createElement('script');
    goat.async = true;
    goat.src = 'https://zunalita.github.io/assets/js/analytics.js';
    goat.setAttribute('data-goatcounter', 'https://zunalita.goatcounter.com/count');
    document.head.appendChild(goat);

    goat.onload = () => {
      setTimeout(() => {
        const pixel = document.querySelector('img[src*="goatcounter.com/count"]');
        if (pixel) {
          pixel.addEventListener('load', () => success());
          pixel.addEventListener('error', () => fail());
        } else {
          fail();
        }
      }, 500);
    };

    goat.onerror = fail;
  }
})();
