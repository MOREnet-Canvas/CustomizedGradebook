// src/services/gradeOverrideVerification.js
/**
 * Grade Override Verification Service
 *
 * This module handles verification of final grade overrides via Canvas API.
 * It ensures that override scores match expected values after submission.
 *
 * Key responsibilities:
 * - Enable final grade override setting for the course
 * - Fetch current override grades from Canvas
 * - Verify override scores match expected values
 */

import { CanvasApiClient } from "../utils/canvasApiClient.js";
import { ENABLE_GRADE_OVERRIDE, OVERRIDE_SCALE } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Enable final grade override for a course
 * This is a one-time setup check that should be performed during CHECKING_SETUP state
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<boolean>} True if override is enabled
 */
export async function enableCourseOverride(courseId, apiClient) {
    if (!ENABLE_GRADE_OVERRIDE) {
        logger.debug('Grade override is disabled in config, skipping');
        return false;
    }

    try {
        logger.debug('Enabling final grade override for course');
        await apiClient.put(
            `/api/v1/courses/${courseId}/settings`,
            {
                allow_final_grade_override: true
            },
            {},
            "enableCourseOverride"
        );
        logger.info('Final grade override enabled for course');
        return true;
    } catch (error) {
        logger.error('Failed to enable final grade override:', error);
        throw error;
    }
}

/**
 * Fetch current override grades from Canvas
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Map<string, number>>} Map of userId -> percentage (keys are userIds, NOT enrollmentIds)
 */
export async function fetchOverrideGrades(courseId, apiClient) {
    if (!ENABLE_GRADE_OVERRIDE) {
        logger.debug('Grade override is disabled in config, skipping fetch');
        return new Map();
    }

    try {
        const response = await apiClient.get(
            `/courses/${courseId}/gradebook/final_grade_overrides`,
            {},
            "fetchOverrideGrades"
        );

        const overrideMap = new Map();
        const overrides = response.final_grade_overrides || {};

        // IMPORTANT: The keys in final_grade_overrides are userIds, NOT enrollmentIds
        for (const [userId, data] of Object.entries(overrides)) {
            const percentage = data?.course_grade?.percentage;
            if (percentage !== null && percentage !== undefined) {
                overrideMap.set(userId, percentage);
                logger.trace(`Override grade for user ${userId}: ${percentage}%`);
            }
        }

        logger.debug(`Fetched ${overrideMap.size} override grades from Canvas API`);
        return overrideMap;
    } catch (error) {
        logger.error('Failed to fetch override grades:', error);
        throw error;
    }
}

/**
 * Verify that override scores match expected values
 * @param {string} courseId - Course ID
 * @param {Array<{userId: string, average: number}>} averages - Expected averages
 * @param {Map<string, string>} enrollmentMap - Map of userId -> enrollmentId (kept for debugging but not used for lookup)
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {number} tolerance - Tolerance for percentage comparison (default: 0.01)
 * @returns {Promise<Array<{userId: string, enrollmentId: string, expected: number, actual: number}>>} Array of mismatches
 */
export async function verifyOverrideScores(courseId, averages, enrollmentMap, apiClient, tolerance = 0.01) {
    if (!ENABLE_GRADE_OVERRIDE) {
        logger.debug('Grade override is disabled in config, skipping verification');
        return [];
    }

    try {
        const overrideGrades = await fetchOverrideGrades(courseId, apiClient);
        const mismatches = [];
        let matchCount = 0;

        logger.debug(`Verifying ${averages.length} students' override grades...`);

        for (const { userId, average } of averages) {
            const expectedPercentage = OVERRIDE_SCALE(average);
            // FIXED: Look up by userId directly (not enrollmentId)
            const actualPercentage = overrideGrades.get(String(userId));

            // Get enrollmentId for debugging purposes only
            const enrollmentId = enrollmentMap.get(String(userId));

            logger.trace(`User ${userId}: expected=${expectedPercentage}%, actual=${actualPercentage}%`);

            if (actualPercentage === null || actualPercentage === undefined) {
                mismatches.push({
                    userId,
                    enrollmentId,
                    expected: expectedPercentage,
                    actual: null,
                    reason: 'No override grade found'
                });
                logger.trace(`  ❌ No override grade found for user ${userId}`);
                continue;
            }

            const diff = Math.abs(actualPercentage - expectedPercentage);
            if (diff > tolerance) {
                mismatches.push({
                    userId,
                    enrollmentId,
                    expected: expectedPercentage,
                    actual: actualPercentage,
                    diff
                });
                logger.trace(`  ❌ Mismatch: expected ${expectedPercentage}%, got ${actualPercentage}% (diff: ${diff.toFixed(2)}%)`);
            } else {
                matchCount++;
                logger.trace(`  ✓ Match: ${actualPercentage}%`);
            }
        }

        logger.debug(`Override verification complete: ${matchCount} matches, ${mismatches.length} mismatches`);

        if (mismatches.length > 0) {
            logger.debug(`Mismatches found:`, mismatches.map(m => ({
                userId: m.userId,
                expected: m.expected,
                actual: m.actual,
                diff: m.diff
            })));
        }

        return mismatches;
    } catch (error) {
        logger.error('Failed to verify override scores:', error);
        throw error;
    }
}

