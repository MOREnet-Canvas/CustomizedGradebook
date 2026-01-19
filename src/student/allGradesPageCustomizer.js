// src/student/allGradesPageCustomizer.js
/**
 * All-Grades Page Customizer Module
 * 
 * Customizes the all-grades page (/grades) to display converted point values
 * for standards-based courses while preserving percentages for traditional courses.
 * 
 * Features:
 * - Detects standards-based courses via course name patterns and AVG Assignment presence
 * - Converts percentage grades to 0-4 point scale for standards-based courses
 * - Displays letter grades alongside numeric scores (e.g., "2.57 (Developing)")
 * - Replaces Canvas grades table with enhanced custom table
 * - Caches detection results for performance
 * 
 * Data Source Strategy:
 * - Primary: Enrollments API (/api/v1/users/self/enrollments) - single call, includes grades
 * - Fallback: DOM parsing if API fails
 */

import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { scoreToGradeLevel } from './gradeExtractor.js';
import { formatGradeDisplay, percentageToPoints } from '../utils/gradeFormatting.js';
import { extractAllCoursesFromTable } from '../utils/domExtractors.js';
import { createPersistentObserver, OBSERVER_CONFIGS } from '../utils/observerHelpers.js';
import { fetchAllEnrollments, extractEnrollmentData } from '../services/enrollmentService.js';
import {
    populateCourseSnapshot,
    getCourseSnapshot,
    shouldRefreshGrade,
    refreshCourseSnapshot,
    PAGE_CONTEXT
} from '../services/courseSnapshotService.js';

/**
 * Track if customizations have been applied
 */
let processed = false;

/**
 * Inject CSS to hide original table immediately (prevent flash)
 */
