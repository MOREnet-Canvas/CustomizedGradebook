// src/masteryDashboard/mobileInit.js
/**
 * Mastery Dashboard Initialization - Mobile Entry Point
 *
 * This is the entry point for the mobile bundle (mobileInit.js).
 * It is loaded by the mobile_loader.js in the Canvas Mobile Theme.
 *
 * This module renders the mastery dashboard viewer when:
 * - The URL contains ?cg_web=1 (set by the button)
 * - The page contains a mastery-dashboard-root element
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

/**
 * Initialize the mastery dashboard viewer
 * Only runs if ?cg_web=1 is present in the URL
 */
function initViewer() {
    // Check if we're on a mastery dashboard page with ?cg_web=1
    const urlParams = new URLSearchParams(window.location.search);
    const isCgWeb = urlParams.get('cg_web') === '1';

    if (!isCgWeb) {
        if (ENV_DEV) {
            console.log('[CG Mobile] Not on mastery dashboard page (?cg_web=1 not present), exiting');
        }
        return;
    }

    if (ENV_DEV) {
        console.log('[CG Mobile] ?cg_web=1 detected, initializing mastery dashboard viewer');
        console.log(`[CG Mobile] Build version: ${BUILD_VERSION}`);
    }

    renderMasteryDashboard().catch(err => {
        console.error('[CG Mobile] Error:', err);
        if (ENV_DEV) {
            console.log('[CG Mobile] ERROR: ' + err.message);
        }
    });
}

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (ENV_DEV) {
            console.log('[CG Mobile] DOM ready, checking for ?cg_web=1');
        }
        initViewer();
    });
} else {
    if (ENV_DEV) {
        console.log('[CG Mobile] DOM already ready, checking for ?cg_web=1');
    }
    initViewer();
}