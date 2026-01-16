// src/student/cleanupObserver.js
/**
 * Cleanup Observer Module
 * 
 * Sets up MutationObserver to continuously clean up fraction scores as Canvas
 * dynamically updates the DOM. This ensures that grade normalization persists
 * even when Canvas re-renders parts of the page.
 * 
 * The observer is debounced to avoid excessive DOM manipulation.
 */

import { removeFractionScores } from './gradeNormalizer.js';
import { courseHasAvgAssignment } from '../utils/canvas.js';
import { logger } from '../utils/logger.js';
import { isDashboardPage, isAllGradesPage, isCoursePageNeedingCleanup } from '../utils/pageDetection.js';
import { debounce } from '../utils/dom.js';

/**
 * Check if current page should have cleanup applied
 * @returns {boolean} True if cleanup should run
 */
function shouldClean() {
    return isDashboardPage() || isCoursePageNeedingCleanup();
}

/**
 * Start cleanup observers for grade normalization
 * Sets up MutationObserver and URL change detection
 */
export function startCleanupObservers() {
    logger.debug('Starting cleanup observers for grade normalization');
    
    // Create debounced version to avoid hammering the DOM
    const debouncedClean = debounce(() => {
        if (shouldClean()) {
            removeFractionScores();
        }
    }, 100); // 100ms is fast enough to feel instant, slow enough to collapse spam
    
    // Initial call after slight delay so Canvas can render
    setTimeout(() => {
        debouncedClean();
        
        const observer = new MutationObserver(() => {
            debouncedClean();
        });
        
        // Only start observing if we're actually on a page we care about
        if (shouldClean()) {
            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
            logger.debug('MutationObserver started for grade cleanup');
        }
        
        // Also handle SPA-style URL changes (tab switches, /grades → /grades#tab-outcomes, etc.)
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                debouncedClean();
            }
        }, 1000);
        
    }, 500);
}

/**
 * Initialize cleanup observers based on page context
 * For dashboard: always run
 * For course pages: only run if course has AVG assignment
 * For all-grades page: skip (no course ID available)
 */
export async function initCleanupObservers() {
    // Skip all-grades page (no course ID available)
    if (isAllGradesPage()) {
        logger.trace('Skipping cleanup observers on all-grades page (no course context)');
        return;
    }

    if (isDashboardPage()) {
        // Dashboard: always allow cleanup
        // The removeFractionScores() function will only rewrite scores
        // for cards matching AVG_ASSIGNMENT_NAME
        logger.debug('Initializing cleanup observers for dashboard');
        startCleanupObservers();
    } else {
        // Course pages: only run if this course has the avg assignment
        const hasAvg = await courseHasAvgAssignment();
        if (!hasAvg) {
            logger.debug('Skipping fraction cleanup — no Current Score Assignment in this course');
            return;
        }
        logger.debug('Initializing cleanup observers for course page');
        startCleanupObservers();
    }
}

