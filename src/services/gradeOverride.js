// src/services/gradeOverride.js
/**
 * Grade Override Service
 *
 * This module handles setting total course grade overrides via Canvas GraphQL API.
 * Grade overrides allow setting a final course grade that differs from the calculated grade.
 *
 * Key responsibilities:
 * - Fetch and cache student enrollment IDs
 * - Set grade overrides via GraphQL mutation
 * - Queue concurrent override updates during bulk operations
 */

import { CanvasApiClient } from "../utils/canvasApiClient.js";
import { ENABLE_GRADE_OVERRIDE, OVERRIDE_SCALE } from "../config.js";
import { logError } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";

/**
 * Cache for enrollment IDs to avoid repeated API calls
 * Structure: Map<courseId, Map<userId, enrollmentId>>
 */
export const __enrollmentMapCache = new Map();

/**
 * Set a grade override for a student using Canvas GraphQL API
 * @param {string} enrollmentId - Student's enrollment ID
 * @param {number} overrideScore - Override score (0-100 scale)
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<number|null>} The set override score or null
 * @throws {Error} If GraphQL request fails
 */
export async function setOverrideScoreGQL(enrollmentId, overrideScore, apiClient) {
    const query = `
    mutation SetOverride($enrollmentId: ID!, $overrideScore: Float!) {
      setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        grades { customGradeStatusId overrideScore __typename }
        __typename
      }
    }`;

    const json = await apiClient.graphql(
        query,
        {
            enrollmentId: String(enrollmentId),
            overrideScore: Number(overrideScore)
        },
        "setOverrideScoreGQL"
    );

    if (json.errors) {
        const error = new Error(`GQL error: ${JSON.stringify(json.errors)}`);
        logError(error, "setOverrideScoreGQL", { enrollmentId, overrideScore });
        throw error;
    }
    return json.data?.setOverrideScore?.grades?.[0]?.overrideScore ?? null;
}

/**
 * Get all enrollment IDs for a course
 * Fetches and caches all enrollments if not already cached
 * Uses pagination to handle courses with >100 students
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Map<string, string>>} Map of userId -> enrollmentId
 * @throws {Error} If enrollment fetch fails
 */
export async function getAllEnrollmentIds(courseId, apiClient) {
    const courseKey = String(courseId);

    // Use cache if present
    if (__enrollmentMapCache.has(courseKey)) {
        return __enrollmentMapCache.get(courseKey);
    }

    // Fetch all enrollments with pagination
    const url = `/api/v1/courses/${courseKey}/enrollments?type[]=StudentEnrollment`;
    const enrollments = await apiClient.getAllPages(url, {}, "getAllEnrollmentIds");

    // Build the map
    const map = new Map();
    for (const e of enrollments) {
        if (e?.user_id && e?.id) {
            map.set(String(e.user_id), String(e.id));
        }
    }

    logger.debug(`[getAllEnrollmentIds] Fetched ${map.size} enrollment IDs for course ${courseKey}`);

    __enrollmentMapCache.set(courseKey, map);
    return map;
}

/**
 * Get the enrollment ID for a user in a course
 * Uses cached data when available; fetches and caches all enrollments if not cached
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<string|null>} Enrollment ID or null if not found
 * @throws {Error} If enrollment fetch fails
 */
export async function getEnrollmentIdForUser(courseId, userId, apiClient) {
    const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);
    return enrollmentMap.get(String(userId)) || null;
}

/**
 * Queue a grade override for a student (used during concurrent bulk updates)
 * Only executes if ENABLE_GRADE_OVERRIDE is true
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @param {number} average - Student's calculated average (0-4 scale)
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<void>}
 */
export async function queueOverride(courseId, userId, average, apiClient) {
    if (!ENABLE_GRADE_OVERRIDE) return;

    try {
        const enrollmentId = await getEnrollmentIdForUser(courseId, userId, apiClient);
        if (!enrollmentId) {
            logger.warn(`[override/concurrent] no enrollmentId for user ${userId}`);
            return;
        }

        const override = OVERRIDE_SCALE(average);
        await setOverrideScoreGQL(enrollmentId, override, apiClient);
        logger.debug(`[override/concurrent] user ${userId} → enrollment ${enrollmentId}: ${override}`);
    } catch (e) {
        logger.warn(`[override/concurrent] failed for user ${userId}:`, e?.message || e);
    }
}