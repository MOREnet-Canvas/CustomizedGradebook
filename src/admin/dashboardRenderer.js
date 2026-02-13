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
        attrs: { id: 'cg-admin-root' },
        style: {
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            padding: '32px',
            maxWidth: '1100px',
            margin: '0 auto',
            background: '#fff',
            minHeight: '100vh',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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

    root.appendChild(header);
    root.appendChild(tagline);
    root.appendChild(accountInfo);

    // Render theme status panels (Installed Theme Overrides only)
    logger.debug('[DashboardRenderer] Rendering theme status panels...');
    renderThemeStatusPanels(root);

    // Render account settings panels (Feature Flags & Grading Schemes)
    logger.debug('[DashboardRenderer] Rendering account settings panel...');
    renderAccountSettingsPanel(root);

    // Render loader generator panel FIRST so it can populate window.CG_MANAGED.config
    // before the account filter panel reads from it
    logger.debug('[DashboardRenderer] Rendering loader generator panel...');
    renderLoaderGeneratorPanel(root);

    // Render account filter panel AFTER loader generator panel
    // This ensures window.CG_MANAGED.config is populated before the panel reads it
    logger.debug('[DashboardRenderer] ========================================');
    logger.debug('[DashboardRenderer] About to call renderAccountFilterPanel()');
    logger.debug('[DashboardRenderer] ========================================');
    // Get current config from window.CG_MANAGED if available
    const currentConfig = window.CG_MANAGED?.config || {};
    logger.debug('[DashboardRenderer] Current config:', currentConfig);
    logger.debug('[DashboardRenderer] Root element:', root);
    logger.debug('[DashboardRenderer] Calling renderAccountFilterPanel()...');
    renderAccountFilterPanel(root, currentConfig);
    logger.debug('[DashboardRenderer] renderAccountFilterPanel() call completed (async, may still be running)');

    // Append to body
    document.body.appendChild(root);

    logger.debug('[DashboardRenderer] Admin dashboard page rendered successfully');
}