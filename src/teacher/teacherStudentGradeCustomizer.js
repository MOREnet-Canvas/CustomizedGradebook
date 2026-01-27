// src/teacher/teacherStudentGradeCustomizer.js
/**
 * Teacher Student Grade Page Customizer Module
 *
 * Customizes the teacher view of individual student grades pages to show
 * standards-based grading for standards-based courses:
 * - Removes fraction denominators from all grade displays
 * - Updates final grade row to show AVG assignment score with letter grade
 * - Updates sidebar total to show AVG assignment score with letter grade
 *
 * This module only runs when:
 * - User is teacher_like (teacher, TA, admin)
 * - Page is /courses/{courseId}/grades/{studentId}
 * - Course is standards-based (has AVG assignment)
 */

import { logger } from '../utils/logger.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { formatGradeDisplay } from '../utils/gradeFormatting.js';
import { removeFractionScores } from '../student/gradeNormalizer.js';
import { getCourseSnapshot, populateCourseSnapshot, PAGE_CONTEXT } from '../services/courseSnapshotService.js';
import { getStudentIdFromUrl } from '../utils/pageDetection.js';
import { createPersistentObserver, OBSERVER_CONFIGS } from '../utils/observerHelpers.js';
import { debounce } from '../utils/dom.js';

/**
 * Track if customizations have been applied (prevent double-runs)
 */
let processed = false;

/**
 * Fetch AVG assignment score for a specific student
 * @param {string} courseId - Course ID
 * @param {string} studentId - Student ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string|null}|null>} Grade data or null
 */
async function fetchStudentAvgScore(courseId, studentId, apiClient) {
    logger.trace(`[Teacher] fetchStudentAvgScore: courseId=${courseId}, studentId=${studentId}`);

    try {
        // Get AVG assignment ID from snapshot
        const snapshot = getCourseSnapshot(courseId);
        if (!snapshot) {
            logger.warn(`[Teacher] No snapshot available for course ${courseId} - cannot fetch student grade`);
            return null;
        }

        logger.trace(`[Teacher] Snapshot found, searching for AVG assignment...`);

        // Search for AVG assignment
        const assignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments`,
            { search_term: 'Current Score' },
            'fetchAvgAssignment'
        );

        logger.trace(`[Teacher] Found ${assignments?.length || 0} assignments matching "Current Score"`);

        const avgAssignment = assignments.find(a => a.name === 'Current Score');
        if (!avgAssignment) {
            logger.warn(`[Teacher] AVG assignment "Current Score" not found in course ${courseId}`);
            return null;
        }

        logger.trace(`[Teacher] Found AVG assignment: id=${avgAssignment.id}, name="${avgAssignment.name}"`);

        // Fetch student's submission for AVG assignment
        logger.trace(`[Teacher] Fetching submission for student ${studentId}, assignment ${avgAssignment.id}...`);
        const submission = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/${studentId}`,
            {},
            'fetchStudentSubmission'
        );

        logger.trace(`[Teacher] Submission response: score=${submission?.score}, workflow_state=${submission?.workflow_state}`);

        const score = submission?.score;
        if (score === null || score === undefined) {
            logger.warn(`[Teacher] No score found for student ${studentId} in AVG assignment (submission exists but score is null/undefined)`);
            return null;
        }

        logger.trace(`[Teacher] Student score found: ${score}, fetching enrollment for letter grade...`);

        // Get letter grade from enrollment
        const enrollment = await apiClient.get(
            `/api/v1/courses/${courseId}/enrollments`,
            { user_id: studentId },
            'fetchStudentEnrollment'
        );

        logger.trace(`[Teacher] Enrollment response: ${enrollment?.length || 0} enrollments found`);

        const letterGrade = enrollment?.[0]?.grades?.current_grade || null;

        logger.debug(`[Teacher] ✅ Student ${studentId} AVG score: ${score}, letter grade: ${letterGrade}`);
        return { score, letterGrade };

    } catch (error) {
        logger.warn(`[Teacher] ❌ Failed to fetch student AVG score:`, error.message);
        return null;
    }
}

/**
 * Update the final grade row in the grades table
 * Matches the student view implementation for consistency
 * @param {Object} gradeData - Grade data object
 */
