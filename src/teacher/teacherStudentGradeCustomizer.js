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
 * @param {Object} gradeData - Grade data object
 */
function updateFinalGradeRow(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);

    document.querySelectorAll("tr.student_assignment.hard_coded.final_grade").forEach(row => {
        const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
        const possibleEl = row.querySelector(".details .possible.points_possible");

        if (gradeEl) {
            if (gradeEl.textContent !== displayValue) {
                gradeEl.textContent = displayValue;
                gradeEl.dataset.normalized = 'true';
            }
        }

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
 * @param {Object} gradeData - Grade data object
 */
function updateSidebarGrade(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);

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
    if (gradeSpan && gradeSpan.textContent !== displayValue) {
        gradeSpan.textContent = displayValue;
        logger.debug(`Sidebar grade updated to: ${displayValue}`);
    }
}




/**
 * Apply all customizations to the teacher student grades page
 * @param {Object} gradeData - Grade data object
 */
function applyCustomizations(gradeData) {
    if (processed) return;

    // Update final grade row and sidebar
    updateFinalGradeRow(gradeData);
    updateSidebarGrade(gradeData);

    processed = true;
}

/**
 * Main execution function
 * Fetches student's AVG assignment score and applies customizations
 * @returns {Promise<boolean>} True if customizations were applied
 */
async function runOnce() {
    if (processed) return true;

    const courseId = getCourseId();
    const studentId = getStudentIdFromUrl();

    if (!courseId || !studentId) {
        logger.trace('Cannot get course ID or student ID from URL');
        return false;
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
        return false;
    }

    // Fetch student's AVG assignment score
    const gradeData = await fetchStudentAvgScore(courseId, studentId, apiClient);
    if (!gradeData) {
        logger.trace('No AVG assignment score found for student');
        return false;
    }

    logger.debug(`Applying teacher student grade customizations for student ${studentId}`);
    applyCustomizations(gradeData);

    return true;
}

/**
 * Start cleanup observers for continuous fraction removal
 */
function startCleanupObservers() {
    logger.debug('Starting cleanup observers for teacher student grade page');

    // Run initial cleanup immediately
    removeFractionScores().catch(err => {
        logger.warn('Error in initial removeFractionScores:', err);
    });

    // Create debounced version
    const debouncedClean = debounce(() => {
        removeFractionScores().catch(err => {
            logger.warn('Error in removeFractionScores:', err);
        });
    }, 100);

    // Start observer on next tick
    setTimeout(() => {
        createPersistentObserver(() => {
            debouncedClean();
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

    // Try immediately
    const success = await runOnce();

    // Start cleanup observers for fraction removal
    startCleanupObservers();

    if (!success) {
        logger.trace('Teacher student grade customization not applied (not standards-based or no AVG score)');
    }
}