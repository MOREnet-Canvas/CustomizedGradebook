// src/gradebook/legacyLmgbLoaderGuard.js
/**
 * TEMPORARY — REMOVE once "Section D: SCHS Learning Mastery Enhancements"
 * is gone from all theme loaders.
 *
 * Section D (pasted into the loader by a district admin) colors the LMGB on
 * its own. It sets no global, so detect it by the DOM markers it leaves.
 * When it is active, lmgbMasteryColors.js defers to it instead of fighting
 * over the same cells.
 *
 * To remove: delete this file, its import + `if` in lmgbMasteryColors.js,
 * and the "legacy loader guard" block in lmgbMasteryColors.test.js.
 */

const LEGACY_SELECTORS = [
    '[data-schs-mastery-score]',
    '[data-schs-mastery-chart]',
    '#schs-mastery-tooltip',
].join(',');

/**
 * @returns {boolean} True if the loader's Section D has touched the page.
 */
export function isLegacyLoaderLmgbActive() {
    return !!document.querySelector(LEGACY_SELECTORS);
}
