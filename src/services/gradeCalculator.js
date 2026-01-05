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
 * - Support multiple grading modes (outcome only, override only, or both)
 * - Return only students whose averages have changed
 */

import { EXCLUDED_OUTCOME_KEYWORDS, ENABLE_OUTCOME_UPDATES, ENABLE_GRADE_OVERRIDE, OVERRIDE_SCALE } from "../config.js";
import { logger } from "../utils/logger.js";
import { fetchOverrideGrades } from "./gradeOverrideVerification.js";

/**
 * Build a map of outcome IDs to titles
 * @param {Object} data - Canvas outcome rollup data
 * @returns {Object} Map of outcomeId -> title
 */
function buildOutcomeMap(data) {
    const map = {};
    (data?.linked?.outcomes ?? []).forEach(o => {
        map[String(o.id)] = o.title;
    });
    return map;
}

/**
 * Get the current outcome score for a student
 * @param {Array} scores - Array of score objects
 * @param {string} outcomeId - The outcome ID to find
 * @returns {number|null} The current score or null if not found
 */
function getCurrentOutcomeScore(scores, outcomeId) {
    const match = scores.find(s => String(s.links?.outcome) === String(outcomeId));
    return match?.score ?? null;
}

/**
 * Filter scores to only include relevant ones (exclude specific outcomes and keywords)
 * @param {Array} scores - Array of score objects
 * @param {Object} outcomeMap - Map of outcomeId -> title
 * @param {Set} excludedOutcomeIds - Set of outcome IDs to exclude
 * @param {Array} excludedKeywords - Array of keywords to exclude from titles
 * @returns {Array} Filtered array of relevant scores
 */
function getRelevantScores(scores, outcomeMap, excludedOutcomeIds, excludedKeywords) {
    return scores.filter(s => {
        const id = String(s.links?.outcome);
        const title = (outcomeMap[id] || "").toLowerCase();

        return (
            typeof s.score === "number" &&
            !excludedOutcomeIds.has(id) &&
            !excludedKeywords.some(keyword => title.includes(keyword.toLowerCase()))
        );
    });
}

/**
 * Compute the average of an array of scores
 * @param {Array} scores - Array of score objects with .score property
 * @returns {number} The average score, rounded to 2 decimal places
 */
function computeAverage(scores) {
    const total = scores.reduce((sum, s) => sum + s.score, 0);
    return Number((total / scores.length).toFixed(2));
}

/**
 * Check if outcome score needs to be updated
 * @param {number|null} oldAverage - Current outcome score
 * @param {number} newAverage - Calculated new average
 * @returns {boolean} True if update is needed
 */
function needsOutcomeUpdate(oldAverage, newAverage) {
    return oldAverage !== newAverage;
}

/**
 * Check if override grade needs to be updated
 * @param {string} userId - User ID
 * @param {number} newAverage - Calculated new average
 * @param {Map} overrideGrades - Map of userId -> current override percentage
 * @param {Function} overrideScaleFn - Function to scale average to override percentage
 * @returns {boolean} True if update is needed
 */
function needsOverrideUpdate(userId, newAverage, overrideGrades, overrideScaleFn) {
    if (!overrideGrades || overrideGrades.size === 0) return false;

    const expected = overrideScaleFn(newAverage);
    const actual = overrideGrades.get(String(userId));

    if (actual === null || actual === undefined) return true;

    return Math.abs(actual - expected) > 0.01;
}

/**
 * Log detailed calculation information for a student
 * @param {string} userId - User ID
 * @param {Array} relevantScores - Array of relevant scores
 * @param {number} oldAverage - Old average score
 * @param {number} newAverage - New calculated average
 * @param {boolean} outcomeUpdate - Whether outcome needs update
 * @param {boolean} overrideUpdate - Whether override needs update
 * @param {Map} overrideGrades - Map of userId -> override percentage
 * @param {Function} overrideScaleFn - Function to scale average to override percentage
 */
