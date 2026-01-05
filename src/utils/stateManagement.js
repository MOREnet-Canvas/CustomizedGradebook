import { getCourseId } from "./canvas.js";
import { logger } from "./logger.js";

/**
 * Clean up legacy localStorage entries if they exist.
 * This function is kept for backwards compatibility to clean up old state machine data.
 *
 * Note: This does NOT remove persistent keys like lastUpdateAt and duration,
 * which are used for the "last update" message display.
 *
 * @returns {void}
 */
export function cleanUpLocalStorage() {
    const courseId = getCourseId();
    if (!courseId) return;

    try {
        // Clean up legacy state machine key if it exists
        const legacyKey = `updateFlow_state_${courseId}`;
        if (localStorage.getItem(legacyKey)) {
            localStorage.removeItem(legacyKey);
            logger.debug(`Cleaned up legacy state machine data for course ${courseId}`);
        }
    } catch (error) {
        logger.error('Failed to clean up localStorage:', error);
    }
}

/**
 * Safely parse JSON string without throwing errors.
 * 
 * This is a utility function for parsing JSON that might be invalid or null.
 * Returns null instead of throwing an error if parsing fails.
 * 
 * @param {string|null} s - JSON string to parse
 * @returns {any|null} Parsed object or null if parsing fails
 * 
 * @example
 * const data = safeParse(localStorage.getItem('myData'));
 * if (data) {
 *   // Use data
 * }
 */
export function safeParse(s) {
    try { 
        return JSON.parse(s); 
    } catch { 
        return null; 
    }
}

