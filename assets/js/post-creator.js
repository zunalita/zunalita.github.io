let cachedAuthor = null;
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
  return typeof token === "string" && token.length > 30;
}

async function fetchAuthorUsername(token) {
  if (!isValidGitHubToken(token)) return "User";
  if (token === lastUsedToken && cachedAuthor) return cachedAuthor;

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}` },
    });
    if (!response.ok) return "User";

    const data = await response.json();
    cachedAuthor = data.login || "User";
    lastUsedToken = token;
    return cachedAuthor;
  } catch {
    return "User";
  }
}

async function updatePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const token = window.githubToken;
    const title = document.getElementById("title").value.trim() || "(Untitled)";
    const tagsRaw = document.getElementById("tags").value.trim();
    const content = document.getElementById("content").value.trim();
    const date = new Date().toLocaleDateString();

    const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);
    const author = await fetchAuthorUsername(token);

    let html = `<h1>${title}</h1><p>${date} • ${author}</p>`;
    if (tags.length) html += tags.map(t => `<span>${t}</span>`).join(" ");
    html += `<hr><pre>${content}</pre>`;

    document.getElementById("preview").innerHTML = html;
  }, 500);
}

function validateForm() {
  const token = window.githubToken;
  const title = document.getElementById("title").value.trim();
  const tags = document.getElementById("tags").value.trim();
  const content = document.getElementById("content").value.trim();
  const agree = document.getElementById("agreement").checked;

  const ok =
    isValidGitHubToken(token) &&
    title.length > 5 &&
    tags &&
    content.length >= 300 &&
    !containsForbiddenContent(content) &&
    agree;

  document.getElementById("submitBtn").disabled = !ok;
  document.getElementById("charcount").textContent = `${content.length} / 300`;
}

["title", "tags", "content"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    updatePreview();
    validateForm();
  });
});
document.getElementById("agreement").addEventListener("change", validateForm);

async function main() {
  const token = window.githubToken;
  const title = document.getElementById("title").value.trim();
  const tagsRaw = document.getElementById("tags").value.trim();
  const contentMarkdown = document.getElementById("content").value.trim();
  const status = document.getElementById("status");
  const submitBtn = document.getElementById("submitBtn");

  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };

  const originalOwner = "zunalita";
  const originalRepo = "posts";
  const randomId = generateRandomId();
  const forkRepoName = `posts`;
  const newBranchName = `post-${randomId}`;

  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";
  status.textContent = "Processing...";
  status.className = "loading";

  try {
    const userResponse = await fetch("https://api.github.com/user", { headers });
    if (!userResponse.ok) throw new Error("Invalid token.");
    const userData = await userResponse.json();
    const username = userData.login;

    await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/forks`, {
      method: "POST",
      headers,
    });
    await new Promise(r => setTimeout(r, 5000));

    const refResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/ref/heads/main`, { headers });
    const baseSha = (await refResponse.json()).object.sha;

    const commitResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits/${baseSha}`, { headers });
    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${newBranchName}`, sha: baseSha }),
    });

    const nowIso = new Date().toISOString();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filePath = `posts/${nowIso.slice(0, 10)}-${slug}.md`;
    const tagsFormatted = tagsRaw.split(",").map(t => t.trim()).filter(Boolean).join('", "');
    const frontMatter =
      `---\nlayout: post\ntitle: "${title}"\nauthor: "${username}"\ndate: "${nowIso}"\ntags: ["${tagsFormatted}"]\ngenerator: post-creator\n---\n\n${contentMarkdown}\n`;

    const blobResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: frontMatter, encoding: "utf-8" }),
    });
    const blobSha = (await blobResponse.json()).sha;

    const treeResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [{ path: filePath, mode: "100644", type: "blob", sha: blobSha }],
      }),
    });
    const treeSha = (await treeResponse.json()).sha;

    const commitResponse2 = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: `New post: ${title}`,
        tree: treeSha,
        parents: [baseSha],
      }),
    });
    const commitSha = (await commitResponse2.json()).sha;

    await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs/heads/${newBranchName}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: commitSha }),
    });

    const prResponse = await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `New post: ${title}`,
        head: `${username}:${newBranchName}`,
        base: "main",
        body: "Automatically generated PR.",
      }),
    });
    const prData = await prResponse.json();

    window.location.href = prData.html_url;

  } catch (error) {
    status.textContent = "Error: " + error.message;
    status.className = "error";
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
}

async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const res = await fetch("https://website-utilities.vercel.app/api/oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem("githubToken", data.token);
      window.githubToken = data.token;
      window.history.replaceState({}, document.title, location.pathname);
      document.getElementById("login-area").style.display = "none";
      document.getElementById("content-area").style.display = "block";
      updatePreview();
      validateForm();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("githubToken");
  if (token) {
    window.githubToken = token;
    document.getElementById("content-area").style.display = "block";
    updatePreview();
    validateForm();
  } else {
    handleOAuthCallback();
    document.getElementById("login-area").style.display = "block";
    document.getElementById("login-btn").href =
      `https://github.com/login/oauth/authorize?client_id=Ov23lim8Ua2vYmUluLTp&scope=repo`;
  }
});
