// src/services/pageService.js
/**
 * Page Service Module
 * 
 * Handles Canvas API operations for wiki pages:
 * - Creating pages
 * - Updating pages
 * - Fetching front page
 */

import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';

/**
 * Get course front page
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object|null>} Front page object or null if not found
 */
export async function getFrontPage(courseId, apiClient) {
    try {
        const frontPage = await apiClient.get(
            `/api/v1/courses/${courseId}/front_page`,
            {},
            'getFrontPage'
        );
        return frontPage;
    } catch (error) {
        logger.debug(`Front page not found for course ${courseId}`);
        return null;
    }
}

/**
 * Create a new wiki page
 * @param {string} courseId - Course ID
 * @param {Object} pageData - Page data {title, url, body, published}
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object>} Created page object
 */
export async function createPage(courseId, pageData, apiClient) {
    const page = await apiClient.post(
        `/api/v1/courses/${courseId}/pages`,
        { wiki_page: pageData },
        {},
        'createPage'
    );
    return page;
}

/**
 * Update an existing wiki page
 * @param {string} courseId - Course ID
 * @param {string} pageUrl - Page URL slug
 * @param {Object} pageData - Page data to update {body, published, etc.}
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object>} Updated page object
 */
export async function updatePage(courseId, pageUrl, pageData, apiClient) {
    const page = await apiClient.put(
        `/api/v1/courses/${courseId}/pages/${pageUrl}`,
        { wiki_page: pageData },
        {},
        'updatePage'
    );
    return page;
}

/**
 * Delete a wiki page by URL slug.
 * @param {string} courseId - Course ID
 * @param {string} pageUrl - Page URL slug
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object>} The deleted page object
 */
export async function deletePage(courseId, pageUrl, apiClient) {
    const deleted = await apiClient.delete(
        `/api/v1/courses/${courseId}/pages/${pageUrl}`,
        {},
        'deletePage'
    );
    logger.info(`Page ${pageUrl} deleted`);
    return deleted;
}

/**
 * Get a specific wiki page by URL slug
 * @param {string} courseId - Course ID
 * @param {string} pageUrl - Page URL slug
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object|null>} Page object or null if not found or deleted
 */
export async function getPage(courseId, pageUrl, apiClient) {
    try {
        const page = await apiClient.get(
            `/api/v1/courses/${courseId}/pages/${pageUrl}`,
            {},
            'getPage'
        );

        // Only return page if it's not deleted (Canvas soft-delete)
        if (page && page.workflow_state === 'deleted') {
            logger.debug(`Page ${pageUrl} exists but is deleted (workflow_state: deleted)`);
            return null;
        }

        return page;
    } catch (error) {
        logger.debug(`Page ${pageUrl} not found for course ${courseId}`);
        return null;
    }
}

/** Mastery Outlook page identity (shared by creation, sidebar link, init, reset). */
export const MASTERY_OUTLOOK_PAGE_TITLE = 'Mastery Outlook';
/** Preferred slug. Canvas may number it (mastery-outlook-2, …) when the slug is taken or was deleted. */
export const MASTERY_OUTLOOK_PAGE_URL = 'mastery-outlook';
/** The element Mastery Outlook renders into; its presence marks our page. */
export const MASTERY_OUTLOOK_ROOT_ID = 'teacher-mastery-dashboard-root';

/**
 * Find every Mastery Outlook page in a course, by title — not by slug, because
 * Canvas keeps a deleted page's slug reserved and numbers the next one
 * (mastery-outlook-3, …).
 *
 * @param {string|number} courseId
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<Object[]>} Page objects (with body). Pages containing the
 *   Mastery Outlook root element first, then newest first.
 */
export async function findMasteryOutlookPages(courseId, apiClient) {
    const pages = await apiClient.getAllPages(
        // Filters go in the URL — getAllPages' second argument is fetch options
        `/api/v1/courses/${courseId}/pages?search_term=${encodeURIComponent(MASTERY_OUTLOOK_PAGE_TITLE)}&include[]=body&per_page=50`,
        {},
        'findMasteryOutlookPages'
    );
    const hasRoot = p => String(p.body ?? '').includes(MASTERY_OUTLOOK_ROOT_ID);
    return (pages ?? [])
        .filter(p => p.title === MASTERY_OUTLOOK_PAGE_TITLE
            && p.workflow_state !== 'deleted'
            && String(p.url ?? '').startsWith(MASTERY_OUTLOOK_PAGE_URL))
        .sort((a, b) => (hasRoot(b) - hasRoot(a))
            || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/**
 * The course's Mastery Outlook page (see findMasteryOutlookPages), or null.
 *
 * @param {string|number} courseId
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<Object|null>}
 */
export async function findMasteryOutlookPage(courseId, apiClient) {
    const pages = await findMasteryOutlookPages(courseId, apiClient);
    return pages[0] ?? null;
}

/**
 * Find the actual URL of the Mastery Dashboard page by searching by title
 * Handles auto-numbered URLs (mastery-dashboard-2, mastery-dashboard-3, etc.)
 *
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<string|null>} Actual page URL or null if not found
 */
export async function findMasteryDashboardPageUrl(courseId, apiClient) {
    try {
        // Search for "Mastery View" (new name) first, then fall back to "Mastery Dashboard"
        // for backward compatibility with existing deployments.
        for (const searchTerm of ['Mastery View', 'Mastery Dashboard']) {
            const pages = await apiClient.get(
                // Filters go in the URL — get's second argument is fetch options
                `/api/v1/courses/${courseId}/pages?search_term=${encodeURIComponent(searchTerm)}&per_page=10`,
                {},
                'findMasteryDashboardPageUrl'
            );

            const masteryPage = pages.find(p =>
                (p.title === 'Mastery View' || p.title === 'Mastery Dashboard') &&
                p.workflow_state !== 'deleted' &&
                p.url &&
                p.url.startsWith('mastery-dashboard')
            );

            if (masteryPage) {
                logger.debug(`[PageService] Found Mastery page at: ${masteryPage.url}`);
                return masteryPage.url;
            }
        }

        logger.debug('[PageService] Mastery Dashboard page not found');
        return null;

    } catch (error) {
        logger.warn('[PageService] Error finding Mastery Dashboard URL:', error);
        return null;
    }
}

/**
 * Set course default view to wiki (front page)
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object>} Updated course object
 */
export async function setCourseDefaultViewToWiki(courseId, apiClient) {
    const course = await apiClient.put(
        `/api/v1/courses/${courseId}`,
        { course: { default_view: 'wiki' } },
        {},
        'setCourseDefaultView'
    );
    return course;
}