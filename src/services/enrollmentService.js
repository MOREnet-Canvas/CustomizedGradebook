/**
 * Enrollment Service
 * 
 * Provides shared utilities for fetching and parsing Canvas enrollment data.
 * This service consolidates enrollment-related logic that was previously duplicated
 * across dashboard and student modules.
 * 
 * @module services/enrollmentService
 */

import { logger } from '../utils/logger.js';

/**
 * Parses grade information from a Canvas enrollment object.
 * 
 * Canvas API can return grades in two different structures:
 * 1. Nested in 'grades' object: grades.current_score, grades.final_score
 * 2. Top-level fields: computed_current_score, calculated_current_score, etc.
 * 
 * This function handles both structures and returns a normalized grade object.
 * 
 * @param {Object} enrollmentData - Canvas enrollment object
 * @param {Object} [enrollmentData.grades] - Nested grades object (most common)
 * @param {number} [enrollmentData.grades.current_score] - Current score percentage
 * @param {number} [enrollmentData.grades.final_score] - Final score percentage
 * @param {string} [enrollmentData.grades.current_grade] - Current letter grade
 * @param {string} [enrollmentData.grades.final_grade] - Final letter grade
 * @param {number} [enrollmentData.computed_current_score] - Alternative: computed current score
 * @param {number} [enrollmentData.calculated_current_score] - Alternative: calculated current score
 * @param {string} [enrollmentData.computed_current_grade] - Alternative: computed current grade
 * @param {string} [enrollmentData.calculated_current_grade] - Alternative: calculated current grade
 * @returns {{score: number|null, letterGrade: string|null}|null} Normalized grade object or null if no grade data
 * 
 * @example
 * // With nested grades object
 * const enrollment = {
 *   grades: { current_score: 85.5, current_grade: 'B' }
 * };
 * const grade = parseEnrollmentGrade(enrollment);
 * // Returns: { score: 85.5, letterGrade: 'B' }
 * 
 * @example
 * // With top-level fields
 * const enrollment = {
 *   computed_current_score: 92.0,
 *   computed_current_grade: 'A-'
 * };
 * const grade = parseEnrollmentGrade(enrollment);
 * // Returns: { score: 92.0, letterGrade: 'A-' }
 */
export function parseEnrollmentGrade(enrollmentData) {
    if (!enrollmentData) {
        return null;
    }

    let score = null;
    let letterGrade = null;

    // Try nested grades object first (most common structure with include[]=total_scores)
    if (enrollmentData.grades) {
        score = enrollmentData.grades.current_score
            ?? enrollmentData.grades.final_score;

        letterGrade = (enrollmentData.grades.current_grade
            ?? enrollmentData.grades.final_grade
            ?? null)?.trim() ?? null;
    }

    // Fallback to top-level fields (alternative API response structure)
    if (score === null || score === undefined) {
        score = enrollmentData.computed_current_score
            ?? enrollmentData.calculated_current_score
            ?? enrollmentData.computed_final_score
            ?? enrollmentData.calculated_final_score;
    }

    if (letterGrade === null && score !== null) {
        letterGrade = (enrollmentData.computed_current_grade
            ?? enrollmentData.calculated_current_grade
            ?? enrollmentData.computed_final_grade
            ?? enrollmentData.calculated_final_grade
            ?? null)?.trim() ?? null;
    }

    // Return null if no grade data found
    if (score === null && letterGrade === null) {
        return null;
    }

    return { score, letterGrade };
}

/**
 * Fetches all student enrollments from Canvas API.
 * 
 * @param {Object} apiClient - Canvas API client instance
 * @param {Object} [options] - Fetch options
 * @param {string} [options.state='active'] - Enrollment state filter (active, completed, etc.)
 * @param {boolean} [options.includeTotalScores=true] - Whether to include total_scores in response
 * @returns {Promise<Array>} Array of enrollment objects
 * 
 * @example
 * const enrollments = await fetchAllEnrollments(apiClient, {
 *   state: 'active',
 *   includeTotalScores: true
 * });
 */
