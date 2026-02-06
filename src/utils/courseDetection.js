// src/utils/courseDetection.js
/**
 * Course Detection Utilities
 *
 * Shared function for course model classification.
 * All modules must use determineCourseModel() for classification.
 *
 * Classification Rules (ONLY these two tests):
 * 1. Name pattern test (first, short-circuit): If course name matches pattern → "standards"
 * 2. Assignment presence test (only if name does NOT match): If AVG_ASSIGNMENT_NAME exists → "standards", else → "traditional"
 *
 * Results are stored in session data (cg_courseSnapshot_<courseId>).
 * Modules should read from session data rather than re-fetching.
 *
 * NOTE: This module does NOT cache results. Caching is handled by courseSnapshotService.
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
        logger.trace(`[hasAvgAssignment] Searching for assignment "${AVG_ASSIGNMENT_NAME}" in course ${courseId}`);

        const assignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
            {},
            'checkAvgAssignment'
        );

        // Log the API response for debugging
        logger.trace(`[hasAvgAssignment] API returned ${Array.isArray(assignments) ? assignments.length : 'non-array'} assignments`);

        if (!Array.isArray(assignments)) {
            logger.warn(`[hasAvgAssignment] API response is not an array for course ${courseId}:`, typeof assignments);
            return false;
        }

        if (assignments.length === 0) {
            logger.trace(`[hasAvgAssignment] No assignments found with search_term="${AVG_ASSIGNMENT_NAME}" in course ${courseId}`);
            return false;
        }

        // Log all assignment names for debugging
        logger.trace(`[hasAvgAssignment] Found assignments:`, assignments.map(a => a.name).join(', '));

        // Exact match check (search_term only filters by prefix)
        const hasMatch = assignments.some(a => a.name === AVG_ASSIGNMENT_NAME);
        logger.trace(`[hasAvgAssignment] Exact match for "${AVG_ASSIGNMENT_NAME}": ${hasMatch ? 'YES' : 'NO'}`);

        return hasMatch;
    } catch (error) {
        logger.warn(`[hasAvgAssignment] Could not check assignments for course ${courseId}:`, error.message);
        logger.trace(`[hasAvgAssignment] Error details:`, error);
        return false;
    }
}

/**
 * Determine course model classification
 *
 * This is the single shared function for course classification.
 * All modules must use this function or read from session data.
 *
 * Classification Rules (ONLY these two tests):
 * 1. Name pattern test (first, short-circuit): If course name matches pattern → "standards"
 * 2. Assignment presence test (only if name does NOT match): If AVG_ASSIGNMENT_NAME exists → "standards", else → "traditional"
 *
 * Pure detection function - does NOT cache results.
 * Caching is handled by courseSnapshotService.
 *
 * @param {Object} course - Course data
 * @param {string} course.courseId - Course ID (required)
 * @param {string} course.courseName - Course name (required)
 * @param {Object} sessionData - Session data (unused, for future compatibility)
 * @param {Object} options - Detection options
 * @param {Object} options.apiClient - CanvasApiClient instance (required for assignment check)
 * @returns {Promise<{model: "standards"|"traditional", reason: "name-pattern"|"avg-assignment"}>}
 *
 * @example
 * const result = await determineCourseModel(
 *   { courseId: '12345', courseName: 'Math 101' },
 *   null,
 *   { apiClient }
 * );
 * console.log(result.model); // "standards" or "traditional"
 * console.log(result.reason); // "name-pattern" or "avg-assignment"
 */
