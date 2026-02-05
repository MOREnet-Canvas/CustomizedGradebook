// src/admin/themeEditorInjection.js
/**
 * Theme Editor Injection Module
 * 
 * Injects "Customized Gradebook Tools" UI block in Theme Editor
 * under the "JavaScript file" control area.
 */

import { logger } from '../utils/logger.js';
import { getAccountId } from './pageDetection.js';
import { ADMIN_DASHBOARD_LABEL } from '../config.js';

const INJECTION_MARKER = 'cg-theme-editor-tools';

/**
 * Inject CG Tools button in Theme Editor
 * 
 * Finds the "JavaScript file" label and injects a UI block below it
 * with a button to open the Admin Dashboard.
 * 
 * @returns {boolean} True if injection succeeded, false otherwise
 */
export function injectThemeEditorButton() {
    // Check if already injected
    if (document.querySelector(`.${INJECTION_MARKER}`)) {
        logger.trace('[ThemeEditorInjection] Already injected, skipping');
        return true;
    }

    // Find "JavaScript file" label (use regex for flexible matching)
    const labels = Array.from(document.querySelectorAll('label'));
    const jsLabel = labels.find(label => 
        /^javascript file/i.test(label.textContent.trim())
    );

    if (!jsLabel) {
        logger.trace('[ThemeEditorInjection] JavaScript file label not found');
        return false;
    }

    // Find parent container
    const container = 
        jsLabel.closest('.ic-Form-control') ||
        jsLabel.closest('.ic-Form-control__control') ||
        jsLabel.parentElement;

    if (!container) {
        logger.warn('[ThemeEditorInjection] Could not find parent container for injection');
        return false;
    }

    // Create injection block
    const block = document.createElement('div');
    block.className = INJECTION_MARKER;
    block.style.cssText = `
        margin-top: 10px;
        padding: 10px;
        border: 2px solid #22dd88;
        border-radius: 6px;
        background: rgba(34, 221, 136, 0.08);
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Customized Gradebook Tools';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';

    // Button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'Button Button--small';
    button.textContent = ADMIN_DASHBOARD_LABEL;
    button.addEventListener('click', () => {
        const accountId = getAccountId();
        if (!accountId) {
            alert('Account ID not found in ENV.');
            return;
        }
        window.open(`/accounts/${accountId}?cg_admin_dashboard=1`, '_blank');
    });

    block.appendChild(title);
    block.appendChild(button);
    container.appendChild(block);

    logger.info('[ThemeEditorInjection] CG Tools button injected successfully');
    return true;
}