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
import {
    DEFAULT_MAX_POINTS,
    MASTERY_REFRESH_DELAY_MS,
    DEFAULT_GRADING_SCHEME_ID,
    DEFAULT_GRADING_TYPE
} from '../config.js';

/**
 * Active locks to prevent concurrent refresh operations on the same assignment
 * Key format: `${courseId}_${assignmentId}`
 */
const activeLocks = new Set();

/**
 * Fetch assignment with rubric details
 *
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<object>} Assignment object with rubric
 */
async function fetchAssignmentWithRubric(courseId, assignmentId, apiClient) {
    const assignment = await apiClient.get(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}?include[]=rubric`,
        {},
        'fetchAssignmentWithRubric'
    );
    return assignment;
}

/**
 * Determine the temporary points value to use for mastery refresh
 *
 * Priority:
 * 1. Use max points from assignment's rubric ratings
 * 2. Use assignment's current points_possible (if > 0)
 * 3. Fallback to DEFAULT_MAX_POINTS (4)
 *
 * @param {object} assignment - Assignment object with rubric
 * @returns {number} Temporary points value
 */
function deriveTempPoints(assignment) {
    let maxPoints = -Infinity;

    // Priority 1: Extract max points from rubric ratings
    if (Array.isArray(assignment?.rubric)) {
        for (const criterion of assignment.rubric) {
            for (const rating of criterion?.ratings || []) {
                const points = Number(rating?.points);
                if (Number.isFinite(points)) {
                    maxPoints = Math.max(maxPoints, points);
                }
            }
        }
    }

    if (Number.isFinite(maxPoints) && maxPoints > 0) {
        logger.debug(`[RefreshMastery] Using max points from rubric ratings: ${maxPoints}`);
        return maxPoints;
    }

    // Priority 2: Use assignment's current points_possible
    const pointsPossible = Number(assignment?.points_possible);
    if (Number.isFinite(pointsPossible) && pointsPossible > 0) {
        logger.debug(`[RefreshMastery] Using assignment points_possible: ${pointsPossible}`);
        return pointsPossible;
    }

    // Fallback
    logger.debug(`[RefreshMastery] Using fallback max points: ${DEFAULT_MAX_POINTS}`);
    return DEFAULT_MAX_POINTS;
}

/**
 * Update assignment points_possible
 *
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {number} points - Points value to set
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {Object} [grading] - grading scheme to (re)apply; defaults to the gradebook's
 * @param {number|string|null} [grading.gradingStandardId=DEFAULT_GRADING_SCHEME_ID]
 * @param {string} [grading.gradingType=DEFAULT_GRADING_TYPE]
 * @returns {Promise<object>} Updated assignment object
 */
async function updateAssignmentPoints(courseId, assignmentId, points, apiClient, grading = {}) {
    const gradingStandardId = grading.gradingStandardId !== undefined ? grading.gradingStandardId : DEFAULT_GRADING_SCHEME_ID;
    const gradingType       = grading.gradingType ?? DEFAULT_GRADING_TYPE;
    const assignmentData = {
        points_possible: points
    };

    // Only include grading scheme fields if a grading scheme is selected
    if (gradingStandardId !== null && gradingStandardId !== undefined) {
        assignmentData.grading_standard_id = gradingStandardId;
        assignmentData.grading_type = gradingType;
        logger.debug(`[RefreshMastery] Including grading scheme in assignment update: grading_standard_id=${gradingStandardId}, grading_type=${gradingType}`);
    }

    const assignment = await apiClient.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
        { assignment: assignmentData },
        {},
        `updatePoints_${points}`
    );
    return assignment;
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
 * @param {number|string|null} [options.gradingStandardId] - grading scheme to keep on the
 *   assignment (default DEFAULT_GRADING_SCHEME_ID) — pass PL_GRADING_SCHEME_ID for Projected Score assignments
 * @param {string} [options.gradingType] - grading type sent with the scheme (default DEFAULT_GRADING_TYPE)
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

    try {
        const apiClient = new CanvasApiClient();
        const delay = options.delay ?? MASTERY_REFRESH_DELAY_MS;
        const skipRevert = options.skipRevert ?? false;
        const grading = { gradingStandardId: options.gradingStandardId, gradingType: options.gradingType };

        logger.info(`[RefreshMastery] Starting refresh for assignment ${assignmentId} in course ${courseId}`);

        // Step 1: Fetch assignment with rubric to determine TEMP_POINTS
        const assignment = await fetchAssignmentWithRubric(courseId, assignmentId, apiClient);
        const tempPoints = deriveTempPoints(assignment);

        logger.debug(`[RefreshMastery] Determined temp points: ${tempPoints}`, {
            courseId,
            assignmentId,
            tempPoints
        });

        // Step 2: Update to TEMP_POINTS
        logger.debug(`[RefreshMastery] Setting points_possible to ${tempPoints}`);
        await updateAssignmentPoints(courseId, assignmentId, tempPoints, apiClient, grading);

        // Step 3: Wait for propagation
        logger.debug(`[RefreshMastery] Waiting ${delay}ms for Canvas to propagate changes`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Step 4: Revert to 0 (unless skipRevert is true)
        if (!skipRevert) {
            logger.debug(`[RefreshMastery] Reverting points_possible to 0`);
            await updateAssignmentPoints(courseId, assignmentId, 0, apiClient, grading);
        }

        logger.info(`[RefreshMastery] Successfully refreshed mastery for assignment ${assignmentId}`);

    } catch (error) {
        logger.error(`[RefreshMastery] Failed to refresh mastery for assignment ${assignmentId}:`, error);
        throw error;
    } finally {
        // Always clear the lock
        activeLocks.delete(lockKey);
    }
}