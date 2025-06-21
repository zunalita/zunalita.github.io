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
  return /^(gh[pous]_)/.test(token) && token.length > 30;
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
  } catch (e) {
    return "User";
  }
}

async function enablePagesSite(owner, repo, token) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };

  const getPagesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, { headers });
  if (getPagesResponse.ok) {
    const pagesData = await getPagesResponse.json();
    if (pagesData.html_url) {
      console.log("Pages já configurado, usando URL existente.");
      return pagesData.html_url;
    }
  }

  const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: { branch: "main", path: "/" } }),
  });

  if (!createResponse.ok) {
    const err = await createResponse.json();
    throw new Error(`Failed to enable Pages: ${err.message}`);
  }

  return null;
}

async function waitForPagesDeployment(owner, repo, token) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };

  for (let i = 0; i < 30; i++) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages/deployment`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "built" && data.url) return data.url;
      if (data.status === "errored") throw new Error("GitHub Pages build failed.");
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error("Timeout waiting for GitHub Pages deployment.");
}

async function updatePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const token = document.getElementById("token").value.trim();
    const title = DOMPurify.sanitize(document.getElementById("title").value.trim() || "(Untitled)");
    const tagsRaw = document.getElementById("tags").value.trim();
    const content = document.getElementById("content").value.trim();
    const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    const author = await fetchAuthorUsername(token);

    let html = `<h1>${title}</h1>`;
    html += `<p class="post-meta">${currentDate} • ${author}</p>`;
    if (tags.length) html += tags.map((tag) => `<span class="badge">${DOMPurify.sanitize(tag)}</span>`).join(" ");
    html += `<hr>${DOMPurify.sanitize(marked.parse(content))}`;

    const previewElement = document.getElementById("preview");
    previewElement.innerHTML = html;
    previewElement.style.opacity = 1;
  }, 500);
}

function validateForm() {
  const token = document.getElementById("token").value.trim();
  const title = document.getElementById("title").value.trim();
  const tags = document.getElementById("tags").value.trim();
  const content = document.getElementById("content").value.trim();
  const agreementChecked = document.getElementById("agreement").checked;

  const contentValid =
    content.length >= 300 &&
    !containsForbiddenContent(content) &&
    !/\]\(\s*http/i.test(content);

  const formValid =
    isValidGitHubToken(token) &&
    title.length > 5 &&
    tags.length > 0 &&
    contentValid &&
    agreementChecked;

  document.getElementById("submitBtn").disabled = !formValid;
  document.getElementById("charcount").textContent = `${content.length} / 300`;
}

["token", "title", "tags", "content"].forEach((id) =>
  document.getElementById(id).addEventListener("input", () => {
    updatePreview();
    validateForm();
  })
);

document.getElementById("agreement").addEventListener("change", validateForm);

async function main() {
  const token = document.getElementById("token").value.trim();
  const title = document.getElementById("title").value.trim();
  const tagsRaw = document.getElementById("tags").value.trim();
  const contentElement = document.getElementById("content");
  const contentMarkdown = contentElement.value.trim();
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

  contentElement.style.display = "none";
  let progressEl = document.getElementById("progress");
  if (!progressEl) {
    progressEl = document.createElement("progress");
    progressEl.id = "progress";
    progressEl.max = 100;
    progressEl.value = 0;
    progressEl.style.width = "100%";
    contentElement.parentNode.insertBefore(progressEl, contentElement.nextSibling);
  } else {
    progressEl.style.display = "block";
    progressEl.value = 0;
  }

  try {
    const userResponse = await fetch("https://api.github.com/user", { headers });
    if (!userResponse.ok) throw new Error("Invalid token or insufficient permissions.");
    const userData = await userResponse.json();
    const username = userData.login;

    const forkResponse = await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/forks`, {
      method: "POST",
      headers,
    });
    if (!forkResponse.ok) {
      const err = await forkResponse.json();
      throw new Error("Failed to create fork: " + err.message);
    }
    await new Promise((r) => setTimeout(r, 5000));

    const refResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/ref/heads/main`, { headers });
    if (!refResponse.ok) {
      const err = await refResponse.json();
      throw new Error("Failed to get main ref: " + err.message);
    }
    const baseSha = (await refResponse.json()).object.sha;

    const commitResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/commits/${baseSha}`, { headers });
    if (!commitResponse.ok) {
      const err = await commitResponse.json();
      throw new Error("Failed to get commit data: " + err.message);
    }
    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    const branchResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${newBranchName}`, sha: baseSha }),
    });
    if (!branchResponse.ok) {
      const err = await branchResponse.json();
      throw new Error("Failed to create branch: " + err.message);
    }

    const nowIso = new Date().toISOString();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filePath = `posts/${nowIso.slice(0, 10)}-${slug}.md`;
    const tagsFormatted = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).join('", "');
    const frontMatter = `---\nlayout: post\ntitle: "${title}"\nauthor: "${username}"\ndate: "${nowIso}"\ntags: ["${tagsFormatted}"]\ngenerator: post-creator\n---\n\n${contentMarkdown}\n`;

    const blobResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: frontMatter, encoding: "utf-8" }),
    });
    if (!blobResponse.ok) {
      const err = await blobResponse.json();
      throw new Error("Failed to create blob: " + err.message);
    }
    const blobSha = (await blobResponse.json()).sha;

    const treeResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [{ path: filePath, mode: "100644", type: "blob", sha: blobSha }],
      }),
    });
    if (!treeResponse.ok) {
      const err = await treeResponse.json();
      throw new Error("Failed to create tree: " + err.message);
    }
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
    if (!commitResponse2.ok) {
      const err = await commitResponse2.json();
      throw new Error("Failed to create commit: " + err.message);
    }
    const commitSha = (await commitResponse2.json()).sha;

    const updateRefResponse = await fetch(`https://api.github.com/repos/${username}/${forkRepoName}/git/refs/heads/${newBranchName}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: commitSha }),
    });
    if (!updateRefResponse.ok) {
      const err = await updateRefResponse.json();
      throw new Error("Failed to update ref: " + err.message);
    }

    const prResponse = await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `New post: ${title}`,
        head: `${username}:${newBranchName}`,
        base: "main",
        body: "Automatically generated PR via post generator.",
      }),
    });
    if (!prResponse.ok) {
      const err = await prResponse.json();
      throw new Error("Error creating PR: " + err.message);
    }
    const prData = await prResponse.json();

    let siteUrl = await enablePagesSite(username, forkRepoName, token);
    if (!siteUrl) {
      siteUrl = await waitForPagesDeployment(username, forkRepoName, token);
    }

    await fetch(`https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls/${prData.number}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body: `${prData.body}\n\n✅ Preview site: ${siteUrl}` }),
    });

    window.location.href = prData.html_url;

  } catch (error) {
    status.textContent = "Error: " + error.message;
    status.className = "error";
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit post to revision...";
    submitBtn.onclick = main;
    contentElement.style.display = "block";
    const progressEl = document.getElementById("progress");
    if (progressEl) progressEl.style.display = "none";
    document.getElementById("content").addEventListener("input", () => {
      updatePreview();
      validateForm();
    });
  }
}
