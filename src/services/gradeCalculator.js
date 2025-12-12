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

import { EXCLUDED_OUTCOME_KEYWORDS, VERBOSE_LOGGING } from "../config.js";

/**
 * Calculate student averages from outcome rollup data
 * 
 * This function:
 * 1. Excludes the "Current Score" outcome itself (to avoid circular calculation)
 * 2. Excludes outcomes matching EXCLUDED_OUTCOME_KEYWORDS (e.g., "attendance")
 * 3. Calculates the average of remaining outcome scores for each student
 * 4. Only returns students whose average has changed from their current score
 * 
 * @param {Object} data - Canvas outcome rollup data
 * @param {Array} data.rollups - Array of student rollup objects
 * @param {Object} data.linked - Linked data including outcomes
 * @param {Array} data.linked.outcomes - Array of outcome objects with id and title
 * @param {string} outcomeId - The ID of the "Current Score" outcome to exclude
 * @returns {Array<{userId: string, average: number}>} Array of students needing updates
 */
export function calculateStudentAverages(data, outcomeId) {
    const averages = [];
    console.log("Calculating student averages...");

    const excludedOutcomeIds = new Set([String(outcomeId)]);

    // Map outcome IDs to titles for lookup
    const outcomeMap = {};
    (data?.linked?.outcomes ?? []).forEach(o => outcomeMap[o.id] = o.title);

    /**
     * Get the current "Current Score" outcome score for a student
     * @param {Array} scores - Array of score objects for a student
     * @returns {number|null} Current score or null if not found
     */
    function getCurrentOutcomeScore(scores) {
        if (VERBOSE_LOGGING) { console.log('Scores: ', scores); }
        const match = scores.find(s => String(s.links?.outcome) === String(outcomeId));
        return match?.score ?? null;  // return null if not found
    }

    if (VERBOSE_LOGGING) console.log("data: data being sent to calculateStudentAverages", data);

    for (const rollup of data.rollups) {
        const userId = rollup.links?.user;

        const oldAverage = getCurrentOutcomeScore(rollup.scores);

        // Filter to only relevant scores (exclude "Current Score" and excluded keywords)
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

        if (VERBOSE_LOGGING) console.log(`User ${userId}  total: ${total}, count: ${relevantScores.length}, average: ${newAverage}`);
        if (VERBOSE_LOGGING) console.log(`Old average: ${oldAverage} New average: ${newAverage}`);
        
        // Only include students whose average has changed
        if (oldAverage === newAverage) {
            if (VERBOSE_LOGGING) { console.log("old average matches new average"); }
            continue; // no update needed
        }

        averages.push({ userId, average: newAverage });
    }

    if (VERBOSE_LOGGING) { console.log("averages after calculations:", averages); }
    return averages;
}

