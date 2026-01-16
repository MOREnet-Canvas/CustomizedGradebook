// src/utils/courseDetection.js
/**
 * Course Detection Utilities
 * 
 * Shared utilities for detecting standards-based courses across the application.
 * Used by dashboard, all-grades page, and other modules that need to identify
 * which courses use standards-based grading (0-4 scale) vs traditional grading.
 * 
 * Detection Methods:
 * 1. Course name pattern matching (fastest - no API calls)
 * 2. AVG Assignment presence check (reliable - requires API call)
 * 3. Letter grade validation against rating scale (for enrollment data)
 * 
 * All results are cached in sessionStorage for performance.
 */

import { logger } from './logger.js';
import { 
    AVG_ASSIGNMENT_NAME, 
    STANDARDS_BASED_COURSE_PATTERNS,
    OUTCOME_AND_RUBRIC_RATINGS 
} from '../config.js';

/**
 * Check if a course name matches any of the configured standards-based patterns
 * @param {string} courseName - Course name to check
 * @returns {boolean} True if course name matches a pattern
 */
export function matchesCourseNamePattern(courseName) {
    if (!courseName) return false;

    return STANDARDS_BASED_COURSE_PATTERNS.some(pattern => {
        if (typeof pattern === 'string') {
            // Case-insensitive string matching
            return courseName.toLowerCase().includes(pattern.toLowerCase());
        } else if (pattern instanceof RegExp) {
            // Regex pattern matching
            return pattern.test(courseName);
        }
        return false;
    });
}

/**
 * Check if a letter grade matches any description in the rating scale
 * Used to validate if a letter grade from Canvas matches our standards-based scale
 * @param {string|null} letterGrade - Letter grade to validate
 * @returns {boolean} True if letter grade matches a rating description
 */
export function isValidLetterGrade(letterGrade) {
    if (!letterGrade || typeof letterGrade !== 'string') {
        return false;
    }

    const trimmed = letterGrade.trim();
    if (!trimmed) return false;

    // Check if the letter grade matches any rating description
    const rating = OUTCOME_AND_RUBRIC_RATINGS.find(
        r => r.description.toLowerCase() === trimmed.toLowerCase()
    );

    return rating !== undefined;
}

/**
 * Check if a course has the AVG Assignment (Current Score Assignment)
 * Makes an API call to check for assignment presence
 * @param {string} courseId - Course ID
 * @param {Object} apiClient - CanvasApiClient instance
 * @returns {Promise<boolean>} True if course has AVG Assignment
 */
export async function hasAvgAssignment(courseId, apiClient) {
    try {
        const assignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments`,
            { search_term: AVG_ASSIGNMENT_NAME },
            'checkAvgAssignment'
        );
        
        return assignments.some(a => a.name === AVG_ASSIGNMENT_NAME);
    } catch (error) {
        logger.warn(`Could not check assignments for course ${courseId}:`, error.message);
        return false;
    }
}

/**
 * Detect if a course uses standards-based grading
 * 
 * Detection strategy (in order):
 * 1. Check cache - return cached result if available
 * 2. Check course name patterns - fastest, no API calls
 * 3. Check letter grade validity - if enrollment data includes letter grade
 * 4. Check AVG Assignment presence - requires API call
 * 
 * @param {Object} options - Detection options
 * @param {string} options.courseId - Course ID (required)
 * @param {string} options.courseName - Course name (required for pattern matching)
 * @param {string|null} [options.letterGrade] - Letter grade from enrollment (optional)
 * @param {Object} options.apiClient - CanvasApiClient instance (required for API checks)
 * @param {boolean} [options.skipApiCheck=false] - Skip API check (for fast path)
 * @returns {Promise<boolean>} True if course uses standards-based grading
 */
export async function isStandardsBasedCourse(options) {
    const { courseId, courseName, letterGrade = null, apiClient, skipApiCheck = false } = options;

    if (!courseId || !courseName) {
        logger.warn('isStandardsBasedCourse called without required courseId or courseName');
        return false;
    }

    // 1. Check cache first
    const cacheKey = `standardsBased_${courseId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
        logger.trace(`[Course Detection] Cache hit for course ${courseId}: ${cached}`);
        return cached === 'true';
    }

    // 2. Check course name patterns (fastest - no API calls)
    if (matchesCourseNamePattern(courseName)) {
        logger.debug(`[Course Detection] Course "${courseName}" matches standards-based pattern`);
        sessionStorage.setItem(cacheKey, 'true');
        return true;
    }

    // 3. Check letter grade validity (if provided)
    if (letterGrade && isValidLetterGrade(letterGrade)) {
        logger.debug(`[Course Detection] Course "${courseName}" has valid letter grade: ${letterGrade}`);
        sessionStorage.setItem(cacheKey, 'true');
        return true;
    }

    // 4. Check AVG Assignment presence (requires API call)
    if (!skipApiCheck && apiClient) {
        const hasAvg = await hasAvgAssignment(courseId, apiClient);
        if (hasAvg) {
            logger.debug(`[Course Detection] Course "${courseName}" has AVG Assignment`);
            sessionStorage.setItem(cacheKey, 'true');
            return true;
        }
    }

    // Not standards-based
    logger.trace(`[Course Detection] Course "${courseName}" is traditional (not standards-based)`);
    sessionStorage.setItem(cacheKey, 'false');
    return false;
}

/**
 * Clear detection cache for a specific course or all courses
 * @param {string|null} courseId - Course ID to clear, or null to clear all
 */
export function clearDetectionCache(courseId = null) {
    if (courseId) {
        const cacheKey = `standardsBased_${courseId}`;
        sessionStorage.removeItem(cacheKey);
        logger.debug(`[Course Detection] Cleared cache for course ${courseId}`);
    } else {
        // Clear all detection cache entries
        const keys = Object.keys(sessionStorage);
        const detectionKeys = keys.filter(k => k.startsWith('standardsBased_'));
        detectionKeys.forEach(k => sessionStorage.removeItem(k));
        logger.debug(`[Course Detection] Cleared all detection cache (${detectionKeys.length} entries)`);
    }
}