export async function determineCourseModel(course, sessionData, options) {
    const { courseId, courseName } = course;
    const { apiClient } = options;

    if (!courseId || !courseName) {
        logger.warn('[CourseModel] determineCourseModel called without required courseId or courseName');
        return { model: 'traditional', reason: 'invalid-input' };
    }

    logger.trace(`[CourseModel] Classifying course ${courseId} "${courseName}"`);

    // Rule 1: Name pattern test (short-circuit)
    const matchesPattern = matchesCourseNamePattern(courseName);
    logger.trace(`[CourseModel] Rule 1 - Pattern match: ${matchesPattern ? 'YES' : 'NO'}`);
    if (matchesPattern) {
        logger.debug(`[CourseModel] ✅ Course "${courseName}" → standards (name-pattern)`);
        return { model: 'standards', reason: 'name-pattern' };
    }

    // Rule 2: Assignment presence test (only if name does NOT match)
    if (!apiClient) {
        logger.warn(`[CourseModel] No apiClient provided for course ${courseId}, defaulting to traditional`);
        return { model: 'traditional', reason: 'no-api-client' };
    }

    logger.trace(`[CourseModel] Rule 2 - Checking AVG Assignment presence...`);
    const hasAvg = await hasAvgAssignment(courseId, apiClient);
    logger.trace(`[CourseModel] Rule 2 - AVG Assignment: ${hasAvg ? 'FOUND' : 'NOT FOUND'}`);

    if (hasAvg) {
        logger.debug(`[CourseModel] ✅ Course "${courseName}" → standards (avg-assignment)`);
        return { model: 'standards', reason: 'avg-assignment' };
    }

    logger.debug(`[CourseModel] ❌ Course "${courseName}" → traditional`);
    return { model: 'traditional', reason: 'no-match' };
}

/**
 * Debug helper: Test assignment detection for a specific course
 * Can be called from browser console to diagnose detection issues
 *
 * @param {string} courseId - Course ID to test
 * @returns {Promise<Object>} Debug information about assignment detection
 *
 * @example
 * // In browser console:
 * import { debugAssignmentDetection } from './utils/courseDetection.js';
 * const result = await debugAssignmentDetection('12345');
 * console.log(result);
 */
