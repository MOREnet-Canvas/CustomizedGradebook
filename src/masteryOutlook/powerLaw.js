// src/masteryOutlook/powerLaw.js
/**
 * Power Law calculation module
 *
 * Pure functions — no DOM, no Canvas API, no side effects.
 * All functions trust that input scores are in chronological order,
 * oldest first. Caller is responsible for correct ordering.
 *
 * Marzano Power Law formula: y = a · x^b
 * Solved via least squares regression on log-transformed values.
 * Predicts what a student would score if assessed at the next time point.
 */

export const MIN_SCORES = 3;
export const MAX_SCORE = 4;
export const MIN_SCORE = 1;
export const DECAYING_AVG_WEIGHT = 0.65;

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Predict the next score using Marzano's Power Law algorithm.
 * Fits y = a · x^b through the score history via log-linear regression.
 *
 * @param {number[]} scores - Rubric criteria scores for a single outcome,
 *   in chronological order (oldest first). Caller is responsible for
 *   correct ordering. Minimum 3 scores required.
 * @returns {number|null} Predicted next score clamped to [MIN_SCORE, MAX_SCORE],
 *   or null if insufficient data (NE status)
 */
export function powerLawPredict(scores) {
    if (!scores || scores.length < MIN_SCORES) return null;

    const n = scores.length;

    // Work in log space: ln(y) = ln(a) + b·ln(x)
    // x is the attempt index (1-based), y is the score
    const lnX = scores.map((_, i) => Math.log(i + 1));
    const lnY = scores.map(y => Math.log(Math.max(y, 0.01))); // guard against ln(0)

    // Least squares regression coefficients
    const sumLnX   = lnX.reduce((a, b) => a + b, 0);
    const sumLnY   = lnY.reduce((a, b) => a + b, 0);
    const sumLnXY  = lnX.reduce((s, lx, i) => s + lx * lnY[i], 0);
    const sumLnX2  = lnX.reduce((s, lx) => s + lx * lx, 0);

    const denom = n * sumLnX2 - sumLnX * sumLnX;

    // Degenerate case — all x values identical (shouldn't happen with 1-based index)
    if (Math.abs(denom) < 1e-9) return null;

    const b = (n * sumLnXY - sumLnX * sumLnY) / denom;
    const a = Math.exp((sumLnY - b * sumLnX) / n);

    // Predict at the next time point (n + 1)
    const predicted = a * Math.pow(n + 1, b);

    return clamp(predicted, MIN_SCORE, MAX_SCORE);
}

/**
 * Calculate the Power Law slope coefficient (b).
 * Positive = growing, negative = declining, near zero = flat.
 *
 * @param {number[]} scores - Chronologically ordered scores
 * @returns {number|null} Slope coefficient, or null if insufficient data
 */
export function powerLawSlope(scores) {
    if (!scores || scores.length < MIN_SCORES) return null;

    const n = scores.length;

    const lnX  = scores.map((_, i) => Math.log(i + 1));
    const lnY  = scores.map(y => Math.log(Math.max(y, 0.01)));

    const sumLnX  = lnX.reduce((a, b) => a + b, 0);
    const sumLnY  = lnY.reduce((a, b) => a + b, 0);
    const sumLnXY = lnX.reduce((s, lx, i) => s + lx * lnY[i], 0);
    const sumLnX2 = lnX.reduce((s, lx) => s + lx * lx, 0);

    const denom = n * sumLnX2 - sumLnX * sumLnX;
    if (Math.abs(denom) < 1e-9) return null;

    return (n * sumLnXY - sumLnX * sumLnY) / denom;
}

/**
 * Simple mean of all scores.
 * Always available regardless of attempt count.
 *
 * @param {number[]} scores
 * @returns {number|null}
 */
export function mean(scores) {
    if (!scores || scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Most recent score.
 * Always available regardless of attempt count.
 *
 * @param {number[]} scores - Chronologically ordered scores
 * @returns {number|null}
 */
export function mostRecent(scores) {
    if (!scores || scores.length === 0) return null;
    return scores[scores.length - 1];
}

/**
 * Decaying average — weights recent scores more heavily.
 * Each new score is blended: result = (weight × newScore) + ((1 - weight) × previous)
 * Always available regardless of attempt count.
 *
 * @param {number[]} scores - Chronologically ordered scores
 * @param {number} [weight=DECAYING_AVG_WEIGHT] - Weight applied to each new score (0-1)
 * @returns {number|null}
 */
export function decayingAverage(scores, weight = DECAYING_AVG_WEIGHT) {
    if (!scores || scores.length === 0) return null;
    return scores.reduce((avg, score, i) => {
        if (i === 0) return score;
        return weight * score + (1 - weight) * avg;
    }, 0);
}

/**
 * Determine NE (Not Enough data) status.
 *
 * @param {number[]} scores
 * @returns {boolean} true if Power Law cannot be calculated
 */
export function isInsufficient(scores) {
    return !scores || scores.length < MIN_SCORES;
}

/**
 * Compute all metrics for a single student/outcome score history.
 * Single entry point for the cache-building phase —
 * outcomesDataService calls this once per student per outcome.
 *
 * @param {number[]} scores - Chronologically ordered rubric criteria scores
 * @returns {Object} computed fields matching the cache schema
 */
export function computeStudentOutcome(scores) {
    const insufficient = isInsufficient(scores);

    return {
        status:       insufficient ? 'NE' : 'ok',
        plPrediction: insufficient ? null : powerLawPredict(scores),
        slope:        insufficient ? null : powerLawSlope(scores),
        mean:         mean(scores),
        mostRecent:   mostRecent(scores),
        decayingAvg:  decayingAverage(scores),
        attemptCount: scores?.length ?? 0
    };
}

/**
 * Compute class-level stats for a single outcome.
 * Called once per outcome during the refresh cycle after all
 * student computations are complete.
 *
 * @param {Object[]} studentResults - Array of computed student objects from cache schema
 * @param {number} threshold - Re-teach threshold (e.g. 2.2)
 * @returns {Object} classStats matching the cache schema
 */
export function computeClassStats(studentResults, threshold) {
    const plScores = studentResults
        .filter(s => s.computed.status === 'ok')
        .map(s => s.computed.plPrediction);

    const slopes = studentResults
        .filter(s => s.computed.slope !== null)
        .map(s => s.computed.slope);

    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0 };
    plScores.forEach(p => {
        if (p < 1.5)      distribution['1']++;
        else if (p < 2.5) distribution['2']++;
        else if (p < 3.5) distribution['3']++;
        else              distribution['4']++;
    });

    const plAvg = plScores.length > 0
        ? plScores.reduce((a, b) => a + b, 0) / plScores.length
        : null;

    const avgSlope = slopes.length > 0
        ? slopes.reduce((a, b) => a + b, 0) / slopes.length
        : null;

    return {
        plAvg:               plAvg !== null ? parseFloat(plAvg.toFixed(4)) : null,
        distribution,
        belowThresholdCount: plScores.filter(p => p < threshold).length,
        computedThreshold:   threshold,
        avgSlope:            avgSlope !== null ? parseFloat(avgSlope.toFixed(4)) : null,
        neCount:             studentResults.filter(s => s.computed.status === 'NE').length
    };
}