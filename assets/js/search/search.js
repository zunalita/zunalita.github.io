// Search functionality using Lunr.js
// This script initializes a search index using Lunr.js
// It fetches posts from a JSON file and allows users to search through titles and content
let idx;
let posts = [];

// Fetch the search index data from a JSON file
fetch('/assets/search.json')
    .then((response) => response.json())
    .then((data) => {
        // Store the posts and create a Lunr index
        // The index will be used to search through the posts
        // The index is configured to search by 'url', 'title', and 'content'
        // The title field is given a higher boost to prioritize it in search results
        posts = data;
        idx = lunr(function () {
            this.pipeline.remove(lunr.stemmer);
            this.searchPipeline.remove(lunr.stemmer);
            this.ref('url');
            this.field('title', { boost: 10 });
            this.field('content');
            data.forEach(function (doc) {
                // Add each post to the index
                this.add(doc);
            }, this);
        });
    });

// Utility functions for escaping HTML and highlighting search terms
// These functions ensure that the search results are safe to display
// They escape HTML to prevent XSS attacks and highlight search terms in the results
// The highlight function wraps matching terms in <mark> tags for visibility
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function (m) {
        return {
            // Escape special characters to prevent XSS
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[m];
    });
}

// Highlight search terms in the text
// This function splits the text into tokens and highlights matching terms
// It uses a regular expression to find terms and wraps them in <mark> tags
function highlightTextSafe(text, terms) {
    const tokens = text.split(/(\s+)/); // Split by spaces but keep spaces
    return tokens
        .map((token) => {
            for (let term of terms) {
                // Escape the term to prevent XSS and create a regex
                const regex = new RegExp(
                    `(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                    'gi',
                );
                if (regex.test(token)) {
                    return token.replace(regex, '<mark>$1</mark>');
                }
            }
            // If no term matches, return the token as is
            // This ensures that non-matching tokens are not altered
            return token;
        })
        .join('');
}

// Render search results based on the user's query
// This function takes the user's input, searches the index, and displays results
// It formats the results with highlighted titles and content snippets
function renderResults(query) {
    if (!idx) return;
    const terms = query.trim().toLowerCase().split(/\s+/);
    const results = idx.search(query);
    const resultList = document.getElementById('search-results');
    resultList.innerHTML = '';

    // If no results found, display a message
    if (results.length === 0) {
        resultList.innerHTML = '<li>No results found.</li>';
        return;
    }

    // Iterate over the search results and create list items
    // Each item will display the post's date, title, and a snippet of content
    // The title and content will be highlighted with the search terms
    results.forEach(function (result) {
        const post = posts.find((p) => p.url === result.ref);
        const date = new Date(post.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

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

// Attach event listeners to the search box
// This will trigger the search when the user types in the search box
const searchBox = document.getElementById('search-box');

searchBox.addEventListener('input', function () {
    const query = searchBox.value.trim();
    if (query.length > 0) {
        // If the query is not empty, render the results
        renderResults(query);
    } else {
        // If the query is empty, clear the results
        document.getElementById('search-results').innerHTML =
            '<li>Start typing to see results...</li>';
    }
});

// Handle Enter key press in the search box
// This allows users to submit the search by pressing Enter
searchBox.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        renderResults(searchBox.value.trim());
    }
});
