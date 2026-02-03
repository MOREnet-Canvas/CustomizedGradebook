// src/utils/canvasApiClient.js
/**
 * Canvas API Client
 * 
 * Centralized client for making authenticated requests to the Canvas LMS API.
 * 
 * Key features:
 * - Constructor-level CSRF token caching (fetch once, reuse for all requests)
 * - Automatic CSRF token injection in headers and request body
 * - Integration with safeFetch for consistent error handling
 * - Support for REST API (GET, POST, PUT, DELETE) and GraphQL
 * 
 * Design decision:
 * CSRF tokens are cached at initialization based on empirical testing showing
 * Canvas accepts previously-issued tokens even after cookie rotation.
 * See docs/CSRF-TOKEN-DECISION.md for full analysis.
 * 
 * @example
 * const apiClient = new CanvasApiClient();
 * const data = await apiClient.get('/api/v1/courses/123/assignments');
 * await apiClient.post('/api/v1/courses/123/assignments', { assignment: {...} });
 */

import { safeFetch, safeJsonParse } from './errorHandler.js';
import { logger } from './logger.js';

export class CanvasApiClient {
    /**
     * Create a new Canvas API client
     * @throws {Error} If CSRF token is not found in cookies
     */
    constructor() {
        this.csrfToken = this.#getTokenCookie('_csrf_token');
        if (!this.csrfToken) {
            throw new Error('CSRF token not found - user may not be authenticated');
        }
        logger.debug('CanvasApiClient initialized with cached CSRF token');
    }

    /**
     * Make a GET request to the Canvas API
     * Automatically appends per_page=100 to avoid pagination limits (Canvas default is 10)
     * @param {string} url - API endpoint URL (e.g., '/api/v1/courses/123/assignments')
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async get(url, options = {}, context = 'get') {
        // Add per_page=100 to avoid Canvas API pagination limits (default is 10 items)
        // Only add if not already present in the URL
        if (!url.includes('per_page=')) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}per_page=100`;
        }

        return this.#makeRequest(url, 'GET', null, options, context);
    }

    /**
     * Make a POST request to the Canvas API
     * @param {string} url - API endpoint URL
     * @param {Object} data - Request body data
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async post(url, data, options = {}, context = 'post') {
        return this.#makeRequest(url, 'POST', data, options, context);
    }

    /**
     * Make a PUT request to the Canvas API
     * @param {string} url - API endpoint URL
     * @param {Object} data - Request body data
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async put(url, data, options = {}, context = 'put') {
        return this.#makeRequest(url, 'PUT', data, options, context);
    }

    /**
     * Make a DELETE request to the Canvas API
     * @param {string} url - API endpoint URL
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async delete(url, options = {}, context = 'delete') {
        return this.#makeRequest(url, 'DELETE', null, options, context);
    }

    /**
     * Make a GraphQL request to the Canvas API
     * @param {string} query - GraphQL query string
     * @param {Object} variables - GraphQL variables (optional)
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async graphql(query, variables = {}, context = 'graphql') {
        const url = '/api/graphql';
        const data = { query, variables };
        
        // GraphQL uses different content type
        const options = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        return this.#makeRequest(url, 'POST', data, options, context);
    }

    /**
     * Get CSRF token from browser cookies
     * @private
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value or null if not found
     */
    #getTokenCookie(name) {
        const cookies = document.cookie.split(";").map(cookie => cookie.trim());
        for (const cookie of cookies) {
            const [key, value] = cookie.split("=", 2);
            if (key === name) {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    /**
     * Make an HTTP request to the Canvas API with CSRF token
     * @private
     * @param {string} url - API endpoint URL
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
     * @param {Object|null} data - Request body data (for POST/PUT)
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging
     * @returns {Promise<any>} Parsed JSON response
     */
    async #makeRequest(url, method, data, options = {}, context = 'request') {
        // Build headers with CSRF token
        // Custom headers are spread first, then CSRF token is set to ensure it cannot be overridden
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
            'X-CSRF-Token': this.csrfToken
        };

        // Build request body
        let body = null;
        if (data) {
            // Determine if we should JSON.stringify based on Content-Type
            const contentType = headers['Content-Type'] || 'application/json';
            const isJson = contentType.includes('application/json');

            if (isJson) {
                // Add authenticity_token to request body if not already present
                // This supports Canvas endpoints that expect token in body
                if (!data.authenticity_token) {
                    data = { ...data, authenticity_token: this.csrfToken };
                }
                body = JSON.stringify(data);
            } else {
                // For non-JSON content (e.g., CSV), pass data as-is
                body = data;
            }
        }

        // Extract headers from options to prevent them from being spread again
        const { headers: _optionsHeaders, ...restOptions } = options;

        // Make request using safeFetch for consistent error handling
        const response = await safeFetch(
            url,
            {
                method,
                credentials: 'same-origin',
                headers,
                body,
                ...restOptions  // Spread remaining options (excluding headers)
            },
            context
        );

        // Parse and return JSON response
        return await safeJsonParse(response, context);
    }
}