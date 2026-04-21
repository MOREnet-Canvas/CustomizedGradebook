// src/ui/styles.js
/**
 * Styles utility
 *
 * Injects CSS text into the document head.
 * Use this as the first step before writing any new view file.
 */

/**
 * Inject a CSS string into the document <head>.
 *
 * Idempotent — if `id` is supplied and an element with that id already
 * exists the call is a no-op, so safe to call on every page load.
 *
 * @param {string} css - CSS text to inject
 * @param {string} [id] - Optional element id for deduplication (recommended)
 */
export function injectStyles(css, id) {
    if (id && document.getElementById(id)) return;

    const style = document.createElement('style');
    if (id) style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
}
