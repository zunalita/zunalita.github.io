// This script estimates the reading time of a post based on its content
// It calculates the number of words and provides an estimate in minutes or seconds
function estimateReadingTime(text) {
    const wordsPerMinute = 200;
    const wordsPerSecond = wordsPerMinute / 60; // ~3.33 words per second
    const textLength = text.trim().split(/\s+/).length;
    const timeInMinutes = textLength / wordsPerMinute;

    // If reading time is less than 1 minute, return seconds
    // Otherwise, return minutes with pluralization
    // This provides a user-friendly reading time estimate
    // e.g., "2 minutes" or "30 seconds"
    if (timeInMinutes < 1) {
        // Round up to the nearest second for short texts
        const seconds = Math.ceil(textLength / wordsPerSecond);
        return `${seconds} seconds`;
    } else {
        // Round up to the nearest minute for longer texts
        const minutes = Math.ceil(timeInMinutes);
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
}

// Attach reading time estimate to the post content
// This will run when the DOM is fully loaded
// It finds the post content element and calculates the reading time
// The reading time is then displayed in an element with ID 'reading-time'
document.addEventListener('DOMContentLoaded', function () {
    var content = document.querySelector('.post-content.e-content');
    if (!content) return;

    // Get the text content of the post
    var text = content.innerText || content.textContent || '';
    var readingTime = estimateReadingTime(text);

    var readingTimeEl = document.getElementById('reading-time');
    if (readingTimeEl) {
        // Display the reading time in the specified element
        readingTimeEl.textContent = ' • Reading time: ' + readingTime;
    }
});
