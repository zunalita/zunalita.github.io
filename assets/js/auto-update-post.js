(function() {
  let lastContent = null;
  const elem = document.querySelector('.post-content.e-content');
  if (elem) lastContent = elem.innerHTML;

  async function checkForRemoteUpdate() {
    try {
      const response = await fetch(window.location.href, { cache: "no-store" });
      if (!response.ok) return;

      const text = await response.text();
      const parser = new DOMParser();
      const remoteDoc = parser.parseFromString(text, "text/html");
      const remoteElem = remoteDoc.querySelector('.post-content.e-content');
      const remoteContent = remoteElem ? remoteElem.innerHTML : null;

      if (remoteContent && lastContent && remoteContent !== lastContent) {
        console.warn("Content changed online. Updating without scroll reset...");

        // Save current position
        const scrollY = window.scrollY;

        // Update the content
        const localElem = document.querySelector('.post-content.e-content');
        if (localElem) localElem.innerHTML = remoteContent;

        // Restore scroll position
        window.scrollTo(0, scrollY);

        lastContent = remoteContent;
      }
    } catch (e) {
      console.warn("Error checking for content update:", e);
    }
  }

  setInterval(checkForRemoteUpdate, 10000); // Checks every 10 seconds
})();
