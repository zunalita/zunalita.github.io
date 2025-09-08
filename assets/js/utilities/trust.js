// OAuth simple protector
(function() {
    const allowedReferrer = 'https://github.com/';
    let firstAuthAllowed = false;

    // Detect first OAuth callback
    if (window.location.search.includes('code=')) {
        // If the URL contains 'code=', it indicates an OAuth callback
        // Set firstAuthAllowed to true to allow the first authorization
        firstAuthAllowed = true;
        console.log('[trust] OAuth callback detected, firstAuthAllowed = true');
    }

    // store original setItem
    const originalSetItem = localStorage.setItem;

    localStorage.setItem = function(key, value) {
        if (key === 'authorization') {
            // If the key is 'authorization', check the referrer
            // If firstAuthAllowed is true or the referrer matches the allowedReferrer
            // then allow setting the item
            // Otherwise, remove the 'authorization' item from localStorage
            if (firstAuthAllowed || document.referrer.startsWith(allowedReferrer)) {
                // Log the allowed referrer and proceed with setting the item
                console.log('[trust] authorization allowed:', document.referrer);
                originalSetItem.apply(this, arguments);
                firstAuthAllowed = false;
            } else {
                // If the referrer is not allowed, log a warning and remove the token
                console.warn('[trust] invalid referrer! removing token.');
                localStorage.removeItem('authorization');
            }
        } else {
            // For other keys, use the original setItem function
            originalSetItem.apply(this, arguments);
        }
    };

    window.addEventListener('storage', (e) => {
        if (e.key === 'authorization' && e.newValue !== null) {
            // If the 'authorization' key is changed, check the referrer again
            // If firstAuthAllowed is false and the referrer does not match the allowedReferrer
            // then remove the 'authorization' item from localStorage
            if (!firstAuthAllowed && !document.referrer.startsWith(allowedReferrer)) {
                console.warn('[trust] external change detected! removing token.');
                localStorage.removeItem('authorization');
            }
        }
    });

})();

// Devtools detection for logging
window.addEventListener("load", () => {
    // Check if the user prefers dark mode
    // This will adjust the text color for better visibility in dark mode
    // It uses the prefers-color-scheme media query to determine the user's preference
    // If dark mode is preferred, it sets the text color to white, otherwise to a dark color
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = prefersDark ? "#ffffff" : "#222222";

    // Message styling
    // This will apply a monospace font, larger size, and a text shadow for visibility
    // The text color is set based on the user's preference for dark mode
    const style = `
        font-family: monospace;
        font-size: 1.4em;
        text-shadow: 0 0 1px #a0f9fa;
        color: ${textColor};
    `;

    // Console group for better organization
    // This groups the messages together in the console for easier reading
    // It uses the style defined above for consistent appearance
    console.group(`%c Hello!`, style);
    console.log(`%c Knows how to code? Contribute with a function!`, style);
    console.log(`%c https://zunalita.github.io/developers`, style);
    console.log(`%c Keep track of on-work updates:`, style);
    console.log(`%c https://zunalita.github.io/roadmap`, style);

    // Warning about scams
    // This will log a warning message about scams
    // It uses a bold orange color for emphasis
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            console.log(
                `%cIf someone asked you to paste something here, don't do it — it has a 101% chance of being a scam!`,
                "color: orange; font-weight: bold; font-size: 1.6em;"
            );
        }, i * 2000);
    }
    // Final message about the project
    console.groupEnd();
});

// Trust secrets protector
// Don't let anyone view it, secure yurself
// Regex for Github token patterns
const githubTokenPatterns = [
    /ghp_[A-Za-z0-9]{36}/g, // GitHub Personal Access Token
    /gho_[A-Za-z0-9]{36}/g, // GitHub OAuth token
    /ghu_[A-Za-z0-9]{36}/g, // GitHub User token
    /ghs_[A-Za-z0-9]{36}/g, // GitHub App token
    /ghr_[A-Za-z0-9]{36}/g  // GitHub Refresh token
];

// Function to run whenever a secret is found
function onSecretExposed(secret) {
    // Try to revoke token
    revokeToken(githubToken); 
}

// Replace/mask secrets
function maskSecrets(str) {
    let masked = str;
    githubTokenPatterns.forEach(pattern => {
        const matches = str.match(pattern);
        if (matches) {
            matches.forEach(secret => onSecretExposed(secret));
            masked = masked.replace(pattern, "***");
        }
    });
    return masked;
}

// Wrap console.log
const originalLog = console.log;
const originalWarn = console.warn;

console.log = (...args) => {
    const maskedArgs = args.map(arg => {
        if (typeof arg === "string") return maskSecrets(arg);
        return arg;
    });
    originalLog(...maskedArgs);
};

// Revoke token function using zunalita api
const revokeToken = async (token) => {
  const url = "https://zunalita.vercel.app/api/revoke";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error while revoking token");
    }

    console.log(data.message);
    return data;
  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
};