// src/dashboard/cardRenderer.js
/**
 * Dashboard Card Renderer
 * 
 * Handles DOM manipulation to display grades on Canvas dashboard cards.
 * Creates visually consistent grade badges that integrate with Canvas UI.
 */

import { logger } from '../utils/logger.js';
import { OUTCOME_AND_RUBRIC_RATINGS } from '../config.js';
import { GRADE_SOURCE } from '../services/gradeDataService.js';
import { HERO_SELECTORS, findCourseCard } from './cardSelectors.js';

/**
 * CSS class prefix for grade elements
 */
const GRADE_CLASS_PREFIX = 'cg-dashboard-grade';

/**
 * Validate grade data before rendering
 * @param {Object} gradeData - Grade data object
 * @returns {boolean} True if valid, false otherwise
 */
function isValidGradeData(gradeData) {
    if (!gradeData) {
        logger.trace('[Grade Display] Grade data is null/undefined');
        return false;
    }

    if (typeof gradeData.score !== 'number' || gradeData.score === null || isNaN(gradeData.score)) {
        logger.trace(`[Grade Display] Invalid score: ${gradeData.score}`);
        return false;
    }

    if (!gradeData.displayType || (gradeData.displayType !== 'points' && gradeData.displayType !== 'percentage')) {
        logger.trace(`[Grade Display] Invalid displayType: ${gradeData.displayType}`);
        return false;
    }

    return true;
}

/**
 * Format grade data for display
 * Pure function - no side effects, easy to test
 * Now uses pre-calculated display values from snapshot service
 * @param {Object} gradeData - Grade data object
 * @param {number} gradeData.score - Display score (already converted)
 * @param {string|null} gradeData.letterGrade - Display letter grade
 * @param {string} gradeData.displayType - Display type ('points' or 'percentage')
 * @returns {{displayValue: string, ariaLabel: string}} Formatted display strings
 */
function formatGradeDisplay(gradeData) {
    const { score, letterGrade, displayType } = gradeData;

    logger.trace(`[Grade Display] Formatting display values: score=${score}, letterGrade=${letterGrade}, displayType=${displayType}`);

    // Format display value based on type
    let displayValue;
    let ariaLabel;

    if (displayType === 'points') {
        // Points format: "2.74" or "2.74 (Developing)"
        const scoreStr = score.toFixed(2);
        if (letterGrade) {
            displayValue = `${scoreStr} (${letterGrade})`;
            ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = scoreStr;
            ariaLabel = `Grade: ${scoreStr}`;
        }
    } else {
        // Percentage format: "68.50%" or "68.50% (B)"
        const percentageStr = `${score.toFixed(2)}%`;
        if (letterGrade) {
            displayValue = `${percentageStr} (${letterGrade})`;
            ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = percentageStr;
            ariaLabel = `Grade: ${percentageStr}`;
        }
    }

    logger.trace(`[Grade Display] Formatted: displayValue="${displayValue}"`);

    return { displayValue, ariaLabel };
}

/**
 * Create grade badge element with hero-integrated styling
 * @param {Object} gradeData - Grade data object
 * @param {number} gradeData.score - Display score (already converted)
 * @param {string|null} gradeData.letterGrade - Display letter grade
 * @param {string} gradeData.displayType - Display type ('points' or 'percentage')
 * @param {string} gradeData.source - Grade source (GRADE_SOURCE.ASSIGNMENT or GRADE_SOURCE.ENROLLMENT)
 * @param {HTMLElement} containerElement - Container element for color extraction (header_image or similar)
 * @param {boolean} useTopPosition - If true, position at top instead of bottom (for cards without images)
 * @returns {HTMLElement} Grade badge element
 */
