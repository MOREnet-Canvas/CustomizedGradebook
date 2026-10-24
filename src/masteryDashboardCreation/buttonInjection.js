// src/masteryDashboardCreation/buttonInjection.js
/**
 * Mastery Dashboard Creation Button Injection
 * 
 * Injects a button in the course settings sidebar that creates:
 * 1. Mastery Dashboard page with <div id="parent-mastery-root"></div>
 * 2. Button on front page linking to the Mastery Dashboard
 */

import { logger } from '../utils/logger.js';
import { makeButton } from '../ui/buttons.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import {
    getFrontPage, createPage, updatePage, deletePage, setCourseDefaultViewToWiki,
    findMasteryViewPage, findMasteryViewPages, hasMasteryViewRoot,
    MASTERY_VIEW_PAGE_URL, MASTERY_VIEW_ROOT_ID,
} from '../services/pageService.js';
import { handleError } from '../utils/errorHandler.js';
import { waitForSettingsSidebar } from '../utils/pageDetection.js';
import { brandButtonPrimaryBg, brandButtonPrimaryText } from '../ui/brandColors.js';

const INJECTION_MARKER = 'cg-mastery-dashboard-creator';
const MASTERY_PAGE_TITLE = 'Mastery View';
export const MASTERY_PAGE_URL = MASTERY_VIEW_PAGE_URL;
const MASTERY_PAGE_BODY = `<div id="${MASTERY_VIEW_ROOT_ID}"></div>`;
/** The front-page button block this module writes. */
const MASTERY_BUTTON_PATTERN = /<div[^>]*data-cg-mastery-button="true"[^>]*>[\s\S]*?<\/div>/;

/**
 * Create mastery dashboard button HTML for front page
 * Uses Canvas theme colors and data attributes for reliable detection
 * (Canvas strips HTML comments, so we use data attributes instead)
 * @param {string} baseUrl - Canvas base URL
 * @param {string} courseId - Course ID
 * @param {string} pageUrl - Actual page URL (may be auto-numbered by Canvas)
 * @returns {string} Button HTML
 */
function createMasteryButtonHtml(baseUrl, courseId, pageUrl) {
    // Get Canvas theme colors
    const primaryButtonColor = brandButtonPrimaryBg();
    const textColor = brandButtonPrimaryText();

    return `<div data-cg-mastery-button="true" data-page-url="${pageUrl}" style="margin: 16px 0;">
    <a style="display: block; padding: 14px; background: ${primaryButtonColor}; color: ${textColor}; text-align: center; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; margin-bottom: 8px;" href="${baseUrl}/courses/${courseId}/pages/${pageUrl}?cg_web=1" data-api-endpoint="${baseUrl}/api/v1/courses/${courseId}/pages/${pageUrl}" data-api-returntype="Page">
        View ${MASTERY_PAGE_TITLE}
    </a>
    
</div>`;
}

/**
 * Make sure a Mastery View page contains the element the viewer renders into.
 * A page saved from Canvas's "page does not exist, create it below" editor is
 * titled right but empty. Prepends the element, keeping existing content; does
 * nothing when it's already there.
 *
 * @param {string|number} courseId
 * @param {Object} page - wiki page object (with body)
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<{ repaired: boolean }>}
 */
export async function ensureMasteryViewRoot(courseId, page, apiClient) {
    if (hasMasteryViewRoot(page)) return { repaired: false };
    await updatePage(courseId, page.url, { body: MASTERY_PAGE_BODY + String(page.body ?? '') }, apiClient);
    logger.info(`[MasteryDashboard] Repaired page ${page.url} (added the Mastery View container)`);
    return { repaired: true };
}

/**
 * Make sure the course front page has the "View Mastery View" button pointing
 * at `pageUrl` (adds it, or replaces an old one), creating a "Home" front page
 * when the course has none, and show the front page as the course home.
 *
 * @param {string|number} courseId
 * @param {string} pageUrl - the Mastery View page's actual slug
 * @param {CanvasApiClient} apiClient
 * @param {string} [baseUrl=window.location.origin]
 */
