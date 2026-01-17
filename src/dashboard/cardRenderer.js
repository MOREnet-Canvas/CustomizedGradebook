// src/dashboard/cardRenderer.js
/**
 * Dashboard Card Renderer
 * 
 * Handles DOM manipulation to display grades on Canvas dashboard cards.
 * Creates visually consistent grade badges that integrate with Canvas UI.
 */

import { logger } from '../utils/logger.js';
import { OUTCOME_AND_RUBRIC_RATINGS } from '../config.js';
import { GRADE_SOURCE } from './gradeDataService.js';
import { isValidLetterGrade as validateLetterGrade } from '../utils/courseDetection.js';
import { percentageToPoints } from '../utils/gradeFormatting.js';
import { HERO_SELECTORS, findCourseCard } from './cardSelectors.js';

/**
 * CSS class prefix for grade elements
 */
const GRADE_CLASS_PREFIX = 'cg-dashboard-grade';

/**
 * Format grade data for display
 * Pure function - no side effects, easy to test
 * @param {Object} gradeData - Grade data object
 * @param {number} gradeData.score - Numeric score value
 * @param {string|null} gradeData.letterGrade - Letter grade (if available)
 * @param {string} gradeData.source - Grade source (GRADE_SOURCE.ASSIGNMENT or GRADE_SOURCE.ENROLLMENT)
 * @returns {{displayValue: string, ariaLabel: string}} Formatted display strings
 */
function formatGradeDisplay(gradeData) {
    const { score, letterGrade, source } = gradeData;

    logger.trace(`[Grade Conversion Debug] Formatting grade data: source=${source}, score=${score}, letterGrade=${letterGrade}`);

    let displayValue;
    let ariaLabel;

    if (source === GRADE_SOURCE.ASSIGNMENT) {
        // AVG assignment: 0-4 scale, show with 2 decimals and letter grade if available
        const scoreStr = score.toFixed(2);
        if (letterGrade) {
            displayValue = `${scoreStr} (${letterGrade})`;
            ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = scoreStr;
            ariaLabel = `Grade: ${scoreStr}`;
        }
        logger.trace(`[Grade Conversion Debug] Assignment grade: display=${displayValue}`);
    } else if (source === GRADE_SOURCE.ENROLLMENT) {
        // Enrollment grade: convert to point value if letter grade matches rating scale
        // Otherwise fall back to percentage display
        const isValidGrade = validateLetterGrade(letterGrade);

        // Trace logging for debugging
        if (!letterGrade) {
            logger.trace(`[Letter Grade Validation] letterGrade is empty/null/undefined`);
        } else {
            logger.trace(`[Letter Grade Validation] Checking "${letterGrade}" against rating scale: ${isValidGrade ? 'MATCH FOUND' : 'NO MATCH'}`);
            if (!isValidGrade && OUTCOME_AND_RUBRIC_RATINGS.length > 0) {
                logger.trace(`[Letter Grade Validation] Available rating descriptions:`, OUTCOME_AND_RUBRIC_RATINGS.map(r => r.description));
            }
        }

        logger.trace(`[Grade Conversion Debug] isValidLetterGrade("${letterGrade}") = ${isValidGrade}`);

        if (isValidGrade) {
            // Letter grade matches rating scale - calculate and display as point value
            // Formula: (percentageScore / 100) * DEFAULT_MAX_POINTS
            const pointValue = percentageToPoints(score);
            const scoreStr = pointValue.toFixed(2);
            displayValue = `${scoreStr} (${letterGrade})`;
            ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
            logger.trace(`[Grade Conversion Debug] Converted to points: ${score}% -> ${pointValue} -> display="${displayValue}"`);
        } else {
            // Letter grade doesn't match or is missing - display as percentage
            const percentageStr = `${score.toFixed(2)}%`;
            if (letterGrade) {
                displayValue = `${percentageStr} (${letterGrade})`;
                ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
                logger.trace(`[Grade Conversion Debug] Letter grade "${letterGrade}" not in rating scale, using percentage: display="${displayValue}"`);
            } else {
                displayValue = percentageStr;
                ariaLabel = `Grade: ${percentageStr}`;
                logger.trace(`[Grade Conversion Debug] No letter grade, using percentage: display="${displayValue}"`);
            }
        }
    } else {
        // Unknown source - should not happen, but handle gracefully
        logger.warn(`[Grade Conversion Debug] Unknown grade source: ${source}`);
        const percentageStr = `${score.toFixed(2)}%`;
        if (letterGrade) {
            displayValue = `${percentageStr} (${letterGrade})`;
            ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = percentageStr;
            ariaLabel = `Grade: ${percentageStr}`;
        }
    }

    return { displayValue, ariaLabel };
}

