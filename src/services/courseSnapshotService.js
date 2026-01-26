// src/services/courseSnapshotService.js
/**
 * Course Snapshot Service
 *
 * Unified session-based caching system for course data shared across Dashboard and Student Grades pages.
 * This is the SINGLE OWNER of course snapshot data - all writes must go through this service.
 *
 * Core Principles:
 * - Single unified cache entry per course (cg_courseSnapshot_<courseId>)
 * - Centralized population logic (only place where detection and grade computation occur)
 * - Page-aware refresh logic (standards-based vs non-standards-based)
 * - TTL-based expiration (10 minutes)
 * - User ownership validation (prevents data leakage between users)
 * - Role-based access control (student-like users only)
 * - Page-based access control (authorized pages only)
 *
 * Snapshot Structure:
 * {
 *   courseId: string,
 *   courseName: string,
 *   model: "standards" | "traditional",  // Course model classification
 *   modelReason: string,                 // Classification reason (for debugging)
 *   isStandardsBased: boolean,           // DEPRECATED: Use model === "standards"
 *   score: number,
 *   letterGrade: string|null,
 *   gradeSource: 'assignment' | 'enrollment',
 *   timestamp: number,
 *   userId: string,           // For user ownership validation
 *   expiresAt: number         // TTL expiration timestamp
 * }
 *
 * @module services/courseSnapshotService
 */

import { logger } from '../utils/logger.js';
import { determineCourseModel } from '../utils/courseDetection.js';
import { getCourseGrade } from './gradeDataService.js';
import { getUserRoleGroup } from '../utils/canvas.js';
import { isDashboardPage, isAllGradesPage, isSingleCourseGradesPage } from '../utils/pageDetection.js';

/**
 * Key prefix for all course snapshots in sessionStorage
 */
const SNAPSHOT_KEY_PREFIX = 'cg_courseSnapshot_';

/**
 * Key for storing current user ID in sessionStorage
 */
const USER_ID_KEY = 'cg_userId';

/**
 * TTL for snapshots in milliseconds (10 minutes)
 */
const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

/**
 * Page context types for refresh logic
 * @readonly
 * @enum {string}
 */
export const PAGE_CONTEXT = Object.freeze({
    DASHBOARD: 'dashboard',
    ALL_GRADES: 'allGrades',
    COURSE_GRADES: 'courseGrades'
});

/**
 * Check if current page is authorized for snapshot operations
 *
 * Authorized pages:
 * - Dashboard
 * - All grades page (/grades)
 * - Course grades page (/courses/[courseId]/grades)
 *
 * @returns {boolean} True if current page is authorized
 */
function isAuthorizedPage() {
    return isDashboardPage() || isAllGradesPage() || isSingleCourseGradesPage();
}

/**
 * Validate user ownership and clear snapshots if user changed
 *
 * This function MUST be called before any snapshot read/write operations.
 * If the current user differs from the cached user, all snapshots are cleared.
 *
 * Security: Prevents data leakage between users in shared browser sessions.
 *
 * @returns {boolean} True if user is valid (same as cached or first time)
 */
function validateUserOwnership() {
    const currentUserId = ENV?.current_user_id ? String(ENV.current_user_id) : null;

    if (!currentUserId) {
        logger.warn('[Snapshot] Cannot validate user ownership - ENV.current_user_id not available');
        return false;
    }

    const cachedUserId = sessionStorage.getItem(USER_ID_KEY);

    // First time - store user ID
    if (!cachedUserId) {
        sessionStorage.setItem(USER_ID_KEY, currentUserId);
        logger.debug(`[Snapshot] Initialized user ownership tracking for user ${currentUserId}`);
        return true;
    }

    // User changed - clear all snapshots
    if (cachedUserId !== currentUserId) {
        logger.warn(`[Snapshot] User changed from ${cachedUserId} to ${currentUserId} - clearing all snapshots`);
        const count = clearAllSnapshots();
        sessionStorage.setItem(USER_ID_KEY, currentUserId);
        logger.info(`[Snapshot] Cleared ${count} snapshots due to user change`);
        return true;
    }

    // Same user - all good
    return true;
}