export async function ensureMasteryViewFrontPageButton(courseId, pageUrl, apiClient, baseUrl = window.location.origin) {
    const masteryButtonHtml = createMasteryButtonHtml(baseUrl, courseId, pageUrl);
    const frontPage = await getFrontPage(courseId, apiClient);

    if (frontPage) {
        const currentBody = frontPage.body || '';
        const newBody = currentBody.includes('data-cg-mastery-button="true"')
            ? currentBody.replace(MASTERY_BUTTON_PATTERN, masteryButtonHtml)
            : masteryButtonHtml + '\n' + currentBody;
        if (newBody !== currentBody || !frontPage.published) {
            await updatePage(courseId, frontPage.url, { body: newBody, published: true }, apiClient);
            logger.info(`[MasteryDashboard] Front page button points to ${pageUrl}`);
        }
    } else {
        await createPage(courseId, {
            title: 'Home',
            body: masteryButtonHtml,
            published: true,
            front_page: true
        }, apiClient);
        logger.info('[MasteryDashboard] New front page created with button');
    }

    await setCourseDefaultViewToWiki(courseId, apiClient);
}

/**
 * Create Mastery View — or repair the existing one.
 *
 * Checks first: if a Mastery View page exists (the most recent one), it is
 * repaired when needed and the front page button is pointed at it — never
 * duplicated. Otherwise creates the page and the button.
 *
 * @param {HTMLButtonElement} button - Button element to update state
 */
export async function createMasteryDashboard(button) {
    const courseId = getCourseId();
    if (!courseId) {
        alert('Could not determine course ID');
        return;
    }

    const apiClient = new CanvasApiClient();

    try {
        button.disabled = true;
        button.textContent = 'Creating...';
        logger.info('[MasteryDashboard] Starting creation process');

        // Found by title — the slug may be numbered (mastery-dashboard-3) after a delete
        const existingPage = await findMasteryViewPage(courseId, apiClient);
        let pageUrl;
        let message;

        if (existingPage) {
            const { repaired } = await ensureMasteryViewRoot(courseId, existingPage, apiClient);
            pageUrl = existingPage.url;
            message = repaired
                ? `✅ ${MASTERY_PAGE_TITLE} was repaired.\n\n• The page was fixed so it loads again\n• Front page button points to it\n\nRefresh the course home page to see it.`
                : `✅ ${MASTERY_PAGE_TITLE} is ready.\n\n• The page already exists\n• Front page button points to it\n\nRefresh the course home page to see it.`;
            logger.info(`[MasteryDashboard] Page exists at ${pageUrl}${repaired ? ' — repaired' : ''}`);
        } else {
            // Canvas picks the slug from the title (mastery-dashboard, or -N if reserved)
            const createdPage = await createPage(courseId, {
                title: MASTERY_PAGE_TITLE,
                body: MASTERY_PAGE_BODY,
                published: true
            }, apiClient);
            pageUrl = createdPage.url;
            message = `✅ ${MASTERY_PAGE_TITLE} setup complete!\n\n• ${MASTERY_PAGE_TITLE} page created\n• Front page updated with button\n• Course home page set to display front page\n\nRefresh the course home page to see it.`;
            logger.info(`[MasteryDashboard] Mastery dashboard page created at: ${pageUrl}`);
        }

        await ensureMasteryViewFrontPageButton(courseId, pageUrl, apiClient);
        alert(message);

    } catch (error) {
        logger.error('[MasteryDashboard] Error creating mastery dashboard:', error);
        handleError(error, 'createMasteryDashboard', { showAlert: true });
    } finally {
        button.disabled = false;
        button.textContent = `🎯 Create ${MASTERY_PAGE_TITLE} Button`;
    }
}

/**
 * Delete Mastery View setup: every Mastery View page (numbered copies too)
 * and the front page button.
 *
 * @param {HTMLAnchorElement} linkElement - Delete link element to update state
 */