export async function debugAssignmentDetection(courseId) {
    const { CanvasApiClient } = await import('./canvasApiClient.js');
    const apiClient = new CanvasApiClient();

    logger.info(`[Debug] Testing assignment detection for course ${courseId}`);
    logger.info(`[Debug] Looking for assignment: "${AVG_ASSIGNMENT_NAME}"`);

    try {
        // Test 1: Search with search_term
        logger.info(`[Debug] Test 1: Using search_term parameter`);
        const searchResults = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
            {},
            'debugSearch'
        );

        logger.info(`[Debug] Search returned ${Array.isArray(searchResults) ? searchResults.length : 'non-array'} results`);
        if (Array.isArray(searchResults)) {
            searchResults.forEach((a, i) => {
                logger.info(`[Debug]   ${i + 1}. "${a.name}" (ID: ${a.id}, published: ${a.published})`);
            });
        }

        // Test 2: Get all assignments (no search filter)
        logger.info(`[Debug] Test 2: Fetching all assignments (no filter)`);
        const allAssignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments`,
            {},
            'debugAllAssignments'
        );

        logger.info(`[Debug] Found ${Array.isArray(allAssignments) ? allAssignments.length : 'non-array'} total assignments`);
        if (Array.isArray(allAssignments)) {
            const avgAssignment = allAssignments.find(a => a.name === AVG_ASSIGNMENT_NAME);
            if (avgAssignment) {
                logger.info(`[Debug] ✅ AVG Assignment FOUND in all assignments:`);
                logger.info(`[Debug]   Name: "${avgAssignment.name}"`);
                logger.info(`[Debug]   ID: ${avgAssignment.id}`);
                logger.info(`[Debug]   Published: ${avgAssignment.published}`);
                logger.info(`[Debug]   Workflow State: ${avgAssignment.workflow_state}`);
            } else {
                logger.info(`[Debug] ❌ AVG Assignment NOT FOUND in all assignments`);
                logger.info(`[Debug] Available assignments:`);
                allAssignments.slice(0, 10).forEach((a, i) => {
                    logger.info(`[Debug]   ${i + 1}. "${a.name}"`);
                });
                if (allAssignments.length > 10) {
                    logger.info(`[Debug]   ... and ${allAssignments.length - 10} more`);
                }
            }
        }

        // Test 3: Run actual detection
        logger.info(`[Debug] Test 3: Running hasAvgAssignment()`);
        const hasAvg = await hasAvgAssignment(courseId, apiClient);
        logger.info(`[Debug] hasAvgAssignment() returned: ${hasAvg}`);

        return {
            courseId,
            searchTerm: AVG_ASSIGNMENT_NAME,
            searchResults: Array.isArray(searchResults) ? searchResults.length : null,
            totalAssignments: Array.isArray(allAssignments) ? allAssignments.length : null,
            hasAvgAssignment: hasAvg,
            avgAssignmentFound: Array.isArray(allAssignments) ? allAssignments.some(a => a.name === AVG_ASSIGNMENT_NAME) : false
        };
    } catch (error) {
        logger.error(`[Debug] Error during detection test:`, error);
        return {
            courseId,
            error: error.message
        };
    }
}

/**
 * LEGACY: Detect if a course uses standards-based grading
 *
 * @deprecated Use determineCourseModel() instead
 *
 * This function is kept for backward compatibility.
 * It wraps determineCourseModel() and returns a boolean.
 *
 * Detection strategy (in order):
 * 1. Check course name patterns - fastest, no API calls
 * 2. Check letter grade validity - if enrollment data includes letter grade
 * 3. Check AVG Assignment presence - requires API call
 *
 * @param {Object} options - Detection options
 * @param {string} options.courseId - Course ID (required for logging)
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

    logger.trace(`[Detection] Starting detection for course ${courseId} "${courseName}"`);
    logger.trace(`[Detection] Input: letterGrade="${letterGrade}", skipApiCheck=${skipApiCheck}`);

    // 1. Check course name patterns (fastest - no API calls)
    const matchesPattern = matchesCourseNamePattern(courseName);
    logger.trace(`[Detection] Step 1 - Pattern match: ${matchesPattern ? 'YES' : 'NO'}`);
    if (matchesPattern) {
        logger.debug(`[Detection] ✅ Course "${courseName}" detected as standards-based (pattern match)`);
        return true;
    }

    // 2. Check letter grade validity (if provided)
    logger.trace(`[Detection] Step 2 - Letter grade validation: letterGrade="${letterGrade}"`);
    if (letterGrade) {
        const isValid = isValidLetterGrade(letterGrade);
        logger.trace(`[Detection] Step 2 - isValidLetterGrade("${letterGrade}") = ${isValid}`);

        if (isValid) {
            logger.debug(`[Detection] ✅ Course "${courseName}" detected as standards-based (valid letter grade: "${letterGrade}")`);
            return true;
        } else {
            // Log why it failed
            const availableGrades = OUTCOME_AND_RUBRIC_RATINGS.map(r => r.description).join(', ');
            logger.trace(`[Detection] Step 2 - Letter grade "${letterGrade}" does NOT match any rating. Available: ${availableGrades}`);
        }
    } else {
        logger.trace(`[Detection] Step 2 - No letter grade provided, skipping validation`);
    }

    // 3. Check AVG Assignment presence (requires API call)
    if (!skipApiCheck && apiClient) {
        logger.trace(`[Detection] Step 3 - Checking AVG Assignment presence via API...`);
        const hasAvg = await hasAvgAssignment(courseId, apiClient);
        logger.trace(`[Detection] Step 3 - AVG Assignment: ${hasAvg ? 'FOUND' : 'NOT FOUND'}`);

        if (hasAvg) {
            logger.debug(`[Detection] ✅ Course "${courseName}" detected as standards-based (AVG Assignment found)`);
            return true;
        }
    } else {
        logger.trace(`[Detection] Step 3 - Skipped (skipApiCheck=${skipApiCheck}, hasApiClient=${!!apiClient})`);
    }

    // Not standards-based
    logger.debug(`[Detection] ❌ Course "${courseName}" is traditional (not standards-based)`);
    return false;
}