/**
 * Validate all existing snapshots and clear any that don't belong to current user
 *
 * This should be called on script initialization to ensure no stale data from previous users.
 *
 * @returns {number} Number of invalid snapshots cleared
 */
export function validateAllSnapshots() {
    const currentUserId = ENV?.current_user_id ? String(ENV.current_user_id) : null;

    if (!currentUserId) {
        logger.warn('[Snapshot] Cannot validate snapshots - ENV.current_user_id not available');
        return 0;
    }

    const cachedUserId = sessionStorage.getItem(USER_ID_KEY);

    // If no cached user ID or user changed, clear all snapshots
    if (!cachedUserId || cachedUserId !== currentUserId) {
        logger.warn(`[Snapshot] User validation failed on init (cached=${cachedUserId}, current=${currentUserId}) - clearing all snapshots`);
        const count = clearAllSnapshots();
        sessionStorage.setItem(USER_ID_KEY, currentUserId);
        return count;
    }

    // Validate individual snapshots for userId and TTL
    const keys = Object.keys(sessionStorage);
    const snapshotKeys = keys.filter(k => k.startsWith(SNAPSHOT_KEY_PREFIX));
    let clearedCount = 0;

    snapshotKeys.forEach(key => {
        try {
            const snapshot = JSON.parse(sessionStorage.getItem(key));

            // Check if snapshot has userId field and it matches current user
            if (snapshot.userId && snapshot.userId !== currentUserId) {
                logger.warn(`[Snapshot] Removing snapshot with mismatched userId: ${key}`);
                sessionStorage.removeItem(key);
                clearedCount++;
                return;
            }

            // Check TTL expiration
            if (snapshot.expiresAt && Date.now() > snapshot.expiresAt) {
                logger.debug(`[Snapshot] Removing expired snapshot: ${key}`);
                sessionStorage.removeItem(key);
                clearedCount++;
                return;
            }
        } catch (error) {
            logger.warn(`[Snapshot] Failed to parse snapshot ${key}, removing:`, error.message);
            sessionStorage.removeItem(key);
            clearedCount++;
        }
    });

    if (clearedCount > 0) {
        logger.info(`[Snapshot] Cleared ${clearedCount} invalid/expired snapshots on init`);
    } else {
        logger.debug('[Snapshot] All existing snapshots validated successfully');
    }

    return clearedCount;
}

/**
 * Get course snapshot from sessionStorage (read-only access for consumers)
 *
 * This is the ONLY way consumers should access course data.
 * Consumers must NEVER independently detect course type or compute grades.
 *
 * Security: Validates user ownership and TTL before returning data.
 *
 * @param {string} courseId - Course ID
 * @returns {Object|null} Course snapshot or null if not found/expired
 *
 * @example
 * const snapshot = getCourseSnapshot('12345');
 * if (snapshot) {
 *   console.log(`Course: ${snapshot.courseName}`);
 *   console.log(`Standards-based: ${snapshot.isStandardsBased}`);
 *   console.log(`Grade: ${snapshot.score} (${snapshot.letterGrade})`);
 * }
 */
