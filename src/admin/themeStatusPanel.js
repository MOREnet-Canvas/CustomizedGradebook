// src/admin/themeStatusPanel.js
/**
 * Theme Status Panel Module
 *
 * Renders panels showing:
 * - Installed theme overrides from ENV.active_brand_config
 *
 * Refactored to use:
 * - Canvas ic-* UI classes
 * - Collapsible panel helper from canvasFormHelpers.js
 * - Minimal inline styling
 */

import { logger } from '../utils/logger.js';
import {
    getInstalledThemeJsUrl,
    getInstalledThemeCssUrl,
    getBrandConfigMetadata
} from './pageDetection.js';
import { createElement, escapeHtml } from './domHelpers.js';
import { createCollapsiblePanel } from './canvasFormHelpers.js';

/**
 * Render theme status panels
 *
 * @param {HTMLElement} root - Root container element
 */
export function renderThemeStatusPanels(root) {
    logger.debug('[ThemeStatusPanel] Rendering theme status panels');

    const installedJs = getInstalledThemeJsUrl();
    const installedCss = getInstalledThemeCssUrl();
    const metadata = getBrandConfigMetadata();

    // Panel: Installed Theme Overrides
    renderInstalledOverridesPanel(root, installedJs, installedCss, metadata);
}

/**
 * Render installed theme overrides panel
 *
 * @param {HTMLElement} root - Root container
 * @param {string} installedJs - Installed JS URL
 * @param {string} installedCss - Installed CSS URL
 * @param {Object} metadata - Brand config metadata
 */
function renderInstalledOverridesPanel(root, installedJs, installedCss, metadata) {
    // Create collapsible panel
    const { panel, body } = createCollapsiblePanel('Installed Theme Overrides (ENV.active_brand_config)');

    // Create pre element with minimal inline styling (only for code display)
    const pre = createElement('pre', {
        style: {
            margin: '0',
            padding: '12px',
            background: '#f8f9fa',
            border: '1px solid #eee',
            borderRadius: '4px',
            fontSize: '13px',
            overflow: 'auto',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace'
        }
    });

    pre.textContent = JSON.stringify({
        js_overrides: installedJs || null,
        css_overrides: installedCss || null,
        brand_md5: metadata.md5,
        brand_created_at: metadata.created_at
    }, null, 2);

    body.appendChild(pre);
    root.appendChild(panel);
}