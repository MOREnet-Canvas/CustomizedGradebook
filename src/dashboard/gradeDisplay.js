// src/dashboard/gradeDisplay.js
/**
 * Dashboard Grade Display Orchestrator
 * 
 * Main entry point for dashboard grade display functionality.
 * Coordinates grade fetching and rendering on Canvas dashboard cards.
 * 
 * Features:
 * - Fetches grades for all active courses
 * - Displays grades on dashboard cards with fallback hierarchy
 * - Handles Canvas SPA navigation with MutationObserver
 * - Graceful error handling (fails silently per course)
 */

import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { getCourseGrade } from './gradeDataService.js';
import { findCourseCard, renderGradeOnCard } from './cardRenderer.js';

/**
 * Track if initialization has been attempted
 */
let initialized = false;

/**
 * MutationObserver instance for watching dashboard changes
 */
let dashboardObserver = null;

/**
 * Fetch active courses using the working API approach
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<Array<{id: string, name: string}>>} Array of active courses
 */
async function fetchActiveCourses(apiClient) {
    try {
        // Use the exact API call that was verified to work
        const courses = await apiClient.get(
            '/api/v1/courses?enrollment_state=active&include[]=total_scores',
            {},
            'fetchActiveCourses'
        );

        logger.debug(`Raw courses response:`, courses);
        logger.debug(`Number of courses returned: ${courses?.length || 0}`);

        // Log first course structure for debugging
        if (courses && courses.length > 0) {
            logger.debug(`First course structure:`, courses[0]);
            logger.debug(`First course enrollments:`, courses[0].enrollments);
        }

        // Filter to only student enrollments
        // Canvas enrollment type is "student" (lowercase), not "StudentEnrollment"
        const studentCourses = courses.filter(course => {
            const enrollments = course.enrollments || [];
            const hasStudentEnrollment = enrollments.some(e =>
                e.type === 'student' ||
                e.type === 'StudentEnrollment' ||
                e.role === 'StudentEnrollment'
            );

            if (logger.isDebugEnabled() && enrollments.length > 0) {
                logger.debug(`Course ${course.id} (${course.name}): enrollments =`, enrollments.map(e => e.type));
            }

            return hasStudentEnrollment;
        });

        logger.info(`Found ${studentCourses.length} active student courses out of ${courses.length} total courses`);
        return studentCourses.map(c => ({ id: String(c.id), name: c.name }));

    } catch (error) {
        logger.error('Failed to fetch active courses:', error);
        return [];
    }
}

/**
 * Update a single course card with grade
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 */
async function updateCourseCard(courseId, apiClient) {
    try {
        // Find the card element
        const cardElement = findCourseCard(courseId);
        if (!cardElement) {
            logger.trace(`Card element not found for course ${courseId}, skipping`);
            return;
        }
        
        // Fetch grade
        const grade = await getCourseGrade(courseId, apiClient);
        if (!grade) {
            logger.trace(`No grade available for course ${courseId}, skipping`);
            return;
        }
        
        // Render grade on card
        renderGradeOnCard(cardElement, grade.value, grade.source);
        logger.debug(`Grade displayed for course ${courseId}: ${grade.value} (source: ${grade.source})`);
        
    } catch (error) {
        // Fail silently for individual courses - don't break the entire dashboard
        logger.warn(`Failed to update grade for course ${courseId}:`, error.message);
    }
}

/**
 * Update all course cards with grades
 */
async function updateAllCourseCards() {
    try {
        const apiClient = new CanvasApiClient();
        
        // Fetch active courses
        const courses = await fetchActiveCourses(apiClient);
        if (courses.length === 0) {
            logger.info('No active student courses found');
            return;
        }
        
        logger.info(`Updating grades for ${courses.length} courses`);
        
        // Update each course card
        // Process sequentially to avoid overwhelming the API
        for (const course of courses) {
            await updateCourseCard(course.id, apiClient);
        }
        
        logger.info('Dashboard grade display update complete');
        
    } catch (error) {
        logger.error('Failed to update dashboard grades:', error);
    }
}

/**
 * Get all possible selectors for Canvas dashboard cards
 * Canvas uses different selectors depending on version/theme
 * @returns {string[]} Array of CSS selectors to try
 */
function getDashboardCardSelectors() {
    return [
        '[data-course-id]',                    // Older Canvas versions
        '.ic-DashboardCard',                   // Common Canvas class
        '[class*="DashboardCard"]',            // Any class containing DashboardCard
        '.course-list-item',                   // Alternative Canvas layout
        '[class*="CourseCard"]',               // Modern Canvas
        'div[id^="dashboard_card_"]',          // ID-based cards
        '.dashboard-card',                     // Lowercase variant
    ];
}

/**
 * Find dashboard cards using multiple selector strategies
 * @returns {NodeList|null} Dashboard card elements or null
 */
function findDashboardCards() {
    const selectors = getDashboardCardSelectors();

    for (const selector of selectors) {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
            logger.debug(`Found ${cards.length} dashboard cards using selector: ${selector}`);
            return cards;
        }
    }

    // Last resort: look for any links to /courses/ on the dashboard
    const courseLinks = document.querySelectorAll('a[href*="/courses/"]');
    if (courseLinks.length > 0) {
        logger.debug(`Found ${courseLinks.length} course links as fallback`);
        // Filter to only dashboard area (not global navigation)
        const dashboardLinks = Array.from(courseLinks).filter(link => {
            const isDashboardArea = !link.closest('.ic-app-header') &&
                                   !link.closest('[role="navigation"]') &&
                                   !link.closest('.menu');
            return isDashboardArea;
        });

        if (dashboardLinks.length > 0) {
            logger.debug(`Found ${dashboardLinks.length} dashboard course links`);
            return dashboardLinks;
        }
    }

    logger.debug('No dashboard cards found with any selector');
    return null;
}

