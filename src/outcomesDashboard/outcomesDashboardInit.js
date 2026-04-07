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
import { getUserRoleGroup, getCourseId } from '../utils/canvas.js';
import { isOutcomesDashboardPage } from '../utils/pageDetection.js';
import { injectOutcomesDashboardButton } from './outcomesDashboardCreation.js';
import { renderOutcomesDashboard } from './outcomesDashboardView.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { fetchAllOutcomeData, computeOutcomeStats } from './outcomesDataService.js';
import { writeOutcomesCache, readOutcomesCache } from './outcomesCacheService.js';

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
// DASHBOARD VIEW INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Initialize Teacher Mastery Dashboard view
 *
 * Finds the root container, sets up refresh handler, and renders the dashboard.
 * Uses outcomesDashboardView.js for UI rendering.
 */
function initOutcomesDashboardView() {
    const containerEl = document.getElementById('teacher-mastery-dashboard-root');

    if (!containerEl) {
        logger.warn('[OutcomesDashboardInit] Root container not found');
        return;
    }

    const courseId = getCourseId();
    if (!courseId) {
        containerEl.innerHTML = '<div style="padding:2rem; text-align:center; color:#888;">Could not determine course ID</div>';
        return;
    }

    const apiClient = new CanvasApiClient();

    // Define refresh handler
    const onRefresh = async (onProgress) => {
        logger.info('[OutcomesDashboardInit] Starting data refresh...');

        // Fetch all data
        const data = await fetchAllOutcomeData(courseId, apiClient, onProgress);

        // Compute Power Law stats
        onProgress('Computing Power Law predictions...');
        const cache = computeOutcomeStats(data, 2.2);

        // Add courseId to cache metadata
        cache.metadata.courseId = courseId;
        cache.metadata.computedAt = new Date().toISOString();

        // Write to cache
        onProgress('Saving cache...');
        await writeOutcomesCache(courseId, apiClient, cache);

        logger.info('[OutcomesDashboardInit] Data refresh complete');

        return {
            meta: cache.metadata,
            outcomes: cache.outcomes,
            students: cache.students
        };
    };

    // Render dashboard
    renderOutcomesDashboard({
        containerEl,
        courseId,
        apiClient,
        onRefresh
    });

    logger.info('[OutcomesDashboardInit] Dashboard view initialized');
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
    
    // Route 2: Teacher Mastery Dashboard page - initialize view
    if (isOutcomesDashboardPage()) {
        logger.info('[OutcomesDashboardInit] On Teacher Mastery Dashboard page, initializing view...');

        try {
            initOutcomesDashboardView();
        } catch (error) {
            logger.error('[OutcomesDashboardInit] Error initializing dashboard view', error);
        }
    }
    
    logger.debug('[OutcomesDashboardInit] Initialization complete');
}