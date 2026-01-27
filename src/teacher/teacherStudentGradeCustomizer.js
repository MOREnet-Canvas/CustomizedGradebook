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
import { getCourseSnapshot, refreshCourseSnapshot, PAGE_CONTEXT } from '../services/courseSnapshotService.js';
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
    try {
        // Get AVG assignment ID from snapshot
        const snapshot = getCourseSnapshot(courseId);
        if (!snapshot) {
            logger.trace(`No snapshot available for course ${courseId}`);
            return null;
        }

        // Search for AVG assignment
        const assignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments`,
            { search_term: 'Current Score' },
            'fetchAvgAssignment'
        );

        const avgAssignment = assignments.find(a => a.name === 'Current Score');
        if (!avgAssignment) {
            logger.trace(`AVG assignment not found in course ${courseId}`);
            return null;
        }

        // Fetch student's submission for AVG assignment
        const submission = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/${studentId}`,
            {},
            'fetchStudentSubmission'
        );

        const score = submission?.score;
        if (score === null || score === undefined) {
            logger.trace(`No score found for student ${studentId} in AVG assignment`);
            return null;
        }

        // Get letter grade from enrollment
        const enrollment = await apiClient.get(
            `/api/v1/courses/${courseId}/enrollments`,
            { user_id: studentId },
            'fetchStudentEnrollment'
        );

        const letterGrade = enrollment?.[0]?.grades?.current_grade || null;

        logger.debug(`Student ${studentId} AVG score: ${score}, letter grade: ${letterGrade}`);
        return { score, letterGrade };

    } catch (error) {
        logger.warn(`Failed to fetch student AVG score:`, error.message);
        return null;
    }
}

/**
 * Update the final grade row in the grades table
 * Handles both separate fraction elements and inline fraction text
 * @param {Object} gradeData - Grade data object
 */
function updateFinalGradeRow(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);

    logger.trace(`updateFinalGradeRow called with score=${score}, letterGrade=${letterGrade}, displayValue="${displayValue}"`);

    // Try multiple selectors to find the final grade row
    const finalGradeRows = [
        ...document.querySelectorAll("tr.student_assignment.hard_coded.final_grade"),
        ...document.querySelectorAll("tr.student_assignment.final_grade"),
        ...document.querySelectorAll("tr.final_grade")
    ];

    if (finalGradeRows.length === 0) {
        logger.trace('Final grade row not found in table');
        return;
    }

    logger.trace(`Found ${finalGradeRows.length} final grade row(s)`);

    finalGradeRows.forEach((row, index) => {
        // Find grade element - try multiple selectors
        const gradeEl = row.querySelector(".assignment_score .tooltip .grade") ||
                       row.querySelector(".assignment_score .grade") ||
                       row.querySelector(".tooltip .grade") ||
                       row.querySelector(".grade");

        if (gradeEl) {
            const currentText = gradeEl.textContent.trim();

            // Check if there's a separate letter grade element (like sidebar)
            const letterGradeEl = row.querySelector(".letter_grade") ||
                                 row.querySelector(".letter-grade");

            if (letterGradeEl) {
                // Separate elements for score and letter grade (like sidebar)
                const scoreStr = typeof score === 'number' ? score.toFixed(2) : String(score);

                if (currentText.includes('/') || currentText !== scoreStr) {
                    gradeEl.textContent = scoreStr;
                    gradeEl.dataset.normalized = 'true';
                    logger.trace(`Updated final grade row ${index} score: "${currentText}" -> "${scoreStr}"`);
                }

                if (letterGrade && letterGradeEl.textContent.trim() !== letterGrade) {
                    letterGradeEl.textContent = letterGrade;
                    logger.trace(`Updated final grade row ${index} letter grade: "${letterGradeEl.textContent}" -> "${letterGrade}"`);
                }
            } else {
                // Single element for combined display (score + letter grade)
                if (currentText.includes('/') || currentText !== displayValue) {
                    gradeEl.textContent = displayValue;
                    gradeEl.dataset.normalized = 'true';
                    logger.trace(`Updated final grade row ${index}: "${currentText}" -> "${displayValue}"`);
                } else {
                    logger.trace(`Final grade row ${index} already has correct value: "${currentText}"`);
                }
            }
        } else {
            logger.trace(`Final grade row ${index}: grade element not found`);
        }

        // Also remove any separate fraction elements
        const possibleEl = row.querySelector(".details .possible.points_possible");
        if (possibleEl) {
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

    // Check if required elements exist
    const hasFinalGradeRow = document.querySelector("tr.student_assignment.final_grade") !== null;
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
    logger.debug('Initializing teacher student grade page customizer');

    // Fetch grade data and apply customizations
    const courseId = getCourseId();
    const studentId = getStudentIdFromUrl();

    if (!courseId || !studentId) {
        logger.trace('Cannot get course ID or student ID from URL');
        startCleanupObservers(); // Still run fraction cleanup
        return;
    }

    // Get course name from DOM
    const courseName = document.querySelector('.course-title, h1, #breadcrumbs li:last-child')?.textContent?.trim() || 'Course';

    // Check if course is standards-based via snapshot
    const apiClient = new CanvasApiClient();
    let snapshot = getCourseSnapshot(courseId);

    if (!snapshot) {
        logger.trace(`No snapshot for course ${courseId}, populating...`);
        snapshot = await refreshCourseSnapshot(courseId, courseName, apiClient, PAGE_CONTEXT.COURSE_GRADES);
    }

    if (!snapshot || snapshot.model !== 'standards') {
        logger.debug(`Skipping teacher student grade customization - course is ${snapshot?.model || 'unknown'}`);
        startCleanupObservers(); // Still run fraction cleanup for any course
        return;
    }

    // Fetch student's AVG assignment score
    const gradeData = await fetchStudentAvgScore(courseId, studentId, apiClient);
    if (!gradeData) {
        logger.trace('No AVG assignment score found for student');
        startCleanupObservers(); // Still run fraction cleanup
        return;
    }

    logger.debug(`Applying teacher student grade customizations for student ${studentId}`);

    // Apply customizations with retry logic
    applyCustomizations(gradeData);

    // Start cleanup observers with grade data for continuous updates
    startCleanupObservers(gradeData);
}