export function getCourseSnapshot(courseId) {
    // Validate user ownership first
    if (!validateUserOwnership()) {
        return null;
    }

    const key = `${SNAPSHOT_KEY_PREFIX}${courseId}`;
    const cached = sessionStorage.getItem(key);

    if (!cached) {
        logger.trace(`[Snapshot] Cache MISS for course ${courseId}`);
        return null;
    }

    try {
        const snapshot = JSON.parse(cached);

        // Validate userId matches current user
        const currentUserId = ENV?.current_user_id ? String(ENV.current_user_id) : null;
        if (snapshot.userId && snapshot.userId !== currentUserId) {
            logger.warn(`[Snapshot] User ID mismatch for course ${courseId}, removing snapshot`);
            sessionStorage.removeItem(key);
            return null;
        }

        // Check TTL expiration
        if (snapshot.expiresAt && Date.now() > snapshot.expiresAt) {
            logger.debug(`[Snapshot] Snapshot expired for course ${courseId}, removing`);
            sessionStorage.removeItem(key);
            return null;
        }

        logger.trace(`[Snapshot] Cache HIT for course ${courseId}: isStandardsBased=${snapshot.isStandardsBased}, score=${snapshot.score}, source=${snapshot.gradeSource}`);
        return snapshot;
    } catch (error) {
        logger.warn(`[Snapshot] Failed to parse snapshot for course ${courseId}:`, error.message);
        sessionStorage.removeItem(key);
        return null;
    }
}

/**
 * Populate course snapshot in sessionStorage (SINGLE OWNER - only place to write)
 *
 * This is the ONLY function that writes course snapshots.
 * It is the ONLY place where:
 * - Course type detection occurs
 * - Grade computation occurs
 * - sessionStorage entries are written
 *
 * All other modules must treat sessionStorage as read-only.
 *
 * Security: Validates user ownership, role, and page authorization before writing data.
 *
 * @param {string} courseId - Course ID
 * @param {string} courseName - Course name
 * @param {Object} apiClient - CanvasApiClient instance
 * @returns {Promise<Object|null>} Populated snapshot or null if failed
 *
 * @example
 * const snapshot = await populateCourseSnapshot('12345', 'Math 101', apiClient);
 * if (snapshot) {
 *   console.log(`Populated snapshot for ${snapshot.courseName}`);
 * }
 */
export async function populateCourseSnapshot(courseId, courseName, apiClient) {
    // Validate user ownership first
    if (!validateUserOwnership()) {
        logger.warn(`[Snapshot] Cannot populate snapshot - user ownership validation failed`);
        return null;
    }

    // Check user role - only student-like users can create snapshots
    const roleGroup = getUserRoleGroup();
    if (roleGroup !== 'student_like') {
        logger.trace(`[Snapshot] Skipping snapshot population - user is ${roleGroup}, not student_like`);
        return null;
    }

    // Check page authorization
    if (!isAuthorizedPage()) {
        logger.trace(`[Snapshot] Skipping snapshot population - unauthorized page`);
        return null;
    }

    const currentUserId = ENV?.current_user_id ? String(ENV.current_user_id) : null;
    if (!currentUserId) {
        logger.warn(`[Snapshot] Cannot populate snapshot - ENV.current_user_id not available`);
        return null;
    }

    logger.debug(`[Snapshot] Populating snapshot for course ${courseId} "${courseName}"`);

    try {
        // Step 1: Fetch grade data first (needed for letter grade in detection)
        logger.trace(`[Snapshot] Step 1: Fetching grade for ${courseId}...`);
        const gradeData = await getCourseGrade(courseId, apiClient);

        if (!gradeData) {
            logger.trace(`[Snapshot] No grade data available for course ${courseId}, skipping snapshot`);
            return null;
        }

        logger.trace(`[Snapshot] Course ${courseId} grade: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}, source=${gradeData.source}`);

        // Step 2: Classify course model (SINGLE SOURCE OF TRUTH)
        logger.trace(`[Snapshot] Step 2: Classifying course model for ${courseId}...`);
        const classification = await determineCourseModel(
            { courseId, courseName },
            null,
            { apiClient }
        );
        logger.trace(`[Snapshot] Course ${courseId} classification: model=${classification.model}, reason=${classification.reason}`);

        // Step 3: Create unified snapshot with security fields
        const snapshot = {
            courseId,
            courseName,
            model: classification.model,
            modelReason: classification.reason,
            isStandardsBased: classification.model === 'standards', // DEPRECATED: for backward compatibility
            score: gradeData.score,
            letterGrade: gradeData.letterGrade,
            gradeSource: gradeData.source,
            timestamp: Date.now(),
            userId: currentUserId,
            expiresAt: Date.now() + SNAPSHOT_TTL_MS
        };

        // Step 4: Write to sessionStorage
        const key = `${SNAPSHOT_KEY_PREFIX}${courseId}`;
        sessionStorage.setItem(key, JSON.stringify(snapshot));

        logger.debug(`[Snapshot] ✅ Populated snapshot for course ${courseId}: model=${classification.model} (${classification.reason}), score=${gradeData.score}, source=${gradeData.source}, expiresAt=${new Date(snapshot.expiresAt).toISOString()}`);

        return snapshot;

    } catch (error) {
        logger.warn(`[Snapshot] Failed to populate snapshot for course ${courseId}:`, error.message);
        return null;
    }
}

