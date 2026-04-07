// src/outcomesDashboard/outcomesDashboardInit.js
/**
 * Outcomes Dashboard Initialization
 * 
 * Entry point for Outcomes Dashboard module.
 * 
 * Responsibilities:
 * 1. Check user permissions (teacher_like only)
 * 2. Inject creation button on Course Settings page
 * 3. Initialize dashboard on Outcomes Dashboard page
 * 
 * See: docs/AI_SERVICES_REFERENCE.md for existing services
 */

import { logger } from '../utils/logger.js';
import { getUserRoleGroup } from '../utils/canvas.js';
import { isOutcomesDashboardPage } from '../utils/pageDetection.js';
import { injectOutcomesDashboardButton } from './outcomesDashboardCreation.js';

// ═══════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if current user can access Outcomes Dashboard
 * 
 * Uses getUserRoleGroup() from src/utils/canvas.js (existing utility)
 * 
 * Permitted roles: teacher, ta, admin, AccountAdmin, designer, root_admin
 * 
 * @returns {boolean} True if user can access dashboard
 */
function canAccessOutcomesDashboard() {
    const roleGroup = getUserRoleGroup();
    
    if (roleGroup === "teacher_like") {
        logger.debug('[OutcomesDashboardInit] Access granted (teacher_like role)');
        return true;
    }
    
    logger.debug(`[OutcomesDashboardInit] Access denied (role group: ${roleGroup})`);
    return false;
}

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Initialize Outcomes Dashboard module
 * 
 * Called from main init (customGradebookInit.js)
 * 
 * Execution flow:
 * 1. Check permissions (teacher_like only)
 * 2. If on Course Settings page → Inject creation button
 * 3. If on Outcomes Dashboard page → Initialize dashboard view
 */
export function initOutcomesDashboard() {
    logger.debug('[OutcomesDashboardInit] Starting initialization...');
    
    // Check permissions
    if (!canAccessOutcomesDashboard()) {
        logger.debug('[OutcomesDashboardInit] User does not have access, exiting');
        return;
    }
    
    // Route 1: Course Settings page - inject creation button
    try {
        injectOutcomesDashboardButton();
    } catch (error) {
        logger.error('[OutcomesDashboardInit] Error injecting creation button', error);
    }
    
    // Route 2: Outcomes Dashboard page - initialize view
    if (isOutcomesDashboardPage()) {
        logger.info('[OutcomesDashboardInit] On Outcomes Dashboard page, initializing view...');
        
        try {
            // TODO: Phase 4 - Initialize dashboard view
            // import { initOutcomesDashboardView } from './outcomesDashboardView.js';
            // initOutcomesDashboardView();
            
            logger.debug('[OutcomesDashboardInit] Dashboard view initialization not yet implemented (Phase 4)');
            
        } catch (error) {
            logger.error('[OutcomesDashboardInit] Error initializing dashboard view', error);
        }
    }
    
    logger.debug('[OutcomesDashboardInit] Initialization complete');
}