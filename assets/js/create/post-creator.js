// ====== use ip to store tokens ======
async function getPublicIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch {
        return '0.0.0.0'; // fallback
    }
}

async function deriveKey(ip) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(ip),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('static-salt-1234'),
            iterations: 100000,
            hash: 'SHA-256'
        },
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
    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(token)
    );
    return {
        cipher: btoa(String.fromCharCode(...new Uint8Array(cipher))),
        iv: btoa(String.fromCharCode(...iv))
    };
}

async function decryptToken(encrypted, ip) {
    const key = await deriveKey(ip);
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(encrypted.cipher), c => c.charCodeAt(0));
    const dec = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipher
    );
    return new TextDecoder().decode(dec);
}

// ====== Cache for GitHub user info ======
let cachedName = null;
let cachedLogin = null;
let lastUsedToken = null;
let debounceTimer = null;

function generateRandomId() {
    return Math.random().toString(36).substring(2, 10);
}

function containsForbiddenContent(content) {
    const forbiddenPattern = /(javascript:|<script|onerror=|onload=)/i;
    return forbiddenPattern.test(content);
}

function isValidGitHubToken(token) {
    return typeof token === 'string' && token.length > 30;
}

async function fetchAuthorUsername(token) {
    if (!isValidGitHubToken(token)) return { name: 'User', login: 'user' };
    if (token === lastUsedToken && cachedName && cachedLogin)
        return { name: cachedName, login: cachedLogin };

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` },
        });
        if (!response.ok) return { name: 'User', login: 'user' };

        const data = await response.json();
        cachedName = data.name || data.login || 'User';
        cachedLogin = data.login || 'user';
        lastUsedToken = token;
        return { name: cachedName, login: cachedLogin };
    } catch {
        return { name: 'User', login: 'user' };
    }
}

// ====== Post preview ======
async function updatePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const token = window.githubToken;
        const title = document.getElementById('title').value.trim() || '(Untitled)';
        const tagsRaw = document.getElementById('tags').value.trim();
        const content = document.getElementById('content').value.trim();
        const date = new Date().toLocaleDateString();

        const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        const { name } = await fetchAuthorUsername(token);

        let html = `<h1>${escapeHTML(title)}</h1><p>${date} • ${escapeHTML(name)}</p>`;
        if (tags.length) html += tags.map(t => `<span>${escapeHTML(t)}</span>`).join(' ');

        const mdHtml = DOMPurify.sanitize(marked.parse(content));
        html += `<hr>${mdHtml}`;

        document.getElementById('preview').innerHTML = html;
    }, 500);
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ====== Form validation ======
function validateForm() {
    const token = window.githubToken;
    const title = document.getElementById('title').value.trim();
    const tags = document.getElementById('tags').value.trim();
    const content = document.getElementById('content').value.trim();
    const agree = document.getElementById('agreement').checked;

    const ok = isValidGitHubToken(token) &&
        title.length > 5 &&
        tags &&
        content.length >= 300 &&
        !containsForbiddenContent(content) &&
        agree;

    document.getElementById('submitBtn').disabled = !ok;
    document.getElementById('charcount').textContent = `${content.length} / 300`;
}

// ====== Watch inputs ======
['title', 'tags', 'content'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        updatePreview();
        validateForm();
        saveDraft();
    });
});
document.getElementById('agreement').addEventListener('change', validateForm);

// ====== Main function ======
async function main() {
    const token = window.githubToken;
    if (!isValidGitHubToken(token)) return alert('Invalid token!');
    const title = document.getElementById('title').value.trim();
    const tagsRaw = document.getElementById('tags').value.trim();
    const contentMarkdown = document.getElementById('content').value.trim();
    const status = document.getElementById('status');
    const submitBtn = document.getElementById('submitBtn');

    const headers = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
    };

    const originalOwner = 'zunalita';
    const originalRepo = 'posts';
    const randomId = generateRandomId();
    const forkRepoName = 'posts';
    const newBranchName = `post-${randomId}`;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    status.textContent = 'Processing...';
    status.className = 'loading';

    try {
        const { login: username } = await fetchAuthorUsername(token);

        await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/forks`, { method: 'POST', headers });
        await new Promise(r => setTimeout(r, 5000));

        const refResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/ref/heads/main`, { headers });
        const baseSha = (await refResponse.json()).object.sha;

        const commitResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits/${baseSha}`, { headers });
        const baseTreeSha = (await commitResponse.json()).tree.sha;

        await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ref: `refs/heads/${newBranchName}`, sha: baseSha })
        });

        const nowIso = new Date().toISOString();
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const filePath = `posts/${nowIso.slice(0, 10)}-${slug}.md`;
        const tagsFormatted = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).join('", "');
        const frontMatter = `---\nlayout: post\ntitle: "${title}"\nauthor: "${username}"\ndate: "${nowIso}"\ntags: ["${tagsFormatted}"]\ngenerator: post-creator\n---\n\n${contentMarkdown}\n`;

        const blobResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/blobs`, {
            method: 'POST', headers, body: JSON.stringify({ content: frontMatter, encoding: 'utf-8' })
        });
        const blobSha = (await blobResponse.json()).sha;

        const treeResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/trees`, {
            method: 'POST', headers,
            body: JSON.stringify({ base_tree: baseTreeSha, tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blobSha }] })
        });
        const treeSha = (await treeResponse.json()).sha;

        const commitResponse2 = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits`, {
            method: 'POST', headers,
            body: JSON.stringify({ message: `New post: ${title}`, tree: treeSha, parents: [baseSha] })
        });
        const commitSha = (await commitResponse2.json()).sha;

        await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs/heads/${newBranchName}`, {
            method: 'PATCH', headers, body: JSON.stringify({ sha: commitSha })
        });

        const prResponse = await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls`, {
            method: 'POST', headers,
            body: JSON.stringify({
                title: `New post: ${title}`,
                head: `${username}:${newBranchName}`,
                base: 'main',
                body: 'Automatically generated Pull Request.\n---\n> Using [web/create](https://zunalita.github.io/create)',
            })
        });
        const prData = await prResponse.json();

        clearDraft();
        window.location.href = prData.html_url;
    } catch (error) {
        status.textContent = 'Error: ' + error.message;
        status.className = 'error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}

// ====== Handle OAuth callback ======
async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
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
            document.getElementById('login-area').style.display = 'none';
            document.getElementById('content-area').style.display = 'block';
            updatePreview();
            validateForm();
        }
    }
}

// ====== On page load ======
document.addEventListener('DOMContentLoaded', async function () {
    const encrypted = localStorage.getItem('authorization');
    const ip = await getPublicIP();

    if (encrypted) {
        try {
            const token = await decryptToken(JSON.parse(encrypted), ip);
            window.githubToken = token;
            document.getElementById('content-area').style.display = 'block';
            loadDraft();
            updatePreview();
            validateForm();
            return;
        } catch {
            localStorage.removeItem('authorization'); // IP mudou ou token inválido
        }
    }

    handleOAuthCallback();

    const clientId = 'Ov23lim8Ua2vYmUluLTp';
    const scope = 'repo';
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`;

    document.getElementById('login-area').style.display = 'block';
    document.getElementById('login-btn').addEventListener('click', e => {
        e.preventDefault();
        window.location.href = oauthUrl;
    });
});

window.addEventListener('storage', (e) => {
    if (e.key === 'authorization' && e.oldValue !== null) {
        console.warn('[critical] token modified from another source!');
        localStorage.removeItem('authorization');
        location.reload();
    }
});