function injectHideTableCSS() {
    // Check if CSS already injected
    if (document.getElementById('cg-hide-grades-table-css')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'cg-hide-grades-table-css';
    style.textContent = `
        /* Hide original Canvas grades table to prevent flash of percentages */
        table.course_details.student_grades:not([data-customized="true"]) {
            opacity: 0 !important;
            pointer-events: none !important;
        }

        /* Show customized table */
        #customized-grades-table {
            opacity: 1 !important;
        }
    `;
    document.head.appendChild(style);
    logger.trace('[All-Grades] Injected CSS to hide original table');
}

/**
 * Extract course data from DOM (fast path - no API calls yet)
 * @returns {Array} Array of course objects with basic info
 */
function extractCoursesFromDOM() {
    try {
        // Use shared DOM extraction utility
        const courses = extractAllCoursesFromTable();

        if (courses.length === 0) {
            logger.warn('[Hybrid] No courses found in DOM');
        } else {
            logger.trace(`[Hybrid] Extracted ${courses.length} courses from DOM`);
        }

        return courses;

    } catch (error) {
        logger.error('[Hybrid] Failed to extract courses from DOM:', error);
        return [];
    }
}

/**
 * Fetch grade data from Enrollments API
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<Map>} Map of courseId -> grade data
 */
async function fetchGradeDataFromAPI(apiClient) {
    try {
        logger.debug('[Hybrid] Fetching grade data from Enrollments API...');

        // Use shared enrollment service to fetch all enrollments
        const enrollments = await fetchAllEnrollments(apiClient, {
            state: 'active',
            includeTotalScores: true
        });

        logger.trace(`[Hybrid] Fetched ${enrollments.length} enrollments from API`);

        // Use shared enrollment service to extract grade data
        const gradeMap = extractEnrollmentData(enrollments);

        logger.trace(`[Hybrid] Extracted grade data for ${gradeMap.size} courses`);
        return gradeMap;

    } catch (error) {
        logger.warn('[Hybrid] Failed to fetch grade data from API:', error.message);
        return new Map();
    }
}

/**
 * Enrich course data with grades and detection using snapshot service
 * @param {Array} courses - Array of course objects from DOM
 * @param {Map} gradeMap - Map of courseId -> grade data from API
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<Array>} Array of enriched course objects
 */
async function enrichCoursesWithAPI(courses, gradeMap, apiClient) {
    const startTime = performance.now();

    // Process courses in parallel
    const enrichedPromises = courses.map(async (course) => {
        const { courseId, courseName, percentage: domPercentage, matchesPattern } = course;

        // Check if we should refresh the snapshot for this course
        const needsRefresh = shouldRefreshGrade(courseId, PAGE_CONTEXT.ALL_GRADES);

        let snapshot = getCourseSnapshot(courseId);

        // Populate or refresh snapshot if needed
        if (!snapshot || needsRefresh) {
            logger.trace(`[All-Grades] ${!snapshot ? 'Populating' : 'Refreshing'} snapshot for course ${courseId}...`);
            snapshot = await refreshCourseSnapshot(courseId, courseName, apiClient, PAGE_CONTEXT.ALL_GRADES);
        }

        // Extract data from snapshot
        let percentage = domPercentage;
        let apiLetterGrade = null;
        let gradeSource = 'DOM';
        let isStandardsBased = false;

        if (snapshot) {
            isStandardsBased = snapshot.isStandardsBased;
            apiLetterGrade = snapshot.letterGrade;

            // Use snapshot score if DOM extraction failed
            if (percentage === null && snapshot.score !== null) {
                percentage = snapshot.score;
                gradeSource = 'Snapshot';
                logger.debug(`[All-Grades] Using snapshot grade for ${courseName}: ${percentage}%`);
            } else if (percentage !== null) {
                logger.trace(`[All-Grades] Using DOM grade for ${courseName}: ${percentage}%`);
            }
        }

        logger.trace(`[All-Grades] Course "${courseName}" (${courseId}): percentage=${percentage}, letterGrade="${apiLetterGrade || 'null'}", isStandardsBased=${isStandardsBased}`);

        // Calculate display values
        let displayScore = percentage;
        let displayLetterGrade = null;
        let displayType = 'percentage';

        if (isStandardsBased && percentage !== null) {
            // Convert percentage to points
            const pointValue = percentageToPoints(percentage);
            displayScore = pointValue;
            displayType = 'points';

            // Use API letter grade if available, otherwise calculate from point value
            displayLetterGrade = apiLetterGrade || scoreToGradeLevel(pointValue);

            logger.trace(`[Hybrid] Standards-based course: ${courseName}, percentage=${percentage}%, points=${pointValue.toFixed(2)}, letterGrade=${displayLetterGrade} (from ${apiLetterGrade ? 'API' : 'calculation'})`);
        } else if (isStandardsBased && percentage === null) {
            logger.trace(`[Hybrid] Course "${courseName}" is standards-based but has no percentage grade`);
        } else {
            logger.trace(`[Hybrid] Traditional course: ${courseName}, percentage=${percentage}%`);
        }

        logger.trace(`[Hybrid] Final values for "${courseName}": displayScore=${displayScore}, displayType=${displayType}, displayLetterGrade=${displayLetterGrade}`);

        return {
            ...course,
            percentage,
            displayScore,
            displayLetterGrade,
            displayType,
            isStandardsBased,
            gradeSource
        };
    });

    const enrichedCourses = await Promise.all(enrichedPromises);

    logger.trace(`[Hybrid] Enriched ${enrichedCourses.length} courses in ${(performance.now() - startTime).toFixed(2)}ms`);
    return enrichedCourses;
}

/**
 * Fetch course grade data using hybrid strategy
 * 1. Extract course list from DOM (fast - course names and IDs)
 * 2. Fetch grade data from Enrollments API (reliable - percentages and letter grades)
 * 3. Merge DOM and API data
 * 4. Detect standards-based courses and convert grades
 *
 * @returns {Promise<Array>} Array of course grade objects
 */
async function fetchCourseGrades() {
    const startTime = performance.now();
    const apiClient = new CanvasApiClient();

    try {
        // Step 1: Extract course list from DOM (fast - no API calls)
        logger.trace('[Hybrid] Step 1: Extracting course list from DOM...');
        const courses = extractCoursesFromDOM();

        if (courses.length === 0) {
            throw new Error('No courses found in DOM');
        }

        logger.trace(`[Hybrid] Found ${courses.length} courses in DOM`);

        // Step 2: Fetch grade data from API (reliable source for percentages)
        logger.trace('[Hybrid] Step 2: Fetching grade data from Enrollments API...');
        const gradeMap = await fetchGradeDataFromAPI(apiClient);

        logger.trace(`[Hybrid] Fetched grade data for ${gradeMap.size} courses from API`);

        // Step 3: Enrich courses with grades and detection
        logger.trace(`[Hybrid] Step 3: Enriching courses with grades and detection...`);
        const enrichedCourses = await enrichCoursesWithAPI(courses, gradeMap, apiClient);

        logger.trace(`[Hybrid] Total processing time: ${(performance.now() - startTime).toFixed(2)}ms`);

        // Log summary
        const withGrades = enrichedCourses.filter(c => c.displayScore !== null).length;
        const withoutGrades = enrichedCourses.length - withGrades;
        const fromDOM = enrichedCourses.filter(c => c.gradeSource === 'DOM').length;
        const fromAPI = enrichedCourses.filter(c => c.gradeSource === 'API').length;
        const standardsBased = enrichedCourses.filter(c => c.isStandardsBased).length;
        const traditional = enrichedCourses.length - standardsBased;

        logger.debug(`[Hybrid] Processed ${enrichedCourses.length} courses: ${standardsBased} standards-based, ${traditional} traditional`);
        logger.debug(`[Hybrid] Grade sources: ${fromDOM} from DOM, ${fromAPI} from API`);

        // Log detailed breakdown for debugging
        if (logger.isTraceEnabled()) {
            logger.trace('[Hybrid] Course breakdown:');
            enrichedCourses.forEach(c => {
                const type = c.isStandardsBased ? 'SBG' : 'TRAD';
                const display = c.displayScore !== null
                    ? (c.isStandardsBased ? `${c.displayScore.toFixed(2)} (${c.displayLetterGrade || 'N/A'})` : `${c.displayScore.toFixed(2)}%`)
                    : 'N/A';
                logger.trace(`  [${type}] ${c.courseName}: ${display}`);
            });
        }

        return enrichedCourses;

    } catch (error) {
        logger.error('[Hybrid] Failed to fetch course grades:', error);
        throw error;
    }
}

/**
 * Create enhanced grades table
 * @param {Array} courses - Array of course grade objects
 * @returns {HTMLElement} Table element
 */
function createGradesTable(courses) {
    const table = document.createElement('table');
    table.className = 'ic-Table ic-Table--hover-row ic-Table--striped customized-grades-table';
    table.style.cssText = 'width: 100%; margin-top: 1rem;';

    // Create table header (removed Type column per requirements)
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="ic-Table-header" style="text-align: left; padding: 0.75rem;">Course</th>
            <th class="ic-Table-header" style="text-align: right; padding: 0.75rem;">Grade</th>
        </tr>
    `;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');

    for (const course of courses) {
        const row = document.createElement('tr');
        row.className = 'ic-Table-row';

        // Course name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'ic-Table-cell';
        nameCell.style.padding = '0.75rem';

        const courseLink = document.createElement('a');
        courseLink.href = course.courseUrl;
        courseLink.textContent = course.courseName;
        courseLink.style.cssText = 'color: #0374B5; text-decoration: none;';
        courseLink.addEventListener('mouseenter', () => {
            courseLink.style.textDecoration = 'underline';
        });
        courseLink.addEventListener('mouseleave', () => {
            courseLink.style.textDecoration = 'none';
        });

        nameCell.appendChild(courseLink);

        // Grade cell
        const gradeCell = document.createElement('td');
        gradeCell.className = 'ic-Table-cell';
        gradeCell.style.cssText = 'text-align: right; padding: 0.75rem; font-weight: bold;';

        if (course.displayScore !== null) {
            if (course.displayType === 'points') {
                // Standards-based: show points with letter grade
                gradeCell.textContent = formatGradeDisplay(course.displayScore, course.displayLetterGrade);
                gradeCell.style.color = '#0B874B'; // Green for standards-based
                logger.trace(`[Table] ${course.courseName}: Rendering as SBG (${course.displayScore.toFixed(2)} ${course.displayLetterGrade})`);
            } else {
                // Traditional: show percentage
                gradeCell.textContent = `${course.displayScore.toFixed(2)}%`;
                gradeCell.style.color = '#2D3B45'; // Default color
                logger.trace(`[Table] ${course.courseName}: Rendering as traditional (${course.displayScore.toFixed(2)}%)`);
            }
        } else {
            gradeCell.textContent = 'N/A';
            gradeCell.style.color = '#73818C'; // Gray for no grade
            logger.trace(`[Table] ${course.courseName}: No grade available`);
        }

        // Log detailed course data for debugging
        logger.trace(`[Table] ${course.courseName} details: isStandardsBased=${course.isStandardsBased}, displayType=${course.displayType}, displayScore=${course.displayScore}`);

        row.appendChild(nameCell);
        row.appendChild(gradeCell);
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    return table;
}

/**
 * Replace the original grades table with enhanced version
 * @param {Array} courses - Array of course grade objects
 */
function replaceGradesTable(courses) {
    // Find the original table
    const originalTable = document.querySelector('table.course_details.student_grades');
    if (!originalTable) {
        logger.warn('Original grades table not found');
        return;
    }

    // Remove any existing customized table (prevent duplicates)
    const existingCustomTable = document.getElementById('customized-grades-table');
    if (existingCustomTable) {
        logger.debug('Removing existing customized table to prevent duplicates');
        existingCustomTable.remove();
    }

    // Hide original table and mark as customized
    originalTable.style.display = 'none';
    originalTable.dataset.customized = 'true';

    // Create and insert new table
    const newTable = createGradesTable(courses);
    newTable.id = 'customized-grades-table';

    // Insert after original table
    originalTable.parentNode.insertBefore(newTable, originalTable.nextSibling);

    logger.info(`Replaced grades table with ${courses.length} courses`);
}

/**
 * Apply all customizations to the all-grades page
 */
async function applyCustomizations() {
    if (processed) {
        logger.debug('All-grades customizations already applied');
        return;
    }

    try {
        logger.info('Applying all-grades page customizations...');

        // Fetch course grades
        const courses = await fetchCourseGrades();

        if (courses.length === 0) {
            logger.warn('No courses found, skipping customization');
            return;
        }

        // Replace table
        replaceGradesTable(courses);

        // Log statistics
        const standardsBasedCount = courses.filter(c => c.isStandardsBased).length;
        const traditionalCount = courses.length - standardsBasedCount;
        logger.info(`All-grades customization complete: ${courses.length} courses (${standardsBasedCount} SBG, ${traditionalCount} traditional)`);

        processed = true;

        document.body.classList.remove('cg_processing_grades');


    } catch (error) {
        logger.error('Failed to apply all-grades customizations:', error);
        // Don't set processed = true so it can retry
        document.body.classList.remove('cg_processing_grades');

    }
}

/**
 * Initialize all-grades page customizer
 * Sets up observers to handle lazy-loaded content
 */
export function initAllGradesPageCustomizer() {
    logger.debug('Initializing all-grades page customizer');

    // Inject CSS immediately to prevent flash of percentages
    injectHideTableCSS();

    // Try immediately
    applyCustomizations();

    // Also observe for lazy-loaded content
    createPersistentObserver(() => {
        const table = document.querySelector('table.course_details.student_grades');
        if (table && !table.dataset.customized && !processed) {
            logger.debug('Grades table detected, applying customizations...');
            applyCustomizations();
        }
    }, {
        config: OBSERVER_CONFIGS.CHILD_LIST,
        target: document.body,
        name: 'AllGradesPageCustomizer'
    });
}