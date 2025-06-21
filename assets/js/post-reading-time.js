function estimateReadingTime(text) {
  const wordsPerMinute = 200;
  const textLength = text.trim().split(/\s+/).length;
  const time = Math.ceil(textLength / wordsPerMinute);
  return time;
}

document.addEventListener("DOMContentLoaded", () => {
  const content = document.querySelector('.post-content.e-content');
  if (!content) return;

  const text = content.innerText || content.textContent || "";
  const minutes = estimateReadingTime(text);

  if (minutes > 0) {
    const readingTimeEl = document.getElementById("reading-time");
    readingTimeEl.textContent = ` • Reading time: ${minutes} minutes`;
  }
});
