const STOPWORDS = new Set([
    'the','and','for','with','that','from','this','your','have','will','were','what','when','where','which','their','about','been','then','them','into','over','also','more','than','just','like','such','only','some','very','many','because','while','after','before','through','between','those','these','each','another'
]);

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

export function getTagSuggestions(content) {
    if (!content) return [];

    const words = content
        .replace(/`[^`]*`/g, '')
        .replace(/\[[^\]]*\]\([^\)]*\)/g, '')
        .replace(/[#>*_\-\[\]\(\)"'\.,!?\/\n\r]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !STOPWORDS.has(word));

    const frequency = words.reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([word]) => word);
}

