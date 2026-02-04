// src/admin/fetchHelpers.js
/**
 * Fetch Helper Utilities
 * 
 * Provides utilities for fetching remote resources with timeout and retry.
 */

import { logger } from '../utils/logger.js';

/**
 * Fetch text content with timeout
 * 
 * @param {string} url - URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} Fetched text content
 * @throws {Error} If fetch fails or times out
 */
export async function fetchTextWithTimeout(url, timeoutMs) {
    logger.debug(`[FetchHelpers] Fetching ${url} with ${timeoutMs}ms timeout`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'omit', // S3/public asset: do not send Canvas cookies
            signal: controller.signal,
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        logger.debug(`[FetchHelpers] Successfully fetched ${text.length} bytes`);
        return text;
    } finally {
        clearTimeout(timer);
    }
}

