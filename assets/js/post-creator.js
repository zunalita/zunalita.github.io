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
  } catch {
    return "User";
  }
}

async function updatePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const token = document.getElementById("token").value.trim();
    const title = DOMPurify.sanitize(
      document.getElementById("title").value.trim() || "(Untitled)"
    );
    const tagsRaw = document.getElementById("tags").value.trim();
    const content = document.getElementById("content").value.trim();
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const tags = tagsRaw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const author = await fetchAuthorUsername(token);

    let html = `<h1>${title}</h1>`;
    html += `<p class="post-meta">${currentDate} • ${author}</p>`;

    if (tags.length > 0) {
      html += tags
        .map((tag) => `<span class="badge">${DOMPurify.sanitize(tag)}</span>`)
        .join(" ");
    }

    html += `<hr>`;
    html += DOMPurify.sanitize(marked.parse(content));

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

["token", "title", "tags", "content"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    updatePreview();
    validateForm();
  });
});

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
  const forkRepoName = `zunalita-posts-${randomId}`;
  const newBranchName = `post-${randomId}`;

  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";
  status.textContent = "Processing...";
  status.className = "loading";

  // Replace textarea with progress bar
  contentElement.outerHTML = `
    <progress id="content" max="100" value="0" style="width: 100%;"></progress>
  `;

  try {
    const userResponse = await fetch("https://api.github.com/user", { headers });
    if (!userResponse.ok) throw new Error("Invalid token or insufficient permissions.");
    const userData = await userResponse.json();
    const username = userData.login;

    const forkResponse = await fetch(
      `https://api.github.com/repos/${originalOwner}/${originalRepo}/forks`,
      { method: "POST", headers }
    );
    if (!forkResponse.ok) {
      const errMsg = (await forkResponse.json()).message;
      throw new Error("Error creating fork: " + errMsg);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const renameResponse = await fetch(
      `https://api.github.com/repos/${username}/${originalRepo}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: forkRepoName }),
      }
    );
    if (!renameResponse.ok) {
      const errMsg = (await renameResponse.json()).message;
      throw new Error("Error renaming fork: " + errMsg);
    }

    const refResponse = await fetch(
      `https://api.github.com/repos/${username}/${forkRepoName}/git/ref/heads/main`,
      { headers }
    );
    if (!refResponse.ok) {
      const errMsg = (await refResponse.json()).message;
      throw new Error("Error fetching main branch ref: " + errMsg);
    }
    const baseSha = (await refResponse.json()).object.sha;

    const branchResponse = await fetch(
      `https://api.github.com/repos/${username}/${forkRepoName}/git/refs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ref: `refs/heads/${newBranchName}`, sha: baseSha }),
      }
    );
    if (!branchResponse.ok) {
      const errMsg = (await branchResponse.json()).message;
      throw new Error("Error creating branch: " + errMsg);
    }

    const nowIso = new Date().toISOString();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const filePath = `posts/${nowIso.slice(0, 10)}-${slug}.md`;
    const tagsFormatted = tagsRaw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join('", "');
    const frontMatter = `---\ntitle: "${title}"\nauthor: "${username}"\ndate: "${nowIso}"\ntags: ["${tagsFormatted}"]\n---\n\n${contentMarkdown}\n`;

    const blobResponse = await fetch(
      `https://api.github.com/repos/${username}/${forkRepoName}/git/blobs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ content: frontMatter, encoding: "utf-8" }),
      }
    );
    if (!blobResponse.ok) {
      const errMsg = (await blobResponse.json()).message;
      throw new Error("Error creating blob: " + errMsg);
    }
    const blobSha = (await blobResponse.json()).sha;

    const treeResponse = await fetch(
      `https://api.github.com/repos/${username}/${forkRepoName}/git/trees`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          base_tree: baseSha,
          tree: [{ path: filePath, mode: "100644", type: "blob", sha: blobSha }],
        }),
      }
    );
    if (!treeResponse.ok) {
      const errMsg = (await treeResponse.json()).message;
      throw new Error("Error creating tree: " + errMsg);
    }
    const treeSha = (await treeResponse.json()).sha;

    const commitResponse = await fetch(
      `https://api.github.com/repos/${username}/${forkRepoName}/git/commits`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: `New post: ${title}`,
          tree: treeSha,
          parents: [baseSha],
        }),
      }
    );
    if (!commitResponse.ok) {
      const errMsg = (await commitResponse.json()).message;
      throw new Error("Error creating commit: " + errMsg);
    }
    const commitSha = (await commitResponse.json()).sha;

    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${username}/${forkRepoName}/git/refs/heads/${newBranchName}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: commitSha }),
      }
    );
    if (!updateRefResponse.ok) {
      const errMsg = (await updateRefResponse.json()).message;
      throw new Error("Error updating branch ref: " + errMsg);
    }

    const prResponse = await fetch(
      `https://api.github.com/repos/${originalOwner}/${originalRepo}/pulls`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `New post: ${title}`,
          head: `${username}:${newBranchName}`,
          base: "main",
          body: "Automatically generated PR via post generator.",
        }),
      }
    );
    const prData = await prResponse.json();

    if (!prResponse.ok) {
      throw new Error("Error creating PR: " + (prData.message || JSON.stringify(prData)));
    }

    // ✅ Redirect user to PR page
    window.location.href = prData.html_url;

  } catch (error) {
    status.textContent = "Error: " + error.message;
    status.className = "error";
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit post to revision...";
    submitBtn.onclick = main;

    const contentParent = document.getElementById("content").parentElement;
    if (contentParent) {
      contentParent.innerHTML = `
        <textarea id="content" rows="10" cols="50">${contentMarkdown}</textarea>
      `;
      document.getElementById("content").addEventListener("input", () => {
        updatePreview();
        validateForm();
      });
    }
  }
}
