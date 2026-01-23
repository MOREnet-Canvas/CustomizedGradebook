// src/ui/infoTooltip.js
/**
 * Info Tooltip Utility
 *
 * Provides a reusable info icon with tooltip functionality.
 * Designed for inline use within menus, buttons, or other UI elements.
 */

/**
 * Track active tooltips for cleanup
 */
export const activeTooltips = new Set();

/**
 * Create an info icon with tooltip
 *
 * @param {Object} options - Configuration options
 * @param {string} options.tooltipId - Unique ID for the tooltip element
 * @param {string} options.ariaLabel - Accessible label for the icon (default: "Information")
 * @param {string} options.title - Tooltip title/heading
 * @param {string[]} options.bodyParagraphs - Array of body text paragraphs
 * @param {string} [options.footer] - Optional footer text (muted/small)
 * @param {number} [options.iconSize=14] - Icon size in pixels
 * @param {string} [options.position='right'] - Tooltip position relative to icon ('right', 'left', 'top', 'bottom')
 * @param {number} [options.offset=8] - Distance from icon to tooltip in pixels
 * @returns {Object} Object containing iconContainer and tooltip elements
 */
export function createInfoIconWithTooltip({
    tooltipId,
    ariaLabel = 'Information',
    title,
    bodyParagraphs = [],
    footer = null,
    iconSize = 14,
    position = 'right',
    offset = 8
}) {
    if (!tooltipId) {
        throw new Error('tooltipId is required for createInfoIconWithTooltip');
    }

    // Create info icon container
    const iconContainer = document.createElement('span');
    iconContainer.className = 'cg-info-icon-container';
    iconContainer.setAttribute('role', 'button');
    iconContainer.setAttribute('tabindex', '0');
    iconContainer.setAttribute('aria-label', ariaLabel);
    iconContainer.setAttribute('aria-describedby', tooltipId);
    iconContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 6px;
        cursor: help;
        vertical-align: middle;
    `;

    // Create SVG info icon (circle with 'i')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', iconSize.toString());
    svg.setAttribute('height', iconSize.toString());
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = `
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        opacity: 0.7;
    `;

    // Circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '8');
    circle.setAttribute('cy', '8');
    circle.setAttribute('r', '6.5');

    // 'i' dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', '8');
    dot.setAttribute('cy', '5.5');
    dot.setAttribute('r', '0.8');
    dot.setAttribute('fill', 'currentColor');
    dot.setAttribute('stroke', 'none');

    // 'i' stem
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    stem.setAttribute('x1', '8');
    stem.setAttribute('y1', '7.5');
    stem.setAttribute('x2', '8');
    stem.setAttribute('y2', '11');
    stem.setAttribute('stroke-width', '1.5');
    stem.setAttribute('stroke-linecap', 'round');

    svg.appendChild(circle);
    svg.appendChild(dot);
    svg.appendChild(stem);
    iconContainer.appendChild(svg);

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = tooltipId;
    tooltip.className = 'cg-info-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.style.cssText = `
        position: fixed;
        display: none;
        background: #2d3b45;
        color: #ffffff;
        padding: 12px 14px 10px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 280px;
        font-size: 13px;
        line-height: 1.5;
        pointer-events: none;
    `;

    // Build tooltip content
    let tooltipHTML = '';

    if (title) {
        tooltipHTML += `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${escapeHtml(title)}</div>`;
    }

    bodyParagraphs.forEach((paragraph, index) => {
        const marginBottom = index === bodyParagraphs.length - 1 && !footer ? '0' : '6px';
        tooltipHTML += `<div style="margin-bottom: ${marginBottom};">${escapeHtml(paragraph)}</div>`;
    });

    if (footer) {
        const topMargin = bodyParagraphs.length > 0 ? '10px' : '0';
        tooltipHTML += `<div style="font-size: 11px; opacity: 0.6; font-style: italic; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 6px; margin-top: ${topMargin};">${escapeHtml(footer)}</div>`;
    }

    tooltip.innerHTML = tooltipHTML;
    document.body.appendChild(tooltip);

    // Track tooltip for cleanup
    activeTooltips.add(tooltip);

    // Tooltip show/hide logic
    let isTooltipVisible = false;




    const showTooltip = () => {
        const rect = iconContainer.getBoundingClientRect();
        tooltip.style.display = 'block';

        // Position tooltip based on position parameter
        switch (position) {
            case 'right':
                tooltip.style.left = `${rect.right + offset}px`;
                tooltip.style.top = `${rect.top}px`;
                break;
            case 'left':
                tooltip.style.right = `${window.innerWidth - rect.left + offset}px`;
                tooltip.style.top = `${rect.top}px`;
                break;
            case 'top':
                tooltip.style.left = `${rect.left}px`;
                tooltip.style.bottom = `${window.innerHeight - rect.top + offset}px`;
                break;
            case 'bottom':
                tooltip.style.left = `${rect.left}px`;
                tooltip.style.top = `${rect.bottom + offset}px`;
                break;
            default:
                tooltip.style.left = `${rect.right + offset}px`;
                tooltip.style.top = `${rect.top}px`;
        }

        isTooltipVisible = true;
    };

    const hideTooltip = () => {
        tooltip.style.display = 'none';
        isTooltipVisible = false;
    };

    // Mouse events
    iconContainer.addEventListener('mouseenter', showTooltip);
    iconContainer.addEventListener('mouseleave', hideTooltip);

    // Keyboard events
    iconContainer.addEventListener('focus', showTooltip);
    iconContainer.addEventListener('blur', hideTooltip);

    // Escape key to dismiss
    iconContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isTooltipVisible) {
            hideTooltip();
            e.stopPropagation();
        }
        // Prevent space/enter from triggering parent element click
        if (e.key === ' ' || e.key === 'Enter') {
            e.stopPropagation();
            e.preventDefault();
        }
    });

    // Prevent clicks from bubbling to parent element
    iconContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });

    return { iconContainer, tooltip };
}

/**
 * Remove all active tooltips from the DOM
 */
export function cleanupAllTooltips() {
    activeTooltips.forEach(tooltip => {
        if (tooltip && tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    });
    activeTooltips.clear();
}

/**
 * Escape HTML to prevent XSS
 *
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}