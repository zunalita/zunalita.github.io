(function () {
  let detected = false;

  function devtoolsDetector() {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    if ((widthThreshold || heightThreshold) && !detected) {
      detected = true;

      // Detect if the user prefers dark mode
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const textColor = prefersDark ? '#ffffff' : '#222222';

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
            'color: orange; font-weight: bold; font-size: 1.6em;'
          );
        }, i * 2000); // 2 seconds interval for each console.log
      }

      console.groupEnd();
    }
  }

  setInterval(devtoolsDetector, 500);
})();