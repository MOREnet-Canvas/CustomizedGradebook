// src/admin/accountSettingsPanel.js
/**
 * Account Settings Panel Module
 *
 * Renders diagnostic panels showing:
 * - Final Grade Override feature flag status
 * - Account-level grading schemes with IDs and scale data
 */

import { logger } from '../utils/logger.js';
import { createElement, createPanel, escapeHtml } from './domHelpers.js';
import { getGradingSchemeExamples } from './data/gradingSchemeExamples.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { triggerConfigChangeNotification } from './loaderGeneratorPanel.js';

// Global references for grading schemes grid refresh
let globalGradingSchemesGridContainer = null;
let globalGradingSchemes = [];

/**
 * Select a grading scheme as default
 *
 * @param {Object} scheme - Grading scheme to select
 * @param {HTMLElement} gridContainer - Grid container element to refresh
 * @param {Array} allSchemes - All available schemes
 */
function selectGradingScheme(scheme, gridContainer, allSchemes) {
    if (!window.CG_MANAGED) {
        window.CG_MANAGED = { config: {} };
    }
    if (!window.CG_MANAGED.config) {
        window.CG_MANAGED.config = {};
    }

    window.CG_MANAGED.config.DEFAULT_GRADING_SCHEME_ID = scheme.id;

    logger.info('[AccountSettingsPanel] Selected grading scheme:', scheme.title, 'ID:', scheme.id);

    // Trigger the shared configuration change notification
    triggerConfigChangeNotification();

    // Refresh the grid to show visual feedback
    if (gridContainer && allSchemes) {
        refreshGradingSchemesGrid(gridContainer, allSchemes);
    }
}

/**
 * Deselect the current grading scheme
 *
 * @param {HTMLElement} gridContainer - Grid container element to refresh
 * @param {Array} allSchemes - All available schemes
 */
function deselectGradingScheme(gridContainer, allSchemes) {
    if (window.CG_MANAGED?.config) {
        window.CG_MANAGED.config.DEFAULT_GRADING_SCHEME_ID = null;
    }

    logger.info('[AccountSettingsPanel] Deselected grading scheme');

    // Trigger the shared configuration change notification
    triggerConfigChangeNotification();

    // Refresh the grid to show visual feedback
    if (gridContainer && allSchemes) {
        refreshGradingSchemesGrid(gridContainer, allSchemes);
    }
}

/**
 * Refresh the grading schemes grid to show updated selection
 *
 * @param {HTMLElement} gridContainer - Grid container element
 * @param {Array} schemes - Array of grading schemes
 */
function refreshGradingSchemesGrid(gridContainer, schemes) {
    const currentSchemeId = window.CG_MANAGED?.config?.DEFAULT_GRADING_SCHEME_ID || null;

    // Clear existing cards
    gridContainer.innerHTML = '';

    // Re-render all cards with updated selection state
    schemes.forEach((scheme) => {
        renderGradingSchemeCard(gridContainer, scheme, currentSchemeId, schemes);
    });

    // Update the "Currently Selected" display
    const selectedDisplay = document.querySelector('#cg-selected-scheme-display');
    if (selectedDisplay) {
        if (currentSchemeId) {
            const selectedScheme = schemes.find(s => s.id === currentSchemeId);
            if (selectedScheme) {
                selectedDisplay.innerHTML = `<strong>Currently Selected:</strong> ${escapeHtml(selectedScheme.title)} (ID: ${currentSchemeId})`;
            } else {
                selectedDisplay.innerHTML = `<strong>Currently Selected:</strong> ID ${currentSchemeId} <em>(not found in current schemes)</em>`;
            }
            selectedDisplay.style.display = 'block';
        } else {
            selectedDisplay.style.display = 'none';
        }
    }

    logger.debug('[AccountSettingsPanel] Grading schemes grid refreshed');
}

/**
 * Create a grading standard in Canvas via API
 *
 * @param {string} accountId - Account ID
 * @param {Object} gradingSchemeData - Grading scheme data
 * @param {string} gradingSchemeData.title - Title of the grading scheme
 * @param {number} gradingSchemeData.scaling_factor - Scaling factor
 * @param {boolean} gradingSchemeData.points_based - Whether points-based
 * @param {Array} gradingSchemeData.data - Array of {name, value} entries
 * @returns {Promise<Object>} Created grading standard data
 */
async function createGradingStandard(accountId, gradingSchemeData) {
    logger.info('[AccountSettingsPanel] Creating grading standard:', gradingSchemeData.title);

    const apiClient = new CanvasApiClient();
    const url = `/api/v1/accounts/${accountId}/grading_standards`;

    // Canvas API expects form-encoded data, not JSON
    // Build URLSearchParams for form-encoded request
    const formData = new URLSearchParams();
    formData.append('title', gradingSchemeData.title);
    formData.append('scaling_factor', gradingSchemeData.scaling_factor);
    formData.append('points_based', gradingSchemeData.points_based);

    // Add grading scheme entries as array parameters
    gradingSchemeData.data.forEach(entry => {
        formData.append('grading_scheme_entry[][name]', entry.name);
        formData.append('grading_scheme_entry[][value]', entry.value);
    });

    logger.debug('[AccountSettingsPanel] API form data:', Object.fromEntries(formData));
    console.log('[DEBUG] Form data being sent to Canvas API:', formData.toString());
    console.log('[DEBUG] Grading scheme data:', JSON.stringify(gradingSchemeData, null, 2));

    try {
        // Send as form-encoded data instead of JSON
        const result = await apiClient.post(url, formData.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, 'createGradingStandard');
        logger.info('[AccountSettingsPanel] Grading standard created successfully:', result);
        return result;
    } catch (error) {
        logger.error('[AccountSettingsPanel] Failed to create grading standard:', error);
        console.error('[DEBUG] Error details:', error);
        console.error('[DEBUG] Error message:', error.message);
        console.error('[DEBUG] Error response:', error.responseText);
        throw error;
    }
}

/**
 * Parse Link header for pagination
 *
 * @param {string} linkHeader - Link header value
 * @returns {Object} Object with rel types as keys and URLs as values
 */
function parseLinkHeader(linkHeader) {
    if (!linkHeader) return {};
    const parts = linkHeader.split(",").map(s => s.trim());
    const links = {};
    for (const p of parts) {
        const m = p.match(/^<([^>]+)>\s*;\s*rel="([^"]+)"$/);
        if (m) links[m[2]] = m[1];
    }
    return links;
}

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
 * Fetch all grading schemes with pagination
 *
 * @param {string} accountId - Account ID
 * @returns {Promise<Array>} Array of grading schemes
 */
async function fetchGradingSchemes(accountId) {
    console.log(`📘 Capturing grading schemes for account: ${accountId}`);

    let url = `/api/v1/accounts/${accountId}/grading_standards?per_page=100`;
    const schemes = [];

    while (url) {
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
                break;
            }

            const data = await res.json();
            schemes.push(...data);

            const links = parseLinkHeader(res.headers.get("link"));
            url = links.next || null;
        } catch (err) {
            console.error("❌ Error fetching grading schemes:", err);
            break;
        }
    }

    console.log(`✅ Captured ${schemes.length} grading scheme(s).`);

    // Store for debugging
    window.cgGradingSchemes = schemes;

    return schemes;
}

/**
 * Render account settings panel with both features
 *
 * @param {HTMLElement} root - Root container element
 */
export async function renderAccountSettingsPanel(root) {
    logger.debug('[AccountSettingsPanel] Rendering account settings panel');

    const accountId = window.location.pathname.match(/accounts\/(\d+)/)?.[1] || "1";

    // Fetch data in parallel
    const [featureData, schemes] = await Promise.all([
        fetchFinalGradeOverrideStatus(accountId),
        fetchGradingSchemes(accountId)
    ]);

    // Render Feature Flag Panel
    renderFeatureFlagPanel(root, featureData);

    // Render Grading Schemes Panel
    renderGradingSchemesPanel(root, schemes);
}



/**
 * Render final grade override feature flag panel
 *
 * @param {HTMLElement} root - Root container
 * @param {Object|null} featureData - Feature flag data
 */
