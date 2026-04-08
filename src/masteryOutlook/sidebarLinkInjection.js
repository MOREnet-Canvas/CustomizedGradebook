// src/masteryOutlook/sidebarLinkInjection.js
/**
 * Mastery Outlook Sidebar Link Injection
 *
 * Injects a link to the Mastery Outlook page in the Canvas course navigation sidebar.
 * Link only appears if the Mastery Outlook page exists in the course.
 */

import { logger } from '../utils/logger.js';
import { getCourseId, getUserRoleGroup } from '../utils/canvas.js';
import { isCoursePage } from '../utils/pageDetection.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { getPage } from '../services/pageService.js';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const LINK_ID = 'cg-mastery-outlook-nav-link';
const OUTLOOK_PAGE_URL = 'mastery-outlook';
const LINK_TEXT = 'Mastery Outlook';

// ═══════════════════════════════════════════════════════════════════════
// INJECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════

/**
 * Inject Mastery Outlook link into course navigation sidebar
 *
 * Called immediately after page creation, or on page load if page exists.
 *
 * @param {string} courseId - Canvas course ID
 */
export function injectMasteryOutlookLink(courseId) {
    if (!courseId) {
        logger.warn('[SidebarLink] No course ID provided, cannot inject link');
        return;
    }

    logger.debug('[SidebarLink] Attempting to inject Mastery Outlook link');

    waitForSectionTabs((sectionTabs) => {
        // Check if already injected
        if (document.getElementById(LINK_ID)) {
            logger.debug('[SidebarLink] Link already exists, skipping injection');
            return;
        }

        logger.debug('[SidebarLink] Injecting Mastery Outlook link');

        // Create <li> element
        const li = document.createElement('li');
        li.className = 'section';
        li.id = LINK_ID;

        // Create <a> element
        const a = document.createElement('a');
        a.href = `/courses/${courseId}/pages/${OUTLOOK_PAGE_URL}`;
        a.className = 'mastery-outlook';
        a.tabIndex = 0;
        a.textContent = LINK_TEXT;

        li.appendChild(a);

        // Insert as second item (after Home, which is always first in Canvas)
        const firstItem = sectionTabs.querySelector('li.section:first-child');

        if (firstItem) {
            firstItem.insertAdjacentElement('afterend', li);
            logger.debug('[SidebarLink] Link inserted as second item (after Home)');
        } else {
            // Fallback: prepend to list if no items found (unlikely)
            sectionTabs.insertBefore(li, sectionTabs.firstChild);
            logger.debug('[SidebarLink] Link inserted as first item (fallback)');
        }

        logger.info('[SidebarLink] Mastery Outlook link injected successfully');
    });
}

/**
 * Remove Mastery Outlook link from sidebar
 * (Used when page is deleted)
 */
export function removeMasteryOutlookLink() {
    const link = document.getElementById(LINK_ID);
    if (link) {
        link.remove();
        logger.info('[SidebarLink] Mastery Outlook link removed');
    }
}

/**
 * Check if Mastery Outlook page exists, then inject link
 *
 * Called on every course page load to ensure link appears if page exists.
 */
export async function checkAndInjectMasteryOutlookLink() {
    // Only run on course pages
    if (!isCoursePage()) {
        logger.trace('[SidebarLink] Not on a course page, skipping');
        return;
    }

    // Only for teachers
    const roleGroup = getUserRoleGroup();
    if (roleGroup !== 'teacher_like') {
        logger.trace('[SidebarLink] User is not teacher_like, skipping');
        return;
    }

    const courseId = getCourseId();
    if (!courseId) {
        logger.warn('[SidebarLink] Could not get course ID, skipping');
        return;
    }

    logger.debug(`[SidebarLink] Checking if Mastery Outlook page exists in course ${courseId}`);

    const apiClient = new CanvasApiClient();

    try {
        // Check if Mastery Outlook page exists
        const page = await getPage(courseId, OUTLOOK_PAGE_URL, apiClient);

        if (page) {
            logger.debug('[SidebarLink] Mastery Outlook page exists, injecting link');
            injectMasteryOutlookLink(courseId);
        } else {
            logger.debug('[SidebarLink] Mastery Outlook page does not exist, no link injected');
        }
    } catch (error) {
        logger.error('[SidebarLink] Error checking for Mastery Outlook page:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Wait for #section-tabs to be ready in the DOM
 *
 * @param {Function} callback - Callback to execute when section-tabs is found
 */
function waitForSectionTabs(callback) {
    let attempts = 0;
    const maxAttempts = 33; // ~10 seconds
    const intervalMs = 300;

    const intervalId = setInterval(() => {
        const sectionTabs = document.getElementById('section-tabs');

        if (sectionTabs) {
            clearInterval(intervalId);
            logger.debug('[SidebarLink] #section-tabs found');
            callback(sectionTabs);
        } else if (attempts++ >= maxAttempts) {
            clearInterval(intervalId);
            logger.warn('[SidebarLink] #section-tabs not found after 10 seconds');
        }
    }, intervalMs);
}