// src/masteryDashboard/mobileInit.js
/**
 * Mastery Dashboard Initialization - Mobile Entry Point
 * 
 * This is the entry point for the mobile bundle (mobileInit.js).
 * It is loaded by the mobile_loader.js in the Canvas Mobile Theme.
 * 
 * This module runs in the Canvas Parent mobile app and provides:
 * - "View Mastery Dashboard" button on course Front Pages
 * - Mastery dashboard viewer when button is clicked
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

/**
 * Check if we're in the Canvas Parent mobile app
 * @returns {boolean} True if in mobile app
 */
function isMobileApp() {
    return /CanvasParent/.test(navigator.userAgent);
}

/**
 * Add "View Mastery Dashboard" button to course Front Page
 * Only runs if:
 * - We're in the Canvas Parent mobile app
 * - We're on a course Front Page
 * - The course has a "Mastery Dashboard" wiki page
 */
function addMasteryButton() {
    // Only run in mobile app
    if (!isMobileApp()) {
        if (ENV_DEV) {
            console.log('[CG Mobile] Not in Canvas Parent app, skipping button injection');
        }
        return;
    }

    // Check if we're on a course Front Page
    const match = location.pathname.match(/^\/courses\/(\d+)$/);
    if (!match) {
        if (ENV_DEV) {
            console.log('[CG Mobile] Not on course Front Page, skipping button injection');
        }
        return;
    }

    const courseId = match[1];
    
    if (ENV_DEV) {
        console.log(`[CG Mobile] On course ${courseId} Front Page, checking for Mastery Dashboard page...`);
    }

    // Check if course has a "Mastery Dashboard" page
    fetch(`/api/v1/courses/${courseId}/pages/mastery-dashboard`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                if (ENV_DEV) {
                    console.log('[CG Mobile] No Mastery Dashboard page found in this course');
                }
                return;
            }
            return response.json();
        })
        .then(page => {
            if (!page) return;
            
            if (ENV_DEV) {
                console.log('[CG Mobile] Mastery Dashboard page found, injecting button');
            }

            // Find a good place to inject the button
            const contentDiv = document.querySelector('.show-content') || 
                             document.querySelector('#content') ||
                             document.body;

            // Create button
            const button = document.createElement('button');
            button.textContent = '📊 View Mastery Dashboard';
            button.style.cssText = `
                display: block;
                width: 100%;
                max-width: 400px;
                margin: 16px auto;
                padding: 12px 20px;
                font-size: 16px;
                font-weight: 600;
                color: #fff;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;

            button.addEventListener('click', () => {
                window.location.href = `/courses/${courseId}/pages/mastery-dashboard?cg_web=1`;
            });

            contentDiv.insertBefore(button, contentDiv.firstChild);
            
            if (ENV_DEV) {
                console.log('[CG Mobile] Button injected successfully');
            }
        })
        .catch(err => {
            if (ENV_DEV) {
                console.error('[CG Mobile] Error checking for Mastery Dashboard page:', err);
            }
        });
}

/**
 * Initialize mastery dashboard viewer
 * Only runs if we're on the mastery dashboard page with ?cg_web=1
 */
function initViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const isCgWeb = urlParams.get('cg_web') === '1';
    
    if (!isCgWeb) {
        if (ENV_DEV) {
            console.log('[CG Mobile] Not on mastery dashboard page (?cg_web=1 not present)');
        }
        return;
    }

    if (ENV_DEV) {
        console.log('[CG Mobile] Initializing mastery dashboard viewer');
        console.log(`[CG Mobile] Build version: ${BUILD_VERSION}`);
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            renderMasteryDashboard().catch(err => {
                console.error('[CG Mobile] Failed to render mastery dashboard:', err);
            });
        });
    } else {
        renderMasteryDashboard().catch(err => {
            console.error('[CG Mobile] Failed to render mastery dashboard:', err);
        });
    }
}

// Main initialization
if (ENV_DEV) {
    console.log('[CG Mobile] mobileInit.js loaded');
    console.log(`[CG Mobile] Build version: ${BUILD_VERSION}`);
    console.log(`[CG Mobile] Dev mode: ${ENV_DEV}`);
}

// Run both functions (only one will actually do something based on URL)
addMasteryButton();
initViewer();

