// src/masteryOutlook/outcomeTypes.js
/**
 * Outcome type predicates and page ordering, shared by the outcome list
 * (outcomeSyncView.js) and the Current Score table (currentScoreTable.js).
 * Kept separate so outcomeRow.js can use them without an import cycle.
 */

import { AVG_OUTCOME_NAME, EXCLUDED_OUTCOME_KEYWORDS } from '../config.js';

/**
 * Check if an outcome title matches the configured Current Score outcome name.
 *
 * @param {string} title - Outcome title to test
 * @returns {boolean} true if the title equals `AVG_OUTCOME_NAME`
 */
export function isCurrentScoreOutcome(title) {
    return title === AVG_OUTCOME_NAME;
}

/**
 * Check if an outcome title contains one of the excluded keywords
 * (e.g. Homework Completion) — left out of the Current Score average.
 *
 * @param {string} title
 * @returns {boolean}
 */
export function isExcludedOutcome(title) {
    return EXCLUDED_OUTCOME_KEYWORDS.some(kw => title.includes(kw));
}

/**
 * @param {string} title
 * @returns {boolean} true for the Current Score outcome or an excluded outcome
 */
export function isSpecialOutcome(title) {
    return isCurrentScoreOutcome(title) || isExcludedOutcome(title);
}

/**
 * Check whether an outcome is a regular (gradable) outcome.
 * Returns false for the Current Score outcome and any excluded-keyword outcomes.
 *
 * @param {{ title: string }} outcome - Outcome object with a title property
 * @returns {boolean} true if the outcome should be included in Power Law calculations
 */
export function isRegularOutcome(outcome) {
    return !isSpecialOutcome(outcome.title);
}

/**
 * Regular outcomes sorted by the teacher's saved order (`cache.meta.customOutcomeOrder`).
 * Outcomes missing from the saved order keep their cache order after the ordered ones.
 *
 * @param {Object} cache
 * @returns {Object[]}
 */
function sortedRegularOutcomes(cache) {
    const regular = (cache.outcomes || []).filter(o => isRegularOutcome(o));
    const order = cache.meta?.customOutcomeOrder;
    if (Array.isArray(order)) {
        // Wiki page stores IDs as strings; outcome.id from cache is a number.
        regular.sort((a, b) => {
            const indexA = order.indexOf(String(a.id));
            const indexB = order.indexOf(String(b.id));
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
        });
    }
    return regular;
}

/**
 * Outcomes in the order they appear on the page:
 * Current Score → excluded outcomes → regular outcomes (teacher order).
 *
 * @param {Object} cache
 * @returns {Object[]}
 */
export function orderOutcomesForPage(cache) {
    const outcomes = cache.outcomes || [];
    const currentScore = outcomes.find(o => isCurrentScoreOutcome(o.title));
    const excluded = outcomes.filter(o => isExcludedOutcome(o.title) && !isCurrentScoreOutcome(o.title));
    return [
        ...(currentScore ? [currentScore] : []),
        ...excluded,
        ...sortedRegularOutcomes(cache),
    ];
}

/**
 * The outcomes Canvas's Current Score averages (regular outcomes), in page order.
 *
 * @param {Object} cache
 * @returns {Object[]}
 */
export function getAveragedOutcomes(cache) {
    return sortedRegularOutcomes(cache);
}
