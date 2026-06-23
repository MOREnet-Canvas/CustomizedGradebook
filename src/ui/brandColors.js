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

export function brandPrimary(fallback = FALLBACK_BRAND) {
    return getCssVar('--ic-brand-primary', fallback);
}

export function brandButtonPrimaryBg(fallback = FALLBACK_BRAND) {
    return getCssVar('--ic-brand-button--primary-bgd', fallback);
}

export function brandButtonPrimaryText(fallback = FALLBACK_WHITE) {
    return getCssVar('--ic-brand-button--primary-text', fallback);
}

export function brandButtonSecondaryBg(fallback = FALLBACK_BUTTON_SECONDARY_BG) {
    return getCssVar('--ic-brand-button--secondary-bgd', fallback);
}

export function brandButtonSecondaryText(fallback = FALLBACK_WHITE) {
    return getCssVar('--ic-brand-button--secondary-text', fallback);
}

/* ------------------------------------------------------------------
   DesignPlus tokens (--dt-color-*)
   Defined in loader files/css_loader.css :root block.
   ------------------------------------------------------------------ */

export function dtPrimary(fallback = '#000000') {
    return getCssVar('--dt-color-primary', fallback);
}

export function dtPrimaryContrast(fallback = '#FFFFFF') {
    return getCssVar('--dt-color-primary-contrast', fallback);
}

export function dtSecondary(fallback = '#F6C72E') {
    return getCssVar('--dt-color-secondary', fallback);
}

export function dtAccent(fallback = '#D6AD2A') {
    return getCssVar('--dt-color-accent', fallback);
}
