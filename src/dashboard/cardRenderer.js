// src/dashboard/cardRenderer.js
/**
 * Dashboard Card Renderer
 * 
 * Handles DOM manipulation to display grades on Canvas dashboard cards.
 * Creates visually consistent grade badges that integrate with Canvas UI.
 */

import { logger } from '../utils/logger.js';
import { OUTCOME_AND_RUBRIC_RATINGS } from '../config.js';

/**
 * CSS class prefix for grade elements
 */
const GRADE_CLASS_PREFIX = 'cg-dashboard-grade';

/**
 * Find dashboard card element for a course
 * Uses multiple strategies to locate the card
 * @param {string} courseId - Course ID
 * @returns {HTMLElement|null} Card element or null if not found
 */
export function findCourseCard(courseId) {
    // Strategy 1: Try data-course-id attribute (older Canvas)
    let card = document.querySelector(`[data-course-id="${courseId}"]`);
    if (card) {
        logger.trace(`Found card for course ${courseId} using data-course-id`);
        return card;
    }

    // Strategy 2: Try finding by href to course
    const courseUrl = `/courses/${courseId}`;
    const links = document.querySelectorAll(`a[href*="${courseUrl}"]`);

    for (const link of links) {
        // Find the closest card-like container
        const cardContainer = link.closest('.ic-DashboardCard') ||
                            link.closest('[class*="DashboardCard"]') ||
                            link.closest('[class*="CourseCard"]') ||
                            link.closest('.course-list-item') ||
                            link.closest('.dashboard-card');

        if (cardContainer) {
            // Verify this is actually for the right course
            const cardLink = cardContainer.querySelector(`a[href*="${courseUrl}"]`);
            if (cardLink) {
                logger.trace(`Found card for course ${courseId} using href strategy`);
                return cardContainer;
            }
        }
    }

    // Strategy 3: Look for course link and use its parent structure
    for (const link of links) {
        // Skip navigation links
        if (link.closest('.ic-app-header') ||
            link.closest('[role="navigation"]') ||
            link.closest('.menu')) {
            continue;
        }

        // The link itself or a close parent might be the card
        // Try a few levels up
        let parent = link;
        for (let i = 0; i < 5; i++) {
            parent = parent.parentElement;
            if (!parent) break;

            // Check if this looks like a card container
            const hasCardClass = parent.className && (
                parent.className.includes('Card') ||
                parent.className.includes('card') ||
                parent.className.includes('course')
            );

            if (hasCardClass) {
                logger.trace(`Found card for course ${courseId} using parent traversal`);
                return parent;
            }
        }
    }

    logger.trace(`Dashboard card not found for course ${courseId}`);
    return null;
}

/**
 * Convert letter grade to point value based on rating scale
 * @param {string} letterGrade - Letter grade to convert
 * @returns {number|null} Point value if found, null otherwise
 */
function letterGradeToPoints(letterGrade) {
    if (!letterGrade) return null;

    const rating = OUTCOME_AND_RUBRIC_RATINGS.find(
        r => r.description === letterGrade
    );

    return rating ? rating.points : null;
}

/**
 * Create grade badge element with hero-integrated styling
 * @param {Object} gradeData - Grade data object
 * @param {number} gradeData.score - Numeric score value
 * @param {string|null} gradeData.letterGrade - Letter grade (if available)
 * @param {string} gradeData.source - Grade source ('override', 'assignment', or 'enrollment')
 * @param {HTMLElement} heroElement - Hero element for color extraction (optional)
 * @returns {HTMLElement} Grade badge element
 */
function createGradeBadge(gradeData, heroElement = null) {
    const { score, letterGrade, source } = gradeData;

    const badge = document.createElement('div');
    badge.className = `${GRADE_CLASS_PREFIX}`;
    badge.setAttribute('data-source', source);
    badge.setAttribute('role', 'status');

    // Format grade display based on source
    let displayValue;
    let ariaLabel;

    if (source === 'assignment') {
        // AVG assignment: 0-4 scale, show with 1 decimal and letter grade if available
        const scoreStr = score.toFixed(1);
        if (letterGrade) {
            displayValue = `${scoreStr} (${letterGrade})`;
            ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = scoreStr;
            ariaLabel = `Grade: ${scoreStr}`;
        }
    } else if (source === 'override') {
        // Override grade: convert to point value if letter grade matches rating scale
        // Otherwise fall back to percentage display
        const pointValue = letterGradeToPoints(letterGrade);

        if (pointValue !== null) {
            // Letter grade matches rating scale - display as point value (0-4 scale)
            const scoreStr = pointValue.toFixed(1);
            displayValue = `${scoreStr} (${letterGrade})`;
            ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
        } else {
            // Letter grade doesn't match or is missing - display as percentage
            const percentageStr = `${score.toFixed(1)}%`;
            if (letterGrade) {
                displayValue = `${percentageStr} (${letterGrade})`;
                ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
            } else {
                displayValue = percentageStr;
                ariaLabel = `Grade: ${percentageStr}`;
            }
        }
    } else {
        // Enrollment: show percentage and letter grade if available
        const percentageStr = `${score.toFixed(1)}%`;
        if (letterGrade) {
            displayValue = `${percentageStr} (${letterGrade})`;
            ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = percentageStr;
            ariaLabel = `Grade: ${percentageStr}`;
        }
    }

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
    // Strategy 1: Find the hero section (primary target for badge overlay)
    // This is the colored header area at the top of each card
    let hero = cardElement.querySelector('.ic-DashboardCard__header_hero');

    if (hero) {
        // Ensure hero has position: relative for absolute positioning of badge
        const heroStyles = window.getComputedStyle(hero);
        if (heroStyles.position === 'static') {
            hero.style.position = 'relative';
        }

        logger.trace('Using header hero for grade badge placement');
        return hero;
    }

    // Strategy 2: Look for alternative hero class names
    hero = cardElement.querySelector('[class*="hero"]') ||
           cardElement.querySelector('[class*="Hero"]');

    if (hero) {
        // Ensure hero has position: relative
        const heroStyles = window.getComputedStyle(hero);
        if (heroStyles.position === 'static') {
            hero.style.position = 'relative';
        }

        logger.trace('Using hero-like element for grade badge placement');
        return hero;
    }

    // Strategy 3: Find the main header and use it as fallback
    const header = cardElement.querySelector('.ic-DashboardCard__header');

    if (header) {
        // Ensure header has position: relative
        const headerStyles = window.getComputedStyle(header);
        if (headerStyles.position === 'static') {
            header.style.position = 'relative';
        }

        logger.trace('Using card header for grade badge placement (fallback)');
        return header;
    }

    // Strategy 4: Look for any header-like element
    const headerLike = cardElement.querySelector('[class*="header"]') ||
                       cardElement.querySelector('[class*="Header"]');

    if (headerLike) {
        // Ensure it has position: relative
        const styles = window.getComputedStyle(headerLike);
        if (styles.position === 'static') {
            headerLike.style.position = 'relative';
        }

        logger.trace('Using header-like element for grade badge placement');
        return headerLike;
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

    if (logger.isDebugEnabled()) {
        const displayInfo = gradeData.letterGrade
            ? `${gradeData.score}% (${gradeData.letterGrade})`
            : `${gradeData.score}`;
        logger.debug(`Grade badge rendered (${displayInfo}, source: ${gradeData.source})`);
        logger.debug(`Badge placed in: ${heroContainer.className || heroContainer.tagName}`);
    } else {
        logger.trace(`Grade badge rendered on card (source: ${gradeData.source})`);
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

