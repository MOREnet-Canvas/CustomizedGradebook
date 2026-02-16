// src/admin/dashboardRenderer.js
/**
 * Admin Dashboard Page Renderer
 * 
 * Renders the virtual admin dashboard page that displays:
 * - Installed theme overrides
 * - Script change detection
 * - Loader generator with auto-load
 */

import { logger } from '../utils/logger.js';
import { getAccountId } from './pageDetection.js';
import { createElement } from './domHelpers.js';
import { renderThemeStatusPanels } from './themeStatusPanel.js';
import { renderAccountSettingsPanel } from './accountSettingsPanel.js';
import { renderAccountFilterPanel } from './accountFilterPanel.js';
import { renderLoaderGeneratorPanel } from './loaderGeneratorPanel.js';

/**
 * Render the Admin Dashboard virtual page
 *
 * Clears the page and renders a full-page admin dashboard UI.
 */
export function renderAdminDashboardPage() {
    logger.debug('[DashboardRenderer] ========================================');
    logger.debug('[DashboardRenderer] renderAdminDashboardPage() CALLED');
    logger.debug('[DashboardRenderer] ========================================');
    logger.info('[DashboardRenderer] Rendering admin dashboard page');

    // Clear body content
    document.body.innerHTML = '';

    // Add styles to hide Canvas elements and reset page
    const style = document.createElement('style');
    style.textContent = `
        /* Hide all Canvas content */
        #content, #application, .ic-app-main-content,
        #header, #main, .ic-app-header, .ic-app-nav-toggle-and-crumbs,
        .ic-app-course-menu, .ic-app-footer {
            display: none !important;
        }

        /* Reset body styles */
        body {
            margin: 0 !important;
            padding: 0 !important;
            background: #f5f5f5 !important;
            overflow-x: hidden !important;
        }

        /* Ensure admin dashboard is visible */
        #cg-admin-root {
            display: block !important;
            visibility: visible !important;
        }
    `;
    document.head.appendChild(style);

    // Update page title
    document.title = 'CG Admin Dashboard';

    // Create root container
    const root = createElement('div', {
        attrs: { id: 'cg-admin-root' }
    });

    // Create Canvas layout wrapper
    const layoutMain = createElement('div', {
        attrs: { class: 'ic-Layout-contentMain' }
    });

    // Create Canvas content box
    const contentBox = createElement('div', {
        attrs: { class: 'content-box' },
        style: {
            padding: '32px'
        }
    });

    // Header
    const header = createElement('h1', {
        text: 'Customized Gradebook – Admin Dashboard'
    });

    // Tagline
    const tagline = createElement('div', {
        text: 'by MOREnet',
        style: {
            fontSize: '16px',
            color: '#888',
            marginTop: '-8px',
            marginBottom: '12px',
            fontWeight: '400'
        }
    });

    // Account info
    const accountInfo = createElement('p', {
        html: `Account ID: <strong>${getAccountId() || 'unknown'}</strong>`,
        style: {
            color: '#666',
            marginTop: '6px'
        }
    });

    contentBox.appendChild(header);
    contentBox.appendChild(tagline);
    contentBox.appendChild(accountInfo);

    // Render theme status panels (Installed Theme Overrides only)
    logger.debug('[DashboardRenderer] Rendering theme status panels...');
    renderThemeStatusPanels(contentBox);

    // Render account settings panels (Feature Flags & Grading Schemes)
    logger.debug('[DashboardRenderer] Rendering account settings panel...');
    renderAccountSettingsPanel(contentBox);

    // Render account filter panel BEFORE loader generator panel
    // Note: The loader generator panel will populate window.CG_MANAGED.config asynchronously,
    // and the account filter panel will read from it when rendering the tree
    logger.debug('[DashboardRenderer] ========================================');
    logger.debug('[DashboardRenderer] About to call renderAccountFilterPanel()');
    logger.debug('[DashboardRenderer] ========================================');
    // Get current config from window.CG_MANAGED if available
    const currentConfig = window.CG_MANAGED?.config || {};
    logger.debug('[DashboardRenderer] Current config:', currentConfig);
    logger.debug('[DashboardRenderer] Root element:', contentBox);
    logger.debug('[DashboardRenderer] Calling renderAccountFilterPanel()...');
    renderAccountFilterPanel(contentBox, currentConfig);
    logger.debug('[DashboardRenderer] renderAccountFilterPanel() call completed (async, may still be running)');

    // Render loader generator panel AFTER account filter panel
    // The loader generator will populate window.CG_MANAGED.config, which the account filter
    // panel will read when it finishes loading accounts (async)
    logger.debug('[DashboardRenderer] Rendering loader generator panel...');
    renderLoaderGeneratorPanel(contentBox);

    // Assemble the layout structure
    layoutMain.appendChild(contentBox);
    root.appendChild(layoutMain);

    // Append to body
    document.body.appendChild(root);

    logger.debug('[DashboardRenderer] Admin dashboard page rendered successfully');
}