function updateFinalGradeRow(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);

    logger.trace(`updateFinalGradeRow called with score=${score}, letterGrade=${letterGrade}, displayValue="${displayValue}"`);

    // Try multiple selectors to find final grade rows (teacher view might have different structure)
    const finalGradeRows = [
        ...document.querySelectorAll("tr.student_assignment.hard_coded.final_grade"),
        ...document.querySelectorAll("tr.student_assignment.final_grade"),
        ...document.querySelectorAll("tr.final_grade")
    ];

    if (finalGradeRows.length === 0) {
        logger.trace('No final grade rows found');
        return;
    }

    logger.trace(`Found ${finalGradeRows.length} final grade row(s)`);

    finalGradeRows.forEach((row, index) => {
        // Try multiple selectors for grade element
        const gradeEl = row.querySelector(".assignment_score .tooltip .grade") ||
                       row.querySelector(".assignment_score .grade") ||
                       row.querySelector(".tooltip .grade") ||
                       row.querySelector(".grade");

        if (gradeEl) {
            const currentText = gradeEl.textContent.trim();

            // Always update to the combined format (score + letter grade)
            // This matches the student view behavior
            if (currentText !== displayValue) {
                gradeEl.textContent = displayValue;
                gradeEl.dataset.normalized = 'true';
                logger.trace(`Updated final grade row ${index}: "${currentText}" -> "${displayValue}"`);
            } else {
                logger.trace(`Final grade row ${index} already has correct value: "${currentText}"`);
            }
        } else {
            logger.trace(`Final grade row ${index}: grade element not found`);
        }

        const possibleEl = row.querySelector(".details .possible.points_possible");
        if (possibleEl) {
            // Canvas shows "102.50 / 152.00". We don't want that.
            const txt = possibleEl.textContent.trim();
            if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
                possibleEl.textContent = "";
            }
        }
    });

    logger.debug(`Final grade row updated to: ${displayValue}`);
}

/**
 * Update the sidebar total grade display
 * Handles inline fraction text (e.g., "2.55 / 4.00")
 * @param {Object} gradeData - Grade data object
 */
function updateSidebarGrade(gradeData) {
    const { score, letterGrade } = gradeData;

    // For sidebar, we want just the score (letter grade is in separate element)
    const scoreStr = typeof score === 'number' ? score.toFixed(2) : String(score);

    const rightSide = document.querySelector('#right-side-wrapper') || document.querySelector('#right-side');
    if (!rightSide) {
        logger.trace('Right sidebar not found');
        return;
    }

    const finalGradeDiv = rightSide.querySelector('.student_assignment.final_grade');
    if (!finalGradeDiv) {
        logger.trace('Final grade element not found in sidebar');
        return;
    }

    const gradeSpan = finalGradeDiv.querySelector('.grade');
    if (gradeSpan) {
        const currentText = gradeSpan.textContent.trim();

        // Check if it contains a fraction (e.g., "2.55 / 4.00")
        if (currentText.includes('/') || currentText !== scoreStr) {
            gradeSpan.textContent = scoreStr;
            logger.trace(`Updated sidebar grade: "${currentText}" -> "${scoreStr}"`);
        }
    }

    // Also update letter grade if present
    const letterGradeSpan = finalGradeDiv.querySelector('.letter_grade');
    if (letterGradeSpan && letterGrade) {
        const currentLetter = letterGradeSpan.textContent.trim();
        if (currentLetter !== letterGrade) {
            letterGradeSpan.textContent = letterGrade;
            logger.trace(`Updated sidebar letter grade: "${currentLetter}" -> "${letterGrade}"`);
        }
    }

    logger.debug(`Sidebar grade updated to: ${scoreStr} (${letterGrade})`);
}




/**
 * Apply all customizations to the teacher student grades page
 * Retries if DOM elements are not yet available
 * @param {Object} gradeData - Grade data object
 * @param {number} retryCount - Current retry attempt
 * @returns {boolean} True if customizations were applied
 */
