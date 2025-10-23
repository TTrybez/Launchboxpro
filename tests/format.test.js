// DB-free unit test for short date formatter

describe('formatShortDateTime', () => {
  function formatShortDateTime(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d)) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  test('formats a valid date into short human-friendly string', () => {
    const dt = new Date('2025-10-23T14:30:00Z');
    const out = formatShortDateTime(dt);
    // Locale output varies; ensure it contains a short month and a HH:MM portion
    expect(out).toMatch(/[A-Za-z]{3}/);
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  test('returns empty string for invalid date', () => {
    expect(formatShortDateTime('not a date')).toBe('');
  });
});