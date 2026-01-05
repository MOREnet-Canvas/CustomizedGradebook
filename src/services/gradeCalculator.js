// src/services/gradeCalculator.js
/**
 * Grade Calculator Service
 *
 * This module contains the core business logic for calculating student outcome averages.
 * It processes Canvas outcome rollup data and computes averages while excluding specific outcomes.
 *
 * Key responsibilities:
 * - Filter out excluded outcomes (by ID and by keyword in title)
 * - Calculate average scores for each student
 * - Compare with existing scores to determine which students need updates
 * - Return only students whose averages have changed
 */

import { EXCLUDED_OUTCOME_KEYWORDS, ENABLE_GRADE_OVERRIDE, OVERRIDE_SCALE } from "../config.js";
import { logger } from "../utils/logger.js";
import { fetchOverrideGrades } from "./gradeOverrideVerification.js";

/**
 * Calculate student averages from outcome rollup data
 *
 * This function:
 * 1. Excludes the "Current Score" outcome itself (to avoid circular calculation)
 * 2. Excludes outcomes matching EXCLUDED_OUTCOME_KEYWORDS (e.g., "attendance")
 * 3. Calculates the average of remaining outcome scores for each student
 * 4. Only returns students whose average has changed from their current score
 * 5. Also checks if override grades match expected values (if ENABLE_GRADE_OVERRIDE is true)
 *
 * @param {Object} data - Canvas outcome rollup data
 * @param {Array} data.rollups - Array of student rollup objects
 * @param {Object} data.linked - Linked data including outcomes
 * @param {Array} data.linked.outcomes - Array of outcome objects with id and title
 * @param {string} outcomeId - The ID of the "Current Score" outcome to exclude
 * @param {string} courseId - Course ID (required for override grade checking)
 * @param {CanvasApiClient} apiClient - Canvas API client instance (required for override grade checking)
 * @returns {Promise<Array<{userId: string, average: number}>>} Array of students needing updates
 */
export async function calculateStudentAverages(data, outcomeId, courseId, apiClient) {
    const averages = [];
    logger.info("Calculating student averages...");

    const excludedOutcomeIds = new Set([String(outcomeId)]);

    // Map outcome IDs to titles for lookup
    const outcomeMap = {};
    (data?.linked?.outcomes ?? []).forEach(o => outcomeMap[o.id] = o.title);

    // Fetch current override grades if enabled
    let overrideGrades = new Map();
    if (ENABLE_GRADE_OVERRIDE && courseId && apiClient) {
        try {
            logger.debug('Fetching current override grades for initial check...');
            overrideGrades = await fetchOverrideGrades(courseId, apiClient);
            logger.debug(`Fetched ${overrideGrades.size} override grades for comparison`);
        } catch (error) {
            logger.warn('Failed to fetch override grades for initial check, continuing without override checking:', error);
        }
    }

    /**
     * Get the current AVG_OUTCOME_NAME outcome score for a student
     * @param {Array} scores - Array of score objects for a student
     * @returns {number|null} Current score or null if not found
     */
    function getCurrentOutcomeScore(scores) {
        logger.trace('Scores: ', scores);
        const match = scores.find(s => String(s.links?.outcome) === String(outcomeId));
        return match?.score ?? null;  // return null if not found
    }

    logger.debug("data: data being sent to calculateStudentAverages", data);

    for (const rollup of data.rollups) {
        const userId = rollup.links?.user;

        const oldAverage = getCurrentOutcomeScore(rollup.scores);

        // Filter to only relevant scores
        const relevantScores = rollup.scores.filter(s => {
            const id = String(s.links?.outcome);
            const title = (outcomeMap[id] || "").toLowerCase();

            return (
                typeof s.score === 'number' && // must have a numeric score
                !excludedOutcomeIds.has(id) &&        // not in the excluded IDs set
                !EXCLUDED_OUTCOME_KEYWORDS.some(keyword =>
                    title.includes(keyword.toLowerCase()) // title doesn't contain any keyword
                )
            );
        });

        // Skip students with no relevant scores
        if (relevantScores.length === 0) continue;

        // Calculate average
        const total = relevantScores.reduce((sum, s) => sum + s.score, 0);
        let newAverage = total / (relevantScores.length);
        newAverage = parseFloat(newAverage.toFixed(2));

        logger.trace(`User ${userId}  total: ${total}, count: ${relevantScores.length}, average: ${newAverage}`);
        logger.trace(`Old average: ${oldAverage} New average: ${newAverage}`);

        // Check if outcome score needs update
        const outcomeNeedsUpdate = (oldAverage !== newAverage);

        // Check if override grade needs update (if enabled)
        let overrideNeedsUpdate = false;
        if (ENABLE_GRADE_OVERRIDE && overrideGrades.size > 0) {
            const expectedOverride = OVERRIDE_SCALE(newAverage);
            const actualOverride = overrideGrades.get(String(userId));

            if (actualOverride === null || actualOverride === undefined) {
                // No override grade found - needs update
                overrideNeedsUpdate = true;
                logger.trace(`  Override: missing (expected ${expectedOverride}%) - needs update`);
            } else {
                const diff = Math.abs(actualOverride - expectedOverride);
                if (diff > 0.01) {
                    // Override grade doesn't match - needs update
                    overrideNeedsUpdate = true;
                    logger.trace(`  Override: mismatch (expected ${expectedOverride}%, got ${actualOverride}%) - needs update`);
                } else {
                    logger.trace(`  Override: matches (${actualOverride}%)`);
                }
            }
        }

        // Include student if either outcome score OR override grade needs update
        if (outcomeNeedsUpdate || overrideNeedsUpdate) {
            if (outcomeNeedsUpdate && overrideNeedsUpdate) {
                logger.trace(`  ✓ Including user ${userId}: both outcome and override need updates`);
            } else if (outcomeNeedsUpdate) {
                logger.trace(`  ✓ Including user ${userId}: outcome needs update`);
            } else {
                logger.trace(`  ✓ Including user ${userId}: override needs update`);
            }
            averages.push({ userId, average: newAverage });
        } else {
            logger.trace(`  ✗ Skipping user ${userId}: no updates needed`);
        }
    }

    logger.debug("averages after calculations:", averages);
    return averages;
}

