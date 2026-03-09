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
import { getFrontPage, createPage, updatePage, setCourseDefaultViewToWiki, getPage } from '../services/pageService.js';
import { handleError } from '../utils/errorHandler.js';
import { isCourseSettingsPage } from '../utils/pageDetection.js';

const INJECTION_MARKER = 'cg-mastery-dashboard-creator';
const MASTERY_PAGE_TITLE = 'Mastery Dashboard';
const MASTERY_PAGE_URL = 'mastery-dashboard';
const MASTERY_PAGE_BODY = '<div id="parent-mastery-root"></div>';

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
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryButtonColor = rootStyles.getPropertyValue("--ic-brand-button--primary-bgd").trim() || "#0c7d9d";
    const textColor = rootStyles.getPropertyValue("--ic-brand-button--primary-text").trim() || "#ffffff";

    return `<div data-cg-mastery-button="true" data-page-url="${pageUrl}" style="margin: 16px 0;">
    <a style="display: block; padding: 14px; background: ${primaryButtonColor}; color: ${textColor}; text-align: center; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; margin-bottom: 8px;" href="${baseUrl}/courses/${courseId}/pages/${pageUrl}?cg_web=1" data-api-endpoint="${baseUrl}/api/v1/courses/${courseId}/pages/${pageUrl}" data-api-returntype="Page">
        View Mastery Dashboard
    </a>
    <p style="font-size: 12px; color: #666; margin: 0; text-align: center;">For parents/observers using the Canvas Parent app</p>
</div>`;
}

/**
 * Create or update mastery dashboard and front page button
 * @param {HTMLButtonElement} button - Button element to update state
 */
async function createMasteryDashboard(button) {
    const courseId = getCourseId();
    if (!courseId) {
        alert('Could not determine course ID');
        return;
    }

    const baseUrl = window.location.origin;
    const apiClient = new CanvasApiClient();

    try {
        // Disable button during operation
        button.disabled = true;
        button.textContent = 'Creating...';
        logger.info('[MasteryDashboard] Starting creation process');

        // Step 1: Check if mastery dashboard page already exists
        logger.debug('[MasteryDashboard] Checking if mastery dashboard page exists');
        const existingPage = await getPage(courseId, MASTERY_PAGE_URL, apiClient);

        if (existingPage) {
            // Page exists - alert user to delete manually
            logger.info('[MasteryDashboard] Mastery dashboard page already exists');
            alert(
                '⚠️ Mastery Dashboard page already exists!\n\n' +
                'Please delete the existing "Mastery Dashboard" page first, then try again.\n\n' +
                'To delete:\n' +
                '1. Go to Pages\n' +
                '2. Find "Mastery Dashboard"\n' +
                '3. Click the three dots menu\n' +
                '4. Select "Delete"\n\n' +
                'Or use the "Delete Mastery Dashboard Setup" link below.'
            );

            // Reset button
            button.disabled = false;
            button.textContent = '🎯 Create Mastery Dashboard Button';
            return;
        }

        // Create mastery dashboard page
        logger.debug('[MasteryDashboard] Creating mastery dashboard page');
        const createdPage = await createPage(courseId, {
            title: MASTERY_PAGE_TITLE,
            url: MASTERY_PAGE_URL,
            body: MASTERY_PAGE_BODY,
            published: true
        }, apiClient);

        // Use the actual URL Canvas assigned (might be auto-numbered if conflict)
        const actualPageUrl = createdPage.url;
        logger.info(`[MasteryDashboard] Mastery dashboard page created at: ${actualPageUrl}`);

        // Step 2: Get or create front page
        logger.debug('[MasteryDashboard] Checking front page');
        let frontPage = await getFrontPage(courseId, apiClient);

        const masteryButtonHtml = createMasteryButtonHtml(baseUrl, courseId, actualPageUrl);

        if (frontPage) {
            // Update existing front page
            logger.debug('[MasteryDashboard] Updating existing front page');
            const currentBody = frontPage.body || '';

            // Check if button already exists (using data attribute instead of HTML comments)
            const buttonExists = currentBody.includes('data-cg-mastery-button="true"');
            let newBody;

            if (buttonExists) {
                logger.debug('[MasteryDashboard] Button already exists, replacing with updated version');

                // Replace existing button HTML with new version
                // Pattern matches: <div data-cg-mastery-button="true" ... > ... </div>
                const buttonPattern = /<div[^>]*data-cg-mastery-button="true"[^>]*>[\s\S]*?<\/div>/;
                newBody = currentBody.replace(buttonPattern, masteryButtonHtml);
            } else {
                logger.debug('[MasteryDashboard] Button does not exist, prepending to front page');
                // Prepend button to existing content
                newBody = masteryButtonHtml + '\n' + currentBody;
            }

            await updatePage(courseId, frontPage.url, {
                body: newBody,
                published: true
            }, apiClient);

            logger.info('[MasteryDashboard] Front page updated with button');
        } else {
            // Create new front page with button
            logger.debug('[MasteryDashboard] Creating new front page');
            await createPage(courseId, {
                title: 'Home',
                body: masteryButtonHtml,
                published: true,
                front_page: true
            }, apiClient);

            logger.info('[MasteryDashboard] New front page created with button');
        }

        // Step 3: Set course default view to wiki (front page)
        logger.debug('[MasteryDashboard] Setting course default view to wiki');
        await setCourseDefaultViewToWiki(courseId, apiClient);
        logger.info('[MasteryDashboard] Course default view set to wiki (front page)');

        // Show success message
        alert('✅ Mastery Dashboard setup complete!\n\n• Mastery Dashboard page created\n• Front page updated with button\n• Course home page set to display front page\n\nRefresh the course home page to see it.');

        // Reset button
        button.disabled = false;
        button.textContent = '🎯 Create Mastery Dashboard Button';

    } catch (error) {
        logger.error('[MasteryDashboard] Error creating mastery dashboard:', error);
        handleError(error, 'createMasteryDashboard', { showAlert: true });
        
        // Reset button
        button.disabled = false;
        button.textContent = '🎯 Create Mastery Dashboard Button';
    }
}

