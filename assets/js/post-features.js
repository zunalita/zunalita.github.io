// Initial font size percentage
let currentSize = 100;
let isSpeaking = false;
let utterance;

function changeFontSize(change) {
    currentSize = Math.min(200, Math.max(50, currentSize + change * 10));
    const content = document.querySelector('.post-content');
    if (!content) return;
    content.style.fontSize = `${currentSize}%`;
    localStorage.setItem('fontSizePercent', currentSize);
}

function updateButton(speaking) {
    const btn = document.getElementById('btn-audio');
    if (!btn) return;
    btn.style.color = speaking ? '#007acc' : 'black';
}

function toggleRead() {
    if (!('speechSynthesis' in window)) {
        alert('Your browser does not support speech synthesis.');
        return;
    }

    if (isSpeaking) {
        speechSynthesis.cancel();
        isSpeaking = false;
        updateButton(false);
        return;
    }

    const content = document.querySelector('.post-content');
    if (!content) return;

    utterance = new SpeechSynthesisUtterance(content.innerText || '');
    utterance.lang = document.documentElement.lang || 'en-US';
    utterance.onend = () => {
        isSpeaking = false;
        updateButton(false);
    };

    speechSynthesis.speak(utterance);
    isSpeaking = true;
    updateButton(true);
}

window.addEventListener('beforeunload', () => {
    if (isSpeaking) speechSynthesis.cancel();
});

document.addEventListener('DOMContentLoaded', () => {
    const savedSize = localStorage.getItem('fontSizePercent');
    const content = document.querySelector('.post-content');

    if (savedSize && content) {
        currentSize = parseInt(savedSize, 10);
        content.style.fontSize = `${currentSize}%`;
    }

    const mainContent = document.querySelector('.post-content.e-content');
    if (!mainContent) return;

    const text = mainContent.innerText || mainContent.textContent || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.ceil(words / 200);
    const readingTime = minutes < 1 ? `${Math.ceil(words / (200 / 60))} seconds` : `${minutes} minute${minutes > 1 ? 's' : ''}`;

    const readingTimeEl = document.getElementById('reading-time');
    if (readingTimeEl) {
        readingTimeEl.textContent = ' • Reading time: ' + readingTime;
    }
});