function createGradeBadge(gradeData, containerElement = null, useTopPosition = false) {
    const { source, displayType } = gradeData;

    // Format the grade display (pure function)
    const { displayValue, ariaLabel } = formatGradeDisplay(gradeData);

    // Create DOM element
    const badge = document.createElement('div');
    badge.className = `${GRADE_CLASS_PREFIX}`;
    badge.setAttribute('data-source', source);
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-label', ariaLabel);
    badge.textContent = displayValue;

    // Extract background color from container for badge styling
    // For cards with images, this extracts the dominant color from the header
    let badgeBackground = 'rgba(64, 64, 64, 0.85)'; // Default fallback

    if (containerElement) {
        const containerStyles = window.getComputedStyle(containerElement);
        const bgColor = containerStyles.backgroundColor;

        if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
            // Derive a translucent version of the background color
            badgeBackground = deriveTranslucentColor(bgColor);
            logger.trace(`Derived badge background from container color: ${bgColor} -> ${badgeBackground}`);
        }
    }

    // Position badge based on whether card has an image
    const verticalPosition = useTopPosition ? 'top: 8px;' : 'bottom: 8px;';

    // Apply inline styles with frosted-glass effect
    // Positioned to overlay on hero/header section (top-right or bottom-right corner)
    badge.style.cssText = `
        position: absolute;
        ${verticalPosition}
        right: 8px;
        font-size: 0.875rem;
        line-height: 1.4;
        border-radius: 8px;
        background: ${badgeBackground};
        color: #fff;
        display: inline-block;
        text-align: center;
        box-sizing: border-box;
        padding: 6px 10px;
        font-weight: 600;
        white-space: nowrap;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 10;
    `;

    return badge;
}

/**
 * Derive a translucent color from a hero background color
 * Creates a water-like/frosted-glass effect
 * @param {string} colorString - CSS color string (rgb, rgba, hex, etc.)
 * @returns {string} RGBA color string with translucency
 */
function deriveTranslucentColor(colorString) {
    // Parse the color to extract RGB values
    const rgb = parseColor(colorString);

    if (!rgb) {
        // Fallback if parsing fails
        return 'rgba(64, 64, 64, 0.75)';
    }

    // Darken the color slightly and add translucency
    const r = Math.max(0, Math.floor(rgb.r * 0.7));
    const g = Math.max(0, Math.floor(rgb.g * 0.7));
    const b = Math.max(0, Math.floor(rgb.b * 0.7));

    // Use 75% opacity for frosted-glass effect
    return `rgba(${r}, ${g}, ${b}, 0.75)`;
}

/**
 * Parse CSS color string to RGB object
 * @param {string} colorString - CSS color string
 * @returns {{r: number, g: number, b: number}|null} RGB object or null
 */
function parseColor(colorString) {
    // Handle rgb() and rgba() formats
    const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10)
        };
    }

    // Handle hex format
    const hexMatch = colorString.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
        return {
            r: parseInt(hexMatch[1], 16),
            g: parseInt(hexMatch[2], 16),
            b: parseInt(hexMatch[3], 16)
        };
    }

    // Could not parse
    return null;
}

/**
 * Find hero container within card for grade badge overlay
 * Targets the card hero section for visual integration with the colored background
 * @param {HTMLElement} cardElement - Dashboard card element
 * @returns {HTMLElement|null} Hero container element or null
 */
function findGradeContainer(cardElement) {
    // Try each hero/header selector in order of preference
    for (const selector of HERO_SELECTORS) {
        const container = cardElement.querySelector(selector);

        if (container) {
            // Ensure container has position: relative for absolute positioning of badge
            const styles = window.getComputedStyle(container);
            if (styles.position === 'static') {
                container.style.position = 'relative';
            }

            logger.trace(`Using container for grade badge placement: ${selector}`);
            return container;
        }
    }

    // Last resort: use the card itself
    logger.warn('Could not find hero or header element, using card itself (fallback)');
    const cardStyles = window.getComputedStyle(cardElement);
    if (cardStyles.position === 'static') {
        cardElement.style.position = 'relative';
    }

    return cardElement;
}

