// src/admin/summaryPanel.js

import { createCollapsiblePanel } from './canvasFormHelpers.js';
import { createElement } from './domHelpers.js';
import {
    getAccountId,
    getInstalledThemeJsUrl,
    getInstalledThemeCssUrl,
    getBrandConfigMetadata
} from './pageDetection.js';

export function renderSummaryPanel(container, ctx) {

    const { panel } = createCollapsiblePanel('Summary', true);

    const accountId = getAccountId();
    const jsUrl = getInstalledThemeJsUrl();
    const cssUrl = getInstalledThemeCssUrl();
    const brandMeta = getBrandConfigMetadata();

    const config = ctx.getConfig?.() || {};

    const content = createElement('div', {
        attrs: { class: 'cg-summary-grid' }
    });

    content.appendChild(createRow('Account ID', accountId || 'Unknown'));
    content.appendChild(createRow('JS Override Installed', jsUrl ? 'Yes' : 'No'));
    content.appendChild(createRow('CSS Override Installed', cssUrl ? 'Yes' : 'No'));
    content.appendChild(createRow('Brand Created', brandMeta?.created_at || 'Unknown'));
    content.appendChild(createRow('Account Filter Enabled', config.ENABLE_ACCOUNT_FILTER ? 'Yes' : 'No'));
    content.appendChild(createRow('Default Grading Scheme', config.DEFAULT_GRADING_SCHEME_ID || 'None'));

    panel.appendChild(content);
    container.appendChild(panel);
}

function createRow(label, value) {
    const row = createElement('div', {
        attrs: { class: 'cg-summary-row' }
    });

    const left = createElement('div', {
        attrs: { class: 'cg-summary-label' },
        text: label
    });

    const right = createElement('div', {
        attrs: { class: 'cg-summary-value' },
        text: String(value)
    });

    row.appendChild(left);
    row.appendChild(right);

    return row;
}