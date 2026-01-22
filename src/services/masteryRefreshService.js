// src/services/masteryRefreshService.js
/**
 * Mastery Refresh Service
 *
 * Handles the "Refresh Mastery" feature for Canvas assignments.
 * 
 * Canvas LMS does not reliably compute/persist mastery levels and letter grade labels
 * for standards-based assignments when points_possible = 0. This service temporarily
 * sets points_possible to match the grading scale maximum, waits for Canvas to propagate
 * the change, then reverts back to 0, causing mastery levels and labels to persist correctly.
 */

import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { getRubricForAssignment } from './rubricService.js';
import { 
    OUTCOME_AND_RUBRIC_RATINGS, 
    DEFAULT_MAX_POINTS,
    MASTERY_REFRESH_DELAY_MS 
} from '../config.js';

/**
 * Active locks to prevent concurrent refresh operations on the same assignment
 * Key format: `${courseId}_${assignmentId}`
 */
const activeLocks = new Set();

/**
 * Determine the temporary points value to use for mastery refresh
 * 
 * Priority:
 * 1. Use max points from OUTCOME_AND_RUBRIC_RATINGS config
 * 2. Fetch assignment's rubric and use its max points
 * 3. Fallback to DEFAULT_MAX_POINTS
 * 
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<number>} Temporary points value
 */
async function determineTempPoints(courseId, assignmentId, apiClient) {
    // Priority 1: Use config ratings
    if (OUTCOME_AND_RUBRIC_RATINGS && OUTCOME_AND_RUBRIC_RATINGS.length > 0) {
        const maxPoints = Math.max(...OUTCOME_AND_RUBRIC_RATINGS.map(r => r.points));
        logger.debug(`[RefreshMastery] Using max points from config ratings: ${maxPoints}`);
        return maxPoints;
    }

    // Priority 2: Fetch rubric
    try {
        const rubricData = await getRubricForAssignment(courseId, assignmentId, apiClient);
        if (rubricData) {
            // Fetch full rubric details to get max points
            const assignment = await apiClient.get(
                `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
                {},
                'getRubricDetails'
            );
            
            if (assignment.rubric && assignment.rubric.length > 0) {
                const maxPoints = Math.max(...assignment.rubric[0].ratings.map(r => r.points));
                logger.debug(`[RefreshMastery] Using max points from rubric: ${maxPoints}`);
                return maxPoints;
            }
        }
    } catch (error) {
        logger.warn(`[RefreshMastery] Failed to fetch rubric, using fallback:`, error.message);
    }

    // Fallback
    logger.debug(`[RefreshMastery] Using fallback max points: ${DEFAULT_MAX_POINTS}`);
    return DEFAULT_MAX_POINTS;
}

/**
 * Refresh mastery levels for an assignment
 * 
 * Performs the update → wait → revert sequence to force Canvas to recalculate
 * mastery levels and letter grade labels.
 * 
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {Object} options - Options for the refresh operation
 * @param {number} [options.delay] - Delay in milliseconds (default: MASTERY_REFRESH_DELAY_MS)
 * @param {boolean} [options.skipRevert] - Skip reverting to 0 (for future SpeedGrader toggle mode)
 * @returns {Promise<void>}
 * @throws {Error} If refresh fails
 */
export async function refreshMasteryForAssignment(courseId, assignmentId, options = {}) {
    const lockKey = `${courseId}_${assignmentId}`;
    
    // Check concurrency lock
    if (activeLocks.has(lockKey)) {
        logger.warn(`[RefreshMastery] Already running for assignment ${assignmentId}`);
        throw new Error('Refresh already in progress for this assignment');
    }
    
    activeLocks.add(lockKey);
    const apiClient = new CanvasApiClient();
    const delay = options.delay ?? MASTERY_REFRESH_DELAY_MS;
    const skipRevert = options.skipRevert ?? false;
    
    let tempPointsSet = false;
    
    try {
        logger.info(`[RefreshMastery] Starting refresh for assignment ${assignmentId} in course ${courseId}`);
        
        // Step 1: Determine TEMP_POINTS
        const tempPoints = await determineTempPoints(courseId, assignmentId, apiClient);
        logger.debug(`[RefreshMastery] Using temp points: ${tempPoints}`);
        
        // Step 2: Update to TEMP_POINTS
        logger.debug(`[RefreshMastery] Setting points_possible to ${tempPoints}`);
        await apiClient.put(
            `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
            { assignment: { points_possible: tempPoints } },
            'setTempPoints'
        );
        tempPointsSet = true;
        
        // Step 3: Wait for propagation
        logger.debug(`[RefreshMastery] Waiting ${delay}ms for Canvas to propagate changes`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Step 4: Revert to 0 (unless skipRevert is true)
        if (!skipRevert) {
            logger.debug(`[RefreshMastery] Reverting points_possible to 0`);
            await apiClient.put(
                `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
                { assignment: { points_possible: 0 } },
                'revertToZero'
            );
            tempPointsSet = false;
        }
        
        logger.info(`[RefreshMastery] Successfully refreshed mastery for assignment ${assignmentId}`);
        
    } catch (error) {
        logger.error(`[RefreshMastery] Failed to refresh mastery for assignment ${assignmentId}:`, error);
        throw error;
    } finally {
        // CRITICAL: Always try to revert to 0 if we set temp points and skipRevert is false
        if (tempPointsSet && !skipRevert) {
            try {
                logger.debug(`[RefreshMastery] Finally block: Reverting points_possible to 0`);
                await apiClient.put(
                    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
                    { assignment: { points_possible: 0 } },
                    'finallyRevertToZero'
                );
            } catch (revertError) {
                logger.error(`[RefreshMastery] CRITICAL: Failed to revert points_possible to 0:`, revertError);
            }
        }
        
        // Always clear the lock
        activeLocks.delete(lockKey);
    }
}

