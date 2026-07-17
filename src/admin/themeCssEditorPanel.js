// src/admin/themeCssEditorPanel.js
/**
 * Theme CSS Editor Panel Module
 *
 * Renders a panel for editing and downloading theme CSS overrides.
 *
 * Refactored to use:
 * - Canvas ic-* UI classes
 * - Collapsible panel helper from canvasFormHelpers.js
 * - Status message classes from dashboardStyles.css
 */

import { logger } from '../utils/logger.js';
import { getInstalledThemeCssUrl } from './pageDetection.js';
import { createElement, downloadText } from './domHelpers.js';
import { createCollapsiblePanel, createTextarea } from './canvasFormHelpers.js';
import { fetchTextWithTimeout } from './fetchHelpers.js';

/**
 * Render Theme CSS Editor panel
 *
 * @param {HTMLElement} root - Root container element
 */
export function renderThemeCssEditorPanel(root) {
    logger.debug('[ThemeCssEditorPanel] Rendering theme CSS editor panel');

    const { panel, body } = createCollapsiblePanel('Theme CSS Editor', true);
    const installedCssUrl = getInstalledThemeCssUrl();

    // Info message using CSS class
    const infoMessage = createElement('div', {
        attrs: { class: 'cg-status cg-status--info' },
        style: { marginBottom: '12px' },
        text: 'Edit your theme CSS overrides here. Changes are not saved automatically - use the Download button to save your work.'
    });

    // Installed CSS URL display
    const urlDisplay = createElement('div', {
        attrs: { class: 'cg-theme-url-display' }
    });
    urlDisplay.innerHTML = `
        <strong>Detected installed Theme CSS URL:</strong>
        <div class="cg-theme-url-text">${installedCssUrl || '(none)'}</div>
    `;

    // Load status display
    const loadStatus = createElement('div', {
        attrs: { class: 'cg-theme-load-status' }
    });

    // CSS Textarea using Canvas helper
    const { container: cssTextareaContainer, textarea: cssTextarea } = createTextarea({
        label: 'Theme CSS Overrides',
        id: 'theme-css-textarea',
        rows: 20,
        placeholder: 'Paste your CSS here or load from installed URL...',
        attrs: { spellcheck: 'false' }
    });

    // Monospace font + background are set via #theme-css-textarea in adminDashboardStyles

    // Button row using CSS class
    const buttonRow = createElement('div', {
        attrs: { class: 'cg-button-row' }
    });

    const loadBtn = createElement('button', {
        text: 'Load from installed CSS URL',
        attrs: {
            class: 'Button Button--small',
            ...(installedCssUrl ? {} : { disabled: 'true' })
        }
    });

    const downloadBtn = createElement('button', {
        text: 'Download CSS',
        attrs: { class: 'Button Button--primary' }
    });

    const clearBtn = createElement('button', {
        text: 'Clear',
        attrs: { class: 'Button Button--small' }
    });

    buttonRow.appendChild(loadBtn);
    buttonRow.appendChild(downloadBtn);
    buttonRow.appendChild(clearBtn);

    // Auto-load function
    async function loadCss() {
        if (!installedCssUrl) {
            loadStatus.innerHTML = '';
            loadStatus.appendChild(createElement('div', {
                attrs: { class: 'cg-status cg-status--warning' },
                text: '⚠️ No installed Theme CSS URL detected.'
            }));
            return;
        }

        loadStatus.innerHTML = '';
        loadStatus.appendChild(createElement('div', {
            attrs: { class: 'cg-status cg-status--info' },
            text: '⏳ Loading CSS from installed URL...'
        }));

        try {
            // Try with 3s timeout
            const cssText = await fetchTextWithTimeout(installedCssUrl, 3000);

            loadStatus.innerHTML = '';
            loadStatus.appendChild(createElement('div', {
                attrs: { class: 'cg-status cg-status--success' },
                text: '✅ CSS loaded successfully from installed URL.'
            }));

            cssTextarea.value = cssText;
            logger.info('[ThemeCssEditorPanel] CSS loaded successfully');
        } catch (err) {
            logger.warn('[ThemeCssEditorPanel] Failed to load CSS:', err);

            loadStatus.innerHTML = '';
            const warningMsg = createElement('div', {
                attrs: { class: 'cg-status cg-status--warning' }
            });
            warningMsg.innerHTML = '⚠️ Could not load CSS from installed URL (likely CORS).<br><span class="cg-theme-cors-hint">Please paste your CSS manually.</span>';
            loadStatus.appendChild(warningMsg);
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

    // Append elements to panel body
    body.appendChild(infoMessage);
    body.appendChild(urlDisplay);
    body.appendChild(loadStatus);
    body.appendChild(cssTextareaContainer);
    body.appendChild(buttonRow);

    // Append panel to root
    root.appendChild(panel);

    // Auto-load on first render if URL exists
    if (installedCssUrl) {
        loadCss();
    }
}