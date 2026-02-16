// src/admin/themeCssEditorPanel.js
/**
 * Theme CSS Editor Panel Module
 * 
 * Renders a panel for editing and downloading theme CSS overrides.
 */

import { logger } from '../utils/logger.js';
import { getInstalledThemeCssUrl } from './pageDetection.js';
import { createElement, createPanel, downloadText } from './domHelpers.js';
import { fetchTextWithTimeout } from './fetchHelpers.js';

/**
 * Render Theme CSS Editor panel
 * 
 * @param {HTMLElement} root - Root container element
 */
export function renderThemeCssEditorPanel(root) {
    logger.debug('[ThemeCssEditorPanel] Rendering theme CSS editor panel');

    const panel = createPanel(root, 'Theme CSS Editor');
    const installedCssUrl = getInstalledThemeCssUrl();

    // Info message
    const infoMessage = createElement('div', {
        html: `
            <div style="color:#444; margin-bottom:12px; padding:12px; background:#f0f7ff; border-left:3px solid #0374B5; border-radius:6px; font-size:13px;">
                Edit your theme CSS overrides here. Changes are not saved automatically - use the Download button to save your work.
            </div>
        `,
    });

    // Installed CSS URL display
    const urlDisplay = createElement('div', {
        html: `
            <div style="font-size:13px; color:#666; margin-bottom:10px; padding:10px; background:#f5f5f5; border-radius:6px;">
                <strong>Detected installed Theme CSS URL:</strong>
                <div style="margin-top:4px; word-break:break-all; font-family:monospace; font-size:12px;">${installedCssUrl || '(none)'}</div>
            </div>
        `,
    });

    // Load status display
    const loadStatus = createElement('div', {
        style: { marginBottom: '10px' }
    });

    // CSS Textarea
    const cssLabel = createElement('div', {
        html: '<strong>Theme CSS Overrides:</strong>',
        style: { fontWeight: '700', marginBottom: '6px' }
    });

    const cssTextarea = createElement('textarea', {
        attrs: { rows: '20', spellcheck: 'false', placeholder: 'Paste your CSS here or load from installed URL...' },
        style: {
            width: '100%',
            marginTop: '6px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            background: '#fafafa'
        }
    });

    // Button row
    const buttonRow = createElement('div', {
        style: {
            display: 'flex',
            gap: '10px',
            marginTop: '12px',
            flexWrap: 'wrap'
        }
    });

    const loadBtn = createElement('button', {
        text: 'Load from installed CSS URL',
        className: 'Button Button--small',
        attrs: installedCssUrl ? {} : { disabled: 'true' }
    });

    const downloadBtn = createElement('button', {
        text: 'Download CSS',
        className: 'Button Button--primary'
    });

    const clearBtn = createElement('button', {
        text: 'Clear',
        className: 'Button Button--small'
    });

    buttonRow.appendChild(loadBtn);
    buttonRow.appendChild(downloadBtn);
    buttonRow.appendChild(clearBtn);

    // Auto-load function
    async function loadCss() {
        if (!installedCssUrl) {
            loadStatus.innerHTML = '';
            loadStatus.appendChild(createElement('div', {
                text: '⚠️ No installed Theme CSS URL detected.',
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #f3d19e',
                    background: '#fff7e6'
                }
            }));
            return;
        }

        loadStatus.innerHTML = '';
        loadStatus.appendChild(createElement('div', {
            html: '⏳ Loading CSS from installed URL...',
            style: {
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d9d9d9',
                background: '#fafafa'
            }
        }));

        try {
            // Try with 3s timeout
            const cssText = await fetchTextWithTimeout(installedCssUrl, 3000);

            loadStatus.innerHTML = '';
            loadStatus.appendChild(createElement('div', {
                html: '✅ CSS loaded successfully from installed URL.',
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f',
                    background: '#f6ffed'
                }
            }));

            cssTextarea.value = cssText;
            logger.info('[ThemeCssEditorPanel] CSS loaded successfully');
        } catch (err) {
            logger.warn('[ThemeCssEditorPanel] Failed to load CSS:', err);

            loadStatus.innerHTML = '';
            loadStatus.appendChild(createElement('div', {
                html: '⚠️ Could not load CSS from installed URL (likely CORS).<br><span style="color:#666; font-size:13px;">Please paste your CSS manually.</span>',
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #f3d19e',
                    background: '#fff7e6'
                }
            }));
        }
    }

    // Event handlers
    loadBtn.addEventListener('click', loadCss);

    downloadBtn.addEventListener('click', () => {
        if (!cssTextarea.value.trim()) {
            alert('No CSS content to download.');
            return;
        }

        // Generate filename with date
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const filename = `theme_css_${dateStr}.css`;

        downloadText(filename, cssTextarea.value);
        logger.info('[ThemeCssEditorPanel] CSS downloaded:', filename);
    });

    clearBtn.addEventListener('click', () => {
        if (cssTextarea.value.trim() && !confirm('Are you sure you want to clear the CSS content?')) {
            return;
        }
        cssTextarea.value = '';
        loadStatus.innerHTML = '';
    });

    // Append elements to panel
    panel.appendChild(infoMessage);
    panel.appendChild(urlDisplay);
    panel.appendChild(loadStatus);
    panel.appendChild(cssLabel);
    panel.appendChild(cssTextarea);
    panel.appendChild(buttonRow);

    // Auto-load on first render if URL exists
    if (installedCssUrl) {
        loadCss();
    }
}