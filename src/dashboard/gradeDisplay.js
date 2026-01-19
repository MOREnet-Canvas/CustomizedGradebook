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
import {
    populateCourseSnapshot,
    getCourseSnapshot,
    PAGE_CONTEXT
} from '../services/courseSnapshotService.js';
import { renderGradeOnCard } from './cardRenderer.js';
import {
    getDashboardCardSelectors,
    findDashboardCards,
    findCourseCard,
    looksLikeDashboardCard
} from './cardSelectors.js';
import { createPersistentObserver, OBSERVER_CONFIGS } from '../utils/observerHelpers.js';

/**
 * Track if initialization has been attempted
 */
let initialized = false;

/**
 * MutationObserver instance for watching dashboard changes
 */
let dashboardObserver = null;

/**
 * Configuration for concurrent processing
 * Concurrency level balances performance with Canvas API rate limits
 * - Too low: Sequential bottleneck, slow performance
 * - Too high: May hit Canvas API rate limits (typically 3000 requests/hour)
 * - Recommended: 3-5 for optimal balance
 */
const CONCURRENT_WORKERS = 3;

/**
 * Fetch active courses with enrollment grade data
 * Uses include[]=total_scores to get grades in a single API call
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<Array<{id: string, name: string, enrollmentData: Object}>>} Array of active courses with enrollment data
 */
async function fetchActiveCourses(apiClient) {
    try {
        // Fetch active courses with total_scores to get enrollment grades in one call
        // This eliminates the need for individual enrollment API calls per course
        const courses = await apiClient.get(
            '/api/v1/courses?enrollment_state=active&include[]=total_scores',
            {},
            'fetchActiveCourses'
        );

        logger.trace(`Raw courses response:`, courses);
        logger.trace(`Number of courses returned: ${courses?.length || 0}`);

        // Log first course structure for debugging
        if (courses && courses.length > 0) {
            logger.trace(`First course structure:`, courses[0]);
            logger.trace(`First course enrollments:`, courses[0].enrollments);
        }

        // Filter to only student enrollments and extract enrollment data
        // Canvas enrollment type is "student" (lowercase), not "StudentEnrollment"
        const studentCourses = courses.filter(course => {
            const enrollments = course.enrollments || [];
            const hasStudentEnrollment = enrollments.some(e =>
                e.type === 'student' ||
                e.type === 'StudentEnrollment' ||
                e.role === 'StudentEnrollment'
            );

            if (logger.isTraceEnabled() && enrollments.length > 0) {
                logger.trace(`Course ${course.id} (${course.name}): enrollments =`, enrollments.map(e => e.type));
            }

            return hasStudentEnrollment;
        });

        // Extract enrollment data for each course
        const coursesWithEnrollmentData = studentCourses.map(course => {
            const enrollments = course.enrollments || [];
            const studentEnrollment = enrollments.find(e =>
                e.type === 'student' ||
                e.type === 'StudentEnrollment' ||
                e.role === 'StudentEnrollment'
            );

            return {
                id: String(course.id),
                name: course.name,
                enrollmentData: studentEnrollment || null
            };
        });

        logger.info(`Found ${coursesWithEnrollmentData.length} active student courses out of ${courses.length} total courses`);

        // Log enrollment data for debugging
        if (logger.isTraceEnabled() && coursesWithEnrollmentData.length > 0) {
            const firstCourse = coursesWithEnrollmentData[0];
            logger.trace(`First course enrollment data:`, firstCourse.enrollmentData);
            if (firstCourse.enrollmentData?.grades) {
                logger.trace(`First course grades object:`, firstCourse.enrollmentData.grades);
            }
        }

        return coursesWithEnrollmentData;

    } catch (error) {
        logger.error('Failed to fetch active courses:', error);
        return [];
    }
}

/**
 * Update a single course card with grade using snapshot service
 * @param {string} courseId - Course ID
 * @param {string} courseName - Course name
 * @param {CanvasApiClient} apiClient - Canvas API client
 */
