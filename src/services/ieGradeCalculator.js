// src/services/ieGradeCalculator.js
/**
 * Insufficient Evidence (IE) Grade Calculator
 *
 * Extends the core grade calculation logic with IE detection:
 * identifies students with any zero outcome score and marks them
 * with action="IE" vs action="SCORE".
 *
 * Kept separate from gradeCalculator.js so IE logic is isolated
 * and not referenced by the main state machine flow.
 *
 * Exports:
 * - calculateStudentAveragesWithIE
 */

import { EXCLUDED_OUTCOME_KEYWORDS } from "../config.js";
import { logger } from "../utils/logger.js";
import {
    buildOutcomeMap,
    getCurrentOutcomeScore,
    getRelevantScores,
    computeAverage
} from "./gradeCalculator.js";

/**
 * Calculate student averages with Insufficient Evidence (IE) detection.
 *
 * Detects if ANY relevant outcome score is zero and marks the student as IE.
 * IE students are always included in results (comment/status may need updating
 * even if the numeric average hasn't changed).
 * SCORE students are only included if their average has changed.
 *
 * @param {Object} data       - Canvas outcome rollup data
 * @param {Array}  data.rollups   - Array of student rollup objects
 * @param {Object} data.linked    - Linked data including outcomes
 * @param {string} outcomeId  - The ID of the "Current Score" outcome to exclude
 * @returns {Array<{
 *   userId: string,
 *   average: number,
 *   hasZero: boolean,
 *   zeroCount: number,
 *   action: "IE"|"SCORE"
 * }>}
 */
export function calculateStudentAveragesWithIE(data, outcomeId) {
    logger.info("Calculating student averages with IE detection...");

    const outcomeMap = buildOutcomeMap(data);
    const excludedOutcomeIds = new Set([String(outcomeId)]);

    const results = [];
    let totalStudents = 0;
    let skippedNoChange = 0;

    for (const rollup of (data?.rollups ?? [])) {
        const userId = rollup.links?.user;
        if (!userId) continue;

        totalStudents++;

        const oldAverage = getCurrentOutcomeScore(rollup.scores ?? [], outcomeId);

        const relevantScores = getRelevantScores(
            rollup.scores ?? [],
            outcomeMap,
            excludedOutcomeIds,
            EXCLUDED_OUTCOME_KEYWORDS
        );

        if (relevantScores.length === 0) continue;

        const newAverage = computeAverage(relevantScores);

        // IE detection: flag any student with at least one zero outcome score
        let hasZero = false;
        let zeroCount = 0;
        for (const score of relevantScores) {
            if (score.score === 0) {
                hasZero = true;
                zeroCount++;
            }
        }

        const action = hasZero ? "IE" : "SCORE";

        if (action === "IE") {
            // Always update IE students — comment/status must reflect current zero count
            logger.trace(`User ${userId}: IE case - will update (zeroCount=${zeroCount})`);
        } else {
            // SCORE: skip if nothing changed
            if (oldAverage === newAverage) {
                skippedNoChange++;
                logger.trace(`User ${userId}: No change (current=${oldAverage}, calculated=${newAverage})`);
                continue;
            }
        }

        logger.trace(
            `User ${userId}: oldAverage=${oldAverage}, newAverage=${newAverage}, ` +
            `hasZero=${hasZero}, zeroCount=${zeroCount}, action=${action}`
        );

        results.push({ userId, average: newAverage, hasZero, zeroCount, action });
    }

    logger.debug(
        `Calculation complete: ${results.length} students need updates ` +
        `(${skippedNoChange} unchanged, ${totalStudents} total)`
    );
    const ieCount = results.filter(r => r.action === "IE").length;
    const scoreCount = results.filter(r => r.action === "SCORE").length;
    logger.debug(`  IE cases: ${ieCount}, SCORE cases: ${scoreCount}`);

    return results;
}
