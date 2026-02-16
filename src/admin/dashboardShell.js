// src/admin/dashboardShell.js
/**
 * Dashboard Shell Module
 * 
 * Responsibilities:
 * - Set up page layout structure (Canvas wrappers + .cg-admin-padding)
 * - Initialize shared context
 * - Load dashboard CSS
 * - Render all panels in correct order
 * - Wire up panel dependencies
 * 
 * Panels are responsible for:
 * - Rendering their own UI using Canvas ic-* classes
 * - Reading/updating config via context
 * - Listening to config changes if needed
 * - Managing their own internal state
 */

import { logger } from '../utils/logger.js';
import { getAccountId } from './pageDetection.js';
import { createElement } from './domHelpers.js';
import { createDashboardContext } from './dashboardContext.js';

// Import existing panel renderers (will be refactored incrementally)
import { renderThemeStatusPanels } from './themeStatusPanel.js';
import { renderAccountSettingsPanel } from './accountSettingsPanel.js';
import { renderAccountFilterPanel } from './accountFilterPanel.js';
import { renderThemeCssEditorPanel } from './themeCssEditorPanel.js';
import { renderLoaderGeneratorPanel } from './loaderGeneratorPanel.js';

/**
 * Render the Admin Dashboard
 * 
 * This is the main entry point for the dashboard.
 * It sets up the layout, context, and renders all panels.
 */
export function renderAdminDashboard() {
    logger.info('[DashboardShell] Rendering admin dashboard');
    
    // Clear body content
    document.body.innerHTML = '';
    
    // Inject dashboard styles
    injectDashboardStyles();
    
    // Create shared context
    const ctx = createDashboardContext();
    
    // Build layout structure
    const { root, innerWrapper } = buildLayoutStructure();
    
    // Render header
    renderHeader(innerWrapper);
    
    // Render all panels
    renderPanels(innerWrapper, ctx);
    
    // Append to body
    document.body.appendChild(root);
    
    logger.debug('[DashboardShell] Dashboard rendered successfully');
}

/**
 * Inject dashboard styles (CSS + page reset)
 */
function injectDashboardStyles() {
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

    // Note: Dashboard panel styles (.cg-panel, .cg-tip, etc.) are loaded via Canvas Theme CSS override
    // The CSS is merged into the main theme CSS file (css_loader.css) and loaded by Canvas automatically

    // Update page title
    document.title = 'CG Admin Dashboard';
}

/**
 * Build layout structure with Canvas wrappers
 * 
 * Structure:
 * #cg-admin-root
 *   .ic-Layout-contentMain
 *     .content-box
 *       .cg-admin-padding
 * 
 * @returns {Object} { root, innerWrapper }
 */
function buildLayoutStructure() {
    const root = createElement('div', {
        attrs: { id: 'cg-admin-root' }
    });
    
    const layoutMain = createElement('div', {
        attrs: { class: 'ic-Layout-contentMain' }
    });
    
    const contentBox = createElement('div', {
        attrs: { class: 'content-box' }
    });
    
    const innerWrapper = createElement('div', {
        attrs: { class: 'cg-admin-padding' }
    });
    
    contentBox.appendChild(innerWrapper);
    layoutMain.appendChild(contentBox);
    root.appendChild(layoutMain);
    
    return { root, innerWrapper };
}

/**
 * Render dashboard header
 *
 * @param {HTMLElement} container - Container element
 */
function renderHeader(container) {
    const header = createElement('h1', {
        text: 'Customized Gradebook – Admin Dashboard'
    });

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

    const accountInfo = createElement('p', {
        html: `Account ID: <strong>${getAccountId() || 'unknown'}</strong>`,
        style: {
            color: '#666',
            marginTop: '6px'
        }
    });

    container.appendChild(header);
    container.appendChild(tagline);
    container.appendChild(accountInfo);
}

/**
 * Render all dashboard panels
 *
 * Panels are rendered in this order:
 * 1. Theme Status (installed overrides)
 * 2. Account Settings (feature flags + grading schemes)
 * 3. Account Filter
 * 4. Theme CSS Editor
 * 5. Loader Generator (must be last - populates window.CG_MANAGED)
 *
 * @param {HTMLElement} container - Container element
 * @param {Object} ctx - Dashboard context
 */
function renderPanels(container, ctx) {
    logger.debug('[DashboardShell] Rendering panels...');

    // Panel 1: Theme Status
    logger.debug('[DashboardShell] Rendering theme status panels...');
    renderThemeStatusPanels(container);

    // Panel 2: Account Settings (Feature Flags & Grading Schemes)
    logger.debug('[DashboardShell] Rendering account settings panel...');
    renderAccountSettingsPanel(container);

    // Panel 3: Account Filter
    // Note: The loader generator panel will populate window.CG_MANAGED.config asynchronously,
    // and the account filter panel will read from it when rendering the tree
    logger.debug('[DashboardShell] Rendering account filter panel...');
    const currentConfig = ctx.getConfig();
    renderAccountFilterPanel(container, currentConfig);

    // Panel 4: Theme CSS Editor
    logger.debug('[DashboardShell] Rendering theme CSS editor panel...');
    renderThemeCssEditorPanel(container);

    // Panel 5: Loader Generator (MUST BE LAST)
    // The loader generator will populate window.CG_MANAGED.config, which the account filter
    // panel will read when it finishes loading accounts (async)
    logger.debug('[DashboardShell] Rendering loader generator panel...');
    renderLoaderGeneratorPanel(container);

    logger.debug('[DashboardShell] All panels rendered');
}