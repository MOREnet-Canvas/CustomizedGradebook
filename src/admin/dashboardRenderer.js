// src/admin/dashboardRenderer.js
/**
 * Admin Dashboard Page Renderer
 *
 * DEPRECATED: This file is being replaced by dashboardShell.js
 * Kept for backward compatibility during refactoring.
 *
 * New approach uses:
 * - dashboardShell.js for layout and coordination
 * - dashboardContext.js for shared state
 * - canvasFormHelpers.js for Canvas UI components
 */

import { logger } from '../utils/logger.js';
import { renderAdminDashboard } from './dashboardShell.js';

/**
 * Render the Admin Dashboard virtual page
 *
 * Delegates to the new dashboardShell module.
 */
export function renderAdminDashboardPage() {
    logger.info('[DashboardRenderer] Delegating to dashboardShell...');
    renderAdminDashboard();
}