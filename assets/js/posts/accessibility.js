// Initial font size percentage
let currentSize = 100;

// Flags and variables for speech synthesis
let isSpeaking = false;
let utterance;

// Change the font size of the main content and save to localStorage
function changeFontSize(change) {
    currentSize += change * 10;

    // Limit font size between 50% and 200%
    if (currentSize < 50) currentSize = 50;
    if (currentSize > 200) currentSize = 200;

    // Apply font size to the content
    document.querySelector('.post-content').style.fontSize = currentSize + '%';

    // Save the updated size in localStorage for persistence
    localStorage.setItem('fontSizePercent', currentSize);
}

// Toggle text-to-speech reading of the page content
function toggleRead() {
    // Check if the browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
        alert('Your browser does not support speech synthesis.');
        return;
    }

    if (isSpeaking) {
        // If already speaking, cancel the speech
        speechSynthesis.cancel();
        isSpeaking = false;
        updateButton(false);
    } else {
        // Otherwise, start reading the content
        const content = document.querySelector('.post-content').innerText;
        utterance = new SpeechSynthesisUtterance(content);
        utterance.lang = document.documentElement.lang || 'en-US';

        // When speech ends, update state and button UI
        utterance.onend = () => {
            isSpeaking = false;
            updateButton(false);
        };

        // Start speaking
        speechSynthesis.speak(utterance);
        isSpeaking = true;
        updateButton(true);
    }
}

// Update the appearance of the audio button based on speaking state
function updateButton(speaking) {
    const btn = document.getElementById('btn-audio');
    btn.style.color = speaking ? '#007acc' : 'black';
}

// Cancel speech when the user navigates away from the page
window.addEventListener('beforeunload', () => {
    if (isSpeaking) speechSynthesis.cancel();
});

// Load saved font size from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedSize = localStorage.getItem('fontSizePercent');
    if (savedSize) {
        currentSize = parseInt(savedSize, 10);
        document.querySelector('.post-content').style.fontSize =
            currentSize + '%';
    }
});
