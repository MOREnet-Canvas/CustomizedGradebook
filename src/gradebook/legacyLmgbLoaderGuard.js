// src/gradebook/legacyLmgbLoaderGuard.js
/**
 * TEMPORARY — legacy loader guard for LMGB mastery colors.
 *
 * WHY THIS EXISTS
 * ---------------
 * A district admin pasted "SECTION D: SCHS LEARNING MASTERY ENHANCEMENTS"
 * straight into the Canvas theme loader. It does what lmgbMasteryColors.js
 * now does (colored LMGB score pills + distribution bars + tooltips).
 * If both run on the same page they fight:
 *   - Section D's inline styles and `container.innerHTML = ""` clobber our
 *     band classes and bars (and ours override its pills via !important).
 *   - Both call /outcome_mastery_distribution, doubling API traffic.
 *   - The cells flicker as each re-applies after the other's DOM writes.
 * Until Section D is gone from every loader, the bundle must step aside.
 *
 * HOW DETECTION WORKS
 * -------------------
 * Section D sets no global variable, so we look for the DOM markers it leaves:
 *   - `data-schs-mastery-score`  on each colored score cell
 *   - `data-schs-mastery-chart`  on each chart container it rebuilds
 *   - `#schs-mastery-tooltip`    its floating tooltip (created on first hover)
 *
 * WHAT HAPPENS ON DETECTION
 * -------------------------
 * lmgbMasteryColors.js calls isLegacyLoaderLmgbActive() at the start of every
 * enhancement pass, plus one re-check ~1.5 s after init (LEGACY_RECHECK_MS),
 * because Section D may only mark the grid after React renders it. When it
 * returns true, the module:
 *   1. logs `[LMGB Colors] Loader Section D detected — deferring to it`
 *   2. calls stopLmgbMasteryColors(), which disconnects the observer and
 *      removes our pill/band classes, bars, hidden-attributes and tooltip.
 * Section D's output is then the only thing on the page.
 *
 * WHEN TO REMOVE THIS GUARD
 * -------------------------
 * Only when ALL of these are true:
 *   - Section D has been removed from every theme loader that uses the CG
 *     loader (desktop Theme JS for each account / sub-account).
 *   - Those loaders set, in Section B `window.CG_MANAGED.config`:
 *       ENABLE_LMGB_MASTERY_COLORS: true,
 *       LMGB_MASTERY_SCHEME: "sedaliaA",
 *   - On a live LMGB page the console no longer shows the "deferring" log and
 *     `document.querySelector('[data-schs-mastery-score]')` returns null.
 *
 * HOW TO REMOVE IT
 * ----------------
 * Every line involved is tagged `TEMPORARY` — `grep -rn TEMPORARY src/gradebook/`.
 *   1. Delete this file.
 *   2. src/gradebook/lmgbMasteryColors.js:
 *        - remove the `isLegacyLoaderLmgbActive` import
 *        - remove the TEMPORARY `if` block in applyLmgbMasteryColors()
 *        - remove LEGACY_RECHECK_MS, the `legacyTimer` state field, its
 *          setTimeout() in initLmgbMasteryColors() and its clearTimeout() in
 *          stopLmgbMasteryColors()
 *   3. src/gradebook/lmgbMasteryColors.test.js: delete the
 *      `describe('legacy loader guard')` block.
 *   4. Run `npm test`.
 */

const LEGACY_SELECTORS = [
    '[data-schs-mastery-score]',
    '[data-schs-mastery-chart]',
    '#schs-mastery-tooltip',
].join(',');

/**
 * @deprecated Temporary — delete with this file once loader Section D is gone
 *   (see the header above for the removal checklist).
 * @returns {boolean} True if the loader's Section D has touched the page.
 */
export function isLegacyLoaderLmgbActive() {
    return !!document.querySelector(LEGACY_SELECTORS);
}
