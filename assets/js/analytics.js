(function () {
  console.log('Attempting to load Umami analytics...');

  const umamiScript = document.createElement('script');
  umamiScript.src = 'https://cloud.umami.is/script.js';
  umamiScript.defer = true;
  umamiScript.setAttribute('data-website-id', 'ca91f314-bce5-44a2-85d5-f747eebf5e55');

  umamiScript.onload = function () {
    console.log('Umami script loaded. Checking if it is active...');

    setTimeout(function () {
      try {
        if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
          umami.track();
          console.log('umami.track() called successfully.');
        } else {
          console.warn('Umami is not active or missing track() method. Falling back.');
          loadGoatCounter();
        }
      } catch (err) {
        console.error('Error calling umami.track():', err);
        loadGoatCounter();
      }
    }, 1000);
  };

  umamiScript.onerror = function () {
    console.warn('Umami script failed to load. Falling back to GoatCounter.');
    loadGoatCounter();
  };

  document.head.appendChild(umamiScript);

  function loadGoatCounter() {
    const goat = document.createElement('script');
    goat.async = true;
    goat.src = 'https://zunalita.github.io/assets/js/analytics.js';
    goat.setAttribute('data-goatcounter', 'https://zunalita.goatcounter.com/count');

    goat.onload = function () {
      console.log('GoatCounter script loaded.');

      // Check if the tracking pixel is present and log its status
      setTimeout(() => {
        const pixel = document.querySelector('img[src*="goatcounter.com/count"]');
        if (pixel) {
          pixel.addEventListener('error', () => {
            console.error('GoatCounter tracking request was blocked by client.');
          });
          pixel.addEventListener('load', () => {
            console.log('GoatCounter tracking request succeeded.');
          });
        } else {
          console.warn('No GoatCounter tracking pixel found.');
        }
      }, 500);
    };

    goat.onerror = function () {
      console.error('GoatCounter script failed to load. No telemetry will be used.');
    };

    document.head.appendChild(goat);
  }
})();