// src/ui/brandColors.js
/**
 * Brand color helpers
 *
 * Thin wrappers over `getComputedStyle(document.documentElement).getPropertyValue(...)`
 * that read Canvas theme variables (--ic-brand-*) and DesignPlus tokens
 * (--dt-color-*) at call time.
 *
 * Always reads live so theme overrides applied after page load are picked up.
 *
 * All canvas-api call sites use these helpers; do not add new inline getPropertyValue
 * calls for brand variables — import from this module instead.
 */

const FALLBACK_BRAND = '#0c7d9d';
const FALLBACK_WHITE = '#ffffff';
const FALLBACK_BUTTON_SECONDARY_BG = '#e0e0e0';

/**
 * Read a CSS custom property from the document root.
 *
 * @param {string} name - Variable name including the leading `--`
 * @param {string} [fallback=''] - Returned when the variable is unset or empty
 * @returns {string} Trimmed value, or `fallback`
 */
export function getCssVar(name, fallback = '') {
    if (typeof document === 'undefined' || !document.documentElement) return fallback;
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    return value || fallback;
}

/* ------------------------------------------------------------------
   Canvas brand variables (--ic-brand-*)
   ------------------------------------------------------------------ */

/**
 * Get the Canvas brand primary color from `--ic-brand-primary`.
 * @param {string} [fallback] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function brandPrimary(fallback = FALLBACK_BRAND) {
    return getCssVar('--ic-brand-primary', fallback);
}

/**
 * Get the Canvas brand primary button background color from `--ic-brand-button--primary-bgd`.
 * @param {string} [fallback] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function brandButtonPrimaryBg(fallback = FALLBACK_BRAND) {
    return getCssVar('--ic-brand-button--primary-bgd', fallback);
}

/**
 * Get the Canvas brand primary button text color from `--ic-brand-button--primary-text`.
 * @param {string} [fallback] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function brandButtonPrimaryText(fallback = FALLBACK_WHITE) {
    return getCssVar('--ic-brand-button--primary-text', fallback);
}

/**
 * Get the Canvas brand secondary button background color from `--ic-brand-button--secondary-bgd`.
 * @param {string} [fallback] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function brandButtonSecondaryBg(fallback = FALLBACK_BUTTON_SECONDARY_BG) {
    return getCssVar('--ic-brand-button--secondary-bgd', fallback);
}

/**
 * Get the Canvas brand secondary button text color from `--ic-brand-button--secondary-text`.
 * @param {string} [fallback] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function brandButtonSecondaryText(fallback = FALLBACK_WHITE) {
    return getCssVar('--ic-brand-button--secondary-text', fallback);
}

/* ------------------------------------------------------------------
   DesignPlus tokens (--dt-color-*)
   Defined in loader files/css_loader.css :root block.
   ------------------------------------------------------------------ */

/**
 * Get the DesignPlus primary color from `--dt-color-primary`.
 * @param {string} [fallback="#000000"] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function dtPrimary(fallback = '#000000') {
    return getCssVar('--dt-color-primary', fallback);
}

/**
 * Get the DesignPlus primary contrast color from `--dt-color-primary-contrast`.
 * @param {string} [fallback="#FFFFFF"] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function dtPrimaryContrast(fallback = '#FFFFFF') {
    return getCssVar('--dt-color-primary-contrast', fallback);
}

/**
 * Get the DesignPlus secondary color from `--dt-color-secondary`.
 * @param {string} [fallback="#F6C72E"] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function dtSecondary(fallback = '#F6C72E') {
    return getCssVar('--dt-color-secondary', fallback);
}

/**
 * Get the DesignPlus accent color from `--dt-color-accent`.
 * @param {string} [fallback="#D6AD2A"] - Fallback hex color if the CSS variable is not set
 * @returns {string} Resolved color value
 */
export function dtAccent(fallback = '#D6AD2A') {
    return getCssVar('--dt-color-accent', fallback);
}
