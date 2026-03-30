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
 * @param {string} [enrollmentData.grades.customGradeStatusId] - Custom grade status ID
 * @param {number} [enrollmentData.grades.override_score] - Override score
 * @param {number} [enrollmentData.computed_current_score] - Alternative: computed current score
 * @param {number} [enrollmentData.calculated_current_score] - Alternative: calculated current score
 * @param {string} [enrollmentData.computed_current_grade] - Alternative: computed current grade
 * @param {string} [enrollmentData.calculated_current_grade] - Alternative: calculated current grade
 * @returns {{score: number|null, letterGrade: string|null, customGradeStatusId: string|null, overrideScore: number|null}|null} Normalized grade object or null if no grade data
 *
 * @example
 * // With nested grades object
 * const enrollment = {
 *   grades: { current_score: 85.5, current_grade: 'B' }
 * };
 * const grade = parseEnrollmentGrade(enrollment);
 * // Returns: { score: 85.5, letterGrade: 'B', customGradeStatusId: null, overrideScore: null }
 *
 * @example
 * // With top-level fields
 * const enrollment = {
 *   computed_current_score: 92.0,
 *   computed_current_grade: 'A-'
 * };
 * const grade = parseEnrollmentGrade(enrollment);
 * // Returns: { score: 92.0, letterGrade: 'A-', customGradeStatusId: null, overrideScore: null }
 *
 * @example
 * // With custom grade status (Insufficient Evidence)
 * const enrollment = {
 *   grades: {
 *     current_score: null,
 *     current_grade: 'Insufficient Evidence',
 *     customGradeStatusId: '1',
 *     override_score: null
 *   }
 * };
 * const grade = parseEnrollmentGrade(enrollment);
 * // Returns: { score: null, letterGrade: 'Insufficient Evidence', customGradeStatusId: '1', overrideScore: null }
 */
