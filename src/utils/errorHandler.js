// src/utils/errorHandler.js
import { logger } from "./logger.js";

/**
 * Custom error types for better error categorization and handling
 */

/**
 * Error thrown when a Canvas API request fails
 */
export class CanvasApiError extends Error {
    constructor(message, statusCode, responseText) {
        super(message);
        this.name = "CanvasApiError";
        this.statusCode = statusCode;
        this.responseText = responseText;
    }
}

/**
 * Error thrown when user cancels an operation
 */
export class UserCancelledError extends Error {
    constructor(message = "User cancelled the operation") {
        super(message);
        this.name = "UserCancelledError";
    }
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
    constructor(message, timeoutMs) {
        super(message);
        this.name = "TimeoutError";
        this.timeoutMs = timeoutMs;
    }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = "ValidationError";
        this.field = field;
    }
}

/**
 * Log an error with consistent formatting
 * @param {Error} error - The error to log
 * @param {string} context - Context where the error occurred (e.g., "createOutcome", "submitGrade")
 * @param {Object} metadata - Additional metadata to log (optional)
 */
export function logError(error, context, metadata = {}) {
    const timestamp = new Date().toISOString();
    const errorInfo = {
        timestamp,
        context,
        name: error.name,
        message: error.message,
        ...metadata
    };

    // Always log errors to console
    logger.error(`[${context}] ${error.name}: ${error.message}`, errorInfo);

    // Log stack trace in debug mode
    if (logger.isDebugEnabled() && error.stack) {
        logger.error("Stack trace:", error.stack);
    }

    // Log additional error properties for custom error types
    if (error instanceof CanvasApiError) {
        logger.error(`  Status: ${error.statusCode}`);
        if (logger.isDebugEnabled() && error.responseText) {
            logger.error(`  Response: ${error.responseText}`);
        }
    } else if (error instanceof TimeoutError) {
        logger.error(`  Timeout: ${error.timeoutMs}ms`);
    } else if (error instanceof ValidationError && error.field) {
        logger.error(`  Field: ${error.field}`);
    }
}

/**
 * Get a user-friendly error message from an error object
 * @param {Error} error - The error to convert
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyMessage(error) {
    // User cancellation - use the specific message provided
    if (error instanceof UserCancelledError) {
        return error.message || "Operation cancelled.";
    }

    // Timeout errors
    if (error instanceof TimeoutError) {
        return "The operation took too long and timed out. Please try again.";
    }

    // Validation errors - show the message directly (should already be user-friendly)
    if (error instanceof ValidationError) {
        return error.message;
    }

    // Canvas API errors
    if (error instanceof CanvasApiError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
            return "You don't have permission to perform this action.";
        }
        if (error.statusCode === 404) {
            return "The requested resource was not found.";
        }
        if (error.statusCode >= 500) {
            return "Canvas server error. Please try again later.";
        }
        // For other API errors, use the error message
        return `Canvas API error: ${error.message}`;
    }

    // Generic errors - use the message if it seems user-friendly, otherwise generic message
    const message = error.message || "An unknown error occurred";
    
    // If the message looks technical (contains "fetch", "JSON", "undefined", etc.), use generic message
    const technicalKeywords = ["fetch", "JSON", "undefined", "null", "parse", "response"];
    const isTechnical = technicalKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isTechnical) {
        return "An unexpected error occurred. Please try again or contact support.";
    }

    return message;
}

/**
 * Handle an error by logging it and optionally showing a user-friendly message
 * @param {Error} error - The error to handle
 * @param {string} context - Context where the error occurred
 * @param {Object} options - Options for error handling
 * @param {boolean} options.showAlert - Whether to show an alert to the user (default: false)
 * @param {Object} options.banner - Banner object to update with error message (optional)
 * @param {Object} options.metadata - Additional metadata to log (optional)
 * @returns {string} User-friendly error message
 */
export function handleError(error, context, options = {}) {
    const { showAlert = false, banner = null, metadata = {} } = options;

    // Log the error
    logError(error, context, metadata);

    // Get user-friendly message
    const userMessage = getUserFriendlyMessage(error);

    // Update banner if provided
    if (banner && typeof banner.setText === "function") {
        banner.setText(userMessage);
    }

    // Show alert if requested (and not a user cancellation)
    if (showAlert && !(error instanceof UserCancelledError)) {
        alert(userMessage);
    }

    return userMessage;
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @param {Object} options - Options for error handling
 * @returns {Function} Wrapped function that handles errors
 *
 * @example
 * const safeCreateOutcome = withErrorHandling(
 *   createOutcome,
 *   "createOutcome",
 *   { showAlert: true }
 * );
 * await safeCreateOutcome(courseId);
 */
export function withErrorHandling(fn, context, options = {}) {
    return async function(...args) {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context, options);
            throw error; // Re-throw so caller can handle if needed
        }
    };
}

/**
 * Wrapper for fetch API with consistent error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {string} context - Context for error logging (optional)
 * @returns {Promise<Response>} Fetch response
 * @throws {CanvasApiError} If the request fails
 *
 * @example
 * const response = await safeFetch('/api/v1/courses/123', {}, 'fetchCourse');
 * const data = await response.json();
 */
export async function safeFetch(url, options = {}, context = "fetch") {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const responseText = await response.text();
            throw new CanvasApiError(
                `HTTP ${response.status}: ${response.statusText}`,
                response.status,
                responseText
            );
        }

        return response;
    } catch (error) {
        // If it's already a CanvasApiError, just re-throw
        if (error instanceof CanvasApiError) {
            throw error;
        }

        // Otherwise, wrap network errors
        throw new CanvasApiError(
            `Network error: ${error.message}`,
            0,
            null
        );
    }
}

/**
 * Safely parse JSON response with error handling
 * @param {Response} response - Fetch response object
 * @param {string} context - Context for error logging
 * @returns {Promise<Object>} Parsed JSON object
 * @throws {CanvasApiError} If parsing fails
 *
 * @example
 * const response = await safeFetch('/api/v1/courses/123');
 * const data = await safeJsonParse(response, 'fetchCourse');
 */
export async function safeJsonParse(response, context = "parseJSON") {
    const rawText = await response.text();

    try {
        return JSON.parse(rawText);
    } catch (error) {
        if (VERBOSE_LOGGING) {
            console.error(`[${context}] Failed to parse JSON:`, rawText);
        }
        throw new CanvasApiError(
            "Invalid JSON response from Canvas API",
            response.status,
            rawText
        );
    }
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay in ms (default: 1000)
 * @param {number} options.backoffMultiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried (optional)
 * @param {string} options.context - Context for logging (optional)
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Last error if all attempts fail
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => fetchData(courseId),
 *   { maxAttempts: 3, context: 'fetchData' }
 * );
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxAttempts = 3,
        initialDelayMs = 1000,
        backoffMultiplier = 2,
        shouldRetry = () => true,
        context = "retry"
    } = options;

    let lastError;
    let delayMs = initialDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry user cancellations
            if (error instanceof UserCancelledError) {
                throw error;
            }

            // Check if we should retry this error
            if (!shouldRetry(error)) {
                throw error;
            }

            // If this was the last attempt, throw
            if (attempt === maxAttempts) {
                if (VERBOSE_LOGGING) {
                    console.warn(`[${context}] All ${maxAttempts} attempts failed`);
                }
                throw error;
            }

            // Log retry attempt
            if (VERBOSE_LOGGING) {
                console.warn(`[${context}] Attempt ${attempt} failed, retrying in ${delayMs}ms...`, error.message);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= backoffMultiplier;
        }
    }

    throw lastError;
}