async function updateCourseCard(courseId, courseName, apiClient) {
    try {
        // Find the card element
        const cardElement = findCourseCard(courseId);
        if (!cardElement) {
            logger.trace(`Card element not found for course ${courseId}, skipping`);
            return;
        }

        // Check if snapshot exists, populate if not
        let snapshot = getCourseSnapshot(courseId);
        if (!snapshot) {
            logger.trace(`No snapshot for course ${courseId}, populating...`);
            snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
        }

        if (!snapshot) {
            logger.trace(`No grade available for course ${courseId}, skipping`);
            return;
        }

        // Render grade on card using snapshot data
        const gradeData = {
            score: snapshot.score,
            letterGrade: snapshot.letterGrade,
            source: snapshot.gradeSource
        };
        renderGradeOnCard(cardElement, gradeData);

        const displayInfo = snapshot.letterGrade
            ? `${snapshot.score}% (${snapshot.letterGrade})`
            : `${snapshot.score}`;
        logger.trace(`Grade displayed for course ${courseId}: ${displayInfo} (source: ${snapshot.gradeSource})`);

    } catch (error) {
        // Fail silently for individual courses - don't break the entire dashboard
        logger.warn(`Failed to update grade for course ${courseId}:`, error.message);
    }
}

/**
 * Update all course cards with grades using concurrent processing
 *
 * Performance optimization: Uses a worker queue pattern to process multiple courses
 * concurrently while respecting Canvas API rate limits. This significantly reduces
 * total processing time compared to sequential processing.
 *
 * Concurrency level is set to 3 to balance performance and API rate limits.
 */
async function updateAllCourseCards() {
    try {
        const startTime = performance.now();
        const apiClient = new CanvasApiClient();

        // Fetch active courses with enrollment data (single API call)
        const courses = await fetchActiveCourses(apiClient);
        if (courses.length === 0) {
            logger.info('No active student courses found');
            return;
        }

        logger.info(`Updating grades for ${courses.length} courses`);

        // Update course cards concurrently using worker queue pattern
        // Concurrency level balances performance with Canvas API rate limits
        const concurrency = CONCURRENT_WORKERS;
        const queue = courses.map(c => ({ id: c.id, name: c.name }));
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        // Worker function: processes courses from the queue
        async function worker() {
            while (queue.length > 0) {
                const course = queue.shift();
                if (!course) break;

                try {
                    await updateCourseCard(course.id, course.name, apiClient);
                    processedCount++;
                    successCount++;

                    // Log progress every 5 courses
                    if (processedCount % 5 === 0) {
                        logger.debug(`Progress: ${processedCount}/${courses.length} courses processed`);
                    }
                } catch (error) {
                    processedCount++;
                    errorCount++;
                    logger.warn(`Worker failed to process course ${course.id}:`, error.message);
                }
            }
        }

        // Launch concurrent workers
        const processingStartTime = performance.now();
        logger.debug(`Starting ${concurrency} concurrent workers for ${courses.length} courses`);

        await Promise.all(
            Array.from({ length: concurrency }, () => worker())
        );

        // Performance measurement: Calculate and log results
        const processingTime = performance.now() - processingStartTime;
        const totalTime = performance.now() - startTime;
        const avgTimePerCourse = processingTime / courses.length;

        logger.info(`Dashboard grade display update complete`);
        logger.info(`Performance: ${courses.length} courses processed in ${totalTime.toFixed(0)}ms total (${processingTime.toFixed(0)}ms processing)`);
        logger.info(`Success: ${successCount}/${courses.length} courses, ${errorCount} errors`);
        logger.info(`Average: ${avgTimePerCourse.toFixed(0)}ms per course with ${concurrency} concurrent workers`);

        // Calculate theoretical sequential time for comparison
        const estimatedSequentialTime = avgTimePerCourse * courses.length;
        const speedup = estimatedSequentialTime / processingTime;
        logger.debug(`Estimated speedup: ${speedup.toFixed(1)}x faster than sequential processing`);

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
            const cards = findDashboardCards();
            if (cards && cards.length > 0) {
                logger.info(`Dashboard cards found: ${cards.length}`);

                // Log the structure of the first card for debugging
                if (logger.isTraceEnabled() && cards[0]) {
                    logger.trace('First card element:', cards[0]);
                    logger.trace('First card classes:', cards[0].className);
                    logger.trace('First card attributes:', Array.from(cards[0].attributes).map(a => `${a.name}="${a.value}"`));
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
 * Setup MutationObserver to watch for dashboard changes
 * Handles Canvas SPA navigation where dashboard may reload
 */
function setupDashboardObserver() {
    // Clean up existing observer
    if (dashboardObserver) {
        dashboardObserver.disconnect();
    }

    // Observe the dashboard container
    const dashboardContainer = document.querySelector('#dashboard') ||
                              document.querySelector('#content') ||
                              document.body;

    // Create new observer
    dashboardObserver = createPersistentObserver((mutations) => {
        // Check if dashboard cards were added
        const cardsAdded = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                return looksLikeDashboardCard(node) ||
                       node.querySelector?.(getDashboardCardSelectors().join(','));
            });
        });

        if (cardsAdded) {
            logger.trace('Dashboard cards detected via MutationObserver, updating grades');
            updateAllCourseCards();
        }
    }, {
        config: OBSERVER_CONFIGS.CHILD_LIST,
        target: dashboardContainer,
        name: 'DashboardGradeDisplay'
    });

    logger.trace('Dashboard observer setup complete, observing:', dashboardContainer.id || dashboardContainer.tagName);
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
        logger.trace('Dashboard grade display already initialized');
        return;
    }

    initialized = true;
    logger.info('Initializing dashboard grade display');

    // Expose diagnostic and testing functions
    if (!window.CG) window.CG = {};
    window.CG.diagnosticDashboard = diagnosticDashboardCards;
    window.CG.testConcurrentPerformance = testConcurrentPerformance;
    logger.info('Diagnostic function available: window.CG.diagnosticDashboard()');
    logger.info('Performance test available: window.CG.testConcurrentPerformance()');

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
    logger.trace('Dashboard grade display cleaned up');
}

