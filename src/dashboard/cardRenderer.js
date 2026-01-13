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
 * @param {string} courseId - Course ID
 * @returns {HTMLElement|null} Card element or null if not found
 */
export function findCourseCard(courseId) {
    // Canvas dashboard cards have data-course-id attribute
    const card = document.querySelector(`[data-course-id="${courseId}"]`);
    
    if (!card) {
        logger.trace(`Dashboard card not found for course ${courseId}`);
        return null;
    }
    
    return card;
}

/**
 * Create grade badge element
 * @param {number} gradeValue - Grade value to display
 * @param {string} gradeSource - Grade source ('assignment' or 'enrollment')
 * @returns {HTMLElement} Grade badge element
 */
function createGradeBadge(gradeValue, gradeSource) {
    const badge = document.createElement('div');
    badge.className = GRADE_CLASS_PREFIX;
    badge.setAttribute('data-source', gradeSource);
    
    // Format grade based on source
    let displayValue;
    let label;
    
    if (gradeSource === 'assignment') {
        // AVG assignment: 0-4 scale, show with 1 decimal
        displayValue = gradeValue.toFixed(1);
        label = 'Current Score';
    } else {
        // Enrollment: percentage, show with 1 decimal
        displayValue = `${gradeValue.toFixed(1)}%`;
        label = 'Grade';
    }
    
    // Create badge structure
    badge.innerHTML = `
        <span class="${GRADE_CLASS_PREFIX}__value">${displayValue}</span>
        <span class="${GRADE_CLASS_PREFIX}__label">${label}</span>
    `;
    
    // Apply inline styles for consistency across Canvas themes
    // Using inline styles to avoid dependency on external CSS
    badge.style.cssText = `
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        background-color: var(--ic-brand-primary, #0374B5);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.2;
        margin-top: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    `;
    
    // Style value
    const valueElement = badge.querySelector(`.${GRADE_CLASS_PREFIX}__value`);
    if (valueElement) {
        valueElement.style.cssText = `
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 2px;
        `;
    }
    
    // Style label
    const labelElement = badge.querySelector(`.${GRADE_CLASS_PREFIX}__label`);
    if (labelElement) {
        labelElement.style.cssText = `
            font-size: 11px;
            font-weight: 500;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
    }
    
    return badge;
}

/**
 * Find appropriate container within card for grade badge
 * @param {HTMLElement} cardElement - Dashboard card element
 * @returns {HTMLElement|null} Container element or null
 */
function findGradeContainer(cardElement) {
    // Try to find the card header subtitle area (common location for metadata)
    let container = cardElement.querySelector('.ic-DashboardCard__header-subtitle');
    
    // Fallback to card header
    if (!container) {
        container = cardElement.querySelector('.ic-DashboardCard__header');
    }
    
    // Last resort: use the card itself
    if (!container) {
        container = cardElement;
    }
    
    return container;
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
        logger.trace(`Grade badge rendered on card (source: ${gradeSource})`);
    } else {
        logger.warn('Could not find suitable container for grade badge');
    }
}

/**
 * Remove grade display from card
 * @param {HTMLElement} cardElement - Dashboard card element
 */
export function removeGradeFromCard(cardElement) {
    const existingBadge = cardElement.querySelector(`.${GRADE_CLASS_PREFIX}`);
    if (existingBadge) {
        existingBadge.remove();
        logger.trace('Existing grade badge removed from card');
    }
}

