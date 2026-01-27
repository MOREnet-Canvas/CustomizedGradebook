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
 * - Fetches courses directly from /api/v1/courses?enrollment_state=active&include[]=total_scores
 * - Single API call gets course list and enrollment grades
 * - Matches dashboard grade fetching strategy for consistency
 */

import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { formatGradeDisplay } from '../utils/gradeFormatting.js';
import { createPersistentObserver, OBSERVER_CONFIGS } from '../utils/observerHelpers.js';
import {
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
 * Fetch active courses with enrollment grade data
 * Uses the same strategy as dashboard: /api/v1/courses with include[]=total_scores
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<Array<{id: string, name: string, enrollmentData: Object}>>} Array of active courses with enrollment data
 */
async function fetchActiveCourses(apiClient) {
    try {
        // Fetch active courses with total_scores to get enrollment grades in one call
        // This matches the dashboard strategy and eliminates the need for separate enrollment API calls
        const courses = await apiClient.get(
            '/api/v1/courses?enrollment_state=active&include[]=total_scores',
            {},
            'fetchActiveCourses'
        );

        logger.trace(`[All-Grades] Raw courses response: ${courses?.length || 0} courses`);

        // Log first course structure for debugging
        if (logger.isTraceEnabled() && courses && courses.length > 0) {
            logger.trace(`[All-Grades] First course structure:`, courses[0]);
            logger.trace(`[All-Grades] First course enrollments:`, courses[0].enrollments);
        }

        // Filter to only student enrollments and extract enrollment data
        // Canvas enrollment type can be "student" (lowercase) or "StudentEnrollment"
        const studentCourses = courses.filter(course => {
            const enrollments = course.enrollments || [];
            const hasStudentEnrollment = enrollments.some(e =>
                e.type === 'student' ||
                e.type === 'StudentEnrollment' ||
                e.role === 'StudentEnrollment'
            );

            if (logger.isTraceEnabled() && enrollments.length > 0) {
                logger.trace(`[All-Grades] Course ${course.id} (${course.name}): enrollments =`, enrollments.map(e => e.type));
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

        logger.info(`[All-Grades] Found ${coursesWithEnrollmentData.length} active student courses out of ${courses.length} total courses`);

        // Log enrollment data for debugging
        if (logger.isTraceEnabled() && coursesWithEnrollmentData.length > 0) {
            const firstCourse = coursesWithEnrollmentData[0];
            logger.trace(`[All-Grades] First course enrollment data:`, firstCourse.enrollmentData);
            if (firstCourse.enrollmentData?.grades) {
                logger.trace(`[All-Grades] First course grades object:`, firstCourse.enrollmentData.grades);
            }
        }

        return coursesWithEnrollmentData;

    } catch (error) {
        logger.error('[All-Grades] Failed to fetch active courses:', error);
        return [];
    }
}

/**
 * Enrich course data with grades and detection using snapshot service
 * @param {Array} courses - Array of course objects from API
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<Array>} Array of enriched course objects
 */
async function enrichCoursesWithSnapshots(courses, apiClient) {
    const startTime = performance.now();

    // Process courses in parallel
    const enrichedPromises = courses.map(async (course) => {
        const { id: courseId, name: courseName } = course;

        // Check if we should refresh the snapshot for this course
        const needsRefresh = shouldRefreshGrade(courseId, PAGE_CONTEXT.ALL_GRADES);

        let snapshot = getCourseSnapshot(courseId);

        // Populate or refresh snapshot if needed
        if (!snapshot || needsRefresh) {
            logger.trace(`[All-Grades] ${!snapshot ? 'Populating' : 'Refreshing'} snapshot for course ${courseId}...`);
            snapshot = await refreshCourseSnapshot(courseId, courseName, apiClient, PAGE_CONTEXT.ALL_GRADES);
        }

        // If no snapshot, skip this course
        if (!snapshot) {
            logger.trace(`[All-Grades] No snapshot available for course ${courseId}, skipping`);
            return null;
        }

        // Use display values directly from snapshot (already calculated by snapshot service)
        // This ensures identical rendering across dashboard and all-grades page
        const displayScore = snapshot.displayScore;
        const displayLetterGrade = snapshot.displayLetterGrade;
        const displayType = snapshot.displayType;
        const isStandardsBased = snapshot.isStandardsBased;

        logger.trace(`[All-Grades] Course "${courseName}" (${courseId}): displayScore=${displayScore}, displayType=${displayType}, displayLetterGrade=${displayLetterGrade}, isStandardsBased=${isStandardsBased}`);

        return {
            courseId,
            courseName,
            courseUrl: `/courses/${courseId}/grades`,
            displayScore,
            displayLetterGrade,
            displayType,
            isStandardsBased,
            gradeSource: snapshot.gradeSource
        };
    });

    const enrichedCourses = (await Promise.all(enrichedPromises)).filter(c => c !== null);

    logger.trace(`[All-Grades] Enriched ${enrichedCourses.length} courses in ${(performance.now() - startTime).toFixed(2)}ms`);
    return enrichedCourses;
}

/**
 * Fetch course grade data using API-first strategy (matches dashboard)
 * 1. Fetch courses from /api/v1/courses with include[]=total_scores (single API call)
 * 2. Enrich with snapshots for course model detection and grade conversion
 *
 * @returns {Promise<Array>} Array of course grade objects
 */
async function fetchCourseGrades() {
    const startTime = performance.now();
    const apiClient = new CanvasApiClient();

    try {
        // Step 1: Fetch active courses with enrollment data (single API call)
        logger.trace('[All-Grades] Step 1: Fetching active courses from API...');
        const courses = await fetchActiveCourses(apiClient);

        if (courses.length === 0) {
            logger.warn('[All-Grades] No active student courses found');
            return [];
        }

        logger.trace(`[All-Grades] Found ${courses.length} active student courses`);

        // Step 2: Enrich courses with snapshots for model detection and grade conversion
        logger.trace(`[All-Grades] Step 2: Enriching courses with snapshots...`);
        const enrichedCourses = await enrichCoursesWithSnapshots(courses, apiClient);

        logger.trace(`[All-Grades] Total processing time: ${(performance.now() - startTime).toFixed(2)}ms`);

        // Log summary
        const withGrades = enrichedCourses.filter(c => c.displayScore !== null).length;
        const withoutGrades = enrichedCourses.length - withGrades;
        const fromEnrollment = enrichedCourses.filter(c => c.gradeSource === 'enrollment').length;
        const fromSnapshot = enrichedCourses.filter(c => c.gradeSource === 'snapshot').length;
        const standardsBased = enrichedCourses.filter(c => c.isStandardsBased).length;
        const traditional = enrichedCourses.length - standardsBased;

        logger.debug(`[All-Grades] Processed ${enrichedCourses.length} courses: ${standardsBased} standards-based, ${traditional} traditional`);
        logger.debug(`[All-Grades] Grade sources: ${fromEnrollment} from enrollment, ${fromSnapshot} from snapshot`);

        // Log detailed breakdown for debugging
        if (logger.isTraceEnabled()) {
            logger.trace('[All-Grades] Course breakdown:');
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
        logger.error('[All-Grades] Failed to fetch course grades:', error);
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
    //injectHideTableCSS();

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