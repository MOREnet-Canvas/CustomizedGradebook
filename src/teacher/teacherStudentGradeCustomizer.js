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
import { AVG_ASSIGNMENT_NAME } from '../config.js';
import { scoreToGradeLevel } from '../student/gradeExtractor.js';

/**
 * Track if customizations have been applied (prevent double-runs)
 */
let processed = false;

/**
 * Fetch AVG assignment score for a specific student
 * Uses the same working endpoint pattern as gradeDataService.js:
 * 1. Search for AVG assignment by name
 * 2. Fetch specific student's submission for that assignment
 *
 * @param {string} courseId - Course ID
 * @param {string} studentId - Student ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string|null}|null>} Grade data or null
 */
async function fetchStudentAvgScore(courseId, studentId, apiClient) {
    logger.trace(`[Teacher] fetchStudentAvgScore: courseId=${courseId}, studentId=${studentId}`);

    try {
        logger.trace(`[Teacher] Searching for AVG assignment "${AVG_ASSIGNMENT_NAME}"...`);

        // Step 1: Search for AVG assignment by name (same as gradeDataService.js)
        const assignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
            {},
            'fetchAvgAssignment'
        );

        logger.trace(`[Teacher] Found ${assignments?.length || 0} assignments matching "${AVG_ASSIGNMENT_NAME}"`);

        // Find exact match
        const avgAssignment = assignments?.find(a => a.name === AVG_ASSIGNMENT_NAME);
        if (!avgAssignment) {
            logger.warn(`[Teacher] AVG assignment "${AVG_ASSIGNMENT_NAME}" not found in course ${courseId}`);
            return null;
        }

        logger.trace(`[Teacher] Found AVG assignment: id=${avgAssignment.id}, name="${avgAssignment.name}"`);

        // Step 2: Fetch student's submission for AVG assignment (same as gradeDataService.js)
        logger.trace(`[Teacher] Fetching submission for student ${studentId}, assignment ${avgAssignment.id}...`);
        const submission = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/${studentId}`,
            {},
            'fetchAvgSubmission'
        );

        logger.trace(
            `[Teacher] Submission fetched`,
            {
                courseId,
                studentId,
                assignmentId: avgAssignment.id,
                score: submission?.score,
                grade: submission?.grade,
                workflow_state: submission?.workflow_state
            }
        );

        // Extract score
        const score = submission?.score;
        if (score === null || score === undefined) {
            logger.warn(`[Teacher] No score found in AVG assignment submission for student ${studentId}`);
            return null;
        }

        logger.trace(`[Teacher] Student score found: ${score}`);

        // Extract letter grade from submission (Canvas stores letter grades in grade/entered_grade fields)
        let letterGrade = submission?.grade ?? submission?.entered_grade ?? null;

        // If letter grade is numeric or missing, calculate from score
        if (!letterGrade || !isNaN(parseFloat(letterGrade))) {
            logger.trace(`[Teacher] No valid letter grade from submission API (got: ${letterGrade}), calculating from score...`);
            letterGrade = scoreToGradeLevel(score);

            if (letterGrade) {
                logger.trace(`[Teacher] Calculated letter grade from score ${score}: "${letterGrade}"`);
            }
        } else {
            logger.trace(`[Teacher] Letter grade from submission API: "${letterGrade}"`);
        }

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

    // Check if snapshot already has grade data for this student
    // (snapshot population already fetched the student's AVG assignment submission)
    let gradeData = null;

    if (snapshot.score != null && snapshot.letterGrade != null) {
        // Reuse grade data from snapshot (already fetched during population)
        gradeData = {
            score: snapshot.score,
            letterGrade: snapshot.letterGrade
        };
        logger.debug(`[Teacher] Reusing snapshot grade data for student ${studentId}: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}`);
    } else {
        // Snapshot doesn't have grade data - fetch it using the same working endpoint
        logger.debug(`[Teacher] Snapshot has no grade data, fetching AVG assignment score for student ${studentId}...`);
        gradeData = await fetchStudentAvgScore(courseId, studentId, apiClient);

        if (!gradeData) {
            logger.warn(`[Teacher] ❌ No AVG assignment score found for student ${studentId} - skipping grade customizations`);
            startCleanupObservers(); // Still run fraction cleanup
            return;
        }
    }

    logger.debug(`[Teacher] ✅ Applying teacher student grade customizations for student ${studentId}: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}`);

    // Apply customizations with retry logic
    applyCustomizations(gradeData);

    // Start cleanup observers with grade data for continuous updates
    startCleanupObservers(gradeData);
}