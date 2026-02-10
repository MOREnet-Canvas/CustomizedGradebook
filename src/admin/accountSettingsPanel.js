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

    // Map from example format (data) to Canvas API format (grading_scheme_entry)
    const payload = {
        title: gradingSchemeData.title,
        scaling_factor: gradingSchemeData.scaling_factor,
        points_based: gradingSchemeData.points_based,
        grading_scheme_entry: gradingSchemeData.data.map(entry => ({
            name: entry.name,
            value: entry.value
        }))
    };

    logger.debug('[AccountSettingsPanel] API payload:', payload);

    try {
        const result = await apiClient.post(url, payload, {}, 'createGradingStandard');
        logger.info('[AccountSettingsPanel] Grading standard created successfully:', result);
        return result;
    } catch (error) {
        logger.error('[AccountSettingsPanel] Failed to create grading standard:', error);
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

    let schemesHTML = '';

    schemes.forEach((scheme, index) => {
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
                    rangeText = `${value} to ${value}`;
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
            <div class="scheme-card">
                <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">
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
                <div class="schemes-grid">
                    ${schemesHTML}
                </div>
            </div>
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
                    rangeText = `${value} to ${value}`;
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

                    const payload = {
                        title: gradingSchemeData.title,
                        scaling_factor: gradingSchemeData.scaling_factor,
                        points_based: gradingSchemeData.points_based,
                        grading_scheme_entry: gradingSchemeData.data.map(entry => ({
                            name: entry.name,
                            value: entry.value
                        }))
                    };

                    const response = await fetch(url, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
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
                            const valueInput = row.querySelector('input[type="number"]');
                            const rangeDisplay = row.querySelector('.range-display');

                            if (!rangeDisplay) return;

                            const currentValue = parseFloat(valueInput.value) || 0;
                            let rangeText = '';

                            if (isPointsMode) {
                                // Points mode
                                if (index === 0) {
                                    // First row - highest grade
                                    const maxPoints = currentValue;
                                    rangeText = \`\${currentValue} to \${maxPoints} pts\`;
                                } else {
                                    // Other rows
                                    const prevValueInput = rows[index - 1].querySelector('input[type="number"]');
                                    const upperBound = parseFloat(prevValueInput.value) || 0;
                                    rangeText = \`< \${upperBound} to \${currentValue} pts\`;
                                }
                            } else {
                                // Percentage mode (0-1 decimal, display as percentage)
                                if (index === 0) {
                                    // First row - highest grade
                                    const percentage = Math.round(currentValue * 100);
                                    rangeText = \`\${percentage}% to 100%\`;
                                } else {
                                    // Other rows
                                    const prevValueInput = rows[index - 1].querySelector('input[type="number"]');
                                    const upperBound = parseFloat(prevValueInput.value) || 0;
                                    const upperPercentage = Math.round(upperBound * 100);
                                    const currentPercentage = Math.round(currentValue * 100);
                                    rangeText = \`\${currentPercentage}% to < \${upperPercentage}%\`;
                                }
                            }

                            rangeDisplay.textContent = rangeText;
                        });
                    };

                    // Function to add entry row
                    const addEntryRow = (name = '', value = 0, isPointsMode = false) => {
                        const row = createElement('tr');

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

                        // Range column - contains both display and input
                        const rangeCell = createElement('td', {
                            style: {
                                padding: '6px',
                                borderBottom: '1px solid #e8e8e8'
                            }
                        });

                        // Container for range display and input
                        const rangeContainer = createElement('div', {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }
                        });

                        // Range display (read-only text)
                        const rangeDisplay = createElement('span', {
                            text: '',
                            attrs: {
                                class: 'range-display'
                            },
                            style: {
                                fontSize: '13px',
                                color: '#666',
                                whiteSpace: 'nowrap',
                                minWidth: '120px'
                            }
                        });

                        // "to" label
                        const toLabel = createElement('span', {
                            text: 'to',
                            style: {
                                fontSize: '13px',
                                color: '#666',
                                margin: '0 4px'
                            }
                        });

                        // Value input - editable threshold
                        const valueInput = createElement('input', {
                            attrs: {
                                type: 'number',
                                value: value.toString(),
                                min: '0',
                                step: isPointsMode ? '1' : '0.01',
                                required: 'true'
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

                        // Store the mode on the input for later reference
                        valueInput.dataset.isPointsMode = isPointsMode ? 'true' : 'false';

                        // Update range displays when value changes
                        valueInput.addEventListener('input', () => {
                            updateRangeDisplays();
                        });

                        rangeContainer.appendChild(rangeDisplay);
                        rangeContainer.appendChild(toLabel);
                        rangeContainer.appendChild(valueInput);
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
                    exampleScheme.data.forEach(entry => {
                        const displayValue = exampleScheme.points_based
                            ? Math.round(entry.value * exampleScheme.scaling_factor)
                            : entry.value;
                        addEntryRow(entry.name, displayValue, exampleScheme.points_based);
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
                                addEntryRow('', 0, isPointsMode);
                            }
                        }
                    });
                    entriesGroup.appendChild(addEntryBtn);

                    form.appendChild(entriesGroup);

                    // Function to convert all existing row values when switching modes
                    const convertRowValues = (toPointsMode) => {
                        const rows = tbody.querySelectorAll('tr');
                        rows.forEach(row => {
                            const valueInput = row.querySelector('input[type="number"]');
                            const currentValue = parseFloat(valueInput.value) || 0;

                            if (toPointsMode) {
                                // Converting from 0-1 decimal to points
                                // Use scaling factor from example or default to 4
                                const scalingFactor = exampleScheme.scaling_factor || 4;
                                const pointValue = Math.round(currentValue * scalingFactor);
                                valueInput.value = pointValue;
                                valueInput.step = '1';
                                valueInput.removeAttribute('max');
                                valueInput.dataset.isPointsMode = 'true';
                            } else {
                                // Converting from points to 0-1 decimal
                                // Find max value from all rows to calculate scaling
                                const allValues = Array.from(tbody.querySelectorAll('input[type="number"]'))
                                    .map(input => parseFloat(input.value) || 0);
                                const maxValue = Math.max(...allValues, 1);
                                const decimalValue = (currentValue / maxValue).toFixed(3);
                                valueInput.value = decimalValue;
                                valueInput.step = '0.01';
                                valueInput.dataset.isPointsMode = 'false';
                            }
                        });

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

                            rows.forEach(row => {
                                const nameInput = row.querySelector('input[type="text"]');
                                const valueInput = row.querySelector('input[type="number"]');
                                rawEntries.push({
                                    name: nameInput.value.trim(),
                                    rawValue: parseFloat(valueInput.value)
                                });
                            });

                            // Validate
                            if (!title) {
                                throw new Error('Title is required');
                            }
                            if (rawEntries.length === 0) {
                                throw new Error('At least one entry is required');
                            }

                            // Calculate scaling_factor and convert values to 0-1 range
                            let scaling_factor;
                            const data = [];

                            if (points_based) {
                                // Find maximum point value from entries
                                const maxPoints = Math.max(...rawEntries.map(e => e.rawValue));

                                if (maxPoints <= 0) {
                                    throw new Error('Point values must be greater than 0');
                                }

                                scaling_factor = maxPoints;

                                // Convert point values to 0-1 decimal range
                                rawEntries.forEach(entry => {
                                    data.push({
                                        name: entry.name,
                                        value: entry.rawValue / scaling_factor
                                    });
                                });
                            } else {
                                // Percentage mode - values are already in 0-1 range
                                scaling_factor = 1;

                                rawEntries.forEach(entry => {
                                    if (entry.rawValue < 0 || entry.rawValue > 1) {
                                        throw new Error('Percentage values must be between 0 and 1');
                                    }
                                    data.push({
                                        name: entry.name,
                                        value: entry.rawValue
                                    });
                                });
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

    // Render each scheme as a compact card
    schemes.forEach((scheme) => {
        renderGradingSchemeCard(gridContainer, scheme);
    });

    panel.appendChild(gridContainer);
}

/**
 * Render a compact grading scheme card (summary only, no table)
 *
 * @param {HTMLElement} parent - Parent container
 * @param {Object} scheme - Grading scheme data
 */
function renderGradingSchemeCard(parent, scheme) {
    const gradeBy = scheme.points_based ? 'Points' : 'Percentage';
    const scaleCount = scheme.grading_scheme ? scheme.grading_scheme.length : 0;

    const card = createElement('div', {
        style: {
            padding: '14px',
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            background: '#fafafa',
            transition: 'box-shadow 0.2s ease',
            cursor: 'default'
        }
    });

    // Title
    const title = createElement('div', {
        html: `<strong>${escapeHtml(scheme.title || 'Untitled')}</strong>`,
        style: {
            fontSize: '14px',
            marginBottom: '6px',
            color: '#333',
            fontWeight: '600'
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
            lineHeight: '1.6'
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

    card.appendChild(title);
    card.appendChild(idBadge);
    card.appendChild(metadata);

    parent.appendChild(card);
}