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
 * - No TTL-based invalidation (session-scoped, explicit refresh only)
 *
 * Snapshot Structure:
 * {
 *   courseId: string,
 *   courseName: string,
 *   isStandardsBased: boolean,
 *   score: number,
 *   letterGrade: string|null,
 *   gradeSource: 'assignment' | 'enrollment',
 *   timestamp: number  // For debugging, not for TTL
 * }
 *
 * @module services/courseSnapshotService
 */

import { logger } from '../utils/logger.js';
import { isStandardsBasedCourse } from '../utils/courseDetection.js';
import { getCourseGrade } from './gradeDataService.js';

/**
 * Key prefix for all course snapshots in sessionStorage
 */
const SNAPSHOT_KEY_PREFIX = 'cg_courseSnapshot_';

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
 * Get course snapshot from sessionStorage (read-only access for consumers)
 *
 * This is the ONLY way consumers should access course data.
 * Consumers must NEVER independently detect course type or compute grades.
 *
 * @param {string} courseId - Course ID
 * @returns {Object|null} Course snapshot or null if not found
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
    const key = `${SNAPSHOT_KEY_PREFIX}${courseId}`;
    const cached = sessionStorage.getItem(key);

    if (!cached) {
        logger.trace(`[Snapshot] Cache MISS for course ${courseId}`);
        return null;
    }

    try {
        const snapshot = JSON.parse(cached);
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

        // Step 2: Detect course type with letter grade (SINGLE SOURCE OF TRUTH)
        logger.trace(`[Snapshot] Step 2: Detecting course type for ${courseId} with letterGrade="${gradeData.letterGrade}"...`);
        const isStandardsBased = await isStandardsBasedCourse({
            courseId,
            courseName,
            letterGrade: gradeData.letterGrade,
            apiClient,
            skipApiCheck: false
        });
        logger.trace(`[Snapshot] Course ${courseId} detection result: isStandardsBased=${isStandardsBased}`);

        // Step 3: Create unified snapshot
        const snapshot = {
            courseId,
            courseName,
            isStandardsBased,
            score: gradeData.score,
            letterGrade: gradeData.letterGrade,
            gradeSource: gradeData.source,
            timestamp: Date.now()
        };

        // Step 4: Write to sessionStorage
        const key = `${SNAPSHOT_KEY_PREFIX}${courseId}`;
        sessionStorage.setItem(key, JSON.stringify(snapshot));

        logger.debug(`[Snapshot] ✅ Populated snapshot for course ${courseId}: isStandardsBased=${isStandardsBased}, score=${gradeData.score}, source=${gradeData.source}`);

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
 * Refresh Rules:
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
 * Removes all keys with cg_ prefix.
 * Useful for debugging and testing.
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