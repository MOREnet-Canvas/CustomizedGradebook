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

    // Clear page
    document.documentElement.innerHTML = '';

    // Create root container
    const root = createElement('div', {
        attrs: { id: 'cg-admin-root' },
        style: {
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            padding: '32px',
            maxWidth: '1100px',
            margin: '0 auto',
            background: '#fff'
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
    document.body.appendChild(root);

    logger.debug('[DashboardRenderer] Admin dashboard page rendered successfully');
}