/**
 * Delete mastery dashboard setup (page and front page button)
 * @param {HTMLAnchorElement} linkElement - Delete link element to update state
 */
async function deleteMasteryDashboard(linkElement) {
    const courseId = getCourseId();
    if (!courseId) {
        alert('Could not determine course ID');
        return;
    }

    // Confirm deletion
    const confirmed = confirm(
        '⚠️ Delete Mastery Dashboard Setup?\n\n' +
        'This will:\n' +
        '• Delete the "Mastery Dashboard" page\n' +
        '• Remove the button from the front page\n\n' +
        'Are you sure you want to continue?'
    );

    if (!confirmed) {
        return;
    }

    const apiClient = new CanvasApiClient();
    const originalText = linkElement.textContent;

    try {
        // Update link during operation
        linkElement.style.pointerEvents = 'none';
        linkElement.style.opacity = '0.5';
        linkElement.textContent = 'Deleting...';
        logger.info('[MasteryDashboard] Starting deletion process');

        // Step 1: Get the actual page URL from the front page button
        logger.debug('[MasteryDashboard] Extracting page URL from front page button');
        const frontPage = await getFrontPage(courseId, apiClient);
        let pageUrlToDelete = MASTERY_PAGE_URL;  // Default fallback

        if (frontPage && frontPage.body) {
            // Extract the actual page URL from the button's data-page-url attribute
            const match = frontPage.body.match(/data-page-url="([^"]+)"/);
            if (match) {
                pageUrlToDelete = match[1];
                logger.debug(`[MasteryDashboard] Found page URL in button: ${pageUrlToDelete}`);
            } else {
                logger.warn('[MasteryDashboard] Could not find data-page-url in button, using default');
            }
        }

        // Step 2: Delete mastery dashboard page using extracted URL
        logger.debug(`[MasteryDashboard] Deleting mastery dashboard page: ${pageUrlToDelete}`);
        try {
            await apiClient.delete(
                `/api/v1/courses/${courseId}/pages/${pageUrlToDelete}`,
                {},
                'deleteMasteryPage'
            );
            logger.info(`[MasteryDashboard] Mastery dashboard page deleted: ${pageUrlToDelete}`);
        } catch (error) {
            // Page might not exist (404 error)
            if (error.message?.includes('404')) {
                logger.info('[MasteryDashboard] Mastery dashboard page does not exist');
            } else {
                throw error;
            }
        }

        // Step 3: Remove button from front page
        logger.debug('[MasteryDashboard] Removing button from front page');

        if (frontPage) {
            const currentBody = frontPage.body || '';

            // Check if button exists (using data attribute)
            const buttonExists = currentBody.includes('data-cg-mastery-button="true"');

            if (buttonExists) {
                logger.debug('[MasteryDashboard] Removing button from front page');

                // Remove button HTML using regex
                const buttonPattern = /<div[^>]*data-cg-mastery-button="true"[^>]*>[\s\S]*?<\/div>\n?/;
                const newBody = currentBody.replace(buttonPattern, '');

                await updatePage(courseId, frontPage.url, {
                    body: newBody,
                    published: true
                }, apiClient);

                logger.info('[MasteryDashboard] Button removed from front page');
            } else {
                logger.info('[MasteryDashboard] Button not found on front page');
            }
        } else {
            logger.info('[MasteryDashboard] No front page found');
        }

        // Show success message
        alert('✅ Mastery Dashboard setup deleted!\n\n• Mastery Dashboard page removed\n• Button removed from front page\n\nRefresh the page to see changes.');

        // Reset link
        linkElement.style.pointerEvents = 'auto';
        linkElement.style.opacity = '1';
        linkElement.textContent = originalText;

    } catch (error) {
        logger.error('[MasteryDashboard] Error deleting mastery dashboard:', error);
        handleError(error, 'deleteMasteryDashboard', { showAlert: true });

        // Reset link
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
            label: '🎯 Create Mastery Dashboard Button',
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
        description.textContent = 'Creates the Mastery Dashboard page and adds a button to the course front page';

        // Create delete link (styled as text link, not button)
        const deleteLink = document.createElement('a');
        deleteLink.href = '#';
        deleteLink.textContent = 'Delete Mastery Dashboard Setup';
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
    });
}

/**
 * Wait for settings sidebar to be ready
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
            logger.debug('[MasteryDashboard] Settings sidebar found');
            callback(sidebar);
        } else if (attempts++ >= maxAttempts) {
            clearInterval(intervalId);
            logger.warn('[MasteryDashboard] Settings sidebar not found after 10 seconds');
        }
    }, intervalMs);
}