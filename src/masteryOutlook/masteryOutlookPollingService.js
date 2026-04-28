// src/masteryOutlook/masteryOutlookPollingService.js
/**
 * Background polling service for Mastery Outlook.
 *
 * Responsibilities:
 *  - Lightweight 5-minute "dirty check" against Canvas submissions API
 *  - Page Visibility API integration — pause on hide, immediate check on return
 *  - Silent fail on all poll errors (never interrupt the teacher)
 *
 * All state is module-level so callers can start/stop from anywhere without
 * passing handles around.  Call stopPolling() + stopVisibilityListener() when
 * the dashboard is torn down or the cache is refreshed and polling restarts.
 *
 * Note: apiClient is passed into each function (not stored at module level)
 * so the CSRF token is always current.
 */

import { logger } from '../utils/logger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes

// ─── Module-level state ───────────────────────────────────────────────────────

let _pollInterval       = null;
let _visibilityHandler  = null;

// ─── checkForChanges ─────────────────────────────────────────────────────────

/**
 * Single lightweight Canvas API call: did any submissions get graded after
 * the cache was built?
 *
 * Uses per_page=1 — we only need a binary changed/unchanged signal.
 * Returns false on any error so the teacher is never interrupted by a poll failure.
 *
 * @param {string} courseId
 * @param {string} cacheComputedAt - ISO timestamp of last cache build
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<boolean>}
 */
export async function checkForChanges(courseId, cacheComputedAt, apiClient) {
    // Note: apiClient.get() adds per_page=100 only when per_page is absent.
    // We include per_page=1 explicitly so Canvas returns at most one row.
    const url = `/api/v1/courses/${courseId}/students/submissions`
        + `?student_ids[]=all`
        + `&workflow_state=graded`
        + `&graded_since=${encodeURIComponent(cacheComputedAt)}`
        + `&per_page=1`;

    try {
        const data = await apiClient.get(url, {}, 'pollCheckForChanges');
        // Canvas returns an array for this endpoint
        return Array.isArray(data) ? data.length > 0 : false;
    } catch (e) {
        logger.warn('[MasteryOutlookPolling] Poll check failed (silent):', e.message);
        return false;   // silent fail — never interrupt the teacher
    }
}

// ─── startPolling / stopPolling ───────────────────────────────────────────────

/**
 * Start the 5-minute background polling interval.
 *
 * Calls stopPolling() first so it is safe to call again after a refresh
 * without accumulating duplicate intervals.
 *
 * Polling stops itself the moment changes are detected — no point continuing
 * once we know the banner should be shown.
 *
 * @param {string}   courseId
 * @param {string}   cacheComputedAt
 * @param {Function} onChangesDetected - Zero-arg callback invoked once on detection
 * @param {CanvasApiClient} apiClient
 */
export function startPolling(courseId, cacheComputedAt, onChangesDetected, apiClient) {
    stopPolling();

    logger.debug(`[MasteryOutlookPolling] Starting polling every ${POLL_INTERVAL_MS / 60000} min`);

    _pollInterval = setInterval(async () => {
        try {
            const hasChanges = await checkForChanges(courseId, cacheComputedAt, apiClient);
            if (hasChanges) {
                logger.info('[MasteryOutlookPolling] Changes detected — stopping poll');
                stopPolling();
                onChangesDetected();
            }
        } catch {
            // Outer safety net — inner catch in checkForChanges should handle most errors
        }
    }, POLL_INTERVAL_MS);
}

/**
 * Stop the background polling interval.  Safe to call when not polling.
 */
export function stopPolling() {
    if (_pollInterval !== null) {
        clearInterval(_pollInterval);
        _pollInterval = null;
        logger.debug('[MasteryOutlookPolling] Polling stopped');
    }
}

// ─── Page Visibility API ──────────────────────────────────────────────────────

/**
 * Register a Page Visibility listener that pauses polling when the teacher
 * switches to another tab and runs an immediate check when they return.
 *
 * Running the check on return is important: the teacher typically finishes
 * grading in Canvas and switches back.  The banner should be there when they
 * arrive, not up to 5 minutes later.
 *
 * @param {string}   courseId
 * @param {Function} getCacheComputedAt - Zero-arg fn returning current cacheComputedAt
 * @param {Function} onChangesDetected  - Zero-arg callback for the banner
 * @param {CanvasApiClient} apiClient
 */
export function startVisibilityListener(courseId, getCacheComputedAt, onChangesDetected, apiClient) {
    stopVisibilityListener();

    _visibilityHandler = async () => {
        if (document.hidden) {
            stopPolling();
            logger.debug('[MasteryOutlookPolling] Tab hidden — polling paused');
        } else {
            logger.debug('[MasteryOutlookPolling] Tab visible — checking immediately');
            const cacheComputedAt = getCacheComputedAt();
            const hasChanges = await checkForChanges(courseId, cacheComputedAt, apiClient)
                .catch(() => false);

            if (hasChanges) {
                stopPolling();
                onChangesDetected();
            } else {
                startPolling(courseId, cacheComputedAt, onChangesDetected, apiClient);
            }
        }
    };

    document.addEventListener('visibilitychange', _visibilityHandler);
    logger.debug('[MasteryOutlookPolling] Visibility listener registered');
}

/**
 * Remove the Page Visibility listener.  Safe to call when none is registered.
 */
export function stopVisibilityListener() {
    if (_visibilityHandler) {
        document.removeEventListener('visibilitychange', _visibilityHandler);
        _visibilityHandler = null;
        logger.debug('[MasteryOutlookPolling] Visibility listener removed');
    }
}
