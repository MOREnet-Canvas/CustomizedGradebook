// src/masteryOutlook/masteryOutlookInit.js
/**
 * Mastery Outlook Initialization
 *
 * Entry point for Mastery Outlook module.
 *
 * Responsibilities:
 * 1. Check user permissions (teacher_like only)
 * 2. Inject creation button on Course Settings page
 * 3. Initialize outlook on Mastery Outlook page
 *
 * See: docs/AI_SERVICES_REFERENCE.md for existing services
 */

import { logger } from '../utils/logger.js';
import { getUserRoleGroup, getCourseId } from '../utils/canvas.js';
import { isMasteryOutlookPage } from '../utils/pageDetection.js';
import { injectMasteryOutlookButton } from './masteryOutlookCreation.js';
import { renderMasteryOutlook } from './masteryOutlookView.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { fetchAllOutcomeData, computeOutcomeStats, applyPossibleManualOverrides } from './masteryOutlookDataService.js';
import { writeMasteryOutlookCache, readPLAssignments, readSyncState } from './masteryOutlookCacheService.js';
import { getThreshold } from './thresholdStorage.js';
import { checkAndInjectMasteryOutlookLink } from './sidebarLinkInjection.js';
import { findMasteryDashboardPageUrl } from '../services/pageService.js';

// ═══════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if current user can access Mastery Outlook
 *
 * Uses getUserRoleGroup() from src/utils/canvas.js (existing utility)
 *
 * Permitted roles: teacher, ta, admin, AccountAdmin, designer, root_admin
 *
 * @returns {boolean} True if user can access outlook
 */
function canAccessMasteryOutlook() {
    const roleGroup = getUserRoleGroup();

    if (roleGroup === "teacher_like") {
        logger.debug('[MasteryOutlookInit] Access granted (teacher_like role)');
        return true;
    }

    logger.debug(`[MasteryOutlookInit] Access denied (role group: ${roleGroup})`);
    return false;
}

// ═══════════════════════════════════════════════════════════════════════
// OUTLOOK VIEW INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Initialize Teacher Mastery OUTLOOK VIEW
 *
 * Finds the root container, sets up refresh handler, and renders the dashboard.
 * Uses MasteryOutlookView.js for UI rendering.
 */
function initMasteryOutlookView() {
    const containerEl = document.getElementById('teacher-mastery-dashboard-root');

    if (!containerEl) {
        logger.warn('[MasteryOutlookInit] Root container not found');
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
        logger.info('[MasteryOutlookInit] Starting data refresh...');

        // Fetch all data
        const data = await fetchAllOutcomeData(courseId, apiClient, onProgress);

        // Get current user's threshold setting
        const userId = window.ENV?.current_user_id;
        const threshold = userId ? getThreshold(courseId, userId) : 2.2;
        logger.debug(`[MasteryOutlookInit] Using threshold: ${threshold} for user ${userId}`);

        // Compute Power Law stats
        onProgress('Computing Power Law predictions...');
        const cache = computeOutcomeStats(data, threshold);

        // Find Mastery Dashboard page URL (handles auto-numbered URLs like mastery-dashboard-2)
        onProgress('Finding Mastery Dashboard page...');
        const masteryDashboardUrl = await findMasteryDashboardPageUrl(courseId, apiClient);
        if (masteryDashboardUrl) {
            logger.info(`[MasteryOutlookInit] Found Mastery Dashboard at: ${masteryDashboardUrl}`);
        } else {
            logger.warn('[MasteryOutlookInit] Mastery Dashboard page not found - student links may not work');
        }

        // Add courseId to cache metadata
        cache.metadata.courseId = courseId;
        cache.metadata.computedAt = new Date().toISOString();
        cache.metadata.threshold = threshold;
        cache.metadata.masteryDashboardUrl = masteryDashboardUrl;

        // Step 6: Preserve pl_assignments across refresh — read from existing cache and merge in
        // before writing so one-time Canvas setup data (assignment IDs, submission IDs, etc.)
        // is not lost when outcome data is recomputed.
        onProgress('Saving cache...');
        const existingPLAssignments = await readPLAssignments(courseId, apiClient);
        if (existingPLAssignments && Object.keys(existingPLAssignments).length > 0) {
            cache.pl_assignments = existingPLAssignments;
        }

        // Step 7: Preserve sync_state across refresh — same read-before-write pattern.
        // sync_state holds last_synced_score, manual_override, will_post, etc.
        // These must survive a data refresh unchanged.
        const existingSyncState = await readSyncState(courseId, apiClient);
        if (existingSyncState && Object.keys(existingSyncState).length > 0) {
            cache.sync_state = existingSyncState;
        }

        // Step 8: Detect possible manual Canvas overrides.
        // Compares canvasScore vs last_synced_score per student × outcome and sets
        // outcomeData.possibleManualOverride = true where they diverge.
        // Never sets manual_override — that requires explicit teacher confirmation.
        applyPossibleManualOverrides(cache, existingSyncState, existingPLAssignments);

        // Step 9: Write the merged cache (outcomes + students + pl_assignments + sync_state)
        await writeMasteryOutlookCache(courseId, apiClient, cache);

        logger.info('[MasteryOutlookInit] Data refresh complete');

        return {
            meta:           cache.metadata,
            outcomes:       cache.outcomes,
            students:       cache.students,
            pl_assignments: cache.pl_assignments  ?? {},
            sync_state:     cache.sync_state      ?? {},
        };
    };

    // Render dashboard
    renderMasteryOutlook({
        containerEl,
        courseId,
        apiClient,
        onRefresh
    });

    logger.info('[MasteryOutlookInit] OUTLOOK VIEW initialized');
}

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Initialize Mastery Outlook module
 *
 * Called from main init (customGradebookInit.js)
 *
 * Execution flow:
 * 1. Check permissions (teacher_like only)
 * 2. If on Course Settings page → Inject creation button
 * 3. If on Mastery Outlook page → Initialize OUTLOOK VIEW
 * 4. On any course page → Check if page exists and inject sidebar link
 */
export function initMasteryOutlook() {
    logger.debug('[MasteryOutlookInit] Starting initialization...');

    // Check permissions
    if (!canAccessMasteryOutlook()) {
        logger.debug('[MasteryOutlookInit] User does not have access, exiting');
        return;
    }

    // Route 1: Course Settings page - inject creation button
    try {
        injectMasteryOutlookButton();
    } catch (error) {
        logger.error('[MasteryOutlookInit] Error injecting creation button', error);
    }

    // Route 2: Mastery Outlook page - initialize view
    if (isMasteryOutlookPage()) {
        logger.info('[MasteryOutlookInit] On Mastery Outlook page, initializing view...');

        try {
            initMasteryOutlookView();
        } catch (error) {
            logger.error('[MasteryOutlookInit] Error initializing OUTLOOK VIEW', error);
        }
    }

    // Route 3: Any course page - check if page exists and inject sidebar link
    try {
        checkAndInjectMasteryOutlookLink();
    } catch (error) {
        logger.error('[MasteryOutlookInit] Error checking/injecting sidebar link', error);
    }

    logger.debug('[MasteryOutlookInit] Initialization complete');
}