/**
 * Wait for dashboard cards to be loaded in the DOM
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} True if cards found, false if timeout
 */
function waitForDashboardCards(maxWaitMs = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();

        const checkCards = () => {
            const cards = findDashboardCards();
            if (cards && cards.length > 0) {
                logger.info(`Dashboard cards found: ${cards.length}`);

                // Log the structure of the first card for debugging
                if (logger.isDebugEnabled() && cards[0]) {
                    logger.debug('First card element:', cards[0]);
                    logger.debug('First card classes:', cards[0].className);
                    logger.debug('First card attributes:', Array.from(cards[0].attributes).map(a => `${a.name}="${a.value}"`));
                }

                resolve(true);
                return;
            }

            if (Date.now() - startTime > maxWaitMs) {
                logger.warn('Timeout waiting for dashboard cards');
                logger.warn('Tried selectors:', getDashboardCardSelectors());
                logger.warn('Current URL:', window.location.href);
                logger.warn('Dashboard container exists:', !!document.querySelector('#dashboard'));
                resolve(false);
                return;
            }

            // Check again in 100ms
            setTimeout(checkCards, 100);
        };

        checkCards();
    });
}

/**
 * Check if a node looks like a dashboard card
 * @param {Node} node - DOM node to check
 * @returns {boolean} True if node appears to be a dashboard card
 */
function looksLikeDashboardCard(node) {
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

    // Check if it contains course links
    if (element.querySelector?.('a[href*="/courses/"]')) {
        return true;
    }

    return false;
}

/**
 * Setup MutationObserver to watch for dashboard changes
 * Handles Canvas SPA navigation where dashboard may reload
 */
function setupDashboardObserver() {
    // Clean up existing observer
    if (dashboardObserver) {
        dashboardObserver.disconnect();
    }

    // Create new observer
    dashboardObserver = new MutationObserver((mutations) => {
        // Check if dashboard cards were added
        const cardsAdded = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                return looksLikeDashboardCard(node) ||
                       node.querySelector?.(getDashboardCardSelectors().join(','));
            });
        });

        if (cardsAdded) {
            logger.debug('Dashboard cards detected via MutationObserver, updating grades');
            updateAllCourseCards();
        }
    });

    // Observe the dashboard container
    const dashboardContainer = document.querySelector('#dashboard') ||
                              document.querySelector('#content') ||
                              document.body;

    dashboardObserver.observe(dashboardContainer, {
        childList: true,
        subtree: true
    });

    logger.debug('Dashboard observer setup complete, observing:', dashboardContainer.id || dashboardContainer.tagName);
}

/**
 * Diagnostic function to help debug dashboard card detection
 * Exposed on window.CG for console access
 */
function diagnosticDashboardCards() {
    console.log('=== Dashboard Card Diagnostic ===');
    console.log('Current URL:', window.location.href);
    console.log('Is dashboard page:', window.location.pathname === '/' || window.location.pathname.startsWith('/dashboard'));

    const selectors = getDashboardCardSelectors();
    console.log('Trying selectors:', selectors);

    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`✓ Found ${elements.length} elements with selector: ${selector}`);
                console.log('  First element:', elements[0]);
            } else {
                console.log(`✗ No elements found with selector: ${selector}`);
            }
        } catch (e) {
            console.log(`✗ Error with selector ${selector}:`, e.message);
        }
    });

    const courseLinks = document.querySelectorAll('a[href*="/courses/"]');
    console.log(`Found ${courseLinks.length} total course links`);

    const dashboardLinks = Array.from(courseLinks).filter(link => {
        return !link.closest('.ic-app-header') &&
               !link.closest('[role="navigation"]') &&
               !link.closest('.menu');
    });
    console.log(`Found ${dashboardLinks.length} dashboard course links`);

    if (dashboardLinks.length > 0) {
        console.log('First dashboard link:', dashboardLinks[0]);
        console.log('First dashboard link parent:', dashboardLinks[0].parentElement);
    }

    console.log('=== End Diagnostic ===');
}

/**
 * Initialize dashboard grade display
 * Main entry point called from main.js
 */
export async function initDashboardGradeDisplay() {
    if (initialized) {
        logger.debug('Dashboard grade display already initialized');
        return;
    }

    initialized = true;
    logger.info('Initializing dashboard grade display');

    // Expose diagnostic function
    if (!window.CG) window.CG = {};
    window.CG.diagnosticDashboard = diagnosticDashboardCards;
    logger.info('Diagnostic function available: window.CG.diagnosticDashboard()');

    // Wait for dashboard cards to load
    const cardsFound = await waitForDashboardCards();
    if (!cardsFound) {
        logger.warn('Dashboard cards not found, grade display may not work');
        logger.warn('Run window.CG.diagnosticDashboard() in console for more info');
        // Continue anyway - observer might catch them later
    }

    // Initial update
    await updateAllCourseCards();

    // Setup observer for SPA navigation
    setupDashboardObserver();
}

/**
 * Cleanup function (useful for testing or if needed)
 */
export function cleanupDashboardGradeDisplay() {
    if (dashboardObserver) {
        dashboardObserver.disconnect();
        dashboardObserver = null;
    }
    initialized = false;
    logger.debug('Dashboard grade display cleaned up');
}

