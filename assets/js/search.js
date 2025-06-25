let idx;
let posts = [];

fetch("/assets/search.json")
.then(response => response.json())
.then(data => {
    posts = data;
    idx = lunr(function () {
    this.pipeline.remove(lunr.stemmer);
    this.searchPipeline.remove(lunr.stemmer);
    this.ref('url');
    this.field('title', { boost: 10 });
    this.field('content');
    data.forEach(function (doc) {
        this.add(doc);
    }, this);
    });
});

function escapeHtml(text) {
return text.replace(/[&<>"']/g, function (m) {
    return ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
    })[m];
});
}

function highlightTextSafe(text, terms) {
const tokens = text.split(/(\s+)/);  // Split by spaces but keep spaces
return tokens.map(token => {
    for (let term of terms) {
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    if (regex.test(token)) {
        return token.replace(regex, '<mark>$1</mark>');
    }
    }
    return token;
}).join('');
}

function renderResults(query) {
if (!idx) return;
const terms = query.trim().toLowerCase().split(/\s+/);
const results = idx.search(query);
const resultList = document.getElementById('search-results');
resultList.innerHTML = '';

if (results.length === 0) {
    resultList.innerHTML = '<li>No results found.</li>';
    return;
}

results.forEach(function (result) {
    const post = posts.find(p => p.url === result.ref);
    const date = new Date(post.date);
    const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const safeTitle = escapeHtml(post.title);
    const safeContent = escapeHtml(post.content.substring(0, 150)) + '...';

    const highlightedTitle = highlightTextSafe(safeTitle, terms);
    const highlightedContent = highlightTextSafe(safeContent, terms);

    const listItem = document.createElement('li');
    listItem.innerHTML = `
    <span class="post-meta">${formattedDate}</span>
    <h3><a class="post-link" href="${post.url}">${highlightedTitle}</a></h3>
    <p>${highlightedContent}</p>
    `;
    resultList.appendChild(listItem);
});
}

const searchBox = document.getElementById('search-box');

searchBox.addEventListener('input', function() {
const query = searchBox.value.trim();
if (query.length > 0) {
    renderResults(query);
} else {
    document.getElementById('search-results').innerHTML = '<li>Start typing to see results...</li>';
}
});

searchBox.addEventListener('keypress', function(event) {
if (event.key === 'Enter') {
    event.preventDefault();
    renderResults(searchBox.value.trim());
}
});
