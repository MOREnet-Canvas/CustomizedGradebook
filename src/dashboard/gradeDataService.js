// src/dashboard/gradeDataService.js
/**
 * Grade Data Service
 * 
 * Fetches grade data for dashboard display using Canvas APIs.
 * Implements a fallback hierarchy:
 * 1. Primary: AVG_ASSIGNMENT_NAME assignment score (if exists)
 * 2. Fallback: Total course score from enrollments API
 * 
 * This service is designed to be flexible for future changes in grading approaches.
 */

import { AVG_ASSIGNMENT_NAME } from '../config.js';
import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';

/**
 * Cache for course grades (session-based)
 * Key: courseId, Value: { score: number, letterGrade: string|null, source: string, timestamp: number }
 */
const gradeCache = new Map();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get cached grade if available and not expired
 * @param {string} courseId - Course ID
 * @returns {Object|null} Cached grade data or null
 */
function getCachedGrade(courseId) {
    const cached = gradeCache.get(courseId);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL_MS) {
        gradeCache.delete(courseId);
        return null;
    }
    
    return cached;
}

/**
 * Cache grade data
 * @param {string} courseId - Course ID
 * @param {number} score - Grade score value
 * @param {string|null} letterGrade - Letter grade (if available)
 * @param {string} source - Grade source ('assignment' or 'enrollment')
 */
function cacheGrade(courseId, score, letterGrade, source) {
    gradeCache.set(courseId, {
        score,
        letterGrade,
        source,
        timestamp: Date.now()
    });
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
            logger.debug(`AVG assignment "${AVG_ASSIGNMENT_NAME}" not found in course ${courseId}`);
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
            logger.debug(`No score found for AVG assignment in course ${courseId}`);
            return null;
        }

        // Also fetch letter grade from enrollment data to display alongside the score
        let letterGrade = null;
        try {
            const enrollments = await apiClient.get(
                `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment&include[]=total_scores`,
                {},
                'fetchEnrollmentForLetterGrade'
            );

            const studentEnrollment = enrollments.find(e =>
                e.type === 'StudentEnrollment' ||
                e.type === 'student' ||
                e.role === 'StudentEnrollment'
            );

            if (studentEnrollment) {
                letterGrade = studentEnrollment.computed_current_grade
                    ?? studentEnrollment.calculated_current_grade
                    ?? studentEnrollment.computed_final_grade
                    ?? studentEnrollment.calculated_final_grade
                    ?? null;
            }
        } catch (error) {
            logger.debug(`Could not fetch letter grade for AVG assignment in course ${courseId}:`, error.message);
            // Continue without letter grade
        }

        logger.debug(`AVG assignment data for course ${courseId}: ${score} (${letterGrade || 'no letter grade'})`);
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
        // Fetch enrollments with total scores
        const enrollments = await apiClient.get(
            `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment&include[]=total_scores`,
            {},
            'fetchEnrollment'
        );

        logger.debug(`Enrollment response for course ${courseId}:`, enrollments);

        // Find student enrollment - try both "StudentEnrollment" and "student"
        const studentEnrollment = enrollments.find(e =>
            e.type === 'StudentEnrollment' ||
            e.type === 'student' ||
            e.role === 'StudentEnrollment'
        );

        if (!studentEnrollment) {
            logger.debug(`No student enrollment found for course ${courseId}`);
            if (logger.isDebugEnabled() && enrollments.length > 0) {
                logger.debug(`Available enrollment types:`, enrollments.map(e => e.type || e.role));
            }
            return null;
        }

        logger.debug(`Student enrollment for course ${courseId}:`, studentEnrollment);

        // Extract score (prefer computed over calculated, prefer current over final)
        const score = studentEnrollment.computed_current_score
            ?? studentEnrollment.calculated_current_score
            ?? studentEnrollment.computed_final_score
            ?? studentEnrollment.calculated_final_score;

        if (score === null || score === undefined) {
            logger.debug(`No enrollment score found for course ${courseId}`);
            logger.debug(`Enrollment object:`, studentEnrollment);
            return null;
        }

        // Extract letter grade (prefer computed over calculated, prefer current over final)
        const letterGrade = studentEnrollment.computed_current_grade
            ?? studentEnrollment.calculated_current_grade
            ?? studentEnrollment.computed_final_grade
            ?? studentEnrollment.calculated_final_grade
            ?? null;

        logger.debug(`Enrollment data for course ${courseId}: ${score}% (${letterGrade || 'no letter grade'})`);

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
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<{score: number, letterGrade: string|null, source: string}|null>} Grade data or null
 */
export async function getCourseGrade(courseId, apiClient) {
    // Check cache first
    const cached = getCachedGrade(courseId);
    if (cached) {
        logger.trace(`Using cached grade for course ${courseId}`);
        return {
            score: cached.score,
            letterGrade: cached.letterGrade,
            source: cached.source
        };
    }

    // Try AVG assignment first (primary source)
    const avgData = await fetchAvgAssignmentScore(courseId, apiClient);
    if (avgData !== null) {
        // AVG assignment returns 0-4 scale score with letter grade from enrollment
        cacheGrade(courseId, avgData.score, avgData.letterGrade, 'assignment');
        return { score: avgData.score, letterGrade: avgData.letterGrade, source: 'assignment' };
    }

    // Fallback to enrollment score
    const enrollmentData = await fetchEnrollmentScore(courseId, apiClient);
    if (enrollmentData !== null) {
        cacheGrade(courseId, enrollmentData.score, enrollmentData.letterGrade, 'enrollment');
        return {
            score: enrollmentData.score,
            letterGrade: enrollmentData.letterGrade,
            source: 'enrollment'
        };
    }

    // No grade available
    logger.debug(`No grade available for course ${courseId}`);
    return null;
}

