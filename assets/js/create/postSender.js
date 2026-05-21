// postSender.js

async function fetchJson(url, options, label) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload.message || response.statusText || 'Unknown error';
        throw new Error(`${label} failed: ${message}`);
    }
    return payload;
}

export async function sendPost({ token, title, tagsRaw, imageUrl, imageAlt, contentMarkdown, authorName, authorLogin, postId, onStatus }) {
    if (!token || token.length < 30) throw new Error('Invalid GitHub token');

    const headers = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
    };

    const originalOwner = 'zunalita';
    const originalRepo = 'posts';
    const forkRepoName = 'posts';
    const randomId = Math.random().toString(36).substring(2, 10);
    const newBranchName = `post-${randomId}`;

    onStatus?.('Processing fork...');
    const forkResponse = await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/forks`, {
        method: 'POST', headers
    });
    if (![202, 201, 403, 422].includes(forkResponse.status) && !forkResponse.ok) {
        const err = await forkResponse.json().catch(() => ({}));
        throw new Error(`Fork creation failed: ${err.message || forkResponse.statusText}`);
    }

    let forkReady = false;
    const userData = await fetchJson('https://api.github.com/user', { headers }, 'Fetch user');
    const username = userData.login;

    for (let i = 0; i < 10; i++) {
        const res = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}`, { headers });
        if (res.ok) { forkReady = true; break; }
        await new Promise(r => setTimeout(r, 2000));
    }
    if (!forkReady) throw new Error('Fork not ready after waiting. Please try again later.');

    onStatus?.('Creating branch...');
    const refResponse = await fetchJson(`https://api.github.com/repos/${username}/${forkRepoName}/git/ref/heads/main`, { headers }, 'Fetch base branch');
    const baseSha = refResponse.object?.sha;
    if (!baseSha) throw new Error('Unable to resolve base branch SHA.');

    const branchPayload = { ref: `refs/heads/${newBranchName}`, sha: baseSha };
    await fetchJson(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs`, {
        method: 'POST', headers,
        body: JSON.stringify(branchPayload)
    }, 'Create branch');

    onStatus?.('Preparing file...');
    const nowIso = new Date().toISOString();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filePath = `posts/${nowIso.slice(0, 10)}-${slug}.md`;
    const tagsFormatted = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const tagsLine = tagsFormatted.length ? `tags: ["${tagsFormatted.join('", "')}"]\n` : '';
    const frontMatter = `---\nlayout: post\ntitle: "${title}"\nauthor: "${authorName}"\nauthor_login: "${authorLogin}"\ndate: "${nowIso}"\nimage: "${imageUrl}"\nimage_alt: "${imageAlt}"\n${tagsLine}generator: zunalita-create\nid: "${postId}"\n---\n\n${contentMarkdown}\n`;

    onStatus?.('Creating blob...');
    const blobResult = await fetchJson(`https://api.github.com/repos/${username}/${forkRepoName}/git/blobs`, {
        method: 'POST', headers,
        body: JSON.stringify({ content: frontMatter, encoding: 'utf-8' })
    }, 'Create blob');
    const blobSha = blobResult.sha;

    onStatus?.('Creating tree...');
    const commitResponse = await fetchJson(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits/${baseSha}`, { headers }, 'Fetch commit');
    const baseTreeSha = commitResponse.tree?.sha;
    if (!baseTreeSha) throw new Error('Unable to resolve base tree SHA.');

    const treeResult = await fetchJson(`https://api.github.com/repos/${username}/${forkRepoName}/git/trees`, {
        method: 'POST', headers,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blobSha }] })
    }, 'Create tree');
    const treeSha = treeResult.sha;

    onStatus?.('Committing...');
    const commitResult = await fetchJson(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits`, {
        method: 'POST', headers,
        body: JSON.stringify({ message: `New post: ${title}`, tree: treeSha, parents: [baseSha] })
    }, 'Create commit');
    const commitSha = commitResult.sha;

    await fetchJson(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs/heads/${newBranchName}`, {
        method: 'PATCH', headers, body: JSON.stringify({ sha: commitSha })
    }, 'Update branch');

    onStatus?.('Creating Pull Request...');
    let prReady = false;
    for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const res = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/branches/${newBranchName}`, { headers });
        if (res.ok) { prReady = true; break; }
    }
    if (!prReady) throw new Error('Branch not ready for Pull Request creation.');

    const prResult = await fetchJson(`https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: `New post: ${title}`,
            head: `${username}:${newBranchName}`,
            base: 'main',
            body: 'Automatically generated Pull Request.\n---\n> Using [web/create](https://zunalita.github.io/create)'
        })
    }, 'Create Pull Request');

    if (!prResult.html_url) {
        throw new Error('Pull Request was created but no URL was returned.');
    }

    return prResult.html_url;
}
