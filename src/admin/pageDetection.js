// src/admin/pageDetection.js
/**
 * Admin Page Detection Utilities
 * 
 * Detects admin-specific pages for the Canvas Admin Dashboard module.
 */

const CG_ADMIN_FLAG = 'cg_admin_dashboard';

/**
 * Check if current page is Theme Editor
 * 
 * Matches:
 * - /accounts/:id/theme_editor
 * 
 * @returns {boolean} True if on Theme Editor page
 */
export function isThemeEditorPage() {
    return /^\/accounts\/\d+\/theme_editor/.test(window.location.pathname);
}

/**
 * Check if current page is the CG Admin Dashboard virtual page
 * 
 * Matches:
 * - /accounts/:id?cg_admin_dashboard=1
 * 
 * @returns {boolean} True if on Admin Dashboard page
 */
export function isAdminDashboardPage() {
    return new URLSearchParams(window.location.search).has(CG_ADMIN_FLAG);
}

/**
 * Get account ID from ENV or URL
 * 
 * @returns {string|null} Account ID or null if not found
 */
export function getAccountId() {
    return window.ENV?.ACCOUNT_ID || null;
}

/**
 * Get installed Theme JS URL from ENV
 * 
 * @returns {string} Installed JS URL (empty string if not found)
 */
export function getInstalledThemeJsUrl() {
    return normalizeUrl(window.ENV?.active_brand_config?.js_overrides);
}

/**
 * Get installed Theme CSS URL from ENV
 * 
 * @returns {string} Installed CSS URL (empty string if not found)
 */
export function getInstalledThemeCssUrl() {
    return normalizeUrl(window.ENV?.active_brand_config?.css_overrides);
}

/**
 * Get brand config metadata
 * 
 * @returns {Object} Brand config metadata
 */
export function getBrandConfigMetadata() {
    const brand = window.ENV?.active_brand_config || {};
    return {
        md5: brand.md5 || null,
        created_at: brand.created_at || null
    };
}

/**
 * Normalize URL (trim and handle null/undefined)
 * 
 * @param {string|null|undefined} url - URL to normalize
 * @returns {string} Normalized URL (empty string if null/undefined)
 */
function normalizeUrl(url) {
    if (url == null) return '';
    return String(url).trim();
}