/**
 * Determine if a course grade should be refreshed based on page context
 *
 * This is the SINGLE FUNCTION that determines page-aware refresh logic.
 *
 * Security: Only allows refresh on authorized pages.
 *
 * Refresh Rules:
 * - Unauthorized pages: NEVER refresh (return false)
 * - Standards-based courses: NEVER refresh (scores are stable)
 * - Non-standards-based courses:
 *   - Dashboard: NEVER refresh (performance optimization)
 *   - All-grades page: ALWAYS refresh (user expects current grade)
 *   - Course grades page: ALWAYS refresh (user expects current grade)
 *
 * @param {string} courseId - Course ID
 * @param {string} pageContext - Page context (PAGE_CONTEXT.DASHBOARD, PAGE_CONTEXT.ALL_GRADES, PAGE_CONTEXT.COURSE_GRADES)
 * @returns {boolean} True if grade should be refreshed
 *
 * @example
 * // On dashboard
 * if (shouldRefreshGrade('12345', PAGE_CONTEXT.DASHBOARD)) {
 *   // Will be false for all courses (performance optimization)
 * }
 *
 * // On all-grades page
 * if (shouldRefreshGrade('12345', PAGE_CONTEXT.ALL_GRADES)) {
 *   // Will be true for non-standards-based courses
 *   // Will be false for standards-based courses
 * }
 */
export function shouldRefreshGrade(courseId, pageContext) {
    // Check page authorization first
    if (!isAuthorizedPage()) {
        logger.trace(`[Refresh] Course ${courseId}: Unauthorized page, no refresh allowed`);
        return false;
    }

    const snapshot = getCourseSnapshot(courseId);

    // No snapshot exists, need to populate
    if (!snapshot) {
        logger.trace(`[Refresh] Course ${courseId}: No snapshot exists, needs population`);
        return true;
    }

    // Standards-based courses: NEVER refresh (scores are stable)
    if (snapshot.isStandardsBased) {
        logger.trace(`[Refresh] Course ${courseId}: Standards-based, no refresh needed (page=${pageContext})`);
        return false;
    }

    // Non-standards-based courses: Refresh on specific pages
    const refreshPages = [PAGE_CONTEXT.ALL_GRADES, PAGE_CONTEXT.COURSE_GRADES];
    const shouldRefresh = refreshPages.includes(pageContext);

    const reason = shouldRefresh
        ? `page ${pageContext} requires fresh grade`
        : `page ${pageContext} uses cached grade`;

    logger.trace(`[Refresh] Course ${courseId}: Non-standards-based, ${reason}`);
    return shouldRefresh;
}

/**
 * Refresh course snapshot (explicit refresh with page-aware logic)
 *
 * Checks shouldRefreshGrade() unless force=true.
 * If refresh is needed, calls populateCourseSnapshot() to update the snapshot.
 *
 * Security: Validates user ownership and page authorization.
 *
 * @param {string} courseId - Course ID
 * @param {string} courseName - Course name
 * @param {Object} apiClient - CanvasApiClient instance
 * @param {string} pageContext - Page context for refresh logic
 * @param {boolean} [force=false] - Force refresh regardless of page context
 * @returns {Promise<Object|null>} Updated snapshot or existing snapshot
 *
 * @example
 * // Refresh with page-aware logic
 * const snapshot = await refreshCourseSnapshot('12345', 'Math 101', apiClient, PAGE_CONTEXT.ALL_GRADES);
 *
 * // Force refresh (debugging)
 * const snapshot = await refreshCourseSnapshot('12345', 'Math 101', apiClient, PAGE_CONTEXT.DASHBOARD, true);
 */
