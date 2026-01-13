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
 * Key: courseId, Value: { value: number, source: string, timestamp: number }
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
 * @param {number} value - Grade value
 * @param {string} source - Grade source ('assignment' or 'enrollment')
 */
function cacheGrade(courseId, value, source) {
    gradeCache.set(courseId, {
        value,
        source,
        timestamp: Date.now()
    });
}

/**
 * Fetch AVG assignment score for a course
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<number|null>} Assignment score (0-4 scale) or null if not found
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
        
        logger.debug(`AVG assignment score for course ${courseId}: ${score}`);
        return score;
        
    } catch (error) {
        logger.warn(`Failed to fetch AVG assignment score for course ${courseId}:`, error.message);
        return null;
    }
}

/**
 * Fetch total course score from enrollments
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client
 * @returns {Promise<number|null>} Course score percentage (0-100) or null if not found
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

        logger.debug(`Enrollment score for course ${courseId}: ${score}%`);
        return score;

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
 * @returns {Promise<{value: number, source: string}|null>} Grade data or null
 */
export async function getCourseGrade(courseId, apiClient) {
    // Check cache first
    const cached = getCachedGrade(courseId);
    if (cached) {
        logger.trace(`Using cached grade for course ${courseId}`);
        return { value: cached.value, source: cached.source };
    }
    
    // Try AVG assignment first (primary source)
    const avgScore = await fetchAvgAssignmentScore(courseId, apiClient);
    if (avgScore !== null) {
        cacheGrade(courseId, avgScore, 'assignment');
        return { value: avgScore, source: 'assignment' };
    }
    
    // Fallback to enrollment score
    const enrollmentScore = await fetchEnrollmentScore(courseId, apiClient);
    if (enrollmentScore !== null) {
        cacheGrade(courseId, enrollmentScore, 'enrollment');
        return { value: enrollmentScore, source: 'enrollment' };
    }
    
    // No grade available
    logger.debug(`No grade available for course ${courseId}`);
    return null;
}

