function estimateReadingTime(text) {
  const wordsPerMinute = 200;
  const wordsPerSecond = wordsPerMinute / 60; // ~3.33 words per second
  const textLength = text.trim().split(/\s+/).length;
  const timeInMinutes = textLength / wordsPerMinute;

  if (timeInMinutes < 1) {
    const seconds = Math.ceil(textLength / wordsPerSecond);
    return `${seconds} seconds`;
  } else {
    const minutes = Math.ceil(timeInMinutes);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var content = document.querySelector('.post-content.e-content');
  if (!content) return;

  var text = content.innerText || content.textContent || "";
  var readingTime = estimateReadingTime(text);

  var readingTimeEl = document.getElementById("reading-time");
  if (readingTimeEl) {
    readingTimeEl.textContent = " • Reading time: " + readingTime;
  }
});
