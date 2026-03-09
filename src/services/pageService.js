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
 * Get a specific wiki page by URL slug
 * @param {string} courseId - Course ID
 * @param {string} pageUrl - Page URL slug
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object|null>} Page object or null if not found
 */
export async function getPage(courseId, pageUrl, apiClient) {
    try {
        const page = await apiClient.get(
            `/api/v1/courses/${courseId}/pages/${pageUrl}`,
            {},
            'getPage'
        );
        return page;
    } catch (error) {
        logger.debug(`Page ${pageUrl} not found for course ${courseId}`);
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