/**
 * Create grade badge element with hero-integrated styling
 * @param {Object} gradeData - Grade data object
 * @param {number} gradeData.score - Numeric score value
 * @param {string|null} gradeData.letterGrade - Letter grade (if available)
 * @param {string} gradeData.source - Grade source (GRADE_SOURCE.ASSIGNMENT or GRADE_SOURCE.ENROLLMENT)
 * @param {HTMLElement} heroElement - Hero element for color extraction (optional)
 * @returns {HTMLElement} Grade badge element
 */
function createGradeBadge(gradeData, heroElement = null) {
    const { source } = gradeData;

    // Format the grade display (pure function)
    const { displayValue, ariaLabel } = formatGradeDisplay(gradeData);

    // Create DOM element
    const badge = document.createElement('div');
    badge.className = `${GRADE_CLASS_PREFIX}`;
    badge.setAttribute('data-source', source);
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-label', ariaLabel);
    badge.textContent = displayValue;

    // Extract hero background color for badge styling
    let badgeBackground = 'rgba(64, 64, 64, 0.85)'; // Default fallback

    if (heroElement) {
        const heroStyles = window.getComputedStyle(heroElement);
        const heroColor = heroStyles.backgroundColor;

        if (heroColor && heroColor !== 'transparent' && heroColor !== 'rgba(0, 0, 0, 0)') {
            // Derive a translucent version of the hero color
            badgeBackground = deriveTranslucentColor(heroColor);
            logger.trace(`Derived badge background from hero color: ${heroColor} -> ${badgeBackground}`);
        }
    }

    // Apply inline styles with frosted-glass effect
    // Positioned to overlay on hero section (lower-right corner)
    badge.style.cssText = `
        position: absolute;
        bottom: 8px;
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
 * Render grade on a dashboard card
 * @param {HTMLElement} cardElement - Dashboard card element
 * @param {Object} gradeData - Grade data object
 * @param {number} gradeData.score - Numeric score value
 * @param {string|null} gradeData.letterGrade - Letter grade (if available)
 * @param {string} gradeData.source - Grade source ('assignment' or 'enrollment')
 */
export function renderGradeOnCard(cardElement, gradeData) {
    // Remove any existing grade badge first
    removeGradeFromCard(cardElement);

    // Find hero container for color extraction
    const heroContainer = findGradeContainer(cardElement);

    if (!heroContainer) {
        logger.warn('Could not find suitable container for grade badge');
        logger.warn('Card element:', cardElement);
        return;
    }

    // Create new badge with hero color integration
    const badge = createGradeBadge(gradeData, heroContainer);

    // Append badge to hero container
    heroContainer.appendChild(badge);

    if (logger.isTraceEnabled()) {
        const displayInfo = gradeData.letterGrade
            ? `${gradeData.score}% (${gradeData.letterGrade})`
            : `${gradeData.score}`;
        logger.trace(`Grade badge rendered (${displayInfo}, source: ${gradeData.source})`);
        logger.trace(`Badge placed in: ${heroContainer.className || heroContainer.tagName}`);
    } else {
        logger.debug(`Grade badge rendered on card (source: ${gradeData.source})`);
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

