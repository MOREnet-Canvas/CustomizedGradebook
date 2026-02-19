// src/admin/accountSettingsPanel.js
/**
 * Account Settings Panel Module
 *
 * Renders diagnostic panel showing:
 * - Final Grade Override feature flag status
 *
 * Note: Grading Schemes panel has been extracted to gradingSchemesPanel.js
 *
 * Refactored to use:
 * - Canvas ic-* UI classes
 * - Collapsible panel helper from canvasFormHelpers.js
 * - Status message classes from dashboardStyles.css
 */

import { logger } from '../utils/logger.js';
import { createElement, escapeHtml } from './domHelpers.js';
import { createCollapsiblePanel } from './canvasFormHelpers.js';

/**
 * Fetch final grade override feature flag status
 *
 * @param {string} accountId - Account ID
 * @returns {Promise<Object|null>} Feature flag data or null on error
 */
async function fetchFinalGradeOverrideStatus(accountId) {
    console.log(`📘 Checking final_grades_override feature for account: ${accountId}`);

    const url = `/api/v1/accounts/${accountId}/features/flags/final_grades_override`;

    try {
        const res = await fetch(url, {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
            const text = await res.text();
            console.error("❌ Expected JSON but got:", ct);
            console.error("Response preview:", text.slice(0, 300));
            return null;
        }

        if (!res.ok) {
            console.error(`❌ HTTP ${res.status}: ${res.statusText}`);
            const errorData = await res.json();
            console.error("Error data:", errorData);
            return null;
        }

        const data = await res.json();
        console.log("✅ Feature flag data:", data);

        // Store for debugging
        window.cgFinalGradeOverrideFeature = data;

        return data;
    } catch (err) {
        console.error("❌ Error fetching feature flag:", err);
        return null;
    }
}

/**
 * Render final grade override feature flag panel
 *
 * @param {HTMLElement} root - Root container
 * @param {Object|null} featureData - Feature flag data
 */
function renderFeatureFlagPanel(root, featureData) {
    // Create collapsible panel
    const { panel, body } = createCollapsiblePanel('Final Grade Override Feature Status');

    if (!featureData) {
        const errorBox = createElement('div', {
            attrs: { class: 'cg-status cg-status--error' },
            text: '❌ Unable to fetch feature flag status. Check console for errors.'
        });
        body.appendChild(errorBox);
        root.appendChild(panel);
        return;
    }

    const { state, locked, parent_state } = featureData;

    // Determine visual indicator, message, and status class
    let indicator = '';
    let message = '';
    let statusClass = 'cg-status--info';

    if (state === 'allowed_on' || state === 'on') {
        indicator = '✅';
        message = state === 'on'
            ? 'Final Grade Override: Enabled (forced on)'
            : 'Final Grade Override: Enabled (allowed on by default)';
        statusClass = 'cg-status--success';
    } else if (state === 'allowed') {
        indicator = '⚠️';
        message = 'Final Grade Override: Available (courses can enable)';
        statusClass = 'cg-status--warning';
    } else {
        indicator = '❌';
        message = 'Final Grade Override: Disabled';
        statusClass = 'cg-status--error';
    }

    // Status box using CSS classes
    const statusBox = createElement('div', {
        attrs: { class: `cg-status ${statusClass}` },
        html: `<strong>${indicator} ${escapeHtml(message)}</strong>`
    });

    body.appendChild(statusBox);

    // Additional details
    const details = createElement('div', {
        style: {
            fontSize: '13px',
            color: '#666',
            marginTop: '8px'
        }
    });

    details.appendChild(createElement('div', {
        html: `<strong>Locked:</strong> ${locked ? 'Yes' : 'No'}`
    }));

    if (parent_state && parent_state !== state) {
        details.appendChild(createElement('div', {
            html: `<strong>Parent State:</strong> ${escapeHtml(parent_state)}`,
            style: { marginTop: '4px' }
        }));
    }

    body.appendChild(details);
    root.appendChild(panel);
}

/**
 * Render account settings panel with Final Grade Override feature
 *
 * @param {HTMLElement} root - Root container element
 */
export async function renderAccountSettingsPanel(root) {
    logger.debug('[AccountSettingsPanel] Rendering account settings panel');

    const accountId = window.location.pathname.match(/accounts\/(\d+)/)?.[1] || "1";

    // Fetch feature flag data
    const featureData = await fetchFinalGradeOverrideStatus(accountId);

    // Render Feature Flag Panel only
    // Note: Grading Schemes Panel is now rendered from loaderGeneratorPanel.js
    renderFeatureFlagPanel(root, featureData);
}

