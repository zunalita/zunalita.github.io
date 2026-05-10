document.addEventListener("DOMContentLoaded", () => {
    // Array of phrases to cycle through
    const phrases = [
        "start creating posts",
        "share your knowledge",
        "give your opinion",
        "comment on discussions",
        "collaborate with others",
        "explore new ideas",
        "be part of the community"
    ];

    const span = document.getElementById("changing-text");
    if (!span) return;

    let index = 0;

    setInterval(() => {
        // Slide out current text
        span.classList.remove("slide-in");
        span.classList.add("slide-out");

        // Wait for slide-out to finish
        setTimeout(() => {
            // Update text
            index = (index + 1) % phrases.length;
            span.textContent = phrases[index];

            // Position new text below
            span.classList.remove("slide-out");
            span.classList.add("hidden-start");

            // Force reflow to restart animation
            void span.offsetWidth;

            // Animate slide-in
            span.classList.remove("hidden-start");
            span.classList.add("slide-in");
        }, 1500); // matches CSS transition duration
    }, 5000); // interval between phrase changes
});