export async function deleteMasteryDashboard(linkElement) {
    const courseId = getCourseId();
    if (!courseId) {
        alert('Could not determine course ID');
        return;
    }

    const confirmed = confirm(
        `⚠️ Delete ${MASTERY_PAGE_TITLE} Setup?\n\n` +
        'This will:\n' +
        `• Delete the "${MASTERY_PAGE_TITLE}" page\n` +
        '• Remove the button from the front page\n\n' +
        'Are you sure you want to continue?'
    );
    if (!confirmed) return;

    const apiClient = new CanvasApiClient();
    const originalText = linkElement.textContent;

    try {
        linkElement.style.pointerEvents = 'none';
        linkElement.style.opacity = '0.5';
        linkElement.textContent = 'Deleting...';
        logger.info('[MasteryDashboard] Starting deletion process');

        // Every Mastery View page, plus whatever the front page button points at
        const frontPage = await getFrontPage(courseId, apiClient);
        const urls = new Set((await findMasteryViewPages(courseId, apiClient)).map(p => p.url));
        const buttonUrl = frontPage?.body?.match(/data-page-url="([^"]+)"/)?.[1];
        if (buttonUrl) urls.add(buttonUrl);

        for (const pageUrl of urls) {
            try {
                await deletePage(courseId, pageUrl, apiClient);
                logger.info(`[MasteryDashboard] Mastery dashboard page deleted: ${pageUrl}`);
            } catch (error) {
                // Page might not exist (404 error)
                if (error.message?.includes('404')) {
                    logger.info(`[MasteryDashboard] Page ${pageUrl} does not exist`);
                } else {
                    throw error;
                }
            }
        }

        // Remove button from front page
        const currentBody = frontPage?.body || '';
        if (frontPage && currentBody.includes('data-cg-mastery-button="true"')) {
            const buttonPattern = /<div[^>]*data-cg-mastery-button="true"[^>]*>[\s\S]*?<\/div>\n?/;
            await updatePage(courseId, frontPage.url, {
                body: currentBody.replace(buttonPattern, ''),
                published: true
            }, apiClient);
            logger.info('[MasteryDashboard] Button removed from front page');
        } else {
            logger.info('[MasteryDashboard] Button not found on front page');
        }

        alert(`✅ ${MASTERY_PAGE_TITLE} setup deleted!\n\n• ${MASTERY_PAGE_TITLE} page removed\n• Button removed from front page\n\nRefresh the page to see changes.`);

    } catch (error) {
        logger.error('[MasteryDashboard] Error deleting mastery dashboard:', error);
        handleError(error, 'deleteMasteryDashboard', { showAlert: true });
    } finally {
        linkElement.style.pointerEvents = 'auto';
        linkElement.style.opacity = '1';
        linkElement.textContent = originalText;
    }
}

/**
 * Inject mastery dashboard creation button into settings sidebar
 */
export function injectMasteryDashboardButton() {
    waitForSettingsSidebar((sidebar) => {
        // Check if already injected
        if (document.querySelector(`.${INJECTION_MARKER}`)) {
            logger.trace('[MasteryDashboard] Button already injected');
            return;
        }

        logger.debug('[MasteryDashboard] Injecting button into settings sidebar');

        // Create button container
        const container = document.createElement('div');
        container.className = INJECTION_MARKER;
        container.style.cssText = 'margin: 12px 0; padding: 12px; background: #f5f5f5; border-radius: 4px;';

        // Create button using existing makeButton utility
        const button = makeButton({
            label: `🎯 Create ${MASTERY_PAGE_TITLE} Button`,
            id: 'create-mastery-dashboard-button',
            onClick: () => createMasteryDashboard(button),
            type: 'primary'
        });

        // Override margin for sidebar context
        button.style.marginLeft = '0';
        button.style.width = '100%';

        // Create description
        const description = document.createElement('div');
        description.style.cssText = 'font-size: 12px; color: #666; text-align: center; margin-top: 8px;';
        description.textContent = `Creates the ${MASTERY_PAGE_TITLE} page and adds a button to the course front page`;

        // Create delete link (styled as text link, not button)
        const deleteLink = document.createElement('a');
        deleteLink.href = '#';
        deleteLink.textContent = `Delete ${MASTERY_PAGE_TITLE} Setup`;
        deleteLink.style.cssText = `
            display: block;
            text-align: center;
            margin-top: 10px;
            font-size: 11px;
            color: #c62828;
            text-decoration: none;
            cursor: pointer;
            opacity: 0.8;
        `;

        // Hover effect
        deleteLink.addEventListener('mouseenter', () => {
            deleteLink.style.textDecoration = 'underline';
            deleteLink.style.opacity = '1';
        });
        deleteLink.addEventListener('mouseleave', () => {
            deleteLink.style.textDecoration = 'none';
            deleteLink.style.opacity = '0.8';
        });

        // Click handler
        deleteLink.addEventListener('click', (e) => {
            e.preventDefault();
            deleteMasteryDashboard(deleteLink);
        });

        container.appendChild(button);
        container.appendChild(description);
        container.appendChild(deleteLink);

        // Try to insert after "Validate Links in Content" button
        const validateLinksButton = Array.from(sidebar.querySelectorAll('a')).find(a =>
            a.textContent.includes('Validate Links')
        );

        if (validateLinksButton && validateLinksButton.parentElement) {
            validateLinksButton.parentElement.insertAdjacentElement('afterend', container);
            logger.debug('[MasteryDashboard] Button inserted after Validate Links');
        } else {
            // Fallback: append to end of sidebar
            sidebar.appendChild(container);
            logger.debug('[MasteryDashboard] Button appended to sidebar');
        }

        logger.info('[MasteryDashboard] Button injected successfully');
    }, 'MasteryDashboard');
}

