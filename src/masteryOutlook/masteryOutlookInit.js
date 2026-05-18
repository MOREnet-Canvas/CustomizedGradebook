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
import { fetchAllOutcomeData, computeOutcomeStats, applyPossibleManualOverrides, reapplyIgnoredAlignments } from './masteryOutlookDataService.js';
import { writeMasteryOutlookCache, readPLAssignments, readSyncState, readIgnoredAlignments } from './masteryOutlookCacheService.js';
import { stopPolling, stopVisibilityListener } from './masteryOutlookPollingService.js';
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

    // Define refresh handler — delegates to the exported runFullRefresh which uses
    // parallel page fetching and enforces the cache integrity guarantee.
    const onRefresh = async (onProgress) => {
        // Stop any running poll/visibility listener — they will be restarted by the
        // view after the new cache is loaded.
        stopPolling();
        stopVisibilityListener();

        return runFullRefresh(courseId, apiClient, onProgress);
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
// runFullRefresh — exported so the banner "Refresh now" button can call it
// ═══════════════════════════════════════════════════════════════════════

/**
 * Perform a full cache rebuild using the parallel outcome_results fetcher.
 *
 * Cache integrity guarantee: if ANY page fetch fails, this function throws and
 * the existing cache on Canvas Files is left completely unchanged.  The caller
 * (either onRefresh or the banner button) must handle the error and show the
 * teacher an appropriate message.
 *
 * On success the function returns the same shape as the existing onRefresh
 * callback: { meta, outcomes, students, pl_assignments, sync_state }.
 *
 * @param {string}   courseId
 * @param {CanvasApiClient} apiClient
 * @param {Function} [onProgress]  - (message: string) => void
 * @returns {Promise<Object>} Cache object ready for the view
 */
export async function runFullRefresh(courseId, apiClient, onProgress = () => {}) {
    logger.info('[MasteryOutlookInit] runFullRefresh — starting parallel data fetch...');

    // Fetch all data with the parallel page fetcher (4d).
    // fetchAllOutcomeData throws if any page fails — the cache is never written in that case.
    const data = await fetchAllOutcomeData(courseId, apiClient, onProgress, { parallel: true });

    // Get current user's threshold setting
    const userId = window.ENV?.current_user_id;
    const threshold = userId ? getThreshold(courseId, userId) : 2.2;
    logger.debug(`[MasteryOutlookInit] Using threshold: ${threshold} for user ${userId}`);

    // Compute Power Law stats
    onProgress('Computing Power Law predictions...');
    const cache = computeOutcomeStats(data, threshold);

    // Find Mastery Dashboard page URL
    onProgress('Finding Mastery Dashboard page...');
    const masteryDashboardUrl = await findMasteryDashboardPageUrl(courseId, apiClient);
    if (masteryDashboardUrl) {
        logger.info(`[MasteryOutlookInit] Found Mastery Dashboard at: ${masteryDashboardUrl}`);
    } else {
        logger.warn('[MasteryOutlookInit] Mastery Dashboard page not found - student links may not work');
    }

    cache.metadata.courseId           = courseId;
    cache.metadata.computedAt         = new Date().toISOString();
    cache.metadata.threshold          = threshold;
    cache.metadata.masteryDashboardUrl = masteryDashboardUrl;

    // Step 6: Preserve pl_assignments across refresh
    onProgress('Saving cache...');
    const existingPLAssignments = await readPLAssignments(courseId, apiClient);
    if (existingPLAssignments && Object.keys(existingPLAssignments).length > 0) {
        cache.pl_assignments = existingPLAssignments;
    }

    // Step 7: Preserve sync_state across refresh
    const existingSyncState = await readSyncState(courseId, apiClient);
    if (existingSyncState && Object.keys(existingSyncState).length > 0) {
        cache.sync_state = existingSyncState;
    }

    // Step 7b: Preserve ignored_alignments across refresh
    const existingIgnoredAlignments = await readIgnoredAlignments(courseId, apiClient);
    if (existingIgnoredAlignments.length > 0) {
        cache.ignored_alignments = existingIgnoredAlignments;
    }

    // Step 7c: Recompute plPrediction for students with ignored alignments.
    // computeOutcomeStats (step above) ran before ignored_alignments was restored,
    // so it used all attempts. This corrects those plPrediction values in place.
    reapplyIgnoredAlignments(cache);

    // Step 8: Detect possible manual Canvas overrides
    applyPossibleManualOverrides(cache, existingSyncState, existingPLAssignments);

    // Step 9: Write the merged cache — only reached if all pages succeeded (4e guarantee)
    await writeMasteryOutlookCache(courseId, apiClient, cache);

    logger.info('[MasteryOutlookInit] runFullRefresh complete');

    return {
        meta:           cache.metadata,
        outcomes:       cache.outcomes,
        students:       cache.students,
        pl_assignments: cache.pl_assignments ?? {},
        sync_state:     cache.sync_state     ?? {},
        ignored_alignments: cache.ignored_alignments ?? [],
    };
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