function renderFeatureFlagPanel(root, featureData) {
    const panel = createPanel(root, 'Final Grade Override Feature Status');

    if (!featureData) {
        panel.appendChild(createElement('div', {
            text: '❌ Unable to fetch feature flag status. Check console for errors.',
            style: {
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ffa39e',
                background: '#fff1f0',
                color: '#cf1322'
            }
        }));
        return;
    }

    const { state, locked, parent_state } = featureData;

    // Determine visual indicator and message
    let indicator = '';
    let message = '';
    let bgColor = '';
    let borderColor = '';

    if (state === 'allowed_on' || state === 'on') {
        indicator = '✅';
        message = state === 'on'
            ? 'Final Grade Override: Enabled (forced on)'
            : 'Final Grade Override: Enabled (allowed on by default)';
        bgColor = '#f6ffed';
        borderColor = '#b7eb8f';
    } else if (state === 'allowed') {
        indicator = '⚠️';
        message = 'Final Grade Override: Available (courses can enable)';
        bgColor = '#fff7e6';
        borderColor = '#f3d19e';
    } else {
        indicator = '❌';
        message = 'Final Grade Override: Disabled';
        bgColor = '#fff1f0';
        borderColor = '#ffa39e';
    }

    // Status box
    const statusBox = createElement('div', {
        html: `<strong>${indicator} ${escapeHtml(message)}</strong>`,
        style: {
            padding: '12px',
            borderRadius: '8px',
            border: `1px solid ${borderColor}`,
            background: bgColor,
            marginBottom: '10px'
        }
    });

    panel.appendChild(statusBox);

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

    panel.appendChild(details);
}


/**
 * Open grading schemes in a new tab with formatted HTML
 *
 * @param {Array} schemes - Array of grading schemes
 */
function openGradingSchemesInNewTab(schemes) {
    const html = generateGradingSchemesHTML(schemes);
    const newTab = window.open('', '_blank');

    if (newTab) {
        newTab.document.write(html);
        newTab.document.close();
    } else {
        console.error('❌ Failed to open new tab. Please check popup blocker settings.');
        alert('Failed to open new tab. Please check your popup blocker settings.');
    }
}

/**
 * Generate HTML for grading schemes display
 *
 * @param {Array} schemes - Array of grading schemes
 * @returns {string} HTML string
 */
