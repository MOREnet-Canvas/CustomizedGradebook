// src/admin/customGradeStatusPanel.js
/**
 * Custom Grade Status Panel Module
 *
 * Renders a panel for viewing and selecting custom grade statuses.
 * Features:
 * - Fetches custom grade statuses from root account
 * - Dropdown selector for choosing default custom status
 * - Saves selected status ID to loader configuration
 * - Warning when dashboard is not on root account
 * - Link to manage custom statuses (always points to root account)
 *
 * Refactored to use:
 * - Canvas ic-* UI classes
 * - Collapsible panel helper from canvasFormHelpers.js
 * - Status message classes from dashboardStyles.css
 */

import { logger } from '../utils/logger.js';
import { createElement, escapeHtml } from './domHelpers.js';
import { createCollapsiblePanel, createSelectGroup, createButton, createCheckbox } from './canvasFormHelpers.js';
import { getAccountId } from './pageDetection.js';
import { getRootCustomGradeStatuses } from '../services/gradeStatusService.js';
import { triggerConfigChangeNotification } from './loaderGeneratorPanel.js';

/**
 * Render Custom Grade Status Panel
 *
 * @param {HTMLElement} container - Container element
 * @param {Object} ctx - Dashboard context with getConfig(), updateConfig(), api, and logger
 */
