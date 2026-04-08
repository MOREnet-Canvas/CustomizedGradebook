// src/masteryOutlook/colorSchemeStorage.js
/**
 * Color Scheme Storage Service
 * 
 * Manages user preference for Mastery Outlook color scheme.
 * Options: 'soft' (default pastel) or 'canvas' (Canvas mastery colors)
 * 
 * Storage pattern: cg_outlook_colorscheme_{courseId}_{userId}
 */

import { logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_COLOR_SCHEME = 'soft';
const STORAGE_KEY_PREFIX = 'cg_outlook_colorscheme_';

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get color scheme preference for current user and course
 * 
 * @param {string} courseId - Canvas course ID
 * @param {string} userId - Canvas user ID
 * @returns {string} 'soft' or 'canvas'
 */
export function getColorScheme(courseId, userId) {
    const key = `${STORAGE_KEY_PREFIX}${courseId}_${userId}`;
    
    try {
        const storedValue = localStorage.getItem(key);
        
        if (storedValue === null) {
            logger.debug(`[colorSchemeStorage] No stored color scheme. Using default: ${DEFAULT_COLOR_SCHEME}`);
            return DEFAULT_COLOR_SCHEME;
        }
        
        if (storedValue !== 'soft' && storedValue !== 'canvas') {
            logger.warn(`[colorSchemeStorage] Invalid color scheme "${storedValue}". Using default: ${DEFAULT_COLOR_SCHEME}`);
            return DEFAULT_COLOR_SCHEME;
        }
        
        logger.debug(`[colorSchemeStorage] Loaded color scheme: ${storedValue}`);
        return storedValue;
        
    } catch (error) {
        logger.error('[colorSchemeStorage] Error reading from localStorage', error);
        return DEFAULT_COLOR_SCHEME;
    }
}

/**
 * Save color scheme preference for current user and course
 * 
 * @param {string} courseId - Canvas course ID
 * @param {string} userId - Canvas user ID
 * @param {string} colorScheme - 'soft' or 'canvas'
 * @returns {boolean} True if saved successfully, false otherwise
 */
export function saveColorScheme(courseId, userId, colorScheme) {
    const key = `${STORAGE_KEY_PREFIX}${courseId}_${userId}`;
    
    try {
        if (colorScheme !== 'soft' && colorScheme !== 'canvas') {
            logger.error(`[colorSchemeStorage] Invalid color scheme: ${colorScheme}. Must be 'soft' or 'canvas'.`);
            return false;
        }
        
        localStorage.setItem(key, colorScheme);
        logger.info(`[colorSchemeStorage] Saved color scheme: ${colorScheme}`);
        return true;
        
    } catch (error) {
        logger.error('[colorSchemeStorage] Error writing to localStorage', error);
        return false;
    }
}
