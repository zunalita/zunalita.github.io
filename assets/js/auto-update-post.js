(function() {
  let lastContent = document.querySelector('.post-content.e-content')?.innerHTML;

  async function checkForRemoteUpdate() {
    try {
      const response = await fetch(window.location.href, { cache: "no-store" });
      if (!response.ok) return;

      const text = await response.text();
      const parser = new DOMParser();
      const remoteDoc = parser.parseFromString(text, "text/html");
      const remoteContent = remoteDoc.querySelector('.post-content.e-content')?.innerHTML;

      if (remoteContent && lastContent && remoteContent !== lastContent) {
        console.warn("Content changed online. Updating without scroll reset...");

        // Save current position
        const scrollY = window.scrollY;

        // Updates the content
        document.querySelector('.post-content.e-content').innerHTML = remoteContent;

        // Gets back to page position
        window.scrollTo(0, scrollY);

        lastContent = remoteContent;
      }
    } catch (e) {
      console.warn("Error checking for content update:", e);
    }
  }

  setInterval(checkForRemoteUpdate, 10000); // Checks every 10 seconds
})();