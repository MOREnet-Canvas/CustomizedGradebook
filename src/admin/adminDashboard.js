// src/admin/adminDashboard.js
/**
 * Canvas Admin Dashboard Module
 * 
 * Provides a virtual admin dashboard for managing Customized Gradebook configuration.
 * 
 * Features:
 * - Injects "CG Tools" button in Theme Editor under "JavaScript file" control
 * - Opens virtual admin dashboard page at /accounts/:id?cg_admin_dashboard=1
 * - Displays installed theme overrides from ENV.active_brand_config
 * - Auto-loads current Theme JS (district loader) with fetch retry
 * - Generates combined loader with CONFIG-ONLY CG-managed block
 * - Supports download and copy of generated loader
 * 
 * Safety:
 * - Read-only operations only (no API writes)
 * - Same-origin virtual page (no iframe, no OAuth needed)
 * - CSRF token intact (same session)
 */

import { logger } from '../utils/logger.js';
import { 
    isThemeEditorPage, 
    isAdminDashboardPage, 
    getAccountId 
} from './pageDetection.js';
import { injectThemeEditorButton } from './themeEditorInjection.js';
import { renderAdminDashboardPage } from './dashboardRenderer.js';

/**
 * Initialize admin dashboard module
 * 
 * Routes to appropriate handler based on current page:
 * - Theme Editor: Inject CG Tools button
 * - Admin Dashboard: Render virtual dashboard page
 * - Other pages: Early return (no-op)
 */
export function initAdminDashboard() {
    logger.debug('[AdminDashboard] Checking if admin dashboard should initialize');

    // Virtual admin dashboard page
    if (isAdminDashboardPage()) {
        logger.info('[AdminDashboard] Rendering virtual admin dashboard page');
        renderAdminDashboardPage();
        return;
    }

    // Theme Editor page
    if (isThemeEditorPage()) {
        logger.info('[AdminDashboard] Injecting CG Tools button in Theme Editor');
        
        // Retry injection with polling (DOM may not be ready)
        let attempts = 0;
        const maxAttempts = 20;
        const pollInterval = 250;
        
        const timer = setInterval(() => {
            const injected = injectThemeEditorButton();
            attempts++;
            
            if (injected || attempts >= maxAttempts) {
                clearInterval(timer);
                if (injected) {
                    logger.debug('[AdminDashboard] CG Tools button injected successfully');
                } else {
                    logger.warn('[AdminDashboard] Failed to inject CG Tools button after max attempts');
                }
            }
        }, pollInterval);
        
        return;
    }

    // Not a relevant page
    logger.trace('[AdminDashboard] Not on Theme Editor or Admin Dashboard page, skipping');
}