export async function renderCustomGradeStatusPanel(container, ctx) {
    logger.debug('[CustomGradeStatusPanel] Rendering custom grade status panel');

    // Create collapsible panel (collapsed by default)
    const { panel, body } = createCollapsiblePanel('📊 Custom Grade Statuses', true, 'cg-section-custom-status');

    // Show loading state
    const loadingEl = createElement('div', {
        attrs: { class: 'cg-status cg-status--info' },
        text: '⏳ Loading custom grade statuses...'
    });
    body.appendChild(loadingEl);
    container.appendChild(panel);

    // Check if on root account
    const currentAccountId = getAccountId();
    const isOnRootAccount = currentAccountId === '1';
    const rootAccountId = '1';

    // Fetch custom grade statuses from root account
    const statuses = await getRootCustomGradeStatuses({ ctx });

    // Store statuses globally for Summary Panel hydration
    window.cgCustomStatuses = statuses;

    // Clear loading state
    body.innerHTML = '';

    // Add helper text
    const helperText = createElement('div', {
        style: {
            fontSize: '13px',
            color: '#666',
            marginBottom: '12px',
            padding: '8px',
            background: '#f5f5f5',
            borderRadius: '4px'
        },
        text: 'Custom grade statuses are applied to individual student grades when there is no evidence of mastery for an outcome.'
    });
    body.appendChild(helperText);

    // Read config for checkboxes
    const config = ctx.getConfig();
    const enableCustomStatus = config.ENABLE_GRADE_CUSTOM_STATUS || false;
    const enableNegativeZeroCount = config.ENABLE_NEGATIVE_ZERO_COUNT || false;

    // Create enable custom status checkbox
    const { container: enableContainer, checkbox: enableCheckbox } = createCheckbox({
        label: 'Enable Custom Grade Statuses',
        id: 'enable-custom-status-gate',
        checked: enableCustomStatus
    });
    body.appendChild(enableContainer);

    // Create grouped section for dependent settings (shown only when enabled)
    const dependentSettings = createElement('div', {
        style: {
            marginLeft: '24px',
            marginTop: '12px',
            padding: '16px',
            background: '#f9f9f9',
            borderLeft: '3px solid #0374B5',
            borderRadius: '4px',
            display: enableCustomStatus ? 'block' : 'none'
        }
    });

    // Add helper text explaining the section
    const sectionHelper = createElement('div', {
        style: {
            fontSize: '12px',
            color: '#666',
            marginBottom: '16px',
            fontStyle: 'italic'
        },
        text: 'Configure custom status labels for avg_assignment, avg_outcome, and course_override scores:'
    });
    dependentSettings.appendChild(sectionHelper);

    // Show warning if not on root account
    if (!isOnRootAccount) {
        const warningBox = createElement('div', {
            attrs: { class: 'cg-status cg-status--warning' },
            html: `<strong>⚠️ Not on Root Account</strong><br>You are currently on account ${escapeHtml(currentAccountId)}. Custom statuses are managed at the root account (ID 1).`
        });
        dependentSettings.appendChild(warningBox);
    }

    // Handle empty statuses
    if (statuses.length === 0) {
        const emptyBox = createElement('div', {
            attrs: { class: 'cg-status cg-status--info' },
            text: 'ℹ️ No custom grade statuses found. Create custom statuses in the root account grading settings.'
        });
        dependentSettings.appendChild(emptyBox);
    } else {
        // Create dropdown for status selection
        const selectedStatusId = config.DEFAULT_CUSTOM_STATUS_ID || '';

        // Build options array
        const options = [
            { value: '', text: '-- None selected --' },
            ...statuses.map(status => ({
                value: status._id,
                text: `${status.name} (ID: ${status._id})`
            }))
        ];

        const statusSelect = createSelectGroup({
            label: 'Default Custom Status',
            id: 'cfg_defaultCustomStatus',
            options: options,
            value: selectedStatusId
        });

        // Add change handler
        statusSelect.select.addEventListener('change', () => {
            const newStatusId = statusSelect.select.value || null;
            logger.debug(`[CustomGradeStatusPanel] Status changed to: ${newStatusId}`);

            // Find the status name
            const selectedStatus = statuses.find(s => s._id === newStatusId);
            const statusName = selectedStatus?.name || null;

            // Update config with both ID and name
            ctx.updateConfig({
                DEFAULT_CUSTOM_STATUS_ID: newStatusId,
                DEFAULT_CUSTOM_STATUS_NAME: statusName
            });

            // Trigger change notification
            triggerConfigChangeNotification();
        });

        dependentSettings.appendChild(statusSelect.container);
    }

    // Create negative zero count checkbox
    const { container: negativeZeroContainer, checkbox: negativeZeroCheckbox } = createCheckbox({
        label: 'Enable Zero Grade Penalty',
        id: 'enable-negative-zero-count',
        checked: enableNegativeZeroCount
    });

    // Add help text for negative zero count
    const negativeZeroHelp = createElement('div', {
        style: {
            fontSize: '11px',
            color: '#999',
            marginTop: '4px',
            marginLeft: '24px',
            lineHeight: '1.4'
        },
        text: 'When enabled, each zero grade subtracts 1 point from zero (1 zero = -1, 2 zeros = -2, etc.). The custom status label remains applied.'
    });
    negativeZeroContainer.appendChild(negativeZeroHelp);

    dependentSettings.appendChild(negativeZeroContainer);

    // Append dependent settings section to body
    body.appendChild(dependentSettings);

    // Add change handlers
    enableCheckbox.addEventListener('change', () => {
        ctx.updateConfig({ ENABLE_GRADE_CUSTOM_STATUS: enableCheckbox.checked });
        triggerConfigChangeNotification();

        // Show/hide entire dependent settings section
        dependentSettings.style.display = enableCheckbox.checked ? 'block' : 'none';
    });

    negativeZeroCheckbox.addEventListener('change', () => {
        ctx.updateConfig({ ENABLE_NEGATIVE_ZERO_COUNT: negativeZeroCheckbox.checked });
        triggerConfigChangeNotification();
    });

    // Add "Manage Custom Statuses" button/link
    const manageUrl = `/accounts/${rootAccountId}/grading_settings/statuses`;
    const manageButton = createButton({
        text: '⚙️ Manage Custom Statuses (Root Account)',
        type: 'secondary',
        onClick: () => {
            window.open(manageUrl, '_blank');
        }
    });

    const buttonContainer = createElement('div', {
        style: { marginTop: '12px' }
    });
    buttonContainer.appendChild(manageButton);
    body.appendChild(buttonContainer);

    logger.debug('[CustomGradeStatusPanel] Panel rendered successfully');
}