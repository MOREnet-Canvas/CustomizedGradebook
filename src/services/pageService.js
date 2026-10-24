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
 * @returns {Promise<Object[]>} Page objects (with body), newest first. The
 *   newest one is "the" Mastery Outlook page.
 */
export async function findMasteryOutlookPages(courseId, apiClient) {
    const pages = await apiClient.getAllPages(
        // Filters go in the URL — getAllPages' second argument is fetch options
        `/api/v1/courses/${courseId}/pages?search_term=${encodeURIComponent(MASTERY_OUTLOOK_PAGE_TITLE)}&include[]=body&per_page=50`,
        {},
        'findMasteryOutlookPages'
    );
    return (pages ?? [])
        .filter(p => p.title === MASTERY_OUTLOOK_PAGE_TITLE
            && p.workflow_state !== 'deleted'
            && String(p.url ?? '').startsWith(MASTERY_OUTLOOK_PAGE_URL))
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/**
 * @param {Object|null} page - wiki page object (with body)
 * @returns {boolean} true when the page contains the element Mastery Outlook renders into
 */
export function hasMasteryOutlookRoot(page) {
    return String(page?.body ?? '').includes(MASTERY_OUTLOOK_ROOT_ID);
}

/**
 * The course's Mastery Outlook page — the most recent non-deleted page titled
 * "Mastery Outlook" (see findMasteryOutlookPages) — or null.
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
        const page = await findMasteryViewPage(courseId, apiClient);
        if (page) {
            logger.debug(`[PageService] Found Mastery page at: ${page.url}`);
            return page.url;
        }
        logger.debug('[PageService] Mastery Dashboard page not found');
        return null;
    } catch (error) {
        logger.warn('[PageService] Error finding Mastery Dashboard URL:', error);
        return null;
    }
}

/** Mastery View page identity. "Mastery Dashboard" is the legacy title. */
export const MASTERY_VIEW_PAGE_TITLES = Object.freeze(['Mastery View', 'Mastery Dashboard']);
/** Preferred slug. Canvas may number it (mastery-dashboard-2, …) when the slug is taken or was deleted. */
export const MASTERY_VIEW_PAGE_URL = 'mastery-dashboard';
/** The element the Mastery View viewer renders into. */
export const MASTERY_VIEW_ROOT_ID = 'mastery-dashboard-root';

/**
 * Find every Mastery View page in a course, by title — not by slug, because
 * Canvas keeps a deleted page's slug reserved and numbers the next one.
 *
 * @param {string|number} courseId
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<Object[]>} Page objects (with body), newest first. The
 *   newest one is "the" Mastery View page.
 */
export async function findMasteryViewPages(courseId, apiClient) {
    const byUrl = new Map();
    for (const title of MASTERY_VIEW_PAGE_TITLES) {
        const pages = await apiClient.getAllPages(
            // Filters go in the URL — getAllPages' second argument is fetch options
            `/api/v1/courses/${courseId}/pages?search_term=${encodeURIComponent(title)}&include[]=body&per_page=50`,
            {},
            'findMasteryViewPages'
        );
        for (const p of pages ?? []) {
            if (MASTERY_VIEW_PAGE_TITLES.includes(p.title)
                && p.workflow_state !== 'deleted'
                && String(p.url ?? '').startsWith(MASTERY_VIEW_PAGE_URL)) {
                byUrl.set(p.url, p);
            }
        }
    }
    return [...byUrl.values()]
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/**
 * The course's Mastery View page — the most recent non-deleted one — or null.
 *
 * @param {string|number} courseId
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<Object|null>}
 */
export async function findMasteryViewPage(courseId, apiClient) {
    const pages = await findMasteryViewPages(courseId, apiClient);
    return pages[0] ?? null;
}

/**
 * @param {Object|null} page - wiki page object (with body)
 * @returns {boolean} true when the page contains the element Mastery View renders into
 */
export function hasMasteryViewRoot(page) {
    return String(page?.body ?? '').includes(MASTERY_VIEW_ROOT_ID);
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