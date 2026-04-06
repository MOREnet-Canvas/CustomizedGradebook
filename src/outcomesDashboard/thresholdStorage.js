// src/outcomesDashboard/thresholdStorage.js
/**
 * Threshold Storage Service
 * 
 * Simple localStorage wrapper for storing per-user, per-course threshold values.
 * Threshold controls which students appear in the intervention sidebar.
 * 
 * Storage pattern: cg_threshold_{courseId}_{userId}
 * Default value: 2.2 (22nd percentile from Power Law research)
 */

import { logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Default threshold value (22nd percentile)
 * Based on Power Law mastery research
 */
const DEFAULT_THRESHOLD = 2.2;

/**
 * localStorage key prefix
 */
const STORAGE_KEY_PREFIX = 'cg_threshold_';

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get threshold value for current user and course
 * 
 * @param {string} courseId - Canvas course ID
 * @param {string} userId - Canvas user ID
 * @returns {number} Threshold value (defaults to 2.2 if not set)
 */
export function getThreshold(courseId, userId) {
    const key = `${STORAGE_KEY_PREFIX}${courseId}_${userId}`;
    
    try {
        const storedValue = localStorage.getItem(key);
        
        if (storedValue === null) {
            logger.debug(`[thresholdStorage] No stored threshold for course ${courseId}, user ${userId}. Using default: ${DEFAULT_THRESHOLD}`);
            return DEFAULT_THRESHOLD;
        }
        
        const parsedValue = parseFloat(storedValue);
        
        if (isNaN(parsedValue)) {
            logger.warn(`[thresholdStorage] Invalid threshold value "${storedValue}". Using default: ${DEFAULT_THRESHOLD}`);
            return DEFAULT_THRESHOLD;
        }
        
        logger.debug(`[thresholdStorage] Loaded threshold for course ${courseId}, user ${userId}: ${parsedValue}`);
        return parsedValue;
        
    } catch (error) {
        logger.error('[thresholdStorage] Error reading from localStorage', error);
        return DEFAULT_THRESHOLD;
    }
}

/**
 * Save threshold value for current user and course
 * 
 * @param {string} courseId - Canvas course ID
 * @param {string} userId - Canvas user ID
 * @param {number} threshold - Threshold value to save
 * @returns {boolean} True if saved successfully, false otherwise
 */
export function saveThreshold(courseId, userId, threshold) {
    const key = `${STORAGE_KEY_PREFIX}${courseId}_${userId}`;
    
    try {
        if (typeof threshold !== 'number' || isNaN(threshold)) {
            logger.error(`[thresholdStorage] Invalid threshold value: ${threshold}. Must be a number.`);
            return false;
        }
        
        localStorage.setItem(key, threshold.toString());
        logger.info(`[thresholdStorage] Saved threshold for course ${courseId}, user ${userId}: ${threshold}`);
        return true;
        
    } catch (error) {
        logger.error('[thresholdStorage] Error writing to localStorage', error);
        return false;
    }
}

/**
 * Reset threshold to default value
 * 
 * @param {string} courseId - Canvas course ID
 * @param {string} userId - Canvas user ID
 * @returns {boolean} True if reset successfully, false otherwise
 */
export function resetThreshold(courseId, userId) {
    const key = `${STORAGE_KEY_PREFIX}${courseId}_${userId}`;
    
    try {
        localStorage.removeItem(key);
        logger.info(`[thresholdStorage] Reset threshold for course ${courseId}, user ${userId} to default: ${DEFAULT_THRESHOLD}`);
        return true;
        
    } catch (error) {
        logger.error('[thresholdStorage] Error removing from localStorage', error);
        return false;
    }
}

/**
 * Export default threshold value for external use
 */
export { DEFAULT_THRESHOLD };