/**
 * Performance testing utility: Compare sequential vs concurrent processing
 *
 * This function is exposed for testing and benchmarking purposes.
 * It measures the performance difference between sequential and concurrent processing.
 *
 * Usage in browser console:
 *   await window.CG.testConcurrentPerformance()
 *
 * @returns {Promise<Object>} Performance comparison results
 */
export async function testConcurrentPerformance() {
    try {
        logger.info('=== Performance Test: Sequential vs Concurrent Processing ===');

        const apiClient = new CanvasApiClient();

        // Fetch courses
        const courses = await fetchActiveCourses(apiClient);
        if (courses.length === 0) {
            logger.warn('No courses found for performance testing');
            return { error: 'No courses found' };
        }

        logger.info(`Testing with ${courses.length} courses`);

        // Test 1: Sequential processing (baseline)
        logger.info('Test 1: Sequential processing...');
        const sequentialStart = performance.now();

        for (const course of courses) {
            try {
                await populateCourseSnapshot(course.id, course.name, apiClient);
            } catch (error) {
                logger.trace(`Sequential test error for course ${course.id}:`, error.message);
            }
        }

        const sequentialTime = performance.now() - sequentialStart;
        logger.info(`Sequential: ${sequentialTime.toFixed(0)}ms total, ${(sequentialTime / courses.length).toFixed(0)}ms per course`);

        // Test 2: Concurrent processing (optimized)
        logger.info('Test 2: Concurrent processing...');
        const concurrentStart = performance.now();

        const concurrency = CONCURRENT_WORKERS;
        const queue = courses.map(c => ({ id: c.id, name: c.name }));

        async function worker() {
            while (queue.length > 0) {
                const course = queue.shift();
                if (!course) break;

                try {
                    await populateCourseSnapshot(course.id, course.name, apiClient);
                } catch (error) {
                    logger.trace(`Concurrent test error for course ${course.id}:`, error.message);
                }
            }
        }

        await Promise.all(
            Array.from({ length: concurrency }, () => worker())
        );

        const concurrentTime = performance.now() - concurrentStart;
        logger.info(`Concurrent: ${concurrentTime.toFixed(0)}ms total, ${(concurrentTime / courses.length).toFixed(0)}ms per course`);

        // Calculate results
        const speedup = sequentialTime / concurrentTime;
        const improvement = ((sequentialTime - concurrentTime) / sequentialTime * 100);

        const results = {
            courses: courses.length,
            concurrency: concurrency,
            sequential: {
                total: Math.round(sequentialTime),
                perCourse: Math.round(sequentialTime / courses.length)
            },
            concurrent: {
                total: Math.round(concurrentTime),
                perCourse: Math.round(concurrentTime / courses.length)
            },
            speedup: speedup.toFixed(2),
            improvement: improvement.toFixed(1) + '%',
            timeSaved: Math.round(sequentialTime - concurrentTime) + 'ms'
        };

        logger.info('=== Performance Test Results ===');
        logger.info(`Speedup: ${results.speedup}x faster (${results.improvement} improvement)`);
        logger.info(`Time saved: ${results.timeSaved}`);
        logger.info('Full results:', results);

        return results;

    } catch (error) {
        logger.error('Performance test failed:', error);
        return { error: error.message };
    }
}