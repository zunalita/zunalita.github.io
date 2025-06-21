function estimateReadingTime(text) {
  const wordsPerMinute = 200;
  const textLength = text.trim().split(/\s+/).length;
  const time = Math.ceil(textLength / wordsPerMinute);
  return time;
}

document.addEventListener("DOMContentLoaded", function() {
  var content = document.querySelector('.post-content.e-content');
  if (!content) return;

  var text = content.innerText || content.textContent || "";
  var minutes = estimateReadingTime(text);

  if (minutes > 0) {
    var readingTimeEl = document.getElementById("reading-time");
    if (readingTimeEl) {
      readingTimeEl.textContent = " • Reading time: " + minutes + " minutes";
    }
  }
});
