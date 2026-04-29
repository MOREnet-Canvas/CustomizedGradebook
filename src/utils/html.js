// src/utils/html.js
/**
 * Shared HTML helpers.
 */

/**
 * Escape a string for safe interpolation into HTML markup.
 *
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]
    );
}