/**
 * Ensure container has sufficient dimensions and overflow settings to display badge
 * Fixes issue where cards without hero images have 0-height containers with overflow:hidden
 * @param {HTMLElement} container - Container element
 * @returns {boolean} True if container has minimal height (no image), false otherwise
 */
function ensureContainerCanDisplayBadge(container) {
    const styles = window.getComputedStyle(container);

    // Check if container has minimal/zero height
    const height = container.offsetHeight;
    const hasMinHeight = styles.minHeight && styles.minHeight !== '0px' && styles.minHeight !== 'auto';
    let hasMinimalHeight = false;

    if (height < 40 && !hasMinHeight) {
        // Container is too small (likely no image), ensure minimum height for badge visibility
        container.style.minHeight = '48px';
        hasMinimalHeight = true;
        logger.trace(`Set min-height on container (was ${height}px)`);
    }

    // Ensure overflow doesn't clip the badge
    // Only override if it's 'hidden' - preserve other values like 'auto' or 'scroll'
    if (styles.overflow === 'hidden') {
        container.style.overflow = 'visible';
        logger.trace('Changed overflow from hidden to visible');
    }

    // Also check overflow-x and overflow-y specifically
    if (styles.overflowX === 'hidden') {
        container.style.overflowX = 'visible';
    }
    if (styles.overflowY === 'hidden') {
        container.style.overflowY = 'visible';
    }

    return hasMinimalHeight;
}

/**
 * Render grade on a dashboard card
 * Uses pre-calculated display values from snapshot service
 * @param {HTMLElement} cardElement - Dashboard card element
 * @param {Object} gradeData - Grade data object
 * @param {number} gradeData.score - Display score (already converted)
 * @param {string|null} gradeData.letterGrade - Display letter grade
 * @param {string} gradeData.displayType - Display type ('points' or 'percentage')
 * @param {string} gradeData.source - Grade source ('assignment' or 'enrollment')
 */
export function renderGradeOnCard(cardElement, gradeData) {
    // Validate grade data before rendering
    if (!isValidGradeData(gradeData)) {
        logger.trace('Invalid grade data, skipping badge render');
        return;
    }

    // Remove any existing grade badge first
    removeGradeFromCard(cardElement);

    // Find hero container for color extraction
    const heroContainer = findGradeContainer(cardElement);

    if (!heroContainer) {
        logger.warn('Could not find suitable container for grade badge');
        logger.warn('Card element:', cardElement);
        return;
    }

    // Fix container visibility issues and check if it has minimal height (no image)
    // This ensures we don't modify cards that don't have grades
    const hasMinimalHeight = ensureContainerCanDisplayBadge(heroContainer);

    // Create new badge with hero color integration
    // Use top positioning for cards without images to avoid overlapping course title
    const badge = createGradeBadge(gradeData, heroContainer, hasMinimalHeight);

    // Append badge to hero container
    heroContainer.appendChild(badge);

    if (logger.isTraceEnabled()) {
        const suffix = gradeData.displayType === 'percentage' ? '%' : '';
        const displayInfo = gradeData.letterGrade
            ? `${gradeData.score}${suffix} (${gradeData.letterGrade})`
            : `${gradeData.score}${suffix}`;
        const position = hasMinimalHeight ? 'top-right (no image)' : 'bottom-right (with image)';
        logger.trace(`Grade badge rendered (${displayInfo}, type: ${gradeData.displayType}, source: ${gradeData.source}, position: ${position})`);
        logger.trace(`Badge placed in: ${heroContainer.className || heroContainer.tagName}`);
    } else {
        logger.debug(`Grade badge rendered on card (type: ${gradeData.displayType}, source: ${gradeData.source})`);
    }
}

/**
 * Remove grade display from card
 * @param {HTMLElement} cardElement - Dashboard card element
 */
export function removeGradeFromCard(cardElement) {
    // Remove the badge itself
    const existingBadge = cardElement.querySelector(`.${GRADE_CLASS_PREFIX}`);
    if (existingBadge) {
        existingBadge.remove();
        logger.trace('Existing grade badge removed from card');
    }
}