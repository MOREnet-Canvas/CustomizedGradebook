// src/utils/dom.js
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

export function debounce(fn, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}
