// Shared utility functions
function formatShortDateTime(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d)) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}