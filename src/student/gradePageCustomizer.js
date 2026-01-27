// src/student/gradePageCustomizer.js
/**
 * Grade Page Customizer Module
 *
 * Customizes the student grades page to emphasize standards-based grading:
 * - Optionally removes the Assignments tab
 * - Switches to the Learning Mastery tab by default
 * - Updates the grade display in the right sidebar while preserving other content
 *
 * This module only runs on student grades pages when ENABLE_STUDENT_GRADE_CUSTOMIZATION is true.
 */

import { REMOVE_ASSIGNMENT_TAB } from '../config.js';
import { logger } from '../utils/logger.js';
import { createConditionalObserver, OBSERVER_CONFIGS } from '../utils/observerHelpers.js';
import { formatGradeDisplay } from '../utils/gradeFormatting.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import {
    getCourseSnapshot,
    refreshCourseSnapshot,
    shouldRefreshGrade,
    PAGE_CONTEXT
} from '../services/courseSnapshotService.js';

/**
 * Track if customizations have been applied (prevent double-runs)
 */
let processed = false;

/**
 * Get the Assignments tab list item element
 * @returns {HTMLElement|null} The Assignments tab <li> element or null
 */
function getAssignmentsTabLI() {
    return document.querySelector('li[aria-controls="assignments"]');
}

/**
 * Get the Learning Mastery tab link element
 * @returns {HTMLElement|null} The Learning Mastery tab <a> element or null
 */
function getLearningMasteryLink() {
    return document.querySelector('li[aria-controls="outcomes"] a[href="#outcomes"]');
}

/**
 * Get the right sidebar element
 * @returns {HTMLElement|null} The right sidebar element or null
 */
function getRightSideElement() {
    return document.querySelector('#right-side-wrapper') || document.querySelector('#right-side');
}

/**
 * Remove the Assignments tab from the grades page
 * Retries multiple times to handle lazy DOM loading
 * 
 * @param {number} retries - Number of retry attempts remaining
 * @param {number} everyMs - Milliseconds between retry attempts
 * @returns {boolean} True if tab was removed, false otherwise
 */
function ensureAssignmentsTabRemoved(retries = 20, everyMs = 250) {
    const li = getAssignmentsTabLI();
    if (li) {
        li.remove();
        logger.debug('Assignments tab removed');
        return true;
    }
    
    if (retries > 0) {
        setTimeout(() => ensureAssignmentsTabRemoved(retries - 1, everyMs), everyMs);
    } else {
        logger.trace('Assignments tab not found after retries');
    }
    
    return false;
}

/**
 * Switch to the Learning Mastery tab
 * Updates URL hash and triggers tab click
 */
function goToLearningMasteryTab() {
    // Canvas wants #tab-outcomes in URL; UI tab uses #outcomes
    if (location.hash !== '#tab-outcomes') {
        history.replaceState(null, '', location.pathname + location.search + '#tab-outcomes');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    
    const link = getLearningMasteryLink();
    if (link) {
        link.click();
    } else {
        // Tabs mount late sometimes, retry
        setTimeout(goToLearningMasteryTab, 300);
    }
}

/**
 * Update the grade display in the existing right sidebar
 * Preserves all other sidebar content (announcements, to-do items, etc.)
 *
 * @param {Object} gradeData - Grade data object
 * @param {string} gradeData.score - The mastery score to display (e.g., "2.74")
 * @param {string|null} gradeData.letterGrade - The letter grade (e.g., "Target")
 */
function replaceRightSidebar(gradeData) {
    const { score, letterGrade } = gradeData;

    const rightSide = getRightSideElement();

    if (!rightSide) {
        logger.trace('Right sidebar not found; deferring...');
        return;
    }

    // Find the final grade display element within the sidebar
    const finalGradeDiv = rightSide.querySelector('.student_assignment.final_grade');

    if (!finalGradeDiv) {
        logger.trace('Final grade element (.student_assignment.final_grade) not found in sidebar; deferring...');
        return;
    }

    if (rightSide.dataset.processed) {
        // Already processed, just update the score
        const gradeSpan = finalGradeDiv.querySelector('.grade');
        const letterGradeSpan = finalGradeDiv.querySelector('.letter_grade');

        if (gradeSpan) {
            gradeSpan.textContent = typeof score === 'number' ? score.toFixed(2) : String(score);
        }
        if (letterGradeSpan && letterGrade) {
            letterGradeSpan.textContent = letterGrade;
        }

        logger.trace('Grade display updated in existing sidebar');
        return;
    }

    // First-time processing: update the grade elements
    const gradeSpan = finalGradeDiv.querySelector('.grade');
    const letterGradeSpan = finalGradeDiv.querySelector('.letter_grade');

    if (gradeSpan) {
        gradeSpan.textContent = typeof score === 'number' ? score.toFixed(2) : String(score);
    }
    if (letterGradeSpan && letterGrade) {
        letterGradeSpan.textContent = letterGrade;
    }

    // Mark as processed
    rightSide.dataset.processed = 'true';

    const displayValue = formatGradeDisplay(score, letterGrade);
    logger.debug(`Sidebar grade updated to: ${displayValue}`);
}

/**
 * Update the final grade row in the grades table
 * Uses the same formatting logic as the sidebar for consistency
 *
 * @param {Object} gradeData - Grade data object
 * @param {string} gradeData.score - The mastery score to display
 * @param {string|null} gradeData.letterGrade - The letter grade
 */
function updateBottomGradeRow(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);

    document.querySelectorAll("tr.student_assignment.hard_coded.final_grade").forEach(row => {
        const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
        const possibleEl = row.querySelector(".details .possible.points_possible");

        if (gradeEl) {
            // Only update if value has changed (prevents flashing and unnecessary DOM updates)
            if (gradeEl.textContent !== displayValue) {
                gradeEl.textContent = displayValue;
                gradeEl.dataset.normalized = 'true';
            }
        }

        if (possibleEl) {
            // Canvas shows "102.50 / 152.00". We don't want that.
            const txt = possibleEl.textContent.trim();
            if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
                possibleEl.textContent = "";
            }
        }
    });

    logger.debug(`Bottom grade row updated to: ${displayValue}`);
}

