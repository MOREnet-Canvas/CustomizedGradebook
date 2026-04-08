// src/MasteryOutlook/MasteryOutlookCreation.js
/**
 * Mastery Outlook Creation & Button Injection
 *
 * Injects a button in the course settings sidebar that creates
 * an unpublished Mastery Outlook page.
 *
 * Teachers navigate to the page manually via: Pages → Mastery Outlook
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

const INJECTION_MARKER = 'cg-mastery-outlook-creator';
const OUTLOOK_PAGE_TITLE = 'Mastery Outlook';
const OUTLOOK_PAGE_URL = 'mastery-outlook';
const OUTLOOK_PAGE_BODY = '<div id="teacher-mastery-dashboard-root"></div>';

// ═══════════════════════════════════════════════════════════════════════
// CREATE Mastery Outlook PAGE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create Mastery Outlook page
 *
 * Creates a single unpublished page that teachers navigate to manually.
 * No front page button, no course settings changes.
 *
 * @param {HTMLButtonElement} button - Button element to update state
 */
export async function createMasteryOutlook(button) {
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
        logger.info('[MasteryOutlook] Creating Mastery Outlook page');

        // Check if page already exists
        const existingPage = await getPage(courseId, OUTLOOK_PAGE_URL, apiClient);

        if (existingPage) {
            logger.info('[MasteryOutlook] Page already exists');
            button.textContent = '✅ Already Exists';
            button.style.backgroundColor = '#28a745';

            alert(`Mastery Outlook page already exists!\n\nNavigate to: Pages → ${OUTLOOK_PAGE_TITLE}`);

            // Reset button after 3 seconds
            setTimeout(() => {
                button.disabled = false;
                button.textContent = `📊 Create ${OUTLOOK_PAGE_TITLE}`;
                button.style.backgroundColor = '';
            }, 3000);

            return;
        }

        // Create Mastery Outlook page (UNPUBLISHED)
        const createdPage = await createPage(courseId, {
            title: OUTLOOK_PAGE_TITLE,
            url: OUTLOOK_PAGE_URL,
            body: OUTLOOK_PAGE_BODY,
            published: false  // UNPUBLISHED - only teachers can access
        }, apiClient);

        logger.info(`[MasteryOutlook] Page created at: ${createdPage.url}`);

        // Success!
        button.textContent = '✅ Page Created!';
        button.style.backgroundColor = '#28a745';

        alert(`Success! Mastery Outlook page created.\n\nNavigate to: Pages → ${OUTLOOK_PAGE_TITLE}\n\nNote: Page is UNPUBLISHED (only visible to teachers)`);

        // Reset button after 3 seconds
        setTimeout(() => {
            button.disabled = false;
            button.textContent = `📊 Create ${OUTLOOK_PAGE_TITLE}`;
            button.style.backgroundColor = '';
        }, 3000);

    } catch (error) {
        logger.error('[MasteryOutlook] Error creating page:', error);
        alert(`Error creating Mastery Outlook page: ${error.message}`);

        // Reset button
        button.disabled = false;
        button.textContent = `📊 Create ${OUTLOOK_PAGE_TITLE}`;
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
 * the unpublished Mastery Outlook page.
 */
export function injectMasteryOutlookButton() {
    if (!isCourseSettingsPage()) {
        logger.trace('[MasteryOutlook] Not on course settings page, skipping injection');
        return;
    }

    logger.debug('[MasteryOutlook] On course settings page, waiting for sidebar...');

    waitForSettingsSidebar((sidebar) => {
        // Check if already injected
        if (document.querySelector(`.${INJECTION_MARKER}`)) {
            logger.debug('[MasteryOutlook] Button already injected, skipping');
            return;
        }

        logger.debug('[MasteryOutlook] Injecting button into settings sidebar');

        // Create button container
        const container = document.createElement('div');
        container.className = INJECTION_MARKER;
        container.style.cssText = 'margin: 12px 0; padding: 12px; background: #f5f5f5; border-radius: 4px;';

        // Create button using existing makeButton utility
        const button = makeButton({
            label: `📊 Create ${OUTLOOK_PAGE_TITLE}`,
            id: 'create-outcomes-dashboard-button',
            onClick: () => createMasteryOutlook(button),
            type: 'primary'
        });

        container.appendChild(button);
        sidebar.appendChild(container);

        logger.info('[MasteryOutlook] Button injected successfully');
    });
}

/**
 * Wait for Course Settings sidebar to be ready
 * @param {Function} callback - Callback to execute when sidebar is found
 */
function waitForSettingsSidebar(callback) {
    let attempts = 0;
    const maxAttempts = 33; // ~10 seconds
    const intervalMs = 300;

    const intervalId = setInterval(() => {
        const onSettingsPage = isCourseSettingsPage();
        const documentReady = document.readyState === 'complete';
        const sidebar = document.querySelector('#right-side') ||
                        document.querySelector('#right-side-wrapper') ||
                        document.querySelector('aside[id="right-side"]');

        if (onSettingsPage && documentReady && sidebar) {
            clearInterval(intervalId);
            logger.debug('[MasteryOutlook] Settings sidebar found');
            callback(sidebar);
        } else if (attempts++ >= maxAttempts) {
            clearInterval(intervalId);
            logger.warn('[MasteryOutlook] Settings sidebar not found after 10 seconds');
        }
    }, intervalMs);
}