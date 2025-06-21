async function fetchInfo(autoOpenEdit = false) {
  function extractSlug(url) {
    const parts = url.split('/');
    let last = parts.pop() || parts.pop();
    if (!last) return null;
    return last.replace(/\.html?$/i, '.md');
  }

  try {
    await showsha();

    const currentUrl = window.location.href;
    const slug = extractSlug(currentUrl);

    if (!slug) throw new Error('Could not extract slug from URL.');

    const owner = 'zunalita';
    const repo = 'posts';
    const branch = 'main';
    const filePath = `posts/${slug}`;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    const historyUrl = `https://github.com/${owner}/${repo}/commits/${branch}/${filePath}`;
    const issuesUrl = `https://github.com/${owner}/${repo}/issues`;

    // Fetch file info
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const fileData = await res.json();

    // File SHA, size, author info from the file info
    const fileSha = fileData.sha || 'N/A';
    const fileSizeKB = (fileData.size / 1024).toFixed(2);

    // Author info (may not always be available here)
    const authorName = fileData.git_author?.name || fileData.author?.login || 'Unknown';

    // Fetch commit info to get last modified date
    const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}&sha=${branch}&per_page=1`);
    let lastModified = 'Unknown';
    if (commitsRes.ok) {
      const commits = await commitsRes.json();
      if (commits.length > 0) {
        lastModified = new Date(commits[0].commit.author.date).toLocaleString();
      }
    }

    const editUrl = `https://github.com/${owner}/${repo}/edit/${branch}/${filePath}`;
    const now = new Date().toLocaleString();

    const infoMessage = `Developer Info:
- Post URL: ${currentUrl}
- Edit URL: ${editUrl}
- File SHA: ${fileSha}
- File Size: ${fileSizeKB} KB
- Last Modified: ${lastModified}
- Post Author: ${authorName}
- History URL: ${historyUrl}
- Issues URL: ${issuesUrl}
- Checked at: ${now}`;

    console.group('Developer Info');
    console.log(infoMessage);
    console.groupEnd();

    alert(infoMessage);

    if (autoOpenEdit || confirm('Open edit page in a new tab?')) {
      window.open(editUrl, '_blank', 'noopener');
    }
  } catch (err) {
    console.error('Error in fetchInfo():', err);
    alert(`Error in fetchInfo(): ${err.message}`);
  }
}
