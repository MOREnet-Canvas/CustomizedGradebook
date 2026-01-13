// src/dashboard/cardRenderer.js
/**
 * Dashboard Card Renderer
 * 
 * Handles DOM manipulation to display grades on Canvas dashboard cards.
 * Creates visually consistent grade badges that integrate with Canvas UI.
 */

import { logger } from '../utils/logger.js';

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
 * Create grade badge element styled to match Canvas ic-badge design
 * @param {number} gradeValue - Grade value to display
 * @param {string} gradeSource - Grade source ('assignment' or 'enrollment')
 * @returns {HTMLElement} Grade badge element
 */
function createGradeBadge(gradeValue, gradeSource) {
    const badge = document.createElement('span');
    badge.className = `${GRADE_CLASS_PREFIX} ic-badge`;
    badge.setAttribute('data-source', gradeSource);
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-label', `Grade: ${gradeValue}`);

    // Format grade based on source
    let displayValue;
    let ariaLabel;

    if (gradeSource === 'assignment') {
        // AVG assignment: 0-4 scale, show with 1 decimal
        displayValue = gradeValue.toFixed(1);
        ariaLabel = `Current score: ${displayValue} out of 4`;
    } else {
        // Enrollment: percentage, show with 1 decimal
        displayValue = `${gradeValue.toFixed(1)}%`;
        ariaLabel = `Grade: ${displayValue}`;
    }

    badge.setAttribute('aria-label', ariaLabel);
    badge.textContent = displayValue;

    // Apply inline styles matching Canvas ic-badge pattern
    // Using semi-transparent dark background for subtle, less intrusive appearance
    // rgba(64, 64, 64, 0.85) provides excellent contrast ratio (>10:1) with white text
    // Meets WCAG AA standards and works well across light and dark Canvas themes
    badge.style.cssText = `
        font-size: 0.6875rem;
        min-width: 20px;
        line-height: 20px;
        border-radius: 10px;
        background: rgba(64, 64, 64, 0.85);
        color: #fff;
        display: inline-block;
        vertical-align: middle;
        text-align: center;
        box-sizing: border-box;
        padding: 0 8px;
        font-weight: 600;
        margin-left: 8px;
        white-space: nowrap;
    `;

    return badge;
}

/**
 * Find appropriate container within card for grade badge
 * Targets the card header area for better visual integration
 * @param {HTMLElement} cardElement - Dashboard card element
 * @returns {HTMLElement|null} Container element or null
 */
function findGradeContainer(cardElement) {
    // Strategy 1: Find the header subtitle area (ideal location for metadata badges)
    // This is typically where term info and other metadata appears
    let container = cardElement.querySelector('.ic-DashboardCard__header-subtitle');

    if (container) {
        logger.trace('Using header subtitle for grade badge placement');
        return container;
    }

    // Strategy 2: Find the header term area (alternative metadata location)
    container = cardElement.querySelector('.ic-DashboardCard__header-term');

    if (container) {
        logger.trace('Using header term for grade badge placement');
        return container;
    }

    // Strategy 3: Find the main header and create a metadata container
    const header = cardElement.querySelector('.ic-DashboardCard__header');

    if (header) {
        // Check if we already created a metadata container
        let metadataContainer = header.querySelector(`.${GRADE_CLASS_PREFIX}-container`);

        if (!metadataContainer) {
            // Create a new container for grade badges in the header
            metadataContainer = document.createElement('div');
            metadataContainer.className = `${GRADE_CLASS_PREFIX}-container`;
            metadataContainer.style.cssText = `
                display: flex;
                align-items: center;
                margin-top: 4px;
                gap: 8px;
            `;

            // Append to header
            header.appendChild(metadataContainer);
            logger.trace('Created new metadata container in header');
        }

        return metadataContainer;
    }

    // Strategy 4: Look for any header-like element
    const headerLike = cardElement.querySelector('[class*="header"]') ||
                       cardElement.querySelector('[class*="Header"]');

    if (headerLike) {
        logger.trace('Using header-like element for grade badge placement');
        return headerLike;
    }

    // Last resort: use the card itself
    logger.trace('Using card element itself for grade badge placement (fallback)');
    return cardElement;
}

/**
 * Render grade on a dashboard card
 * @param {HTMLElement} cardElement - Dashboard card element
 * @param {number} gradeValue - Grade value to display
 * @param {string} gradeSource - Grade source ('assignment' or 'enrollment')
 */
export function renderGradeOnCard(cardElement, gradeValue, gradeSource) {
    // Remove any existing grade badge first
    removeGradeFromCard(cardElement);

    // Create new badge
    const badge = createGradeBadge(gradeValue, gradeSource);

    // Find container and append badge
    const container = findGradeContainer(cardElement);
    if (container) {
        container.appendChild(badge);

        if (logger.isDebugEnabled()) {
            logger.debug(`Grade badge rendered (value: ${gradeValue}, source: ${gradeSource})`);
            logger.debug(`Badge placed in: ${container.className || container.tagName}`);
        } else {
            logger.trace(`Grade badge rendered on card (source: ${gradeSource})`);
        }
    } else {
        logger.warn('Could not find suitable container for grade badge');
        logger.warn('Card element:', cardElement);
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

    // Clean up empty metadata container if it exists
    const metadataContainer = cardElement.querySelector(`.${GRADE_CLASS_PREFIX}-container`);
    if (metadataContainer && metadataContainer.children.length === 0) {
        metadataContainer.remove();
        logger.trace('Empty metadata container removed');
    }
}