export async function refreshCourseSnapshot(courseId, courseName, apiClient, pageContext, force = false) {
    // Validate user ownership first
    if (!validateUserOwnership()) {
        logger.warn(`[Refresh] Cannot refresh snapshot - user ownership validation failed`);
        return null;
    }

    // Check page authorization (unless force=true for debugging)
    if (!force && !isAuthorizedPage()) {
        logger.trace(`[Refresh] Cannot refresh snapshot - unauthorized page`);
        return getCourseSnapshot(courseId);
    }

    if (force) {
        logger.debug(`[Refresh] Force refresh for course ${courseId} (page=${pageContext})`);
        return await populateCourseSnapshot(courseId, courseName, apiClient);
    }

    const needsRefresh = shouldRefreshGrade(courseId, pageContext);

    if (needsRefresh) {
        logger.debug(`[Refresh] Refreshing snapshot for course ${courseId} (page=${pageContext})`);
        return await populateCourseSnapshot(courseId, courseName, apiClient);
    } else {
        logger.trace(`[Refresh] Using existing snapshot for course ${courseId} (page=${pageContext})`);
        return getCourseSnapshot(courseId);
    }
}

/**
 * Clear all course snapshots from sessionStorage
 *
 * Removes all keys with cg_ prefix (including user ID tracking).
 * Useful for debugging, testing, and logout cleanup.
 *
 * @returns {number} Number of entries removed
 *
 * @example
 * const count = clearAllSnapshots();
 * console.log(`Cleared ${count} snapshots`);
 */
export function clearAllSnapshots() {
    const keys = Object.keys(sessionStorage);
    const snapshotKeys = keys.filter(k => k.startsWith('cg_'));

    snapshotKeys.forEach(k => sessionStorage.removeItem(k));

    logger.debug(`[Snapshot] Cleared all snapshots (${snapshotKeys.length} entries removed)`);
    return snapshotKeys.length;
}

/**
 * Debug function to show all cached snapshots
 *
 * Useful for troubleshooting cache issues.
 *
 * @returns {Object} Map of courseId -> snapshot
 *
 * @example
 * const snapshots = debugSnapshots();
 * console.log('All snapshots:', snapshots);
 */
export function debugSnapshots() {
    const snapshots = {};
    const keys = Object.keys(sessionStorage);

    keys.forEach(key => {
        if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
            const courseId = key.replace(SNAPSHOT_KEY_PREFIX, '');
            try {
                snapshots[courseId] = JSON.parse(sessionStorage.getItem(key));
            } catch (error) {
                snapshots[courseId] = { error: 'Failed to parse' };
            }
        }
    });

    logger.info('[Snapshot] All cached snapshots:', snapshots);
    logger.info(`[Snapshot] Total snapshots: ${Object.keys(snapshots).length}`);

    // Summary statistics
    const stats = {
        total: Object.keys(snapshots).length,
        standardsBased: 0,
        traditional: 0,
        assignmentSource: 0,
        enrollmentSource: 0
    };

    Object.values(snapshots).forEach(snapshot => {
        if (snapshot.error) return;

        if (snapshot.isStandardsBased) stats.standardsBased++;
        else stats.traditional++;

        if (snapshot.gradeSource === 'assignment') stats.assignmentSource++;
        else if (snapshot.gradeSource === 'enrollment') stats.enrollmentSource++;
    });

    logger.info('[Snapshot] Statistics:', stats);

    return snapshots;
}