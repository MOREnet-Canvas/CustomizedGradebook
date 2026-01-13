// src/dashboard/gradeDataService.js
/**
 * Grade Data Service
 *
 * Fetches grade data for dashboard display using Canvas APIs.
 * Implements a fallback hierarchy:
 * 1. Primary: AVG_ASSIGNMENT_NAME assignment score (0-4 scale)
 * 2. Fallback: Total course score from enrollments API (grades.current_score/current_grade)
 *
 * This service is designed to be flexible for future changes in grading approaches.
 */

import { AVG_ASSIGNMENT_NAME } from '../config.js';
import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';

/**
 * Grade source types
 * @readonly
 * @enum {string}
 */
export const GRADE_SOURCE = Object.freeze({
    ASSIGNMENT: 'assignment',
    ENROLLMENT: 'enrollment'
});

/**
 * Cache TTL in milliseconds (5 minutes)
 * Centralized configuration for easy adjustment
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache for course grades (session-based)
 * Key: courseId, Value: { value: { score, letterGrade, source }, expiresAt: timestamp }
 */
const gradeCache = new Map();

/**
 * Get cached grade if available and not expired
 * @param {string} courseId - Course ID
 * @returns {Object|null} Cached grade data or null
 */
function getCachedGrade(courseId) {
    const cached = gradeCache.get(courseId);
    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() > cached.expiresAt) {
        gradeCache.delete(courseId);
        logger.trace(`Cache expired for course ${courseId}`);
        return null;
    }

    logger.trace(`Cache hit for course ${courseId}, expires in ${Math.round((cached.expiresAt - Date.now()) / 1000)}s`);
    return cached.value;
}

/**
 * Cache grade data with explicit expiration timestamp
 * @param {string} courseId - Course ID
 * @param {number} score - Grade score value
 * @param {string|null} letterGrade - Letter grade (if available)
 * @param {string} source - Grade source (GRADE_SOURCE.ASSIGNMENT or GRADE_SOURCE.ENROLLMENT)
 */
function cacheGrade(courseId, score, letterGrade, source) {
    const expiresAt = Date.now() + CACHE_TTL_MS;
    gradeCache.set(courseId, {
        value: { score, letterGrade, source },
        expiresAt
    });
    logger.trace(`Cached grade for course ${courseId}, expires at ${new Date(expiresAt).toISOString()}`);
}

/**
 * Clear all cached grades
 * Useful for debugging and SPA navigation cleanup
 */
export function clearGradeCache() {
    const size = gradeCache.size;
    gradeCache.clear();
    logger.debug(`Grade cache cleared (${size} entries removed)`);
}

/**
 * Fetch AVG assignment score and letter grade for a course
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string|null}|null>} Assignment data or null if not found
 */
