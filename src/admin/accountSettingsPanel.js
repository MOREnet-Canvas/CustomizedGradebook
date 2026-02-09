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

        // Build grading scale table
        let tableRows = '';
        if (scheme.grading_scheme && scheme.grading_scheme.length > 0) {
            scheme.grading_scheme.forEach((entry, idx) => {
                // Handle both array format [name, value] and object format {name, value}
                const name = Array.isArray(entry) ? entry[0] : entry.name;
                const value = Array.isArray(entry) ? entry[1] : entry.value;

                let rangeText = '';
                if (idx === 0) {
                    rangeText = `${value} to ${value}`;
                } else {
                    const prevEntry = scheme.grading_scheme[idx - 1];
                    const upperValue = Array.isArray(prevEntry) ? prevEntry[1] : prevEntry.value;
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
            <div style="margin-bottom: 32px; padding: 20px; border: 1px solid #d9d9d9; border-radius: 8px; background: #fafafa;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #333;">
                    ${escapeHtml(scheme.title || 'Untitled')} <span style="color: #666; font-weight: normal;">(ID: ${scheme.id})</span>
                </h2>

                <div style="margin-bottom: 16px; font-size: 14px; color: #666;">
                    <div><strong>Grade By:</strong> ${gradeBy}</div>
                    <div style="margin-top: 4px;"><strong>Context:</strong> ${escapeHtml(scheme.context_type || 'Unknown')}</div>
                    <div style="margin-top: 4px;"><strong>Context ID:</strong> ${scheme.context_id || 'N/A'}</div>
                    ${scheme.scaling_factor ? `<div style="margin-top: 4px;"><strong>Scaling Factor:</strong> ${scheme.scaling_factor}</div>` : ''}
                </div>

                ${tableRows ? `
                    <h3 style="margin: 16px 0 8px 0; font-size: 16px; color: #333;">Grading Scale</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: #fff;">
                        <thead>
                            <tr style="background: #f0f0f0;">
                                <th style="text-align: left; padding: 10px; border-bottom: 2px solid #d9d9d9; font-weight: 600;">Letter Grade</th>
                                <th style="text-align: left; padding: 10px; border-bottom: 2px solid #d9d9d9; font-weight: 600;">Range</th>
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
                    max-width: 1000px;
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
                @media print {
                    body { background: #fff; padding: 0; }
                    .container { box-shadow: none; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Grading Schemes</h1>
                <div class="subtitle">Account ID: ${escapeHtml(accountId)} | Total Schemes: ${schemes.length}</div>
                ${schemesHTML}
            </div>
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

    panel.appendChild(viewDetailsBtn);

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