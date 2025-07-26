// Cache for author username and last used token to avoid extra API calls
let cachedName = null;
let cachedLogin = null;
let lastUsedToken = null;
let debounceTimer = null;

// Generate a random 8-character string (used for branch name)
function generateRandomId() {
    return Math.random().toString(36).substring(2, 10);
}

// Check if content contains dangerous HTML or JS
function containsForbiddenContent(content) {
    const forbiddenPattern = /(javascript:|<script|onerror=|onload=)/i;
    return forbiddenPattern.test(content);
}

// Simple GitHub token validity check
function isValidGitHubToken(token) {
    return typeof token === 'string' && token.length > 30;
}

// Fetch GitHub name and login from API (with caching)
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
        console.log('[post-creator] GitHub shared user data:\n', data);
        cachedName = data.name || data.login || 'User';
        cachedLogin = data.login || 'user';
        lastUsedToken = token;
        return { name: cachedName, login: cachedLogin };
    } catch (e) {
        return { name: 'User', login: 'user' };
    }
}

// Update the post preview with sanitized content and metadata
async function updatePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const token = window.githubToken;
        const title = document.getElementById('title').value.trim() || '(Untitled)';
        const tagsRaw = document.getElementById('tags').value.trim();
        const content = document.getElementById('content').value.trim();
        const date = new Date().toLocaleDateString();

        const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
        const { name } = await fetchAuthorUsername(token);

        let html = `<h1>${escapeHTML(title)}</h1><p>${date} • ${escapeHTML(name)}</p>`;
        if (tags.length)
            html += tags.map((t) => `<span>${escapeHTML(t)}</span>`).join(' ');

        // Render sanitized Markdown as HTML
        const mdHtml = DOMPurify.sanitize(marked.parse(content));
        html += `<hr>${mdHtml}`;

        document.getElementById('preview').innerHTML = html;
    }, 500);
}

// Escape HTML special chars for safe rendering
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Validate form inputs and enable/disable submit button
function validateForm() {
    const token = window.githubToken;
    const title = document.getElementById('title').value.trim();
    const tags = document.getElementById('tags').value.trim();
    const content = document.getElementById('content').value.trim();
    const agree = document.getElementById('agreement').checked;

    const ok =
        isValidGitHubToken(token) &&
        title.length > 5 &&
        tags &&
        content.length >= 300 &&
        !containsForbiddenContent(content) &&
        agree;

    document.getElementById('submitBtn').disabled = !ok;
    document.getElementById('charcount').textContent =
        `${content.length} / 300`;
}

// Watch for form changes to update preview and validate
['title', 'tags', 'content'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
        updatePreview();
        validateForm();
        saveDraft();
    });
});
document.getElementById('agreement').addEventListener('change', validateForm);

// Main function to create a PR with the post content
async function main() {
    const token = window.githubToken;
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
    const forkRepoName = `posts`;
    const newBranchName = `post-${randomId}`;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    status.textContent = 'Processing...';
    status.className = 'loading';

    try {
        // Get user login for commit
        const { login: username } = await fetchAuthorUsername(token);

        // Fork repo
        await fetch(
            `https://api.github.com/repos/${originalOwner}/${originalRepo}/forks`,
            {
                method: 'POST',
                headers,
            },
        );
        await new Promise((r) => setTimeout(r, 5000)); // wait for fork

        // Get base commit SHA
        const refResponse = await fetch(
            `https://api.github.com/repos/${username}/${forkRepoName}/git/ref/heads/main`,
            { headers },
        );
        const baseSha = (await refResponse.json()).object.sha;

        const commitResponse = await fetch(
            `https://api.github.com/repos/${username}/${forkRepoName}/git/commits/${baseSha}`,
            { headers },
        );
        const commitData = await commitResponse.json();
        const baseTreeSha = commitData.tree.sha;

        // Create new branch
        await fetch(
            `https://api.github.com/repos/${username}/${forkRepoName}/git/refs`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ref: `refs/heads/${newBranchName}`,
                    sha: baseSha,
                }),
            },
        );

        // Prepare post content with front matter
        const nowIso = new Date().toISOString();
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        const filePath = `posts/${nowIso.slice(0, 10)}-${slug}.md`;
        const tagsFormatted = tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .join('", "');
        const frontMatter = `---\nlayout: post\ntitle: "${title}"\nauthor: "${username}"\ndate: "${nowIso}"\ntags: ["${tagsFormatted}"]\ngenerator: post-creator\n---\n\n${contentMarkdown}\n`;

        // Create blob (file content)
        const blobResponse = await fetch(
            `https://api.github.com/repos/${username}/${forkRepoName}/git/blobs`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    content: frontMatter,
                    encoding: 'utf-8',
                }),
            },
        );
        const blobSha = (await blobResponse.json()).sha;

        // Create tree (file structure)
        const treeResponse = await fetch(
            `https://api.github.com/repos/${username}/${forkRepoName}/git/trees`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    base_tree: baseTreeSha,
                    tree: [
                        {
                            path: filePath,
                            mode: '100644',
                            type: 'blob',
                            sha: blobSha,
                        },
                    ],
                }),
            },
        );
        const treeSha = (await treeResponse.json()).sha;

        // Create commit
        const commitResponse2 = await fetch(
            `https://api.github.com/repos/${username}/${forkRepoName}/git/commits`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: `New post: ${title}`,
                    tree: treeSha,
                    parents: [baseSha],
                }),
            },
        );
        const commitSha = (await commitResponse2.json()).sha;

        // Update branch with new commit
        await fetch(
            `https://api.github.com/repos/${username}/${forkRepoName}/git/refs/heads/${newBranchName}`,
            {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ sha: commitSha }),
            },
        );

        // Create pull request
        const prResponse = await fetch(
            `https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    title: `New post: ${title}`,
                    head: `${username}:${newBranchName}`,
                    base: 'main',
                    body: 'Automatically generated PR.',
                }),
            },
        );
        const prData = await prResponse.json();

        // Redirect to PR page
        clearDraft();
        window.location.href = prData.html_url;
    } catch (error) {
        status.textContent = 'Error: ' + error.message;
        status.className = 'error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}

// Handle OAuth callback: exchange code for token and save it
async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        const res = await fetch(
            'https://website-utilities.vercel.app/api/oauth',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            },
        );
        const data = await res.json();
        if (data.token) {
            localStorage.setItem('githubToken', data.token);
            window.githubToken = data.token;
            window.history.replaceState({}, document.title, location.pathname);
            document.getElementById('login-area').style.display = 'none';
            document.getElementById('content-area').style.display = 'block';
            updatePreview();
            validateForm();
        }
    }
}

// On page load: handle OAuth or show login
document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('githubToken');
    if (token) {
        window.githubToken = token;
        document.getElementById('content-area').style.display = 'block';
        loadDraft();
        updatePreview();
        validateForm();
        return;
    }

    handleOAuthCallback();

    const clientId = 'Ov23lim8Ua2vYmUluLTp';
    const scope = 'repo';
    const oauthBaseUrl = 'https://github.com/login/oauth/authorize';
    const oauthUrl = `${oauthBaseUrl}?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`;

    document.getElementById('login-area').style.display = 'block';
    document
        .getElementById('login-btn')
        .addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = oauthUrl;
        });
});