function applyCustomizations(gradeData, retryCount = 0) {
    if (processed) return true;

    const MAX_RETRIES = 10;
    const RETRY_DELAY = 200; // ms

    // Check if required elements exist - use same selector as updateFinalGradeRow
    const hasFinalGradeRow = document.querySelector("tr.student_assignment.hard_coded.final_grade") !== null;
    const hasSidebar = (document.querySelector('#right-side-wrapper') || document.querySelector('#right-side')) !== null;

    if (!hasFinalGradeRow || !hasSidebar) {
        if (retryCount < MAX_RETRIES) {
            logger.trace(`DOM not ready (retry ${retryCount + 1}/${MAX_RETRIES}), waiting...`);
            setTimeout(() => applyCustomizations(gradeData, retryCount + 1), RETRY_DELAY);
            return false;
        } else {
            logger.warn('DOM elements not found after max retries');
            return false;
        }
    }

    logger.trace(`Applying customizations with gradeData: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}`);

    // Update final grade row and sidebar
    updateFinalGradeRow(gradeData);
    updateSidebarGrade(gradeData);

    processed = true;
    logger.debug('Teacher student grade customizations applied successfully');
    return true;
}

/**
 * Start cleanup observers for continuous fraction removal and grade updates
 * @param {Object|null} gradeData - Grade data for re-applying customizations
 */
function startCleanupObservers(gradeData = null) {
    logger.debug('Starting cleanup observers for teacher student grade page');

    // Run initial cleanup immediately
    removeFractionScores().catch(err => {
        logger.warn('Error in initial removeFractionScores:', err);
    });

    // Create debounced version for fraction removal
    const debouncedClean = debounce(() => {
        removeFractionScores().catch(err => {
            logger.warn('Error in removeFractionScores:', err);
        });
    }, 100);

    // Create debounced version for grade updates (if we have grade data)
    let debouncedGradeUpdate = null;
    if (gradeData) {
        debouncedGradeUpdate = debounce(() => {
            // Re-apply grade customizations if Canvas re-renders the elements
            updateFinalGradeRow(gradeData);
            updateSidebarGrade(gradeData);
        }, 150);
    }

    // Start observer on next tick
    setTimeout(() => {
        createPersistentObserver(() => {
            debouncedClean();
            if (debouncedGradeUpdate) {
                debouncedGradeUpdate();
            }
        }, {
            config: OBSERVER_CONFIGS.CHILD_LIST,
            target: document.body,
            name: 'TeacherStudentGradeCleanupObserver'
        });
    }, 0);
}

/**
 * Initialize teacher student grade page customizations
 * Main entry point called from customGradebookInit.js
 */
export async function initTeacherStudentGradeCustomizer() {
    logger.debug('[Teacher] Initializing teacher student grade page customizer');

    // Fetch grade data and apply customizations
    const courseId = getCourseId();
    const studentId = getStudentIdFromUrl();

    if (!courseId || !studentId) {
        logger.trace('[Teacher] Cannot get course ID or student ID from URL');
        startCleanupObservers(); // Still run fraction cleanup
        return;
    }

    logger.debug(`[Teacher] Teacher viewing student ${studentId} grades for course ${courseId}`);

    // Get course name from DOM
    const courseName = document.querySelector('.course-title, h1, #breadcrumbs li:last-child')?.textContent?.trim() || 'Course';

    // Check if course is standards-based via snapshot
    const apiClient = new CanvasApiClient();
    let snapshot = getCourseSnapshot(courseId);

    if (!snapshot) {
        logger.debug(`[Teacher] No snapshot for course ${courseId}, populating snapshot...`);
        snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
    }

    if (!snapshot) {
        logger.warn(`[Teacher] Failed to create snapshot for course ${courseId}`);
        startCleanupObservers(); // Still run fraction cleanup for any course
        return;
    }

    logger.debug(`[Teacher] Course ${courseId} snapshot: model=${snapshot.model}, reason=${snapshot.modelReason}`);

    if (snapshot.model !== 'standards') {
        logger.debug(`[Teacher] Skipping teacher student grade customization - course is ${snapshot.model}`);
        startCleanupObservers(); // Still run fraction cleanup for any course
        return;
    }

    // Fetch student's AVG assignment score
    logger.debug(`[Teacher] Fetching AVG assignment score for student ${studentId}...`);
    const gradeData = await fetchStudentAvgScore(courseId, studentId, apiClient);
    if (!gradeData) {
        logger.warn(`[Teacher] ❌ No AVG assignment score found for student ${studentId} - skipping grade customizations`);
        startCleanupObservers(); // Still run fraction cleanup
        return;
    }

    logger.debug(`[Teacher] ✅ Applying teacher student grade customizations for student ${studentId}: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}`);

    // Apply customizations with retry logic
    applyCustomizations(gradeData);

    // Start cleanup observers with grade data for continuous updates
    startCleanupObservers(gradeData);
}