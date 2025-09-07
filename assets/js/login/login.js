
// Inject hidden canvas for fingerprinting if not present
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('fingerprint-canvas')) {
        const canvas = document.createElement('canvas');
        canvas.id = 'fingerprint-canvas';
        canvas.width = 200;
        canvas.height = 50;
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
    }
});

// Get canvas fingerprint as a unique browser key
async function canvasFingerprintKey() {
    const canvas = document.getElementById("fingerprint-canvas");
    if (!canvas) throw new Error("Canvas element for fingerprint not found");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f00";
    ctx.fillRect(10, 10, 80, 30);
    ctx.font = "20px Arial";
    ctx.fillStyle = "#0f0";
    ctx.fillText("ed565fb2-fc48-4359-9989-694923161655", 10, 40);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get user IP address (uses public API)
async function getUserIP() {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
}

// Generate encryption key from fingerprint + IP
async function generateCryptoKey() {
    const fingerprint = await canvasFingerprintKey();
    const ip = await getUserIP();
    const combined = fingerprint + ip;
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(combined));
    return hashBuffer; // ArrayBuffer for key import
}

// Encrypt data using AES-GCM with fingerprint+IP as key
async function encryptData(plainText) {
    const keyBuffer = await generateCryptoKey();
    const key = await crypto.subtle.importKey(
        "raw", keyBuffer, { name: "AES-GCM" }, false, ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText)
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

// Decrypt data using AES-GCM with fingerprint+IP as key
async function decryptData(encrypted, iv) {
    const keyBuffer = await generateCryptoKey();
    const key = await crypto.subtle.importKey(
        "raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) }, key, new Uint8Array(encrypted)
    );
    return new TextDecoder().decode(decrypted);
}

// ====== Handle OAuth callback ======
async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    try {
        const res = await fetch('https://zunalita.vercel.app/api/oauth', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.token) {
            const encrypted = await encryptData(data.token);
            localStorage.setItem('authorization', JSON.stringify(encrypted));
            window.githubToken = data.token;
            window.history.replaceState({}, document.title, location.pathname);
            document.getElementById('login-area')?.style.setProperty('display', 'none');
            document.getElementById('content-area')?.style.setProperty('display', 'block');
        }
    } catch(e) {
        console.error('OAuth callback failed', e);
        localStorage.removeItem('authorization');
        window.location.href = '/'; // redirect to login
    }
}

// ====== On page load ======
document.addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById('login-btn');
    const loginArea = document.getElementById('login-area');
    const contentArea = document.getElementById('content-area');

    const clientId = 'Ov23lim8Ua2vYmUluLTp';
    const scope = 'repo';
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`;

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = oauthUrl;
        });
    }

    function shouldRedirectToLogin() {
        const currentPath = window.location.pathname;
        const auth = localStorage.getItem('authorization');
        return currentPath !== '/login/' && !auth;
    }

    if (shouldRedirectToLogin()) {
        window.location.href = '/login';
        return;
    }

    const encrypted = localStorage.getItem('authorization');

    try {
        if (encrypted) {
            const parsed = JSON.parse(encrypted);
            const token = await decryptData(parsed.data, parsed.iv);
            if (!isValidGitHubToken(token)) throw new Error('Invalid token');
            window.githubToken = token;
            contentArea?.style.setProperty('display', 'block');
            return;
        }
    } catch (e) {
        localStorage.removeItem('authorization');
    }

    handleOAuthCallback();

    loginArea?.style.setProperty('display', 'block');
});


function isValidGitHubToken(token) {
    return typeof token === 'string' && token.length > 30;
}
