// postSender.js

export async function sendPost({ token, title, tagsRaw, contentMarkdown, onStatus }) {
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
    // 1. Create fork
    await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/forks`, { method: 'POST', headers });

    // 2. Wait fork be ready
    let forkReady = false;
    const username = (await fetch('https://api.github.com/user', { headers })).json().then(d => d.login);
    for (let i = 0; i < 10; i++) {
        const res = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}`, { headers });
        if (res.ok) { forkReady = true; break; }
        await new Promise(r => setTimeout(r, 2000));
    }
    if (!forkReady) throw new Error('Fork not ready');

    onStatus?.('Creating branch...');
    // 3. Create new branch
    const refResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/ref/heads/main`, { headers });
    const baseSha = (await refResponse.json()).object.sha;

    await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: `refs/heads/${newBranchName}`, sha: baseSha })
    });

    onStatus?.('Preparing file...');
    const nowIso = new Date().toISOString();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filePath = `posts/${nowIso.slice(0, 10)}-${slug}.md`;
    const tagsFormatted = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).join('", "');
    const frontMatter = `---\nlayout: post\ntitle: "${title}"\nauthor: "${username}"\ndate: "${nowIso}"\ntags: ["${tagsFormatted}"]\ngenerator: post-creator\n---\n\n${contentMarkdown}\n`;

    onStatus?.('Creating blob...');
    const blobResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/blobs`, {
        method: 'POST', headers, body: JSON.stringify({ content: frontMatter, encoding: 'utf-8' })
    });
    const blobSha = (await blobResponse.json()).sha;

    onStatus?.('Creating tree...');
    const commitResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits/${baseSha}`, { headers });
    const baseTreeSha = (await commitResponse.json()).tree.sha;

    const treeResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/trees`, {
        method: 'POST', headers,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blobSha }] })
    });
    const treeSha = (await treeResponse.json()).sha;

    onStatus?.('Committing...');
    const commitResponse2 = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits`, {
        method: 'POST', headers,
        body: JSON.stringify({ message: `New post: ${title}`, tree: treeSha, parents: [baseSha] })
    });
    const commitSha = (await commitResponse2.json()).sha;

    await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs/heads/${newBranchName}`, {
        method: 'PATCH', headers, body: JSON.stringify({ sha: commitSha })
    });

    onStatus?.('Creating Pull Request...');
    // 4. Create Pull Request
    let prReady = false;
    for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const res = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/branches/${newBranchName}`, { headers });
        if (res.ok) { prReady = true; break; }
    }
    if (!prReady) throw new Error('Branch not ready for PR');

    const prResponse = await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: `New post: ${title}`,
            head: `${username}:${newBranchName}`,
            base: 'main',
            body: 'Automatically generated Pull Request.\n---\n> Using [web/create](https://zunalita.github.io/create)'
        })
    });

    return (await prResponse.json()).html_url;
}