/**
 * Apply all customizations to the grades page
 *
 * @param {Object} gradeData - Grade data object
 * @param {string} gradeData.score - The mastery score to display
 * @param {string|null} gradeData.letterGrade - The letter grade
 * @returns {boolean} True if customizations were applied, false if already processed
 */
function applyCustomizations(gradeData) {
    if (processed) return false;

    // 1) Remove Assignments tab (if configured)
    if (REMOVE_ASSIGNMENT_TAB) {
        ensureAssignmentsTabRemoved();
        goToLearningMasteryTab();
    }

    // 2) Update the grade display in the right sidebar
    replaceRightSidebar(gradeData);

    // 3) Update the final grade row in the grades table
    updateBottomGradeRow(gradeData);

    processed = true;
    return true;
}

/**
 * Main execution function
 * Attempts to fetch grade data from Course Snapshot Service and apply customizations
 *
 * @returns {Promise<boolean>} True if customizations were applied, false if score not found
 */
async function runOnce() {
    if (processed) return true;

    // Get course ID from URL
    const courseId = getCourseId();
    if (!courseId) {
        logger.warn('Cannot get course ID from URL');
        return false;
    }

    // Get course name from DOM (try multiple selectors)
    const courseName = document.querySelector('.course-title, h1, #breadcrumbs li:last-child')?.textContent?.trim() || 'Course';

    // Check snapshot cache first
    let snapshot = getCourseSnapshot(courseId);

    // Populate/refresh if needed
    if (!snapshot || shouldRefreshGrade(courseId, PAGE_CONTEXT.COURSE_GRADES)) {
        logger.trace(`Fetching grade data from API for course ${courseId}...`);
        const apiClient = new CanvasApiClient();
        snapshot = await refreshCourseSnapshot(courseId, courseName, apiClient, PAGE_CONTEXT.COURSE_GRADES);
    }

    if (!snapshot) {
        logger.trace('No grade data available from snapshot');
        return false;
    }

    // Only apply customizations for standards-based courses
    if (snapshot.model !== 'standards') {
        logger.debug(`Skipping grade page customization - course is ${snapshot.model} (reason: ${snapshot.modelReason})`);
        return false;
    }

    // Extract display-ready grade data from snapshot
    const gradeData = {
        score: snapshot.displayScore,
        letterGrade: snapshot.displayLetterGrade
    };

    logger.trace(`Using display grade data from snapshot: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}, type=${snapshot.displayType}`);

    return applyCustomizations(gradeData);
}

/**
 * Initialize grade page customizations
 * Sets up observers to handle lazy-loaded content
 */
export async function initGradePageCustomizer() {
    logger.debug('Initializing grade page customizer');

    // Try immediately
    let didRun = await runOnce();

    // If content is lazy-loaded, observe and retry when score appears
    if (!didRun) {
        createConditionalObserver(async () => {
            const success = await runOnce();
            if (success) {
                logger.debug('Student grade customization applied after DOM updates');
            }
            return success; // Disconnect when successful
        }, {
            timeout: 30000,
            config: OBSERVER_CONFIGS.CHILD_LIST_AND_ATTRIBUTES,
            target: document.body,
            name: 'GradePageCustomizer'
        });
    }
}