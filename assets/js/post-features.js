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
(function () {
    const STORAGE_KEY = 'autoUpdatePost:v1';

    const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hora
    const MAX_CHECKS = 12; // máximo por sessão
    const LOCK_TTL = CHECK_INTERVAL; // tempo mínimo entre requests

    const CONTENT_SELECTOR = '.post-content.e-content';

    let lastContent = null;
    let checkCount = 0;
    let intervalId = null;

    const elem = document.querySelector(CONTENT_SELECTOR);
    if (elem) {
        lastContent = elem.innerHTML;
    }

    function now() {
        return Date.now();
    }

    function readState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;

            const data = JSON.parse(raw);

            if (!data || typeof data !== 'object') {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return data;
        } catch {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    function writeState(data) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    ...data,
                    updatedAt: now(),
                })
            );
        } catch {
            // localStorage pode falhar em modo privado ou storage cheio.
            // Ignora para não quebrar o site.
        }
    }

    function clearExpiredLock() {
        const state = readState();
        if (!state || !state.lockedAt) return;

        const lockAge = now() - state.lockedAt;

        if (lockAge > LOCK_TTL) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    function canRequest() {
        clearExpiredLock();

        const state = readState();
        if (!state) return true;

        if (!state.lastRequestAt) return true;

        const elapsed = now() - state.lastRequestAt;

        return elapsed >= CHECK_INTERVAL;
    }

    function markRequestStarted() {
        writeState({
            lockedAt: now(),
            lastRequestAt: now(),
        });
    }

    function markRequestFinished(extra = {}) {
        const state = readState() || {};

        writeState({
            ...state,
            lockedAt: null,
            ...extra,
        });
    }

    async function checkForRemoteUpdate() {
        if (document.hidden) return;
        if (!lastContent) return;

        if (checkCount >= MAX_CHECKS) {
            clearInterval(intervalId);
            console.log('[auto-update-post] Max checks reached. Stopping.');
            return;
        }

        if (!canRequest()) {
            return;
        }

        checkCount++;
        markRequestStarted();

        try {
            const response = await fetch(window.location.href, {
                cache: 'no-store',
            });

            if (!response.ok) {
                markRequestFinished({
                    lastStatus: response.status,
                    lastSuccessAt: null,
                });
                return;
            }

            const text = await response.text();

            const parser = new DOMParser();
            const remoteDoc = parser.parseFromString(text, 'text/html');

            const remoteElem = remoteDoc.querySelector(CONTENT_SELECTOR);
            const remoteContent = remoteElem ? remoteElem.innerHTML : null;

            if (!remoteContent) {
                markRequestFinished({
                    lastStatus: response.status,
                    lastSuccessAt: now(),
                    changed: false,
                });
                return;
            }

            if (remoteContent !== lastContent) {
                console.log(
                    '[auto-update-post] Content changed online. Updating without scroll reset...'
                );

                const scrollY = window.scrollY;
                const localElem = document.querySelector(CONTENT_SELECTOR);

                if (localElem) {
                    localElem.innerHTML = remoteContent;
                }

                window.scrollTo(0, scrollY);

                lastContent = remoteContent;

                markRequestFinished({
                    lastStatus: response.status,
                    lastSuccessAt: now(),
                    changed: true,
                    changedAt: now(),
                });

                clearInterval(intervalId);
                console.log('[auto-update-post] Updated once. Stopping checks.');
                return;
            }

            markRequestFinished({
                lastStatus: response.status,
                lastSuccessAt: now(),
                changed: false,
            });
        } catch (e) {
            markRequestFinished({
                lastErrorAt: now(),
                lastError: String(e && e.message ? e.message : e),
            });

            console.warn(
                '[auto-update-post] Error checking for content update:',
                e
            );
        }
    }

    console.log('Auto update post is running!');

    checkForRemoteUpdate();

    intervalId = setInterval(checkForRemoteUpdate, CHECK_INTERVAL);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkForRemoteUpdate();
        }
    });
})();
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
        readingTimeEl.textContent = ' • Reading time: ' + readingTime;
    }
});
