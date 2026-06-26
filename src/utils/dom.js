// src/utils/dom.js
/**
 * Copy font-family, font-size, and font-weight from a matched DOM element to a target element.
 * Used to match Canvas's native font styling without hardcoded values.
 *
 * @param {string} selector - CSS selector for the source element
 * @param {HTMLElement} element - Target element to apply styles to
 * @returns {boolean} true if the source element was found and styles were applied, false otherwise
 */
export function inheritFontStylesFrom(selector, element) {
    const source = document.querySelector(selector);
    if (source) {
        const styles = getComputedStyle(source);
        element.style.fontSize = styles.fontSize;
        element.style.fontFamily = styles.fontFamily;
        element.style.fontWeight = styles.fontWeight;
        return true;
    }
    return false;
}

/**
 * Wrap a function in a debounce so it only fires after `delay` ms of inactivity.
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Milliseconds to wait after the last call before invoking fn
 * @returns {Function} Debounced wrapper function
 */
export function debounce(fn, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}