export async function fetchAllEnrollments(apiClient, options = {}) {
    const {
        state = 'active',
        includeTotalScores = true
    } = options;

    try {
        const params = {
            'type[]': 'StudentEnrollment',
            'state[]': state
        };

        if (includeTotalScores) {
            params['include[]'] = 'total_scores';
        }

        const enrollments = await apiClient.get(
            '/api/v1/users/self/enrollments',
            params,
            'fetchAllEnrollments'
        );

        logger.trace(`[EnrollmentService] Fetched ${enrollments.length} enrollments from API`);
        return enrollments;

    } catch (error) {
        logger.warn('[EnrollmentService] Failed to fetch enrollments:', error.message);
        return [];
    }
}

/**
 * Fetches enrollment for a specific course.
 *
 * @param {string|number} courseId - Canvas course ID
 * @param {Object} apiClient - Canvas API client instance
 * @returns {Promise<Object|null>} Enrollment object or null if not found
 *
 * @example
 * const enrollment = await fetchSingleEnrollment('12345', apiClient);
 * if (enrollment) {
 *   const grade = parseEnrollmentGrade(enrollment);
 * }
 */
export async function fetchSingleEnrollment(courseId, apiClient) {
    try {
        // Fetch enrollments for specific course
        const enrollments = await apiClient.get(
            `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment`,
            {},
            'fetchSingleEnrollment'
        );

        logger.trace(`[EnrollmentService] Fetched ${enrollments.length} enrollment(s) for course ${courseId}`);

        // Find student enrollment - try both "StudentEnrollment" and "student"
        const studentEnrollment = enrollments.find(e =>
            e.type === 'StudentEnrollment' ||
            e.type === 'student' ||
            e.role === 'StudentEnrollment'
        );

        if (!studentEnrollment) {
            logger.trace(`[EnrollmentService] No student enrollment found for course ${courseId}`);
            if (logger.isTraceEnabled() && enrollments.length > 0) {
                logger.trace(`[EnrollmentService] Available enrollment types:`, enrollments.map(e => e.type || e.role));
            }
            return null;
        }

        logger.trace(`[EnrollmentService] Found student enrollment for course ${courseId}`);
        return studentEnrollment;

    } catch (error) {
        logger.warn(`[EnrollmentService] Failed to fetch enrollment for course ${courseId}:`, error.message);
        return null;
    }
}

/**
 * Converts array of enrollments to a Map of course grades.
 *
 * @param {Array} enrollments - Array of enrollment objects from Canvas API
 * @returns {Map<string, {percentage: number|null, letterGrade: string|null}>} Map of courseId to grade data
 *
 * @example
 * const enrollments = await fetchAllEnrollments(apiClient);
 * const gradeMap = extractEnrollmentData(enrollments);
 * const courseGrade = gradeMap.get('12345');
 * // Returns: { percentage: 85.5, letterGrade: 'B' }
 */
export function extractEnrollmentData(enrollments) {
    const gradeMap = new Map();

    if (!Array.isArray(enrollments)) {
        logger.warn('[EnrollmentService] extractEnrollmentData called with non-array:', typeof enrollments);
        return gradeMap;
    }

    for (const enrollment of enrollments) {
        const courseId = enrollment.course_id?.toString();
        if (!courseId) {
            logger.trace('[EnrollmentService] Skipping enrollment without course_id');
            continue;
        }

        const gradeData = parseEnrollmentGrade(enrollment);
        if (!gradeData) {
            logger.trace(`[EnrollmentService] No grade data found for course ${courseId}`);
            gradeMap.set(courseId, { percentage: null, letterGrade: null });
            continue;
        }

        // Map 'score' to 'percentage' for compatibility with existing code
        gradeMap.set(courseId, {
            percentage: gradeData.score,
            letterGrade: gradeData.letterGrade
        });

        logger.trace(`[EnrollmentService] Course ${courseId}: percentage=${gradeData.score}%, letterGrade="${gradeData.letterGrade || 'null'}"`);
    }

    logger.trace(`[EnrollmentService] Extracted grade data for ${gradeMap.size} courses`);
    return gradeMap;
}