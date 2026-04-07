// src/outcomesDashboard/outcomesDashboardCreation.js
/**
 * Outcomes Dashboard Creation & Button Injection
 *
 * Injects a button in the course settings sidebar that creates
 * an unpublished Outcomes Dashboard page.
 *
 * Teachers navigate to the page manually via: Pages → Outcomes Dashboard
 */

import { logger } from '../utils/logger.js';
import { makeButton } from '../ui/buttons.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { createPage, getPage } from '../services/pageService.js';
import { isCourseSettingsPage } from '../utils/pageDetection.js';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const INJECTION_MARKER = 'cg-teacher-mastery-dashboard-creator';
const OUTCOMES_PAGE_TITLE = 'Teacher Mastery Dashboard';
const OUTCOMES_PAGE_URL = 'teacher-mastery-dashboard';
const OUTCOMES_PAGE_BODY = '<div id="teacher-mastery-dashboard-root"></div>';

// ═══════════════════════════════════════════════════════════════════════
// CREATE OUTCOMES DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create outcomes dashboard page
 *
 * Creates a single unpublished page that teachers navigate to manually.
 * No front page button, no course settings changes.
 *
 * @param {HTMLButtonElement} button - Button element to update state
 */
export async function createOutcomesDashboard(button) {
    const courseId = getCourseId();
    if (!courseId) {
        alert('Could not determine course ID');
        return;
    }

    const apiClient = new CanvasApiClient();

    try {
        // Disable button during operation
        button.disabled = true;
        button.textContent = 'Creating...';
        logger.info('[OutcomesDashboard] Creating outcomes dashboard page');

        // Check if page already exists
        const existingPage = await getPage(courseId, OUTCOMES_PAGE_URL, apiClient);

        if (existingPage) {
            logger.info('[OutcomesDashboard] Page already exists');
            button.textContent = '✅ Already Exists';
            button.style.backgroundColor = '#28a745';

            alert(`Outcomes Dashboard page already exists!\n\nNavigate to: Pages → ${OUTCOMES_PAGE_TITLE}`);

            // Reset button after 3 seconds
            setTimeout(() => {
                button.disabled = false;
                button.textContent = `📊 Create ${OUTCOMES_PAGE_TITLE}`;
                button.style.backgroundColor = '';
            }, 3000);

            return;
        }

        // Create outcomes dashboard page (UNPUBLISHED)
        const createdPage = await createPage(courseId, {
            title: OUTCOMES_PAGE_TITLE,
            url: OUTCOMES_PAGE_URL,
            body: OUTCOMES_PAGE_BODY,
            published: false  // UNPUBLISHED - only teachers can access
        }, apiClient);

        logger.info(`[OutcomesDashboard] Page created at: ${createdPage.url}`);

        // Success!
        button.textContent = '✅ Page Created!';
        button.style.backgroundColor = '#28a745';

        alert(`Success! Outcomes Dashboard page created.\n\nNavigate to: Pages → ${OUTCOMES_PAGE_TITLE}\n\nNote: Page is UNPUBLISHED (only visible to teachers)`);

        // Reset button after 3 seconds
        setTimeout(() => {
            button.disabled = false;
            button.textContent = `📊 Create ${OUTCOMES_PAGE_TITLE}`;
            button.style.backgroundColor = '';
        }, 3000);

    } catch (error) {
        logger.error('[OutcomesDashboard] Error creating page:', error);
        alert(`Error creating Outcomes Dashboard page: ${error.message}`);

        // Reset button
        button.disabled = false;
        button.textContent = `📊 Create ${OUTCOMES_PAGE_TITLE}`;
        button.style.backgroundColor = '';
    }
}

// ═══════════════════════════════════════════════════════════════════════
// BUTTON INJECTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Inject button in Course Settings sidebar
 *
 * Waits for the sidebar to be ready, then injects a button that creates
 * the unpublished Outcomes Dashboard page.
 */
export function injectOutcomesDashboardButton() {
    if (!isCourseSettingsPage()) {
        logger.trace('[OutcomesDashboard] Not on course settings page, skipping injection');
        return;
    }

    logger.debug('[OutcomesDashboard] On course settings page, waiting for sidebar...');

    waitForSettingsSidebar((sidebar) => {
        // Check if already injected
        if (document.querySelector(`.${INJECTION_MARKER}`)) {
            logger.debug('[OutcomesDashboard] Button already injected, skipping');
            return;
        }

        logger.debug('[OutcomesDashboard] Injecting button into settings sidebar');

        // Create button container
        const container = document.createElement('div');
        container.className = INJECTION_MARKER;
        container.style.cssText = 'margin: 12px 0; padding: 12px; background: #f5f5f5; border-radius: 4px;';

        // Create button using existing makeButton utility
        const button = makeButton({
            label: `📊 Create ${OUTCOMES_PAGE_TITLE}`,
            id: 'create-outcomes-dashboard-button',
            onClick: () => createOutcomesDashboard(button),
            type: 'primary'
        });

        container.appendChild(button);
        sidebar.appendChild(container);

        logger.info('[OutcomesDashboard] Button injected successfully');
    });
}

/**
 * Wait for Course Settings sidebar to be ready
 * @param {Function} callback - Callback to execute when sidebar is found
 */
function waitForSettingsSidebar(callback) {
    let attempts = 0;
    const intervalId = setInterval(() => {
        const sidebar = document.querySelector('aside[role="region"]');
        const documentReady = document.readyState === 'complete';

        if (sidebar && documentReady) {
            clearInterval(intervalId);
            logger.debug('[OutcomesDashboard] Settings sidebar found');
            callback(sidebar);
        } else if (attempts++ > 33) {
            clearInterval(intervalId);
            logger.warn('[OutcomesDashboard] Settings sidebar not found after 10 seconds');
        }
    }, 300);
}