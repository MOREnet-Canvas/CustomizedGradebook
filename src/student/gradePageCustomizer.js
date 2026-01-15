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
import { extractCurrentScoreFromPage } from './gradeExtractor.js';
import { logger } from '../utils/logger.js';
import { inheritFontStylesFrom } from '../utils/dom.js';

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
 * @param {string} score - The mastery score to display (e.g., "2.74")
 */
function replaceRightSidebar(score) {
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
            if (span) span.textContent = score;
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
                ${AVG_OUTCOME_NAME}: <span class="mastery-grade">${score}</span>
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

    logger.debug(`Sidebar replaced with ${AVG_OUTCOME_NAME}: ${score}`);
}

/**
 * Apply all customizations to the grades page
 *
 * @param {string} score - The mastery score to display
 * @returns {boolean} True if customizations were applied, false if already processed
 */
function applyCustomizations(score) {
    if (processed) return false;

    // 1) Remove Assignments tab (if configured)
    if (REMOVE_ASSIGNMENT_TAB) {
        ensureAssignmentsTabRemoved();
        goToLearningMasteryTab();
    }

    // 2) Replace the right sidebar with mastery score display
    replaceRightSidebar(score);

    processed = true;
    return true;
}

/**
 * Main execution function
 * Attempts to extract the score and apply customizations
 *
 * @returns {boolean} True if customizations were applied, false if score not found
 */
function runOnce() {
    if (processed) return true;

    const score = extractCurrentScoreFromPage();
    if (score === null) {
        // If score not found, do nothing
        return false;
    }

    return applyCustomizations(score);
}

/**
 * Initialize grade page customizations
 * Sets up observers to handle lazy-loaded content
 */
export function initGradePageCustomizer() {
    logger.debug('Initializing grade page customizer');

    // Try immediately
    let didRun = runOnce();

    // If content is lazy-loaded, observe and retry when score appears
    if (!didRun) {
        const obs = new MutationObserver(() => {
            if (runOnce()) {
                obs.disconnect();
                logger.debug('Student grade customization applied after DOM updates');
            }
        });

        obs.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });

        // Safety stop after 30s
        setTimeout(() => {
            obs.disconnect();
            logger.trace('Student grade customization observer disconnected (timeout)');
        }, 30000);
    }
}

