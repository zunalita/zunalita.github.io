(function () {
  let detected = false;

  function devtoolsDetector() {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    if ((widthThreshold || heightThreshold) && !detected) {
      detected = true;

      const style = `
        font-family: monospace;
        font-size: 1.4em;
        text-shadow: 0 0 1px #a0f9fa;
        color: #ffffffff;
      `;

      console.group(`%c Hello!`, style);
      console.log(`%c Knows how to code? Contribute with an function!`, style);
      console.log(`%c Visit: https://zunalita.github.io/developers`, style);
      console.log(`%c Visit: https://zunalita.github.io/roadmap for future projects.`, style);
      console.groupEnd();
    }
  }

  setInterval(devtoolsDetector, 500);
})();
