/**
 * Format a Date object as a human-readable timestamp in the America/Chicago (Central) timezone.
 * Output format: `YYYY-MM-DD H:MM:SS AM/PM`
 *
 * @param {Date} date - The date to format
 * @returns {string} Formatted timestamp string, e.g. `"2025-06-01 2:30:45 PM"`
 */
export function formatTimestampCentral(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).formatToParts(date);

    let y, m, d, h, min, s, ampm;

    for (const p of parts) {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
        if (p.type === "hour") h = p.value;
        if (p.type === "minute") min = p.value;
        if (p.type === "second") s = p.value;
        if (p.type === "dayPeriod") ampm = p.value.toUpperCase();
    }

    return `${y}-${m}-${d} ${h}:${min}:${s} ${ampm}`;
}


