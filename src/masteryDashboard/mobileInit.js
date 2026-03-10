// src/masteryDashboard/mobileInit.js
/**
 * Mastery Dashboard Initialization - Mobile Entry Point
 *
 * This is the entry point for the mobile bundle (mobileInit.js).
 * It is loaded by the mobile_loader.js in the Canvas Mobile Theme.
 *
 * This module renders the mastery dashboard viewer when the page contains
 * a mastery-dashboard-root element. The viewer checks for this element and
 * exits silently if not found, so it's safe to run on every page.
 *
 * Build Process:
 * - Source: src/masteryDashboard/mobileInit.js
 * - Build: esbuild.mobile.config.js
 * - Output: dist/mobile/dev/mobileInit.js or dist/mobile/prod/mobileInit.js
 * - Deploy: Uploaded to GitHub Releases (mobile-dev or mobile-v0.x.x)
 *
 * Environment Variables (set by esbuild):
 * - ENV_DEV: true in dev builds, false in prod
 * - ENV_PROD: true in prod builds, false in dev
 * - BUILD_VERSION: Build timestamp and git hash
 */

import { renderMasteryDashboard } from './masteryDashboardViewer.js';

// Debug logging
if (ENV_DEV) {
    console.log('[CG Mobile] Script loaded, waiting for DOM...');
}

// Wait for DOM to be ready, then render
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (ENV_DEV) {
            console.log('[CG Mobile] DOM ready, starting run()');
        }
        renderMasteryDashboard().catch(err => {
            console.error('[CG Mobile] Error:', err);
            if (ENV_DEV) {
                console.log('[CG Mobile] ERROR: ' + err.message);
            }
        });
    });
} else {
    if (ENV_DEV) {
        console.log('[CG Mobile] DOM already ready, starting run()');
    }
    renderMasteryDashboard().catch(err => {
        console.error('[CG Mobile] Error:', err);
        if (ENV_DEV) {
            console.log('[CG Mobile] ERROR: ' + err.message);
        }
    });
}