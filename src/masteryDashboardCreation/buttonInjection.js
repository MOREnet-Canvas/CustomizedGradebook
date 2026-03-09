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
import { getFrontPage, createPage, updatePage } from '../services/pageService.js';
import { handleError } from '../utils/errorHandler.js';
import { isCourseSettingsPage } from '../utils/pageDetection.js';

const INJECTION_MARKER = 'cg-mastery-dashboard-creator';
const MASTERY_PAGE_TITLE = 'Mastery Dashboard';
const MASTERY_PAGE_URL = 'mastery-dashboard';
const MASTERY_PAGE_BODY = '<div id="parent-mastery-root"></div>';

/**
 * Create mastery dashboard button HTML for front page
 * @param {string} baseUrl - Canvas base URL
 * @param {string} courseId - Course ID
 * @returns {string} Button HTML
 */
function createMasteryButtonHtml(baseUrl, courseId) {
    return `<div style="margin: 16px 0;">
    <a style="display: block; padding: 14px; background: #005f9e; color: white; text-align: center; border-radius: 8px; text-decoration: none; font-size: 16px; margin-bottom: 8px;" href="${baseUrl}/courses/${courseId}/pages/${MASTERY_PAGE_URL}?cg_web=1" data-api-endpoint="${baseUrl}/api/v1/courses/${courseId}/pages/${MASTERY_PAGE_URL}" data-api-returntype="Page">
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

        // Step 1: Create mastery dashboard page (if it doesn't exist)
        logger.debug('[MasteryDashboard] Creating mastery dashboard page');
        try {
            await createPage(courseId, {
                title: MASTERY_PAGE_TITLE,
                url: MASTERY_PAGE_URL,
                body: MASTERY_PAGE_BODY,
                published: true
            }, apiClient);
            logger.info('[MasteryDashboard] Mastery dashboard page created');
        } catch (error) {
            // Page might already exist (400 error)
            if (error.message?.includes('400')) {
                logger.info('[MasteryDashboard] Mastery dashboard page already exists');
            } else {
                throw error;
            }
        }

        // Step 2: Get or create front page
        logger.debug('[MasteryDashboard] Checking front page');
        let frontPage = await getFrontPage(courseId, apiClient);
        
        const masteryButtonHtml = createMasteryButtonHtml(baseUrl, courseId);

        if (frontPage) {
            // Update existing front page - prepend button
            logger.debug('[MasteryDashboard] Updating existing front page');
            const currentBody = frontPage.body || '';
            const newBody = masteryButtonHtml + '\n' + currentBody;
            
            await updatePage(courseId, frontPage.url, {
                body: newBody,
                published: true
            }, apiClient);
            
            logger.info('[MasteryDashboard] Front page updated with button');
            alert('✅ Mastery Dashboard button added to front page!\n\nRefresh the course home page to see it.');
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
            alert('✅ New front page created with Mastery Dashboard button!\n\nRefresh the course home page to see it.');
        }

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

        container.appendChild(button);
        container.appendChild(description);

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