// src/admin/domHelpers.js
/**
 * DOM Helper Utilities for Admin Dashboard
 * 
 * Provides utilities for creating and manipulating DOM elements.
 */

/**
 * Create a DOM element with properties
 * 
 * @param {string} tag - HTML tag name
 * @param {Object} props - Element properties
 * @param {string} [props.className] - CSS class name
 * @param {string} [props.text] - Text content
 * @param {string} [props.html] - HTML content
 * @param {Object} [props.style] - Inline styles
 * @param {Object} [props.attrs] - HTML attributes
 * @param {Object} [props.on] - Event listeners
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, props = {}) {
    const element = document.createElement(tag);

    if (props.className) {
        element.className = props.className;
    }

    if (props.text != null) {
        element.textContent = props.text;
    }

    if (props.html != null) {
        element.innerHTML = props.html;
    }

    if (props.style && typeof props.style === 'object') {
        Object.assign(element.style, props.style);
    }

    if (props.attrs && typeof props.attrs === 'object') {
        for (const [key, value] of Object.entries(props.attrs)) {
            element.setAttribute(key, value);
        }
    }

    if (props.on && typeof props.on === 'object') {
        for (const [event, handler] of Object.entries(props.on)) {
            element.addEventListener(event, handler);
        }
    }

    return element;
}

/**
 * Create a panel container
 * 
 * @param {HTMLElement} parent - Parent element to append to
 * @param {string} title - Panel title
 * @returns {HTMLElement} Panel element
 */
export function createPanel(parent, title) {
    const panel = createElement('div', {
        style: {
            marginTop: '16px',
            padding: '16px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            background: '#fff'
        }
    });

    const titleElement = createElement('div', {
        text: title,
        style: {
            fontWeight: '700',
            marginBottom: '10px'
        }
    });

    panel.appendChild(titleElement);
    parent.appendChild(panel);

    return panel;
}

/**
 * Escape HTML special characters
 * 
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Download text as a file
 * 
 * @param {string} filename - File name
 * @param {string} text - File content
 */
export function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

