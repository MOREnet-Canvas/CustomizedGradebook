// src/ui/masteryColorStyles.js
/**
 * Shared mastery-color CSS.
 *
 * Colors are expressed as CSS custom properties on a per-band class
 * (`.cg-mband--<scheme>-<i>`), and scheme-agnostic components read them:
 *
 *   .cg-mastery-pill     score chip
 *   .cg-mastery-bar      distribution bar container
 *   .cg-mastery-seg      one distribution segment
 *   .cg-mastery-tooltip  floating tooltip
 *
 * Switching scheme is a class swap — no inline color styles. Any view can
 * adopt these classes; today only the LMGB enhancement uses them.
 */

import { injectStyles } from './styles.js';
import { getBandIndex } from './masteryColors.js';

const BAND_CLASS_PREFIX = 'cg-mband--';

/** Attribute applied to Canvas-owned nodes we visually hide (React won't touch it). */
export const MASTERY_HIDDEN_ATTR = 'data-cg-mastery-hidden';

/**
 * CSS-safe version of a scheme key.
 * @param {string} schemeKey
 * @returns {string}
 */
function safeKey(schemeKey) {
    return String(schemeKey).replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Class name for band `index` of `schemeKey`.
 * @param {string} schemeKey
 * @param {number} index
 * @returns {string}
 */
export function getBandClassName(schemeKey, index) {
    return `${BAND_CLASS_PREFIX}${safeKey(schemeKey)}-${index}`;
}

/**
 * True for any class produced by {@link getBandClassName}.
 * @param {string} className
 * @returns {boolean}
 */
export function isBandClassName(className) {
    return className.startsWith(BAND_CLASS_PREFIX);
}

/**
 * Band class for a score, or null when the score is not a finite number.
 *
 * @param {number} score
 * @param {string} schemeKey
 * @param {Array<{min:number}>} bands - sorted high → low
 * @returns {string|null}
 */
export function getMasteryBandClass(score, schemeKey, bands) {
    const i = getBandIndex(score, bands);
    return i === -1 ? null : getBandClassName(schemeKey, i);
}

/**
 * Scheme-agnostic component CSS. Background/color use doubled classes and
 * !important so they win over Canvas's InstUI (emotion) styles, which are
 * injected after ours.
 */
export const MASTERY_BASE_CSS = `
.cg-mastery-pill.cg-mastery-pill {
  background-color: var(--cg-mastery-bg) !important;
  color: var(--cg-mastery-fg) !important;
  border-radius: 999px;
  padding: 4px 10px;
  min-width: 38px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  font-weight: 600;
  box-sizing: border-box;
}
.cg-mastery-bar {
  width: 140px;
  height: 22px;
  display: flex;
  border-radius: 5px;
  overflow: hidden;
  background: #EEEEEE;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.10);
  cursor: pointer;
  box-sizing: border-box;
}
.cg-mastery-seg {
  height: 100%;
  min-width: 2px;
  background-color: var(--cg-mastery-bg);
}
.cg-mastery-seg:focus-visible {
  outline: 2px solid #2B7ABC;
  outline-offset: -2px;
}
.cg-mastery-chart-host {
  display: flex !important;
  align-items: center;
  justify-content: center;
}
[${MASTERY_HIDDEN_ATTR}] {
  display: none !important;
}
.cg-mastery-tooltip {
  position: fixed;
  z-index: 999999;
  background: #FFFFFF;
  color: #222222;
  border: 1px solid #C7CDD1;
  border-radius: 6px;
  padding: 8px 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,.18);
  font-size: 13px;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
}
`;

/**
 * CSS for one scheme's band classes.
 *
 * @param {string} schemeKey
 * @param {Array<{bg:string, fg:string, accent?:string}>} bands - sorted high → low
 * @returns {string}
 */
export function buildMasteryColorCss(schemeKey, bands) {
    return bands.map((b, i) =>
        `.${getBandClassName(schemeKey, i)} { ` +
        `--cg-mastery-bg: ${b.bg}; ` +
        `--cg-mastery-fg: ${b.fg}; ` +
        `--cg-mastery-accent: ${b.accent || b.bg}; }`
    ).join('\n');
}

/**
 * Inject the base component CSS and the band CSS for `schemeKey`.
 * Idempotent per scheme.
 *
 * @param {string} schemeKey
 * @param {Array<{bg:string, fg:string, accent?:string}>} bands
 */
export function ensureMasteryColorStyles(schemeKey, bands) {
    injectStyles(MASTERY_BASE_CSS, 'cg-mastery-colors-base');
    injectStyles(buildMasteryColorCss(schemeKey, bands), `cg-mastery-colors-${safeKey(schemeKey)}`);
}
