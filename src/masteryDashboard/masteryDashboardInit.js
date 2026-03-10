// src/masteryDashboard/masteryDashboardInit.js
/**
 * Mastery Dashboard Initialization - Web Entry Point
 * 
 * This module is imported by customGradebookInit.js and runs on the Canvas website.
 * 
 * IMPORTANT: Only initializes if the URL contains ?cg_web=1
 * 
 * This is to prevent conflicts with the mobile loader, which also creates the
 * mastery-dashboard-root element but uses a different initialization path.
 * 
 * URL Detection:
 * - ?cg_web=1 → Initialize web mastery dashboard viewer
 * - No ?cg_web=1 → Do nothing (mobile loader will handle it if present)
 */

import { renderMasteryDashboard } from './masteryDashboardViewer.js';
import { logger } from '../utils/logger.js';

/**
 * Initialize the mastery dashboard viewer for web
 * Only runs if ?cg_web=1 is present in the URL
 */
export function initMasteryDashboardViewer() {
    // Check if we're on a mastery dashboard page with ?cg_web=1
    const urlParams = new URLSearchParams(window.location.search);
    const isCgWeb = urlParams.get('cg_web') === '1';
    
    if (!isCgWeb) {
        // Not a web mastery dashboard request, exit silently
        return;
    }
    
    // Check if we're on a wiki page (mastery dashboard is a wiki page)
    const isWikiPage = /\/courses\/\d+\/pages\//.test(window.location.pathname);
    
    if (!isWikiPage) {
        logger.debug('[MasteryDashboard] ?cg_web=1 detected but not on a wiki page, ignoring');
        return;
    }
    
    logger.debug('[MasteryDashboard] Initializing web mastery dashboard viewer');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            renderMasteryDashboard().catch(err => {
                logger.error('[MasteryDashboard] Failed to render:', err);
            });
        });
    } else {
        // DOM already ready
        renderMasteryDashboard().catch(err => {
            logger.error('[MasteryDashboard] Failed to render:', err);
        });
    }
}

