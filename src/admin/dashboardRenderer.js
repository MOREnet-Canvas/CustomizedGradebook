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
import { renderLoaderGeneratorPanel } from './loaderGeneratorPanel.js';

/**
 * Render the Admin Dashboard virtual page
 *
 * Clears the page and renders a full-page admin dashboard UI.
 */
export function renderAdminDashboardPage() {
    logger.info('[DashboardRenderer] Rendering admin dashboard page');

    // Clear page completely
    document.documentElement.innerHTML = '';

    // Create new head and body elements
    const head = document.createElement('head');
    const body = document.createElement('body');

    // Add basic meta tags
    head.innerHTML = `
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CG Admin Dashboard</title>
        <style>
            /* Reset and ensure clean slate */
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
                width: 100%;
                height: 100%;
                overflow-x: hidden;
                background: #f5f5f5;
            }
            /* Hide any Canvas content that might appear */
            #content, #application, .ic-app-main-content { display: none !important; }
        </style>
    `;

    document.documentElement.appendChild(head);
    document.documentElement.appendChild(body);

    // Create root container
    const root = createElement('div', {
        attrs: { id: 'cg-admin-root' },
        style: {
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            padding: '32px',
            maxWidth: '1100px',
            margin: '0 auto',
            background: '#fff',
            minHeight: '100vh'
        }
    });

    // Header
    const header = createElement('h1', {
        text: 'Customized Gradebook – Admin Dashboard'
    });

    // Account info
    const accountInfo = createElement('p', {
        html: `Account ID: <strong>${getAccountId() || 'unknown'}</strong>`,
        style: {
            color: '#666',
            marginTop: '6px'
        }
    });

    // Confirmation banner
    const banner = createElement('div', {
        html: `✅ Virtual admin page rendered via Theme JS<br>Same origin • Same session • CSRF intact`,
        style: {
            marginTop: '16px',
            padding: '16px',
            border: '2px solid #22dd88',
            borderRadius: '10px',
            background: 'rgba(34, 221, 136, 0.08)'
        }
    });

    root.appendChild(header);
    root.appendChild(accountInfo);
    root.appendChild(banner);

    // Render theme status panels
    renderThemeStatusPanels(root);

    // Render loader generator panel
    renderLoaderGeneratorPanel(root);

    // Append to body
    body.appendChild(root);

    logger.debug('[DashboardRenderer] Admin dashboard page rendered successfully');
}