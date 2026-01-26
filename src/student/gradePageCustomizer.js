// src/student/gradePageCustomizer.js
/**
 * Grade Page Customizer Module
 * 
 * Customizes the student grades page to emphasize standards-based grading:
 * - Optionally removes the Assignments tab
 * - Switches to the Learning Mastery tab by default
 * - Replaces the right sidebar with a clean mastery score display
 * 
 * This module only runs on student grades pages when ENABLE_STUDENT_GRADE_CUSTOMIZATION is true.
 */

import { AVG_OUTCOME_NAME, REMOVE_ASSIGNMENT_TAB } from '../config.js';
import { logger } from '../utils/logger.js';
import { inheritFontStylesFrom } from '../utils/dom.js';
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
 * Replace the right sidebar with a clean mastery score display
 *
 * @param {Object} gradeData - Grade data object
 * @param {string} gradeData.score - The mastery score to display (e.g., "2.74")
 * @param {string|null} gradeData.letterGrade - The letter grade (e.g., "Target")
 */
function replaceRightSidebar(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);

    const rightSide = getRightSideElement();

    if (!rightSide) {
        logger.trace('Right sidebar not found; deferring...');
        return;
    }

    if (rightSide.dataset.processed) {
        // Already processed, just update the score
        const masteryAside = document.getElementById('mastery-right-side');
        if (masteryAside) {
            const span = masteryAside.querySelector('.mastery-grade');
            if (span) span.textContent = displayValue;
        }
        return;
    }

    // Hide original sidebar
    rightSide.style.display = 'none';
    rightSide.dataset.processed = 'true';

    // Create new mastery sidebar
    const masteryAside = document.createElement('aside');
    masteryAside.id = 'mastery-right-side';
    masteryAside.setAttribute('role', 'complementary');
    masteryAside.style.cssText = `
        color: inherit; font-weight: inherit; font-size: inherit; font-family: inherit;
        margin: inherit; padding: inherit; background: inherit; border: inherit;
    `;

    masteryAside.innerHTML = `
        <div id="student-grades-right-content">
            <div class="student_assignment mastery_total">
                ${AVG_OUTCOME_NAME}: <span class="mastery-grade">${displayValue}</span>
            </div>
        </div>
    `;

    // Make it typographically consistent with Canvas
    const headerEl = masteryAside.querySelector('.mastery_total');
    if (headerEl) {
        const ok = inheritFontStylesFrom('h1.screenreader-only, h1, .ic-app-nav-toggle-and-crumbs h1', headerEl);
        if (!ok) {
            headerEl.style.fontSize = '1.5em';
            headerEl.style.fontWeight = 'bold';
        }
    }

    // Insert after the original sidebar
    rightSide.parentNode.insertBefore(masteryAside, rightSide.nextSibling);

    logger.debug(`Sidebar replaced with ${AVG_OUTCOME_NAME}: ${displayValue}`);
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

    // 2) Replace the right sidebar with mastery score display
    replaceRightSidebar(gradeData);

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

    // Extract grade data from snapshot
    const gradeData = {
        score: snapshot.score,
        letterGrade: snapshot.letterGrade
    };

    logger.trace(`Using grade data from snapshot: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}`);

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