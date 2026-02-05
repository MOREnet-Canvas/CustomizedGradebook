// src/admin/themeStatusPanel.js
/**
 * Theme Status Panel Module
 * 
 * Renders panels showing:
 * - Installed theme overrides from ENV.active_brand_config
 * - Script change detection (compare expected vs installed)
 */

import { logger } from '../utils/logger.js';
import { 
    getInstalledThemeJsUrl, 
    getInstalledThemeCssUrl,
    getBrandConfigMetadata 
} from './pageDetection.js';
import { createElement, createPanel, escapeHtml } from './domHelpers.js';

// Default expected JS URL (should match dev loader or be configurable)
const DEFAULT_EXPECTED_JS_URL = window.CG_CONFIG?.EXPECTED_THEME_JS_URL || '';

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

    // Panel 1: Installed Theme Overrides
    renderInstalledOverridesPanel(root, installedJs, installedCss, metadata);

    // Panel 2: CG Script Check - REMOVED per UX improvements
    // renderScriptCheckPanel(root, installedJs);
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
    const panel = createPanel(root, 'Installed Theme Overrides (ENV.active_brand_config)');

    const pre = createElement('pre', {
        style: {
            margin: '0',
            padding: '12px',
            background: '#f8f9fa',
            border: '1px solid #eee',
            borderRadius: '8px',
            fontSize: '13px',
            overflow: 'auto'
        }
    });

    pre.textContent = JSON.stringify({
        js_overrides: installedJs || null,
        css_overrides: installedCss || null,
        brand_md5: metadata.md5,
        brand_created_at: metadata.created_at
    }, null, 2);

    panel.appendChild(pre);
}

/**
 * Render script check panel
 * 
 * @param {HTMLElement} root - Root container
 * @param {string} installedJs - Installed JS URL
 */
function renderScriptCheckPanel(root, installedJs) {
    const panel = createPanel(root, 'CG Script Check');

    // Expected URL input
    const inputLabel = createElement('div', {
        text: 'Expected CG JS URL:',
        style: {
            fontWeight: '600',
            marginBottom: '6px'
        }
    });

    const input = createElement('input', {
        attrs: {
            type: 'text',
            value: DEFAULT_EXPECTED_JS_URL,
            spellcheck: 'false'
        },
        style: {
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '13px'
        }
    });

    // Status display
    const status = createElement('div', {
        style: { marginTop: '10px' }
    });

    // Render status function
    function renderStatus() {
        const expected = input.value.trim();
        const matches = expected && installedJs && expected === installedJs;

        status.innerHTML = '';

        if (!installedJs) {
            status.appendChild(createElement('div', {
                text: '⚠️ No JavaScript override is currently installed on this account.',
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #f3d19e',
                    background: '#fff7e6'
                }
            }));
            return;
        }

        if (!expected) {
            status.appendChild(createElement('div', {
                text: 'Enter an Expected CG JS URL to compare.',
                style: { color: '#666' }
            }));
            return;
        }

        if (matches) {
            status.appendChild(createElement('div', {
                text: '✅ Installed JS matches Expected CG JS URL.',
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f',
                    background: '#f6ffed'
                }
            }));
        } else {
            status.appendChild(createElement('div', {
                html: `🚨 <strong>Script has changed</strong><br>Installed JS does not match the expected CG script URL.`,
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ffa39e',
                    background: '#fff1f0'
                }
            }));

            status.appendChild(createElement('div', {
                html: `
                    <div style="margin-top:10px; font-size:13px; color:#333;">
                        <div><strong>Installed:</strong> ${escapeHtml(installedJs)}</div>
                        <div style="margin-top:6px;"><strong>Expected:</strong> ${escapeHtml(expected)}</div>
                    </div>
                `
            }));
        }
    }

    input.addEventListener('input', renderStatus);

    panel.appendChild(inputLabel);
    panel.appendChild(input);
    panel.appendChild(status);

    renderStatus();
}