function generateGradingSchemesHTML(schemes) {
    const accountId = window.location.pathname.match(/accounts\/(\d+)/)?.[1] || "unknown";
    const currentSchemeId = window.CG_MANAGED?.config?.DEFAULT_GRADING_SCHEME_ID || null;

    let schemesHTML = '';

    schemes.forEach((scheme, index) => {
        const isSelected = currentSchemeId === scheme.id;
        const gradeBy = scheme.points_based ? 'Points' : 'Percentage';
        const scalingFactor = scheme.scaling_factor || null;

        // Build grading scale table
        let tableRows = '';
        if (scheme.grading_scheme && scheme.grading_scheme.length > 0) {
            scheme.grading_scheme.forEach((entry, idx) => {
                // Handle both array format [name, value] and object format {name, value}
                const name = Array.isArray(entry) ? entry[0] : entry.name;
                const rawValue = Array.isArray(entry) ? entry[1] : entry.value;

                // Apply scaling factor if present
                const value = scalingFactor ? (rawValue * scalingFactor).toFixed(2) : rawValue;

                let rangeText = '';
                if (idx === 0) {
                    // First entry: upper bound is scaling_factor (points) or 100 (percentage)
                    const upperBound = scheme.points_based
                        ? scalingFactor.toFixed(2)
                        : '100';
                    rangeText = `${upperBound} to ${value}`;
                } else {
                    const prevEntry = scheme.grading_scheme[idx - 1];
                    const rawUpperValue = Array.isArray(prevEntry) ? prevEntry[1] : prevEntry.value;
                    const upperValue = scalingFactor ? (rawUpperValue * scalingFactor).toFixed(2) : rawUpperValue;
                    rangeText = `&lt; ${upperValue} to ${value}`;
                }

                tableRows += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #e8e8e8;">${escapeHtml(name)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e8e8e8;">${rangeText}</td>
                    </tr>
                `;
            });
        }

        schemesHTML += `
            <div class="scheme-card" data-scheme-id="${scheme.id}" style="border: ${isSelected ? '2px solid #52c41a' : '1px solid #d9d9d9'}; background: ${isSelected ? '#f6ffed' : '#fafafa'}; position: relative;">
                ${isSelected ? '<div style="position: absolute; top: 12px; right: 12px; padding: 4px 10px; background: #52c41a; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600;">✓ Selected</div>' : ''}

                <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #333; ${isSelected ? 'padding-right: 90px;' : ''}">
                    ${escapeHtml(scheme.title || 'Untitled')} <span style="color: #666; font-weight: normal;">(ID: ${scheme.id})</span>
                </h2>

                <div style="margin-bottom: 16px; font-size: 13px; color: #666;">
                    <div><strong>Grade By:</strong> ${gradeBy}</div>
                    <div style="margin-top: 4px;"><strong>Context:</strong> ${escapeHtml(scheme.context_type || 'Unknown')}</div>
                    <div style="margin-top: 4px;"><strong>Context ID:</strong> ${scheme.context_id || 'N/A'}</div>
                    ${scheme.scaling_factor ? `<div style="margin-top: 4px;"><strong>Scaling Factor:</strong> ${scheme.scaling_factor}</div>` : ''}
                </div>

                ${tableRows ? `
                    <h3 style="margin: 16px 0 8px 0; font-size: 15px; color: #333;">Grading Scale</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: #fff;">
                        <thead>
                            <tr style="background: #f0f0f0;">
                                <th style="text-align: left; padding: 8px; border-bottom: 2px solid #d9d9d9; font-weight: 600;">Letter Grade</th>
                                <th style="text-align: left; padding: 8px; border-bottom: 2px solid #d9d9d9; font-weight: 600;">Range</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                ` : '<p style="color: #999; font-style: italic;">No grading scale data available.</p>'}

                <button
                    class="select-scheme-btn"
                    data-scheme-id="${scheme.id}"
                    data-scheme-title="${escapeHtml(scheme.title || 'Untitled')}"
                    style="width: 100%; margin-top: 16px; padding: 8px 16px; background: ${isSelected ? '#ff4d4f' : '#52c41a'}; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.2s ease;"
                    onmouseover="this.style.background='${isSelected ? '#cf1322' : '#389e0d'}'"
                    onmouseout="this.style.background='${isSelected ? '#ff4d4f' : '#52c41a'}'"
                >
                    ${isSelected ? 'Deselect' : 'Select as Default'}
                </button>
            </div>
        `;
    });

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Grading Schemes - Account ${escapeHtml(accountId)}</title>
            <style>
                body {
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    margin: 0;
                    padding: 32px;
                    background: #f5f5f5;
                    color: #333;
                }
                .container {
                    max-width: 1400px;
                    margin: 0 auto;
                    background: #fff;
                    padding: 32px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                h1 {
                    margin: 0 0 8px 0;
                    font-size: 28px;
                    color: #333;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 24px;
                    font-size: 14px;
                }
                .schemes-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }
                .scheme-card {
                    padding: 20px;
                    border: 1px solid #d9d9d9;
                    border-radius: 8px;
                    background: #fafafa;
                    break-inside: avoid;
                }
                @media print {
                    body { background: #fff; padding: 0; }
                    .container { box-shadow: none; }
                    .schemes-grid { gap: 16px; }
                }
                @media (max-width: 1200px) {
                    .schemes-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                @media (max-width: 768px) {
                    .schemes-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Grading Schemes</h1>
                <div class="subtitle">Account ID: ${escapeHtml(accountId)} | Total Schemes: ${schemes.length}</div>
                ${currentSchemeId ? `
                    <div style="padding: 12px; margin-bottom: 20px; background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 6px; font-size: 14px;">
                        <strong>Currently Selected:</strong> ${schemes.find(s => s.id === currentSchemeId)?.title || 'Unknown'} (ID: ${currentSchemeId})
                    </div>
                ` : ''}
                <div class="schemes-grid">
                    ${schemesHTML}
                </div>
            </div>

            <script>
                // Handle scheme selection
                document.addEventListener('DOMContentLoaded', function() {
                    const buttons = document.querySelectorAll('.select-scheme-btn');

                    buttons.forEach(button => {
                        button.addEventListener('click', function() {
                            const schemeId = parseInt(this.getAttribute('data-scheme-id'), 10);
                            const schemeTitle = this.getAttribute('data-scheme-title');
                            const isCurrentlySelected = this.textContent.trim() === 'Deselect';

                            // Access parent window's CG_MANAGED config
                            if (window.opener && window.opener.CG_MANAGED) {
                                if (isCurrentlySelected) {
                                    // Deselect
                                    window.opener.CG_MANAGED.config.DEFAULT_GRADING_SCHEME_ID = null;
                                    alert('✓ Grading scheme deselected.\\n\\nThis change will be saved when you regenerate the loader in the Loader Generator panel.');
                                } else {
                                    // Select
                                    window.opener.CG_MANAGED.config.DEFAULT_GRADING_SCHEME_ID = schemeId;
                                    alert('✓ Selected grading scheme: ' + schemeTitle + ' (ID: ' + schemeId + ')\\n\\nThis selection will be saved when you regenerate the loader in the Loader Generator panel.');
                                }

                                // Reload this window to show updated selection
                                window.location.reload();
                            } else {
                                alert('Unable to access parent window configuration. Please use the selection buttons in the main admin dashboard instead.');
                            }
                        });
                    });
                });
            </script>
        </body>
        </html>
    `;
}

/**
 * Open grading scheme editor modal
 *
 * @param {Object} exampleScheme - Example grading scheme to use as template
 * @param {Function} onSuccess - Callback function to call after successful creation
 */
function openGradingSchemeEditor(exampleScheme, onSuccess) {
    const accountId = window.location.pathname.match(/accounts\/(\d+)/)?.[1] || "1";

    // Create modal overlay
    const overlay = createElement('div', {
        style: {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }
    });

    // Create modal container
    const modal = createElement('div', {
        style: {
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px'
        }
    });

    // Modal header
    const header = createElement('div', {
        style: {
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '2px solid #e8e8e8'
        }
    });

    header.appendChild(createElement('h2', {
        text: 'Create Grading Standard',
        style: {
            margin: '0 0 8px 0',
            fontSize: '24px',
            color: '#333'
        }
    }));

    header.appendChild(createElement('div', {
        html: `Based on template: <strong>${escapeHtml(exampleScheme.title)}</strong>`,
        style: {
            fontSize: '14px',
            color: '#666'
        }
    }));

    modal.appendChild(header);

    // Create form
    const form = createElement('form', {
        style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        }
    });

    // Title input
    const titleGroup = createElement('div');
    titleGroup.appendChild(createElement('label', {
        html: '<strong>Title:</strong>',
        style: {
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            color: '#333'
        }
    }));

    const titleInput = createElement('input', {
        attrs: {
            type: 'text',
            value: exampleScheme.title,
            required: 'true'
        },
        style: {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box'
        }
    });
    titleGroup.appendChild(titleInput);
    form.appendChild(titleGroup);

    // Scaling factor input
    const scalingGroup = createElement('div');
    scalingGroup.appendChild(createElement('label', {
        html: '<strong>Scaling Factor:</strong>',
        style: {
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            color: '#333'
        }
    }));

    const scalingInput = createElement('input', {
        attrs: {
            type: 'number',
            value: exampleScheme.scaling_factor.toString(),
            min: '0.01',
            step: '0.01',
            required: 'true'
        },
        style: {
            width: '200px',
            padding: '8px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            fontSize: '14px'
        }
    });
    scalingGroup.appendChild(scalingInput);
    form.appendChild(scalingGroup);

    // Points-based checkbox
    const pointsGroup = createElement('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }
    });

    const pointsCheckbox = createElement('input', {
        attrs: {
            type: 'checkbox',
            id: 'points-based-checkbox',
            checked: exampleScheme.points_based ? 'true' : null
        },
        style: {
            width: '18px',
            height: '18px',
            cursor: 'pointer'
        }
    });

    const pointsLabel = createElement('label', {
        html: '<strong>Points-Based</strong>',
        attrs: {
            for: 'points-based-checkbox'
        },
        style: {
            fontSize: '14px',
            color: '#333',
            cursor: 'pointer'
        }
    });

    pointsGroup.appendChild(pointsCheckbox);
    pointsGroup.appendChild(pointsLabel);
    form.appendChild(pointsGroup);

    // Grading scale entries
    const entriesGroup = createElement('div');
    entriesGroup.appendChild(createElement('label', {
        html: '<strong>Grading Scale Entries:</strong>',
        style: {
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            color: '#333'
        }
    }));

    // Create table for entries
    const entriesTable = createElement('table', {
        style: {
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #d9d9d9',
            marginBottom: '8px'
        }
    });

    // Table header
    const thead = createElement('thead');
    const headerRow = createElement('tr', {
        style: {
            background: '#f0f0f0'
        }
    });
    headerRow.appendChild(createElement('th', {
        text: 'Name',
        style: {
            textAlign: 'left',
            padding: '8px',
            borderBottom: '2px solid #d9d9d9',
            fontWeight: '600',
            fontSize: '13px'
        }
    }));
    headerRow.appendChild(createElement('th', {
        text: 'Value (0-1)',
        style: {
            textAlign: 'left',
            padding: '8px',
            borderBottom: '2px solid #d9d9d9',
            fontWeight: '600',
            fontSize: '13px',
            width: '150px'
        }
    }));
    headerRow.appendChild(createElement('th', {
        text: 'Actions',
        style: {
            textAlign: 'center',
            padding: '8px',
            borderBottom: '2px solid #d9d9d9',
            fontWeight: '600',
            fontSize: '13px',
            width: '80px'
        }
    }));
    thead.appendChild(headerRow);
    entriesTable.appendChild(thead);

    // Table body
    const tbody = createElement('tbody');
    entriesTable.appendChild(tbody);

    // Function to add entry row
    const addEntryRow = (name = '', value = 0) => {
        const row = createElement('tr');

        const nameCell = createElement('td', {
            style: {
                padding: '6px',
                borderBottom: '1px solid #e8e8e8'
            }
        });
        const nameInput = createElement('input', {
            attrs: {
                type: 'text',
                value: name,
                required: 'true'
            },
            style: {
                width: '100%',
                padding: '6px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '13px',
                boxSizing: 'border-box'
            }
        });
        nameCell.appendChild(nameInput);
        row.appendChild(nameCell);

        const valueCell = createElement('td', {
            style: {
                padding: '6px',
                borderBottom: '1px solid #e8e8e8'
            }
        });
        const valueInput = createElement('input', {
            attrs: {
                type: 'number',
                value: value.toString(),
                min: '0',
                max: '1',
                step: '0.001',
                required: 'true'
            },
            style: {
                width: '100%',
                padding: '6px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '13px',
                boxSizing: 'border-box'
            }
        });
        valueCell.appendChild(valueInput);
        row.appendChild(valueCell);

        const actionsCell = createElement('td', {
            style: {
                padding: '6px',
                borderBottom: '1px solid #e8e8e8',
                textAlign: 'center'
            }
        });
        const deleteBtn = createElement('button', {
            text: '🗑️',
            attrs: {
                type: 'button',
                title: 'Delete entry'
            },
            style: {
                padding: '4px 8px',
                background: '#ff4d4f',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
            },
            on: {
                click: () => {
                    if (tbody.children.length > 1) {
                        row.remove();
                    } else {
                        alert('At least one entry is required.');
                    }
                }
            }
        });
        actionsCell.appendChild(deleteBtn);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    };

    // Add existing entries from example
    exampleScheme.data.forEach(entry => {
        addEntryRow(entry.name, entry.value);
    });

    entriesGroup.appendChild(entriesTable);

    // Add entry button
    const addEntryBtn = createElement('button', {
        text: '+ Add Entry',
        attrs: {
            type: 'button'
        },
        style: {
            padding: '6px 12px',
            background: '#52c41a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
        },
        on: {
            click: () => addEntryRow('', 0)
        }
    });
    entriesGroup.appendChild(addEntryBtn);

    form.appendChild(entriesGroup);

    // Status message area
    const statusArea = createElement('div', {
        style: {
            minHeight: '40px',
            padding: '12px',
            borderRadius: '6px',
            display: 'none'
        }
    });
    form.appendChild(statusArea);

    // Action buttons
    const buttonGroup = createElement('div', {
        style: {
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid #e8e8e8'
        }
    });

    const cancelBtn = createElement('button', {
        text: 'Cancel',
        attrs: {
            type: 'button'
        },
        style: {
            padding: '10px 20px',
            background: '#fff',
            color: '#333',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
        },
        on: {
            click: () => overlay.remove()
        }
    });

    const createBtn = createElement('button', {
        text: 'Create Grading Standard',
        attrs: {
            type: 'submit'
        },
        style: {
            padding: '10px 20px',
            background: '#0374B5',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
        }
    });

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(createBtn);
    form.appendChild(buttonGroup);

    // Form submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Disable buttons during submission
        createBtn.disabled = true;
        cancelBtn.disabled = true;
        createBtn.style.opacity = '0.6';
        createBtn.style.cursor = 'not-allowed';
        createBtn.textContent = 'Creating...';

        // Show loading status
        statusArea.style.display = 'block';
        statusArea.style.background = '#e6f7ff';
        statusArea.style.border = '1px solid #91d5ff';
        statusArea.style.color = '#0050b3';
        statusArea.textContent = '⏳ Creating grading standard...';

        try {
            // Collect form data
            const title = titleInput.value.trim();
            const scaling_factor = parseFloat(scalingInput.value);
            const points_based = pointsCheckbox.checked;

            // Collect entries
            const data = [];
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const nameInput = row.querySelector('input[type="text"]');
                const valueInput = row.querySelector('input[type="number"]');
                data.push({
                    name: nameInput.value.trim(),
                    value: parseFloat(valueInput.value)
                });
            });

            // Validate
            if (!title) {
                throw new Error('Title is required');
            }
            if (scaling_factor <= 0) {
                throw new Error('Scaling factor must be positive');
            }
            if (data.length === 0) {
                throw new Error('At least one entry is required');
            }

            // Sort entries by value (descending) - Canvas requirement
            data.sort((a, b) => b.value - a.value);

            // Create grading standard
            const gradingSchemeData = {
                title,
                scaling_factor,
                points_based,
                data
            };

            const result = await createGradingStandard(accountId, gradingSchemeData);

            // Show success
            statusArea.style.background = '#f6ffed';
            statusArea.style.border = '1px solid #b7eb8f';
            statusArea.style.color = '#389e0d';
            statusArea.innerHTML = `✅ Grading standard created successfully! <a href="/accounts/${accountId}/grading_standards" target="_blank" style="color: #0374B5; text-decoration: underline;">View in Canvas</a>`;

            // Call success callback
            if (onSuccess) {
                onSuccess(result);
            }

            // Close modal after 2 seconds
            setTimeout(() => {
                overlay.remove();
            }, 2000);

        } catch (error) {
            logger.error('[AccountSettingsPanel] Error creating grading standard:', error);

            // Show error
            statusArea.style.background = '#fff1f0';
            statusArea.style.border = '1px solid #ffa39e';
            statusArea.style.color = '#cf1322';
            statusArea.textContent = `❌ Error: ${error.message || 'Failed to create grading standard'}`;

            // Re-enable buttons
            createBtn.disabled = false;
            cancelBtn.disabled = false;
            createBtn.style.opacity = '1';
            createBtn.style.cursor = 'pointer';
            createBtn.textContent = 'Create Grading Standard';
        }
    });

    modal.appendChild(form);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

