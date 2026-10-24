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
import {
    createPage, findMasteryOutlookPage,
    MASTERY_OUTLOOK_PAGE_TITLE, MASTERY_OUTLOOK_PAGE_URL, MASTERY_OUTLOOK_ROOT_ID,
} from '../services/pageService.js';
import { isCourseSettingsPage, waitForSettingsSidebar } from '../utils/pageDetection.js';
import { injectMasteryOutlookLink } from './sidebarLinkInjection.js';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const INJECTION_MARKER = 'cg-mastery-outlook-creator';
export const OUTLOOK_PAGE_TITLE = MASTERY_OUTLOOK_PAGE_TITLE;
export const OUTLOOK_PAGE_URL = MASTERY_OUTLOOK_PAGE_URL;
export const OUTLOOK_ROOT_ID = MASTERY_OUTLOOK_ROOT_ID;
const OUTLOOK_PAGE_BODY = `<div id="${OUTLOOK_ROOT_ID}"></div>`;

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
        // Found by title — the slug may be numbered (mastery-outlook-3) after a reset
        const existingPage = await findMasteryOutlookPage(courseId, apiClient);

        if (existingPage) {
            logger.info('[MasteryOutlook] Page already exists');
            button.textContent = '✅ Already Exists';
            button.style.backgroundColor = '#28a745';

            alert(`Mastery Outlook page already exists!\n\nNavigate to: Pages → ${OUTLOOK_PAGE_TITLE}`);

            // Inject sidebar link (in case it was removed or page loaded without it)
            injectMasteryOutlookLink(courseId, existingPage.url);

            // Reset button after 3 seconds
            setTimeout(() => {
                button.disabled = false;
                button.textContent = `📊 Create ${OUTLOOK_PAGE_TITLE}`;
                button.style.backgroundColor = '';
            }, 3000);

            return;
        }

        // Create Mastery Outlook page (UNPUBLISHED). Canvas picks the slug from the
        // title (mastery-outlook, or mastery-outlook-N if that slug is reserved).
        const createdPage = await createPage(courseId, {
            title: OUTLOOK_PAGE_TITLE,
            body: OUTLOOK_PAGE_BODY,
            published: false  // UNPUBLISHED - only teachers can access
        }, apiClient);

        logger.info(`[MasteryOutlook] Page created at: ${createdPage.url}`);

        // Inject sidebar link immediately
        injectMasteryOutlookLink(courseId, createdPage.url);
        logger.info('[MasteryOutlook] Sidebar link injection triggered');

        // Success!
        button.textContent = '✅ Page Created!';
        button.style.backgroundColor = '#28a745';

        alert(`Success! Mastery Outlook page created.\n\nNavigate to: Pages → ${OUTLOOK_PAGE_TITLE}\n\nNote: Page is UNPUBLISHED (only visible to teachers)\n\nA link has been added to the course navigation sidebar.`);

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
    }, 'MasteryOutlook');
}