// ====== use IP to store tokens ======
async function getPublicIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch (e) {
        return '0.0.0.0';
    }
}

async function deriveKey(ip) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(ip), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('static-salt-1234'), iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptToken(token, ip) {
    const key = await deriveKey(ip);
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
    return { cipher: btoa(String.fromCharCode(...new Uint8Array(cipher))), iv: btoa(String.fromCharCode(...iv)) };
}

async function decryptToken(encrypted, ip) {
    const key = await deriveKey(ip);
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(encrypted.cipher), c => c.charCodeAt(0));
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(dec);
}

// ====== Handle OAuth callback ======
async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    try {
        const res = await fetch('https://website-utilities.vercel.app/api/oauth', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.token) {
            const ip = await getPublicIP();
            const encrypted = await encryptToken(data.token, ip);
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
    const ip = await getPublicIP();
    const encrypted = localStorage.getItem('authorization');

    if (encrypted) {
        try {
            const token = await decryptToken(JSON.parse(encrypted), ip);
            if (!isValidGitHubToken(token)) throw new Error('Invalid token');
            window.githubToken = token;
            document.getElementById('content-area')?.style.setProperty('display', 'block');
            return;
        } catch (e) {
            console.warn('Token invalid, redirecting to login', e);
            localStorage.removeItem('authorization');
            window.location.href = '/'; // redirect to login
        }
    }

    handleOAuthCallback();

    const clientId = 'Ov23lim8Ua2vYmUluLTp';
    const scope = 'repo';
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`;

    document.getElementById('login-area')?.style.setProperty('display', 'block');
    document.getElementById('login-btn')?.addEventListener('click', () => {
        window.location.href = oauthUrl;
    });
});

function isValidGitHubToken(token) {
    return typeof token === 'string' && token.length > 30;
}