function logStudentCalculation(userId, relevantScores, oldAverage, newAverage, outcomeUpdate, overrideUpdate, overrideGrades, overrideScaleFn) {
    const total = relevantScores.reduce((sum, s) => sum + s.score, 0);
    logger.trace(`User ${userId}: total=${total}, count=${relevantScores.length}, average=${newAverage}`);
    logger.trace(`  Old average: ${oldAverage}, New average: ${newAverage}`);

    // Log override-specific information
    if (ENABLE_GRADE_OVERRIDE && overrideGrades.size > 0) {
        const expected = overrideScaleFn(newAverage);
        const actual = overrideGrades.get(String(userId));

        if (actual === null || actual === undefined) {
            logger.trace(`  Override: missing (expected ${expected}%) - needs update`);
        } else {
            const diff = Math.abs(actual - expected);
            if (diff > 0.01) {
                logger.trace(`  Override: mismatch (expected ${expected}%, got ${actual}%) - needs update`);
            } else {
                logger.trace(`  Override: matches (${actual}%)`);
            }
        }
    }

    // Log decision
    if (outcomeUpdate || overrideUpdate) {
        if (outcomeUpdate && overrideUpdate) {
            logger.trace(`  ✓ Including user ${userId}: both outcome and override need updates`);
        } else if (outcomeUpdate) {
            logger.trace(`  ✓ Including user ${userId}: outcome needs update`);
        } else {
            logger.trace(`  ✓ Including user ${userId}: override needs update`);
        }
    } else {
        logger.trace(`  ✗ Skipping user ${userId}: no updates needed`);
    }
}

/**
 * Calculate student averages from outcome rollup data
 *
 * This function orchestrates the calculation process:
 * 1. Excludes the "Current Score" outcome itself (to avoid circular calculation)
 * 2. Excludes outcomes matching EXCLUDED_OUTCOME_KEYWORDS (e.g., "attendance")
 * 3. Calculates the average of remaining outcome scores for each student
 * 4. Checks if outcome scores need updates (if ENABLE_OUTCOME_UPDATES is true)
 * 5. Checks if override grades need updates (if ENABLE_GRADE_OVERRIDE is true)
 * 6. Returns only students who need updates (either outcome or override or both)
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
    logger.info("Calculating student averages...");
    logger.debug(`Grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);

    const outcomeMap = buildOutcomeMap(data);
    const excludedOutcomeIds = new Set([String(outcomeId)]);

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

    const results = [];

    for (const rollup of (data?.rollups ?? [])) {
        const userId = rollup.links?.user;
        if (!userId) continue;

        const oldAverage = getCurrentOutcomeScore(rollup.scores ?? [], outcomeId);

        const relevantScores = getRelevantScores(
            rollup.scores ?? [],
            outcomeMap,
            excludedOutcomeIds,
            EXCLUDED_OUTCOME_KEYWORDS
        );

        if (relevantScores.length === 0) continue;

        const newAverage = computeAverage(relevantScores);

        // Determine if updates are needed based on enabled modes
        const outcomeUpdate = ENABLE_OUTCOME_UPDATES && needsOutcomeUpdate(oldAverage, newAverage);
        const overrideUpdate = ENABLE_GRADE_OVERRIDE &&
            needsOverrideUpdate(userId, newAverage, overrideGrades, OVERRIDE_SCALE);

        // Log detailed calculation information
        logStudentCalculation(
            userId,
            relevantScores,
            oldAverage,
            newAverage,
            outcomeUpdate,
            overrideUpdate,
            overrideGrades,
            OVERRIDE_SCALE
        );

        // Include student if either outcome or override needs update
        if (outcomeUpdate || overrideUpdate) {
            results.push({ userId, average: newAverage });
        }
    }

    logger.debug(`Calculation complete: ${results.length} students need updates`);
    if (ENABLE_OUTCOME_UPDATES && ENABLE_GRADE_OVERRIDE && overrideGrades.size > 0) {
        logger.debug(`  (checked both outcome scores and override grades)`);
    } else if (ENABLE_OUTCOME_UPDATES) {
        logger.debug(`  (checked outcome scores only)`);
    } else if (ENABLE_GRADE_OVERRIDE) {
        logger.debug(`  (checked override grades only)`);
    }

    return results;
}

