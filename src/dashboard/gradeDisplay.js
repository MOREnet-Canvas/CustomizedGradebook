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
        const courses = await apiClient.get(
            '/api/v1/courses?enrollment_state=active&include[]=total_scores',
            {},
            'fetchActiveCourses'
        );
        
        // Filter to only student enrollments
        const studentCourses = courses.filter(course => {
            const enrollments = course.enrollments || [];
            return enrollments.some(e => e.type === 'StudentEnrollment');
        });
        
        logger.debug(`Found ${studentCourses.length} active student courses`);
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
 * Wait for dashboard cards to be loaded in the DOM
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} True if cards found, false if timeout
 */
function waitForDashboardCards(maxWaitMs = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkCards = () => {
            const cards = document.querySelectorAll('[data-course-id]');
            if (cards.length > 0) {
                logger.debug(`Dashboard cards found: ${cards.length}`);
                resolve(true);
                return;
            }
            
            if (Date.now() - startTime > maxWaitMs) {
                logger.warn('Timeout waiting for dashboard cards');
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
                return node.nodeType === Node.ELEMENT_NODE && 
                       (node.hasAttribute?.('data-course-id') || 
                        node.querySelector?.('[data-course-id]'));
            });
        });
        
        if (cardsAdded) {
            logger.debug('Dashboard cards detected, updating grades');
            updateAllCourseCards();
        }
    });
    
    // Observe the dashboard container
    const dashboardContainer = document.querySelector('#dashboard') || document.body;
    dashboardObserver.observe(dashboardContainer, {
        childList: true,
        subtree: true
    });
    
    logger.debug('Dashboard observer setup complete');
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
    
    // Wait for dashboard cards to load
    const cardsFound = await waitForDashboardCards();
    if (!cardsFound) {
        logger.warn('Dashboard cards not found, grade display may not work');
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