async function fetchAvgAssignmentScore(courseId, apiClient) {
    try {
        // Search for the assignment by name
        const assignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
            {},
            'fetchAvgAssignment'
        );

        // Find exact match
        const avgAssignment = assignments.find(a => a.name === AVG_ASSIGNMENT_NAME);
        if (!avgAssignment) {
            logger.trace(`AVG assignment "${AVG_ASSIGNMENT_NAME}" not found in course ${courseId}`);
            return null;
        }

        // Fetch student's submission for this assignment
        const submission = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/self`,
            {},
            'fetchAvgSubmission'
        );

        // Extract score
        const score = submission?.score;
        if (score === null || score === undefined) {
            logger.trace(`No score found for AVG assignment in course ${courseId}`);
            return null;
        }

        // Also fetch letter grade from enrollment data to display alongside the score
        let letterGrade = null;
        try {
            const enrollments = await apiClient.get(
                `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment`,
                {},
                'fetchEnrollmentForLetterGrade'
            );

            const studentEnrollment = enrollments.find(e =>
                e.type === 'StudentEnrollment' ||
                e.type === 'student' ||
                e.role === 'StudentEnrollment'
            );

            if (studentEnrollment) {
                // Check nested grades object first (most common structure)
                if (studentEnrollment.grades) {
                    letterGrade = (studentEnrollment.grades.current_grade
                        ?? studentEnrollment.grades.final_grade
                        ?? null)?.trim() ?? null;
                }

                // Fallback to top-level fields
                if (letterGrade === null) {
                    letterGrade = (studentEnrollment.computed_current_grade
                        ?? studentEnrollment.calculated_current_grade
                        ?? studentEnrollment.computed_final_grade
                        ?? studentEnrollment.calculated_final_grade
                        ?? null)?.trim() ?? null;
                }
            }
        } catch (error) {
            logger.trace(`Could not fetch letter grade for AVG assignment in course ${courseId}:`, error.message);
            // Continue without letter grade
        }

        logger.trace(`AVG assignment data for course ${courseId}: ${score} (${letterGrade || 'no letter grade'})`);
        return { score, letterGrade };

    } catch (error) {
        logger.warn(`Failed to fetch AVG assignment score for course ${courseId}:`, error.message);
        return null;
    }
}

/**
 * Fetch total course score and letter grade from enrollments
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string}|null>} Grade data or null if not found
 */
async function fetchEnrollmentScore(courseId, apiClient) {
    try {
        // Fetch enrollments
        const enrollments = await apiClient.get(
            `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment`,
            {},
            'fetchEnrollment'
        );

        logger.trace(`Enrollment response for course ${courseId}:`, enrollments);

        // Find student enrollment - try both "StudentEnrollment" and "student"
        const studentEnrollment = enrollments.find(e =>
            e.type === 'StudentEnrollment' ||
            e.type === 'student' ||
            e.role === 'StudentEnrollment'
        );

        if (!studentEnrollment) {
            logger.trace(`No student enrollment found for course ${courseId}`);
            if (logger.isTraceEnabled() && enrollments.length > 0) {
                logger.trace(`Available enrollment types:`, enrollments.map(e => e.type || e.role));
            }
            return null;
        }

        logger.trace(`Student enrollment for course ${courseId}:`, studentEnrollment);

        // Extract score - Canvas API can return grades in two different structures:
        // 1. Nested in 'grades' object: grades.current_score, grades.final_score
        // 2. Top-level fields: computed_current_score, calculated_current_score, etc.
        let score = null;
        let letterGrade = null;

        // Try nested grades object first (most common structure)
        if (studentEnrollment.grades) {
            score = studentEnrollment.grades.current_score
                ?? studentEnrollment.grades.final_score;

            letterGrade = (studentEnrollment.grades.current_grade
                ?? studentEnrollment.grades.final_grade
                ?? null)?.trim() ?? null;
        }

        // Fallback to top-level fields (alternative API response structure)
        if (score === null || score === undefined) {
            score = studentEnrollment.computed_current_score
                ?? studentEnrollment.calculated_current_score
                ?? studentEnrollment.computed_final_score
                ?? studentEnrollment.calculated_final_score;
        }

        if (letterGrade === null && score !== null) {
            letterGrade = (studentEnrollment.computed_current_grade
                ?? studentEnrollment.calculated_current_grade
                ?? studentEnrollment.computed_final_grade
                ?? studentEnrollment.calculated_final_grade
                ?? null)?.trim() ?? null;
        }

        if (score === null || score === undefined) {
            logger.trace(`No enrollment score found for course ${courseId}`);
            logger.trace(`Enrollment object:`, studentEnrollment);
            return null;
        }

        logger.trace(`Enrollment data for course ${courseId}: ${score}% (${letterGrade || 'no letter grade'})`);

        return {
            score,
            letterGrade
        };

    } catch (error) {
        logger.warn(`Failed to fetch enrollment score for course ${courseId}:`, error.message);
        if (logger.isDebugEnabled()) {
            logger.warn(`Full error:`, error);
        }
        return null;
    }
}

/**
 * Get course grade with fallback hierarchy
 * Priority order:
 * 1. Primary: AVG assignment score (0-4 scale)
 * 2. Fallback: Enrollment grade (grades.current_score/current_grade)
 *
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string|null, source: string}|null>} Grade data or null
 */
export async function getCourseGrade(courseId, apiClient) {
    logger.trace(`[Grade Source Debug] Course ${courseId}: Starting grade fetch with fallback hierarchy`);

    // Check cache first
    const cached = getCachedGrade(courseId);
    if (cached) {
        logger.trace(`[Grade Source Debug] Course ${courseId}: Using cached grade (source=${cached.source}, score=${cached.score}, letterGrade=${cached.letterGrade})`);
        return {
            score: cached.score,
            letterGrade: cached.letterGrade,
            source: cached.source
        };
    }

    // Priority 1: Try AVG assignment
    logger.trace(`[Grade Source Debug] Course ${courseId}: Checking priority 1 - AVG assignment...`);
    const avgData = await fetchAvgAssignmentScore(courseId, apiClient);
    if (avgData !== null) {
        logger.trace(`[Grade Source Debug] Course ${courseId}: AVG assignment found! score=${avgData.score}, letterGrade=${avgData.letterGrade}`);
        // AVG assignment returns 0-4 scale score with letter grade from enrollment
        cacheGrade(courseId, avgData.score, avgData.letterGrade, GRADE_SOURCE.ASSIGNMENT);
        return { score: avgData.score, letterGrade: avgData.letterGrade, source: GRADE_SOURCE.ASSIGNMENT };
    }
    logger.trace(`[Grade Source Debug] Course ${courseId}: AVG assignment not found, checking priority 2...`);

    // Priority 2: Fallback to enrollment score
    logger.trace(`[Grade Source Debug] Course ${courseId}: Checking priority 2 - enrollment grade...`);
    const enrollmentData = await fetchEnrollmentScore(courseId, apiClient);
    if (enrollmentData !== null) {
        logger.trace(`[Grade Source Debug] Course ${courseId}: Enrollment grade found! score=${enrollmentData.score}, letterGrade=${enrollmentData.letterGrade}`);
        cacheGrade(courseId, enrollmentData.score, enrollmentData.letterGrade, GRADE_SOURCE.ENROLLMENT);
        return {
            score: enrollmentData.score,
            letterGrade: enrollmentData.letterGrade,
            source: GRADE_SOURCE.ENROLLMENT
        };
    }
    logger.trace(`[Grade Source Debug] Course ${courseId}: Enrollment grade not found`);

    // No grade available
    logger.trace(`[Grade Source Debug] Course ${courseId}: No grade available from any source`);
    return null;
}

