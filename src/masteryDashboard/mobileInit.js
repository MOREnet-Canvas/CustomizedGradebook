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
    // Add visible indicator that script loaded
    setTimeout(() => {
        showDebugMessage('mobileInit.js loaded successfully');
    }, 100);
}

/**
 * Show debug message on page (for mobile debugging without console access)
 */
function showDebugMessage(message, isError = false) {
    if (!ENV_DEV) return;

    let debugDiv = document.getElementById('cg-mobile-debug');
    if (!debugDiv) {
        debugDiv = document.createElement('div');
        debugDiv.id = 'cg-mobile-debug';
        debugDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: ${isError ? '#f44336' : '#2196F3'};
            color: white;
            padding: 8px;
            font-size: 12px;
            z-index: 99999;
            max-height: 200px;
            overflow-y: auto;
        `;
        document.body.appendChild(debugDiv);
    }

    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.textContent = `[${timestamp}] ${message}`;
    line.style.borderBottom = '1px solid rgba(255,255,255,0.3)';
    line.style.padding = '4px 0';
    debugDiv.appendChild(line);

    console.log('[CG Mobile Debug]', message);
}

/**
 * Initialize the mastery dashboard viewer
 * Only runs if ?cg_web=1 is present in the URL
 */
function initViewer() {
    showDebugMessage('initViewer() called');

    // Check if we're on a mastery dashboard page with ?cg_web=1
    const urlParams = new URLSearchParams(window.location.search);
    const isCgWeb = urlParams.get('cg_web') === '1';

    showDebugMessage(`URL: ${window.location.href}`);
    showDebugMessage(`?cg_web=1 present: ${isCgWeb}`);

    if (!isCgWeb) {
        showDebugMessage('No ?cg_web=1, exiting');
        if (ENV_DEV) {
            console.log('[CG Mobile] Not on mastery dashboard page (?cg_web=1 not present), exiting');
        }
        return;
    }

    showDebugMessage('?cg_web=1 detected, rendering...');

    if (ENV_DEV) {
        console.log('[CG Mobile] ?cg_web=1 detected, initializing mastery dashboard viewer');
        console.log(`[CG Mobile] Build version: ${BUILD_VERSION}`);
    }

    renderMasteryDashboard().catch(err => {
        console.error('[CG Mobile] Error:', err);
        showDebugMessage(`ERROR: ${err.message}`, true);
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