export function parseEnrollmentGrade(enrollmentData) {
    if (!enrollmentData) {
        return null;
    }

    let score = null;
    let letterGrade = null;
    let customGradeStatusId = null;
    let overrideScore = null;

    // Try nested grades object first (most common structure with include[]=total_scores)
    if (enrollmentData.grades) {
        score = enrollmentData.grades.current_score
            ?? enrollmentData.grades.final_score;

        letterGrade = (enrollmentData.grades.current_grade
            ?? enrollmentData.grades.final_grade
            ?? null)?.trim() ?? null;

        // Extract custom grade status and override score
        customGradeStatusId = enrollmentData.grades.customGradeStatusId ?? null;
        overrideScore = enrollmentData.grades.override_score ?? null;
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
    if (score === null && letterGrade === null && customGradeStatusId === null) {
        return null;
    }

    return { score, letterGrade, customGradeStatusId, overrideScore };
}

/**
 * Fetches all student and observer enrollments from Canvas API.
 *
 * For observers, the enrollment will include associated_user_id pointing to the observed student.
 * The grade data in observer enrollments reflects the observed student's grades.
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
        const params = new URLSearchParams();
        params.append('type[]', 'StudentEnrollment');
        params.append('type[]', 'ObserverEnrollment');
        params.append('state[]', state);

        if (includeTotalScores) {
            params.append('include[]', 'total_scores');
        }

        const enrollments = await apiClient.get(
            `/api/v1/users/self/enrollments?${params.toString()}`,
            {},
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
 * Supports both student and observer enrollments. For observers, returns the
 * ObserverEnrollment which contains the observed student's grade data.
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
        // Fetch enrollments for specific course (both student and observer types)
        const enrollments = await apiClient.get(
            `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment&type[]=ObserverEnrollment`,
            {},
            'fetchSingleEnrollment'
        );

        logger.trace(`[EnrollmentService] Fetched ${enrollments.length} enrollment(s) for course ${courseId}`);

        // Find student or observer enrollment
        // For observers, check that associated_user_id exists (indicates they're observing a student)
        // Canvas returns lowercase 'observer' for type, but 'ObserverEnrollment' for role
        const studentEnrollment = enrollments.find(e =>
            e.type === 'StudentEnrollment' ||
            e.type === 'student' ||
            e.role === 'StudentEnrollment' ||
            ((e.type === 'observer' || e.type === 'ObserverEnrollment') && e.associated_user_id)
        );

        if (!studentEnrollment) {
            logger.trace(`[EnrollmentService] No student or observer enrollment found for course ${courseId}`);
            if (logger.isTraceEnabled() && enrollments.length > 0) {
                logger.trace(`[EnrollmentService] Available enrollment types:`, enrollments.map(e => e.type || e.role));
            }
            return null;
        }

        const enrollmentType = (studentEnrollment.type === 'observer' || studentEnrollment.type === 'ObserverEnrollment') ? 'observer' : 'student';
        logger.trace(`[EnrollmentService] Found ${enrollmentType} enrollment for course ${courseId}`);
        return studentEnrollment;

    } catch (error) {
        logger.warn(`[EnrollmentService] Failed to fetch enrollment for course ${courseId}:`, error.message);
        return null;
    }
}

/**
 * Fetches all student enrollments for a course (teacher perspective).
 * Uses getAllPages to handle courses with more than 100 students.
 *
 * @param {string|number} courseId - Canvas course ID
 * @param {Object} apiClient - Canvas API client instance
 * @returns {Promise<Array<{userId: string, name: string, sortableName: string, sectionId: string}>>} Normalized student list
 *
 * @example
 * const students = await fetchCourseStudents('12345', apiClient);
 * // [{ userId: '101', name: 'Jane Smith', sortableName: 'Smith, Jane', sectionId: '55' }, ...]
 */
export async function fetchCourseStudents(courseId, apiClient) {
    try {
        const enrollments = await apiClient.getAllPages(
            `/api/v1/courses/${courseId}/enrollments?type[]=StudentEnrollment&state[]=active`,
            {},
            'fetchCourseStudents'
        );

        logger.trace(`[EnrollmentService] Fetched ${enrollments.length} student enrollments for course ${courseId}`);

        return enrollments.map(e => ({
            userId: String(e.user_id),
            name: e.user?.name ?? e.user?.short_name ?? `Student ${e.user_id}`,
            sortableName: e.user?.sortable_name ?? e.user?.name ?? `Student ${e.user_id}`,
            sectionId: String(e.course_section_id)
        }));

    } catch (error) {
        logger.warn(`[EnrollmentService] Failed to fetch course students for ${courseId}:`, error.message);
        return [];
    }
}

/**
 * Fetch all observed students for an observer (parent) in a specific course.
 * Uses /api/v1/users/self/observees to get all observed students with names,
 * then filters to only those enrolled in the specified course.
 *
 * @param {string|number} courseId - Canvas course ID
 * @param {Array} observerEnrollments - Array of ObserverEnrollment objects for this course (from /users/self/enrollments)
 * @param {Object} apiClient - Canvas API client instance
 * @returns {Promise<Array<{userId: string, name: string, sortableName: string, sectionId: string}>>} Normalized observed student list
 *
 * @example
 * const students = await fetchObservedStudents('12345', observerEnrollments, apiClient);
 * // [{ userId: '642', name: 'Test Student001', sortableName: 'Student001, Test', sectionId: '55' }, ...]
 */
export async function fetchObservedStudents(courseId, observerEnrollments, apiClient) {
    try {
        // Fetch all observed students (returns user objects with id, name, etc.)
        const observees = await apiClient.getAllPages(
            `/api/v1/users/self/observees`,
            {},
            'fetchObservees'
        );

        logger.trace(`[EnrollmentService] Fetched ${observees.length} total observed students`);

        // Build a map of observed student IDs to their user data
        const observeeMap = new Map();
        observees.forEach(user => {
            observeeMap.set(String(user.id), user);
        });

        // Map observer enrollments to student data, enriching with names from observees API
        const observedStudents = observerEnrollments
            .filter(e => e.associated_user_id) // Must have associated student
            .map(enrollment => {
                const userId = String(enrollment.associated_user_id);
                const observeeData = observeeMap.get(userId);

                return {
                    userId: userId,
                    name: observeeData?.name ?? observeeData?.short_name ?? `Student ${userId}`,
                    sortableName: observeeData?.sortable_name ?? observeeData?.name ?? `Student ${userId}`,
                    sectionId: String(enrollment.course_section_id)
                };
            });

        logger.debug(`[EnrollmentService] Found ${observedStudents.length} observed students in course ${courseId}`);

        return observedStudents;

    } catch (error) {
        logger.warn(`[EnrollmentService] Failed to fetch observed students for ${courseId}:`, error.message);
        return [];
    }
}

/**
 * Fetches all sections for a course.
 *
 * @param {string|number} courseId - Canvas course ID
 * @param {Object} apiClient - Canvas API client instance
 * @returns {Promise<Array<{id: string, name: string}>>} Normalized section list, sorted by name
 *
 * @example
 * const sections = await fetchCourseSections('12345', apiClient);
 * // [{ id: '55', name: 'Period 1' }, { id: '56', name: 'Period 2' }]
 */
export async function fetchCourseSections(courseId, apiClient) {
    try {
        const sections = await apiClient.get(
            `/api/v1/courses/${courseId}/sections`,
            {},
            'fetchCourseSections'
        );

        logger.trace(`[EnrollmentService] Fetched ${sections.length} sections for course ${courseId}`);

        return sections
            .map(s => ({ id: String(s.id), name: s.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        logger.warn(`[EnrollmentService] Failed to fetch sections for ${courseId}:`, error.message);
        return [];
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