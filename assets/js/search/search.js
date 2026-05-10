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

        // Check if there is a query param in the URL and trigger search
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q');
        if (query) {
            const searchBox = document.getElementById('search-box');
            if (searchBox) {
                searchBox.value = query;
                renderResults(query);
            }
        }
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

    if (results.length === 0) {
        resultList.innerHTML = '<li style="color: var(--muted); padding: 20px 0; text-align: center; font-style: italic;">We could not find exactly that, but maybe try another keyword. Curiosity has no limits.</li>';
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
        
        let categoryHtml = '';
        if (post.categories && post.categories.length > 0) {
            const cat = post.categories[0];
            categoryHtml = `<span class="category-label" data-cat="${cat}">${cat}</span>`;
        }

        listItem.innerHTML = `
            <a href="${post.url}" class="latest-item">
                <div class="latest-body">
                    ${categoryHtml}
                    <h4 class="latest-title">${highlightedTitle}</h4>
                    <p class="latest-excerpt">${highlightedContent}</p>
                    <span class="post-date">${formattedDate}</span>
                </div>
            </a>
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
        // Update URL query param without reloading
        const newUrl = window.location.pathname + '?q=' + encodeURIComponent(query);
        window.history.replaceState(null, '', newUrl);

        // If the query is not empty, render the results
        renderResults(query);
    } else {
        // Remove query param without reloading
        window.history.replaceState(null, '', window.location.pathname);

        // If the query is empty, clear the results
        document.getElementById('search-results').innerHTML =
            '<li style="color: var(--muted); padding: 20px 0; text-align: center;">What are you curious about today? Type a keyword to explore.</li>';
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