/**
 * Open grading scheme examples in a new tab
 */
function openGradingSchemeExamplesInNewTab() {
    const html = generateGradingSchemeExamplesHTML();
    const newTab = window.open('', '_blank');

    if (newTab) {
        newTab.document.write(html);
        newTab.document.close();
    } else {
        console.error('❌ Failed to open new tab. Please check popup blocker settings.');
        alert('Failed to open new tab. Please check your popup blocker settings.');
    }
}

/**
 * Generate HTML for grading scheme examples display
 *
 * @returns {string} HTML string
 */
function generateGradingSchemeExamplesHTML() {
    const accountId = window.location.pathname.match(/accounts\/(\d+)/)?.[1] || "unknown";
    const examples = getGradingSchemeExamples();

    let schemesHTML = '';

    examples.forEach((scheme, index) => {
        const gradeBy = scheme.points_based ? 'Points' : 'Percentage';
        const scalingFactor = scheme.scaling_factor || null;

        // Build grading scale table
        let tableRows = '';
        if (scheme.data && scheme.data.length > 0) {
            scheme.data.forEach((entry, idx) => {
                const name = entry.name;
                const rawValue = entry.value;

                // Apply scaling factor if present
                const value = scalingFactor ? (rawValue * scalingFactor).toFixed(2) : rawValue;

                let rangeText = '';
                if (idx === 0) {
                    // First entry: upper bound is scaling_factor (points) or 100 (percentage)
                    const upperBound = scheme.points_based
                        ? scalingFactor.toFixed(2)
                        : '100';
                    rangeText = `${upperBound} to ${value}`;
                } else {
                    const prevEntry = scheme.data[idx - 1];
                    const rawUpperValue = prevEntry.value;
                    const upperValue = scalingFactor ? (rawUpperValue * scalingFactor).toFixed(2) : rawUpperValue;
                    rangeText = `&lt; ${upperValue} to ${value}`;
                }

                tableRows += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #e8e8e8;">${escapeHtml(name)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e8e8e8;">${rangeText}</td>
                    </tr>
                `;
            });
        }

        schemesHTML += `
            <div class="scheme-card">
                <div class="example-badge" style="display: inline-block; padding: 4px 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 11px; font-weight: 600; color: #856404; margin-bottom: 12px;">
                    📋 EXAMPLE TEMPLATE
                </div>
                <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">
                    ${escapeHtml(scheme.title || 'Untitled')}
                </h2>

                <div style="margin-bottom: 16px; font-size: 13px; color: #666;">
                    <div><strong>Grade By:</strong> ${gradeBy}</div>
                    <div style="margin-top: 4px;"><strong>Scaling Factor:</strong> ${scheme.scaling_factor}</div>
                    <div style="margin-top: 4px;"><strong>Scale Items:</strong> ${scheme.data.length}</div>
                </div>

                ${tableRows ? `
                    <h3 style="margin: 16px 0 8px 0; font-size: 15px; color: #333;">Grading Scale</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: #fff;">
                        <thead>
                            <tr style="background: #f0f0f0;">
                                <th style="text-align: left; padding: 8px; border-bottom: 2px solid #d9d9d9; font-weight: 600;">Letter Grade</th>
                                <th style="text-align: left; padding: 8px; border-bottom: 2px solid #d9d9d9; font-weight: 600;">Range</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                ` : '<p style="color: #999; font-style: italic;">No grading scale data available.</p>'}

                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                    <button
                        class="create-in-canvas-btn"
                        data-example-id="${scheme.id}"
                        style="padding: 8px 16px; background: #0374B5; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;"
                        onmouseover="this.style.background='#025a8c'"
                        onmouseout="this.style.background='#0374B5'"
                    >
                        ✨ Create in Canvas
                    </button>
                </div>
            </div>
        `;
    });

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Grading Scheme Examples - Account ${escapeHtml(accountId)}</title>
            <style>
                body {
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    margin: 0;
                    padding: 32px;
                    background: #f5f5f5;
                    color: #333;
                }
                .container {
                    max-width: 1400px;
                    margin: 0 auto;
                    background: #fff;
                    padding: 32px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                h1 {
                    margin: 0 0 8px 0;
                    font-size: 28px;
                    color: #333;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 24px;
                    font-size: 14px;
                }
                .info-banner {
                    background: #e7f3ff;
                    border-left: 4px solid #0374B5;
                    padding: 16px;
                    margin-bottom: 24px;
                    border-radius: 4px;
                }
                .info-banner p {
                    margin: 0;
                    color: #333;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .schemes-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }
                .scheme-card {
                    padding: 20px;
                    border: 1px solid #d9d9d9;
                    border-radius: 8px;
                    background: #fafafa;
                    break-inside: avoid;
                }
                @media print {
                    body { background: #fff; padding: 0; }
                    .container { box-shadow: none; }
                    .schemes-grid { gap: 16px; }
                }
                @media (max-width: 1200px) {
                    .schemes-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                @media (max-width: 768px) {
                    .schemes-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📚 Grading Scheme Examples</h1>
                <div class="subtitle">Example Templates for Account ${escapeHtml(accountId)}</div>

                <div class="info-banner">
                    <p><strong>ℹ️ About These Examples:</strong> These are pre-configured grading scheme templates that you can use as a starting point. Click "Create in Canvas" to customize and apply a template to your account.</p>
                </div>

                <div class="schemes-grid">
                    ${schemesHTML}
                </div>
            </div>

            <script>
                // Grading scheme examples data
                const GRADING_SCHEME_EXAMPLES = ${JSON.stringify(examples)};

                // Helper function to create DOM elements
                function createElement(tag, options = {}) {
                    const el = document.createElement(tag);

                    if (options.text) el.textContent = options.text;
                    if (options.html) el.innerHTML = options.html;
                    if (options.attrs) {
                        Object.entries(options.attrs).forEach(([key, value]) => {
                            if (value !== null && value !== undefined) {
                                el.setAttribute(key, value);
                            }
                        });
                    }
                    if (options.style) {
                        Object.entries(options.style).forEach(([key, value]) => {
                            el.style[key] = value;
                        });
                    }
                    if (options.on) {
                        Object.entries(options.on).forEach(([event, handler]) => {
                            el.addEventListener(event, handler);
                        });
                    }

                    return el;
                }

                // Escape HTML for safe display
                function escapeHtml(str) {
                    if (str == null) return '';
                    const div = document.createElement('div');
                    div.textContent = str;
                    return div.innerHTML;
                }

                // Get CSRF token from cookies
                function getCsrfToken() {
                    const match = document.cookie.match(/(?:^|;\\s*)_csrf_token=([^;]+)/);
                    return match ? decodeURIComponent(match[1]) : null;
                }

                // Create grading standard via Canvas API
                async function createGradingStandard(accountId, gradingSchemeData) {
                    const csrfToken = getCsrfToken();
                    if (!csrfToken) {
                        throw new Error('CSRF token not found - user may not be authenticated');
                    }

                    const url = \`/api/v1/accounts/\${accountId}/grading_standards\`;

                    // Canvas API expects form-encoded data, not JSON
                    // Build URLSearchParams for form-encoded request
                    const formData = new URLSearchParams();
                    formData.append('title', gradingSchemeData.title);
                    formData.append('scaling_factor', gradingSchemeData.scaling_factor);
                    formData.append('points_based', gradingSchemeData.points_based);

                    // Add grading scheme entries as array parameters
                    gradingSchemeData.data.forEach(entry => {
                        formData.append('grading_scheme_entry[][name]', entry.name);
                        formData.append('grading_scheme_entry[][value]', entry.value);
                    });

                    console.log('[GradingSchemeEditor] Form data being sent:', formData.toString());
                    console.log('[GradingSchemeEditor] Grading scheme data:', JSON.stringify(gradingSchemeData, null, 2));

                    const response = await fetch(url, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-CSRF-Token': csrfToken
                        },
                        body: formData.toString()
                    });

                    if (!response.ok) {
                        const responseText = await response.text();
                        console.error('[GradingSchemeEditor] Error response:', responseText);
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || \`HTTP \${response.status}: \${response.statusText}\`);
                    }

                    return await response.json();
                }

                // Open grading scheme editor modal
                function openGradingSchemeEditor(exampleScheme, onSuccess) {
                    const accountId = window.location.pathname.match(/accounts\\/(\\d+)/)?.[1] || "1";

                    // Create modal overlay
                    const overlay = createElement('div', {
                        style: {
                            position: 'fixed',
                            top: '0',
                            left: '0',
                            right: '0',
                            bottom: '0',
                            background: 'rgba(0, 0, 0, 0.5)',
                            zIndex: '10000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }
                    });

                    // Create modal container
                    const modal = createElement('div', {
                        style: {
                            background: '#fff',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                            maxWidth: '800px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: '24px'
                        }
                    });

                    // Modal header
                    const header = createElement('div', {
                        style: {
                            marginBottom: '20px',
                            paddingBottom: '16px',
                            borderBottom: '2px solid #e8e8e8'
                        }
                    });

                    header.appendChild(createElement('h2', {
                        text: 'Create Grading Standard',
                        style: {
                            margin: '0 0 8px 0',
                            fontSize: '24px',
                            color: '#333'
                        }
                    }));

                    header.appendChild(createElement('div', {
                        html: \`Based on template: <strong>\${escapeHtml(exampleScheme.title)}</strong>\`,
                        style: {
                            fontSize: '14px',
                            color: '#666'
                        }
                    }));

                    modal.appendChild(header);

                    // Create form
                    const form = createElement('form', {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }
                    });

                    // Title input
                    const titleGroup = createElement('div');
                    titleGroup.appendChild(createElement('label', {
                        html: '<strong>Title:</strong>',
                        style: {
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            color: '#333'
                        }
                    }));

                    const titleInput = createElement('input', {
                        attrs: {
                            type: 'text',
                            value: exampleScheme.title,
                            required: 'true'
                        },
                        style: {
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                        }
                    });
                    titleGroup.appendChild(titleInput);
                    form.appendChild(titleGroup);

                    // Grade by radio button group (Percentage/Points)
                    const gradeByGroup = createElement('div');
                    gradeByGroup.appendChild(createElement('label', {
                        html: '<strong>Grade by</strong>',
                        style: {
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '14px',
                            color: '#333'
                        }
                    }));

                    const radioContainer = createElement('div', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            marginBottom: '8px'
                        }
                    });

                    // Percentage radio button
                    const percentageRadioWrapper = createElement('div', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }
                    });

                    const percentageRadio = createElement('input', {
                        attrs: {
                            type: 'radio',
                            name: 'grade-by',
                            id: 'grade-by-percentage',
                            value: 'percentage',
                            checked: !exampleScheme.points_based ? 'true' : null
                        },
                        style: {
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer'
                        }
                    });

                    const percentageLabel = createElement('label', {
                        text: 'Percentage',
                        attrs: {
                            for: 'grade-by-percentage'
                        },
                        style: {
                            fontSize: '14px',
                            color: '#333',
                            cursor: 'pointer'
                        }
                    });

                    percentageRadioWrapper.appendChild(percentageRadio);
                    percentageRadioWrapper.appendChild(percentageLabel);
                    radioContainer.appendChild(percentageRadioWrapper);

                    // Points radio button
                    const pointsRadioWrapper = createElement('div', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }
                    });

                    const pointsRadio = createElement('input', {
                        attrs: {
                            type: 'radio',
                            name: 'grade-by',
                            id: 'grade-by-points',
                            value: 'points',
                            checked: exampleScheme.points_based ? 'true' : null
                        },
                        style: {
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer'
                        }
                    });

                    const pointsLabel = createElement('label', {
                        text: 'Points',
                        attrs: {
                            for: 'grade-by-points'
                        },
                        style: {
                            fontSize: '14px',
                            color: '#333',
                            cursor: 'pointer'
                        }
                    });

                    pointsRadioWrapper.appendChild(pointsRadio);
                    pointsRadioWrapper.appendChild(pointsLabel);
                    radioContainer.appendChild(pointsRadioWrapper);

                    gradeByGroup.appendChild(radioContainer);
                    form.appendChild(gradeByGroup);

                    // Grading scale entries
                    const entriesGroup = createElement('div');
                    entriesGroup.appendChild(createElement('label', {
                        html: '<strong>Grading Scale Entries:</strong>',
                        style: {
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '14px',
                            color: '#333'
                        }
                    }));

                    // Create table for entries
                    const entriesTable = createElement('table', {
                        style: {
                            width: '100%',
                            borderCollapse: 'collapse',
                            border: '1px solid #d9d9d9',
                            marginBottom: '8px'
                        }
                    });

                    // Table header
                    const thead = createElement('thead');
                    const headerRow = createElement('tr', {
                        style: {
                            background: '#f0f0f0'
                        }
                    });
                    headerRow.appendChild(createElement('th', {
                        text: 'Letter Grade',
                        style: {
                            textAlign: 'left',
                            padding: '8px',
                            borderBottom: '2px solid #d9d9d9',
                            fontWeight: '600',
                            fontSize: '13px'
                        }
                    }));

                    // Range header - will be updated dynamically
                    const rangeHeader = createElement('th', {
                        text: exampleScheme.points_based ? 'Range' : 'Range',
                        style: {
                            textAlign: 'left',
                            padding: '8px',
                            borderBottom: '2px solid #d9d9d9',
                            fontWeight: '600',
                            fontSize: '13px',
                            width: '150px'
                        }
                    });
                    headerRow.appendChild(rangeHeader);

                    headerRow.appendChild(createElement('th', {
                        text: 'Actions',
                        style: {
                            textAlign: 'center',
                            padding: '8px',
                            borderBottom: '2px solid #d9d9d9',
                            fontWeight: '600',
                            fontSize: '13px',
                            width: '80px'
                        }
                    }));
                    thead.appendChild(headerRow);
                    entriesTable.appendChild(thead);

                    // Table body
                    const tbody = createElement('tbody');
                    entriesTable.appendChild(tbody);

                    // Function to calculate and update range displays for all rows
                    const updateRangeDisplays = () => {
                        const rows = Array.from(tbody.querySelectorAll('tr'));
                        const isPointsMode = pointsRadio.checked;

                        rows.forEach((row, index) => {
                            const rangeDisplay = row.querySelector('.range-display');
                            if (!rangeDisplay) return;

                            if (index === 0) {
                                // First row - no range display needed (has two inputs)
                                rangeDisplay.textContent = '';
                            } else {
                                // Other rows - show calculated range
                                const valueInput = row.querySelector('.threshold-input');
                                const currentValue = parseFloat(valueInput.value) || 0;

                                // Get upper bound from previous row's threshold
                                const prevRow = rows[index - 1];
                                const prevThresholdInput = prevRow.querySelector('.threshold-input');
                                const upperBound = parseFloat(prevThresholdInput.value) || 0;

                                let rangeText = '';
                                if (isPointsMode) {
                                    rangeText = \`< \${upperBound}\`;
                                } else {
                                    const upperPercentage = Math.round(upperBound * 100);
                                    rangeText = \`< \${upperPercentage}%\`;
                                }

                                rangeDisplay.textContent = rangeText;
                            }
                        });
                    };

                    // Function to add entry row
                    const addEntryRow = (name = '', value = 0, isPointsMode = false, maxPoints = null) => {
                        const row = createElement('tr');
                        const isFirstRow = tbody.children.length === 0;

                        // Letter Grade column
                        const nameCell = createElement('td', {
                            style: {
                                padding: '6px',
                                borderBottom: '1px solid #e8e8e8'
                            }
                        });
                        const nameInput = createElement('input', {
                            attrs: {
                                type: 'text',
                                value: name,
                                required: 'true'
                            },
                            style: {
                                width: '100%',
                                padding: '6px',
                                border: '1px solid #d9d9d9',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                            }
                        });
                        nameCell.appendChild(nameInput);
                        row.appendChild(nameCell);

                        // Range column - different structure for first row vs others
                        const rangeCell = createElement('td', {
                            style: {
                                padding: '6px',
                                borderBottom: '1px solid #e8e8e8'
                            }
                        });

                        const rangeContainer = createElement('div', {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }
                        });

                        if (isFirstRow) {
                            // First row: Two editable inputs (upper bound and lower bound)
                            // Upper bound input (maximum points)
                            const upperBoundInput = createElement('input', {
                                attrs: {
                                    type: 'number',
                                    value: maxPoints !== null ? maxPoints.toString() : value.toString(),
                                    min: '0',
                                    step: '0.01',
                                    required: 'true',
                                    class: 'max-points-input'
                                },
                                style: {
                                    width: '80px',
                                    padding: '6px',
                                    border: '1px solid #d9d9d9',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    boxSizing: 'border-box'
                                }
                            });

                            upperBoundInput.addEventListener('input', () => {
                                updateRangeDisplays();
                            });

                            const toLabel = createElement('span', {
                                text: 'to',
                                style: {
                                    fontSize: '13px',
                                    color: '#666',
                                    margin: '0 4px'
                                }
                            });

                            // Lower bound input (threshold)
                            const thresholdInput = createElement('input', {
                                attrs: {
                                    type: 'number',
                                    value: value.toString(),
                                    min: '0',
                                    step: '0.01',
                                    required: 'true',
                                    class: 'threshold-input'
                                },
                                style: {
                                    width: '80px',
                                    padding: '6px',
                                    border: '1px solid #d9d9d9',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    boxSizing: 'border-box'
                                }
                            });

                            thresholdInput.addEventListener('input', () => {
                                updateRangeDisplays();
                            });

                            // Hidden range display for consistency
                            const rangeDisplay = createElement('span', {
                                text: '',
                                attrs: {
                                    class: 'range-display'
                                },
                                style: {
                                    display: 'none'
                                }
                            });

                            rangeContainer.appendChild(upperBoundInput);
                            rangeContainer.appendChild(toLabel);
                            rangeContainer.appendChild(thresholdInput);
                            rangeContainer.appendChild(rangeDisplay);
                        } else {
                            // Other rows: Range display + threshold input
                            const rangeDisplay = createElement('span', {
                                text: '',
                                attrs: {
                                    class: 'range-display'
                                },
                                style: {
                                    fontSize: '13px',
                                    color: '#666',
                                    whiteSpace: 'nowrap',
                                    minWidth: '60px'
                                }
                            });

                            const toLabel = createElement('span', {
                                text: 'to',
                                style: {
                                    fontSize: '13px',
                                    color: '#666',
                                    margin: '0 4px'
                                }
                            });

                            const thresholdInput = createElement('input', {
                                attrs: {
                                    type: 'number',
                                    value: value.toString(),
                                    min: '0',
                                    step: '0.01',
                                    required: 'true',
                                    class: 'threshold-input'
                                },
                                style: {
                                    width: '80px',
                                    padding: '6px',
                                    border: '1px solid #d9d9d9',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    boxSizing: 'border-box'
                                }
                            });

                            thresholdInput.addEventListener('input', () => {
                                updateRangeDisplays();
                            });

                            rangeContainer.appendChild(rangeDisplay);
                            rangeContainer.appendChild(toLabel);
                            rangeContainer.appendChild(thresholdInput);
                        }

                        rangeCell.appendChild(rangeContainer);
                        row.appendChild(rangeCell);

                        // Actions column
                        const actionsCell = createElement('td', {
                            style: {
                                padding: '6px',
                                borderBottom: '1px solid #e8e8e8',
                                textAlign: 'center'
                            }
                        });
                        const deleteBtn = createElement('button', {
                            text: '🗑️',
                            attrs: {
                                type: 'button',
                                title: 'Delete entry'
                            },
                            style: {
                                padding: '4px 8px',
                                background: '#ff4d4f',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            },
                            on: {
                                click: () => {
                                    if (tbody.children.length > 1) {
                                        row.remove();
                                        updateRangeDisplays();
                                    } else {
                                        alert('At least one entry is required.');
                                    }
                                }
                            }
                        });
                        actionsCell.appendChild(deleteBtn);
                        row.appendChild(actionsCell);

                        tbody.appendChild(row);

                        // Update all range displays after adding new row
                        setTimeout(() => updateRangeDisplays(), 0);
                    };

                    // Add existing entries from example
                    // Convert values based on mode: if points-based, convert from 0-1 to actual points
                    // For percentage-based, convert from 0-1 to percentage (0-100)
                    const maxPoints = exampleScheme.points_based ? exampleScheme.scaling_factor : 1;

                    exampleScheme.data.forEach((entry, index) => {
                        const displayValue = exampleScheme.points_based
                            ? entry.value * exampleScheme.scaling_factor
                            : entry.value * 100;  // Convert 0-1 to percentage (0-100)

                        // Pass maxPoints only for the first row
                        if (index === 0) {
                            addEntryRow(entry.name, displayValue, exampleScheme.points_based, maxPoints);
                        } else {
                            addEntryRow(entry.name, displayValue, exampleScheme.points_based, null);
                        }
                    });

                    entriesGroup.appendChild(entriesTable);

                    // Add entry button
                    const addEntryBtn = createElement('button', {
                        text: '+ Add Entry',
                        attrs: {
                            type: 'button'
                        },
                        style: {
                            padding: '6px 12px',
                            background: '#52c41a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600'
                        },
                        on: {
                            click: () => {
                                const isPointsMode = pointsRadio.checked;
                                addEntryRow('', 0, isPointsMode, null);
                            }
                        }
                    });
                    entriesGroup.appendChild(addEntryBtn);

                    form.appendChild(entriesGroup);

                    // Function to convert all existing row values when switching modes
                    const convertRowValues = (toPointsMode) => {
                        const rows = Array.from(tbody.querySelectorAll('tr'));

                        if (toPointsMode) {
                            // Converting from 0-1 decimal to points
                            const scalingFactor = exampleScheme.scaling_factor || 4;

                            rows.forEach((row, index) => {
                                const thresholdInput = row.querySelector('.threshold-input');
                                const currentValue = parseFloat(thresholdInput.value) || 0;
                                const pointValue = currentValue * scalingFactor;
                                thresholdInput.value = pointValue;

                                // For first row, also update max points input
                                if (index === 0) {
                                    const maxPointsInput = row.querySelector('.max-points-input');
                                    if (maxPointsInput) {
                                        maxPointsInput.value = scalingFactor;
                                    }
                                }
                            });
                        } else {
                            // Converting from points to 0-1 decimal
                            // Get max points from first row
                            const firstRow = rows[0];
                            const maxPointsInput = firstRow ? firstRow.querySelector('.max-points-input') : null;
                            const maxValue = maxPointsInput ? parseFloat(maxPointsInput.value) : 1;

                            rows.forEach((row, index) => {
                                const thresholdInput = row.querySelector('.threshold-input');
                                const currentValue = parseFloat(thresholdInput.value) || 0;
                                const decimalValue = (currentValue / maxValue).toFixed(3);
                                thresholdInput.value = decimalValue;
                            });
                        }

                        // Update range displays after conversion
                        updateRangeDisplays();
                    };

                    // Add radio button change handlers
                    percentageRadio.addEventListener('change', () => {
                        if (percentageRadio.checked) {
                            convertRowValues(false);
                        }
                    });

                    pointsRadio.addEventListener('change', () => {
                        if (pointsRadio.checked) {
                            convertRowValues(true);
                        }
                    });

                    // Status message area
                    const statusArea = createElement('div', {
                        style: {
                            minHeight: '40px',
                            padding: '12px',
                            borderRadius: '6px',
                            display: 'none'
                        }
                    });
                    form.appendChild(statusArea);

                    // Action buttons
                    const buttonGroup = createElement('div', {
                        style: {
                            display: 'flex',
                            gap: '12px',
                            justifyContent: 'flex-end',
                            paddingTop: '16px',
                            borderTop: '1px solid #e8e8e8'
                        }
                    });

                    const cancelBtn = createElement('button', {
                        text: 'Cancel',
                        attrs: {
                            type: 'button'
                        },
                        style: {
                            padding: '10px 20px',
                            background: '#fff',
                            color: '#333',
                            border: '1px solid #d9d9d9',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                        },
                        on: {
                            click: () => overlay.remove()
                        }
                    });

                    const createBtn = createElement('button', {
                        text: 'Create Grading Standard',
                        attrs: {
                            type: 'submit'
                        },
                        style: {
                            padding: '10px 20px',
                            background: '#0374B5',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                        }
                    });

                    buttonGroup.appendChild(cancelBtn);
                    buttonGroup.appendChild(createBtn);
                    form.appendChild(buttonGroup);

                    // Form submit handler
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();

                        // Disable buttons during submission
                        createBtn.disabled = true;
                        cancelBtn.disabled = true;
                        createBtn.style.opacity = '0.6';
                        createBtn.style.cursor = 'not-allowed';
                        createBtn.textContent = 'Creating...';

                        // Show loading status
                        statusArea.style.display = 'block';
                        statusArea.style.background = '#e6f7ff';
                        statusArea.style.border = '1px solid #91d5ff';
                        statusArea.style.color = '#0050b3';
                        statusArea.textContent = '⏳ Creating grading standard...';

                        try {
                            // Collect form data
                            const title = titleInput.value.trim();

                            // Determine points_based from radio selection
                            const points_based = pointsRadio.checked;

                            // Collect entries from table
                            const rows = tbody.querySelectorAll('tr');
                            const rawEntries = [];
                            let maxPointsValue = null;

                            rows.forEach((row, index) => {
                                const nameInput = row.querySelector('input[type="text"]');
                                const thresholdInput = row.querySelector('.threshold-input');

                                // For first row, also get the max points input
                                if (index === 0) {
                                    const maxPointsInput = row.querySelector('.max-points-input');
                                    if (maxPointsInput) {
                                        maxPointsValue = parseFloat(maxPointsInput.value);
                                    }
                                }

                                rawEntries.push({
                                    name: nameInput.value.trim(),
                                    rawValue: parseFloat(thresholdInput.value)
                                });
                            });

                            // Validate
                            if (!title) {
                                throw new Error('Title is required');
                            }
                            if (rawEntries.length === 0) {
                                throw new Error('At least one entry is required');
                            }

                            // Determine scaling_factor and validate values
                            let scaling_factor;

                            if (points_based) {
                                // Use the max points from the first row's upper bound input
                                if (maxPointsValue === null || maxPointsValue <= 0) {
                                    throw new Error('Maximum points must be greater than 0');
                                }

                                scaling_factor = maxPointsValue;

                                // Validate that all thresholds are between 0 and max points
                                rawEntries.forEach(entry => {
                                    if (entry.rawValue < 0 || entry.rawValue > maxPointsValue) {
                                        throw new Error(\`Threshold value \${entry.rawValue} must be between 0 and \${maxPointsValue}\`);
                                    }
                                });
                            } else {
                                // Percentage mode
                                scaling_factor = 1;

                                // Validate that all values are between 0 and 100
                                rawEntries.forEach(entry => {
                                    if (entry.rawValue < 0 || entry.rawValue > 100) {
                                        throw new Error(\`Percentage value \${entry.rawValue} must be between 0 and 100\`);
                                    }
                                });
                            }

                            // Prepare data array with raw values (no normalization)
                            const data = rawEntries.map(entry => ({
                                name: entry.name,
                                value: entry.rawValue
                            }));

                            // Sort entries by value (descending) - Canvas requirement
                            data.sort((a, b) => b.value - a.value);

                            // Validate for duplicate values
                            const values = data.map(entry => entry.value);
                            const uniqueValues = new Set(values);
                            if (values.length !== uniqueValues.size) {
                                // Find duplicates for error message
                                const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
                                const duplicateDisplay = points_based
                                    ? duplicates.map(v => v.toFixed(2)).join(', ')
                                    : duplicates.map(v => v.toFixed(0)).join(', ');
                                throw new Error(\`Grading scheme cannot contain duplicate values. Duplicates found: \${duplicateDisplay}\`);
                            }

                            // Create grading standard
                            const gradingSchemeData = {
                                title,
                                scaling_factor,
                                points_based,
                                data
                            };

                            console.log('[DEBUG] Form submission - Raw entries:', rawEntries);
                            console.log('[DEBUG] Form submission - Max points value:', maxPointsValue);
                            console.log('[DEBUG] Form submission - Points based:', points_based);
                            console.log('[DEBUG] Form submission - Scaling factor:', scaling_factor);
                            console.log('[DEBUG] Form submission - Final data array:', data);
                            console.log('[DEBUG] Form submission - Complete grading scheme data:', gradingSchemeData);

                            const result = await createGradingStandard(accountId, gradingSchemeData);

                            // Show success
                            statusArea.style.background = '#f6ffed';
                            statusArea.style.border = '1px solid #b7eb8f';
                            statusArea.style.color = '#389e0d';
                            statusArea.innerHTML = \`✅ Grading standard created successfully! <a href="/accounts/\${accountId}/grading_standards" target="_blank" style="color: #0374B5; text-decoration: underline;">View in Canvas</a>\`;

                            // Call success callback
                            if (onSuccess) {
                                onSuccess(result);
                            }

                            // Close modal after 2 seconds
                            setTimeout(() => {
                                overlay.remove();
                            }, 2000);

                        } catch (error) {
                            console.error('[GradingSchemeEditor] Error creating grading standard:', error);

                            // Show error
                            statusArea.style.background = '#fff1f0';
                            statusArea.style.border = '1px solid #ffa39e';
                            statusArea.style.color = '#cf1322';
                            statusArea.textContent = \`❌ Error: \${error.message || 'Failed to create grading standard'}\`;

                            // Re-enable buttons
                            createBtn.disabled = false;
                            cancelBtn.disabled = false;
                            createBtn.style.opacity = '1';
                            createBtn.style.cursor = 'pointer';
                            createBtn.textContent = 'Create Grading Standard';
                        }
                    });

                    modal.appendChild(form);
                    overlay.appendChild(modal);

                    // Close on overlay click
                    overlay.addEventListener('click', (e) => {
                        if (e.target === overlay) {
                            overlay.remove();
                        }
                    });

                    document.body.appendChild(overlay);
                }

                // Add click handlers to all "Create in Canvas" buttons
                document.addEventListener('DOMContentLoaded', () => {
                    const buttons = document.querySelectorAll('.create-in-canvas-btn');
                    buttons.forEach(btn => {
                        btn.addEventListener('click', () => {
                            const exampleId = btn.getAttribute('data-example-id');
                            const example = GRADING_SCHEME_EXAMPLES.find(ex => ex.id === exampleId);

                            if (example) {
                                openGradingSchemeEditor(example, (result) => {
                                    console.log('Grading standard created:', result);
                                    // Optionally refresh the parent window's grading schemes panel
                                    if (window.opener && !window.opener.closed) {
                                        window.opener.postMessage({ type: 'grading-standard-created', data: result }, '*');
                                    }
                                });
                            }
                        });
                    });
                });
            </script>
        </body>
        </html>
    `;
}


/**
 * Render grading schemes panel
 *
 * @param {HTMLElement} root - Root container
 * @param {Array} schemes - Array of grading schemes
 */
function renderGradingSchemesPanel(root, schemes) {
    const panel = createPanel(root, `Grading Schemes (${schemes.length} found)`);

    if (schemes.length === 0) {
        panel.appendChild(createElement('div', {
            text: 'No grading schemes configured at account level.',
            style: {
                padding: '10px',
                color: '#666',
                fontStyle: 'italic'
            }
        }));
        return;
    }

    // Get currently selected scheme ID
    const currentSchemeId = window.CG_MANAGED?.config?.DEFAULT_GRADING_SCHEME_ID || null;

    // Display currently selected scheme
    const selectedScheme = currentSchemeId ? schemes.find(s => s.id === currentSchemeId) : null;
    const selectedDisplay = createElement('div', {
        attrs: { id: 'cg-selected-scheme-display' },
        style: {
            padding: '10px',
            marginBottom: '12px',
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: '6px',
            fontSize: '13px',
            display: currentSchemeId ? 'block' : 'none'
        }
    });

    if (selectedScheme) {
        selectedDisplay.innerHTML = `<strong>Currently Selected:</strong> ${escapeHtml(selectedScheme.title)} (ID: ${currentSchemeId})`;
    } else if (currentSchemeId) {
        selectedDisplay.innerHTML = `<strong>Currently Selected:</strong> ID ${currentSchemeId} <em>(not found in current schemes)</em>`;
    }

    panel.appendChild(selectedDisplay);

    // Add "View Full Details" button
    const viewDetailsBtn = createElement('button', {
        text: '📋 View Full Details',
        style: {
            padding: '8px 16px',
            marginBottom: '12px',
            background: '#0374B5',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
        },
        on: {
            click: () => openGradingSchemesInNewTab(schemes),
            mouseenter: (e) => { e.target.style.background = '#025a8c'; },
            mouseleave: (e) => { e.target.style.background = '#0374B5'; }
        }
    });

    // Add "View Examples" button
    const viewExamplesBtn = createElement('button', {
        text: '📚 View Examples',
        style: {
            padding: '8px 16px',
            marginBottom: '12px',
            marginLeft: '8px',
            background: '#0374B5',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
        },
        on: {
            click: () => openGradingSchemeExamplesInNewTab(),
            mouseenter: (e) => { e.target.style.background = '#025a8c'; },
            mouseleave: (e) => { e.target.style.background = '#0374B5'; }
        }
    });

    panel.appendChild(viewDetailsBtn);
    panel.appendChild(viewExamplesBtn);

    // Create grid container for scheme cards
    const gridContainer = createElement('div', {
        style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '12px'
        }
    });

    // Store references globally for refresh capability
    globalGradingSchemesGridContainer = gridContainer;
    globalGradingSchemes = schemes;

    // Render each scheme as a compact card
    schemes.forEach((scheme) => {
        renderGradingSchemeCard(gridContainer, scheme, currentSchemeId, schemes);
    });

    panel.appendChild(gridContainer);
}

/**
 * Render a compact grading scheme card (summary only, no table)
 *
 * @param {HTMLElement} parent - Parent container
 * @param {Object} scheme - Grading scheme data
 * @param {number|null} currentSchemeId - Currently selected scheme ID
 * @param {Array} allSchemes - All available schemes (for refresh)
 */
function renderGradingSchemeCard(parent, scheme, currentSchemeId = null, allSchemes = []) {
    const gradeBy = scheme.points_based ? 'Points' : 'Percentage';
    const scaleCount = scheme.grading_scheme ? scheme.grading_scheme.length : 0;
    const isSelected = currentSchemeId === scheme.id;

    const card = createElement('div', {
        style: {
            padding: '14px',
            border: isSelected ? '2px solid #52c41a' : '1px solid #d9d9d9',
            borderRadius: '8px',
            background: isSelected ? '#f6ffed' : '#fafafa',
            transition: 'all 0.2s ease',
            cursor: 'default',
            position: 'relative'
        }
    });

    // Selected badge
    if (isSelected) {
        const selectedBadge = createElement('div', {
            text: '✓ Selected',
            style: {
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '2px 8px',
                background: '#52c41a',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600'
            }
        });
        card.appendChild(selectedBadge);
    }

    // Title
    const title = createElement('div', {
        html: `<strong>${escapeHtml(scheme.title || 'Untitled')}</strong>`,
        style: {
            fontSize: '14px',
            marginBottom: '6px',
            color: '#333',
            fontWeight: '600',
            paddingRight: isSelected ? '70px' : '0'
        }
    });

    // ID badge
    const idBadge = createElement('div', {
        text: `ID: ${scheme.id}`,
        style: {
            display: 'inline-block',
            padding: '2px 8px',
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#0050b3',
            fontWeight: '600',
            marginBottom: '8px'
        }
    });

    // Metadata
    const metadata = createElement('div', {
        style: {
            fontSize: '12px',
            color: '#666',
            lineHeight: '1.6',
            marginBottom: '10px'
        }
    });

    metadata.appendChild(createElement('div', {
        html: `<strong>Grade By:</strong> ${gradeBy}`
    }));

    metadata.appendChild(createElement('div', {
        html: `<strong>Context:</strong> ${escapeHtml(scheme.context_type || 'Unknown')}`
    }));

    metadata.appendChild(createElement('div', {
        html: `<strong>Scale Items:</strong> ${scaleCount}`
    }));

    if (scheme.scaling_factor) {
        metadata.appendChild(createElement('div', {
            html: `<strong>Scaling:</strong> ${scheme.scaling_factor}`
        }));
    }

    // Select button
    const selectBtn = createElement('button', {
        text: isSelected ? 'Current Default' : 'Select as Default',
        style: {
            width: '100%',
            padding: '6px 12px',
            background: isSelected ? '#52c41a' : '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'background 0.2s ease'
        },
        on: {
            click: () => {
                if (isSelected) {
                    deselectGradingScheme(parent, allSchemes);
                } else {
                    selectGradingScheme(scheme, parent, allSchemes);
                }
            },
            mouseenter: (e) => {
                e.target.style.background = isSelected ? '#389e0d' : '#5a6268';
            },
            mouseleave: (e) => {
                e.target.style.background = isSelected ? '#52c41a' : '#6c757d';
            }
        }
    });

    card.appendChild(title);
    card.appendChild(idBadge);
    card.appendChild(metadata);
    card.appendChild(selectBtn);

    parent.appendChild(card);
}

/**
 * Refresh grading schemes grid from external trigger (e.g., after loader parse)
 * This function can be called from other panels to update the visual state
 */
export function refreshGradingSchemesGridExternal() {
    if (globalGradingSchemesGridContainer && globalGradingSchemes.length > 0) {
        refreshGradingSchemesGrid(globalGradingSchemesGridContainer, globalGradingSchemes);
        logger.debug('[AccountSettingsPanel] Grading schemes grid refreshed from external trigger');
    } else {
        logger.warn('[AccountSettingsPanel] Cannot refresh grading schemes grid - not yet initialized');
    }
}