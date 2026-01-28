// src/services/gradeDataService.js
/**
 * Grade Data Service
 *
 * Pure fetching service for grade data using Canvas APIs.
 * Used by courseSnapshotService for grade population.
 *
 * Implements a fallback hierarchy:
 * 1. Primary: AVG_ASSIGNMENT_NAME assignment score (0-4 scale)
 * 2. Fallback: Total course score from enrollments API (grades.current_score/current_grade)
 *
 * NOTE: This service does NOT cache data. Caching is handled by courseSnapshotService.
 */

import { AVG_ASSIGNMENT_NAME } from '../config.js';
import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { parseEnrollmentGrade, fetchSingleEnrollment } from './enrollmentService.js';
import {getStudentIdFromUrl, resolveTargetStudentId} from "../utils/pageDetection.js";

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
 * Fetch a student's AVG assignment score for a course
 *
 * @param {string} courseId - Course ID
 * @param {string} studentId - Student ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number}|null>} Assignment score or null if not found
 */
async function fetchAvgAssignmentScore(courseId, studentId, apiClient) {
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
            `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/${studentId}`,
            {},
            'fetchAvgSubmission'
        );

        logger.trace(
            `[fetchAvgAssignmentScore] Submission fetched`,
            {
                courseId,
                studentId,
                assignmentId: avgAssignment.id,
                score: submission?.score,
                grade: submission?.grade
            }
        );

        // Extract score
        const score = submission?.score;
        const grade = submission?.grade;

        if (score === null || score === undefined) {
            logger.trace(`No score found for AVG assignment in course ${courseId}`);
            return null;
        }
        if (grade === null || grade === undefined) {
            logger.trace(`No grade found for AVG assignment in course ${courseId}`);

        }

        logger.trace(`AVG assignment score for course ${courseId}: ${score}, grade: ${grade}`);
        return { score, grade };

    } catch (error) {
        logger.warn(`Failed to fetch AVG assignment score for course ${courseId}:`, error.message);
        return null;
    }
}

/**
 * Fetch total course score and letter grade from enrollments
 *
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string}|null>} Grade data or null if not found
 */
async function fetchEnrollmentScore(courseId, apiClient) {
    // Use shared enrollment service to fetch and parse enrollment data
    const studentEnrollment = await fetchSingleEnrollment(courseId, apiClient);
    if (!studentEnrollment) {
        return null;
    }

    // Parse enrollment grade using shared service
    const gradeData = parseEnrollmentGrade(studentEnrollment);
    if (!gradeData || gradeData.score === null || gradeData.score === undefined) {
        logger.trace(`No enrollment score found for course ${courseId}`);
        return null;
    }

    logger.trace(`Enrollment data for course ${courseId}: ${gradeData.score}% (${gradeData.letterGrade || 'no letter grade'})`);

    return {
        score: gradeData.score,
        letterGrade: gradeData.letterGrade
    };
}

/**
 * Get course grade with fallback hierarchy
 *
 * Pure fetching function - does NOT cache results.
 * Caching is handled by courseSnapshotService.
 *
 * Priority order:
 * 1. Primary: AVG assignment score (0-4 scale)
 * 2. Fallback: Enrollment grade (grades.current_score/current_grade)
 *
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string|null, source: string}|null>} Grade data or null
 */
export async function getCourseGrade(courseId, apiClient) {
    logger.trace(`[Grade Fetch] Course ${courseId}: Starting grade fetch with fallback hierarchy`);


    logger.trace(`[Grade Fetch] Course ${courseId}: Checking priority 1 - AVG assignment...`);
    const studentId = resolveTargetStudentId();
    if (!studentId) {
        logger.trace(`[Grade Fetch] Course ${courseId}: No target studentId available for submission lookup`);
        return null; // or fall back to enrollment
    }

    const { score, grade } = await fetchAvgAssignmentScore(courseId, studentId, apiClient);
    return { score, letterGrade: grade ?? null, source: GRADE_SOURCE.ASSIGNMENT };

}

//     if (avgData !== null) {
//         // Fetch enrollment data to get letter grade
//         const enrollmentData = await fetchEnrollmentScore(courseId, apiClient);
//         const letterGrade = enrollmentData?.letterGrade || null;
//
//         logger.trace(`[Grade Fetch] Course ${courseId}: AVG assignment found! score=${avgData.score}, letterGrade=${letterGrade}`);
//         return {
//             score: avgData.score,
//             letterGrade,
//             source: GRADE_SOURCE.ASSIGNMENT
//         };
//     }
//     logger.trace(`[Grade Fetch] Course ${courseId}: AVG assignment not found, checking priority 2...`);
//
//     // Priority 2: Fallback to enrollment score
//     logger.trace(`[Grade Fetch] Course ${courseId}: Checking priority 2 - enrollment grade...`);
//     const enrollmentData = await fetchEnrollmentScore(courseId, apiClient);
//     if (enrollmentData !== null) {
//         logger.trace(`[Grade Fetch] Course ${courseId}: Enrollment grade found! score=${enrollmentData.score}, letterGrade=${enrollmentData.letterGrade}`);
//         return {
//             score: enrollmentData.score,
//             letterGrade: enrollmentData.letterGrade,
//             source: GRADE_SOURCE.ENROLLMENT
//         };
//     }
//     logger.trace(`[Grade Fetch] Course ${courseId}: Enrollment grade not found`);
//
//     // No grade available
//     logger.trace(`[Grade Fetch] Course ${courseId}: No grade available from any source`);
//     return null;
// }