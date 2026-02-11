// src/dashboard/cardSelectors.js
/**
 * Dashboard Card Selector Utilities
 * 
 * Shared utilities for finding and identifying Canvas dashboard cards.
 * Canvas uses different selectors depending on version/theme, so we try multiple strategies.
 * 
 * Used by:
 * - gradeDisplay.js - Finding all dashboard cards for grade display
 * - cardRenderer.js - Finding specific course cards for rendering
 */

import { logger } from '../utils/logger.js';
import { extractCourseLinks } from '../utils/domExtractors.js';

/**
 * Selectors for finding dashboard card elements
 * Ordered by specificity and reliability
 * 
 * Canvas uses different selectors depending on version/theme:
 * - Older Canvas: data-course-id attribute
 * - Modern Canvas: .ic-DashboardCard class
 * - Alternative layouts: .course-list-item, .CourseCard
 */
export const CARD_SELECTORS = [
    '[data-course-id]',                    // Older Canvas versions
    '.ic-DashboardCard',                   // Common Canvas class
    '[class*="DashboardCard"]',            // Any class containing DashboardCard
    '.course-list-item',                   // Alternative Canvas layout
    '[class*="CourseCard"]',               // Modern Canvas
    'div[id^="dashboard_card_"]',          // ID-based cards
    '.dashboard-card',                     // Lowercase variant
];

/**
 * Selectors for finding hero/header containers within cards
 * Ordered by preference for badge placement
 *
 * Used by cardRenderer to find the best location to place grade badges
 *
 * NOTE: We target .ic-DashboardCard__header_image instead of __header_hero
 * because Canvas sets opacity:0 on the hero overlay, which would make our badge invisible.
 * The header_image container has the background image and is always visible.
 */
export const HERO_SELECTORS = [
    '.ic-DashboardCard__header_image',  // Primary: image container (visible, has background)
    '.ic-DashboardCard__header',        // Fallback: header container
    '[class*="header"]',                // Generic header
    '[class*="Header"]',                // Generic Header (capitalized)
    '[class*="hero"]',                  // Generic hero (avoid __header_hero due to opacity:0)
    '[class*="Hero"]'                   // Generic Hero (capitalized)
];

/**
 * Get all possible selectors for Canvas dashboard cards
 * 
 * @returns {string[]} Array of CSS selectors to try
 */
export function getDashboardCardSelectors() {
    return CARD_SELECTORS;
}

/**
 * Check if a DOM node looks like a dashboard card
 *
 * Used by MutationObserver to detect when new cards are added to the DOM
 *
 * @param {Node} node - DOM node to check
 * @returns {boolean} True if node appears to be a dashboard card
 */
export function looksLikeDashboardCard(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const element = node;

    // Check for data-course-id attribute
    if (element.hasAttribute?.('data-course-id')) return true;

    // Check for dashboard card classes
    const className = element.className || '';
    if (typeof className === 'string') {
        if (className.includes('DashboardCard') ||
            className.includes('CourseCard') ||
            className.includes('course-list-item') ||
            className.includes('dashboard-card')) {
            return true;
        }
    }

    // Check for dashboard card ID pattern
    const id = element.id || '';
    if (id.startsWith('dashboard_card_')) return true;

    // Check if it contains course links
    if (element.querySelector?.('a[href*="/courses/"]')) {
        return true;
    }

    return false;
}

/**
 * Find all dashboard cards using multiple selector strategies
 *
 * Tries each selector in order until cards are found.
 * Returns the first successful match.
 *
 * Fallback strategy: If no cards found with selectors, looks for course links
 * in the dashboard area (excluding navigation/header).
 *
 * @returns {NodeList|Array|null} Dashboard card elements or null if not found
 */
export function findDashboardCards() {
    for (const selector of CARD_SELECTORS) {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
            logger.trace(`Found ${cards.length} dashboard cards using selector: ${selector}`);
            return cards;
        }
    }

    // Last resort: look for any links to /courses/ on the dashboard
    const dashboardLinks = extractCourseLinks(document.body, true);
    if (dashboardLinks.length > 0) {
        logger.trace(`Found ${dashboardLinks.length} dashboard course links`);
        return dashboardLinks;
    }

    logger.trace('No dashboard cards found with any selector');
    return null;
}

/**
 * Find dashboard card element for a specific course
 * 
 * Uses multiple strategies to locate the card:
 * 1. Try data-course-id attribute (older Canvas)
 * 2. Find by href to course using selector array
 * 3. Look for course link and traverse parent structure
 * 
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

    // Strategy 2: Try finding by href to course using selector array
    const courseUrl = `/courses/${courseId}`;
    const links = document.querySelectorAll(`a[href*="${courseUrl}"]`);

    for (const link of links) {
        // Try each card selector to find the closest card-like container
        for (const selector of CARD_SELECTORS) {
            const cardContainer = link.closest(selector);

            if (cardContainer) {
                // Verify this is actually for the right course
                const cardLink = cardContainer.querySelector(`a[href*="${courseUrl}"]`);
                if (cardLink) {
                    logger.trace(`Found card for course ${courseId} using href strategy with selector: ${selector}`);
                    return cardContainer;
                }
            }
        }
    }

    // Strategy 3: Look for course link and use its parent structure
    // Use shared utility to filter out navigation links
    const dashboardLinks = extractCourseLinks(document.body, true).filter(link => {
        const href = link.getAttribute('href');
        return href && href.includes(courseUrl);
    });

    for (const link of dashboardLinks) {
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