// src/utils/pageDetection.js
/**
 * Page Detection Utilities
 *
 * Shared utilities for detecting different Canvas page types across the application.
 * Used by dashboard, student grade customization, cleanup observer, and other modules.
 *
 * Functions:
 * - isDashboardPage: Check if on Canvas dashboard
 * - isAllGradesPage: Check if on all-grades page (/grades)
 * - isSingleCourseGradesPage: Check if on single course grades page
 * - isCoursePageNeedingCleanup: Check if on course page that needs grade cleanup
 * - isMasteryOutlookPage: Check if on Mastery Outlook page
 */

import {logger} from "./logger.js";

/**
 * Check if current page is the Canvas dashboard
 *
 * Matches:
 * - / (root)
 * - /dashboard
 * - /dashboard/*
 *
 * @returns {boolean} True if on dashboard page
 */
export function isDashboardPage() {
    const path = window.location.pathname;
    return path === "/" || path.startsWith("/dashboard");
}

/**
 * Check if current page is the all-grades page
 *
 * Matches:
 * - /grades (exact)
 * - Any path with /grades but NOT /courses/ (e.g., /users/123/grades)
 *
 * Does NOT match:
 * - /courses/123/grades (single course grades page)
 *
 * @returns {boolean} True if on all-grades page
 */
export function isAllGradesPage() {
    const path = window.location.pathname;
    // All-grades page is /grades without /courses/ in the path
    return path === '/grades' || (path.includes('/grades') && !path.includes('/courses/'));
}

/**
 * Check if current page is a single-course grades page
 *
 * Matches:
 * - /courses/123/grades
 * - /courses/123/grades#tab-outcomes
 * - /courses/123/grades?any=params
 *
 * Does NOT match:
 * - /grades (all-grades page)
 * - /courses/123 (course homepage)
 *
 * @returns {boolean} True if on single-course grades page
 */
export function isSingleCourseGradesPage() {
    return (
        window.location.href.includes('/courses/') &&
        window.location.pathname.includes('/grades')
    );
}

/**
 * Check if current page is a course page that needs grade cleanup
 *
 * Matches:
 * - /courses/123/grades (grades page)
 * - /courses/123/assignments (assignments list)
 * - /courses/123 (course homepage)
 *
 * Does NOT match:
 * - /courses/123/modules (modules page)
 * - /courses/123/settings (settings page)
 * - Other course sub-pages
 *
 * @returns {boolean} True if page needs cleanup
 */
export function isCoursePageNeedingCleanup() {
    const path = window.location.pathname;
    return (
        window.location.href.includes("/courses/") &&
        (
            path.includes("/grades") ||
            path.includes("/assignments") ||
            /^\/courses\/\d+$/.test(path)
        )
    );
}

/**
 * Check if current page is teacher viewing individual student grades
 *
 * Matches:
 * - /courses/123/grades/456 (teacher viewing student 456's grades)
 *
 * Does NOT match:
 * - /courses/123/grades (student's own grades page)
 * - /grades (all-grades page)
 *
 * @returns {boolean} True if teacher viewing student grades
 */
export function isTeacherViewingStudentGrades() {
    const path = window.location.pathname;
    // Pattern: /courses/{courseId}/grades/{studentId}
    return /^\/courses\/\d+\/grades\/\d+/.test(path);
}

/**
 * Check if current page is the gradebook page
 *
 * Matches:
 * - /courses/123/gradebook
 * - /courses/123/gradebook?cid=xxx
 *
 * Does NOT match:
 * - /courses/123/gradebook/speed_grader (SpeedGrader)
 *
 * @returns {boolean} True if on gradebook page
 */
export function isGradebookPage() {
    const path = window.location.pathname;
    return path.includes('/courses/') && path.includes('/gradebook') && !path.includes('/speed_grader');
}

/**
 * Check if current page is Learning Mastery Gradebook (LMGB)
 *
 * LMGB and traditional gradebook share the same URL (/courses/:id/gradebook),
 * so URL-based detection alone cannot distinguish them. This function uses
 * Canvas's ENV.GRADEBOOK_OPTIONS to reliably detect LMGB.
 *
 * Detection method:
 * - Primary: Check if ENV.GRADEBOOK_OPTIONS.settings.gradebook_view === 'learning_mastery'
 * - Fallback: Check if ENV.GRADEBOOK_OPTIONS.outcome_proficiency exists (LMGB-only property)
 *
 * @returns {boolean} True if on Learning Mastery Gradebook
 */
export function isLMGBPage() {
    const opts = window.ENV?.GRADEBOOK_OPTIONS;

    // Primary: Check gradebook_view setting
    if (opts?.settings?.gradebook_view === 'learning_mastery') {
        return true;
    }

    // Fallback: outcome_proficiency only exists on LMGB
    return !!opts?.outcome_proficiency;
}

/**
 * Check if current page is SpeedGrader
 *
 * Matches:
 * - /courses/123/gradebook/speed_grader
 * - /courses/123/gradebook/speed_grader?assignment_id=456&student_id=789
 *
 * @returns {boolean} True if on SpeedGrader page
 */
export function isSpeedGraderPage() {
    return window.location.pathname.includes('/speed_grader');
}

/**
 * Check if current page is course settings page
 *
 * Matches:
 * - /courses/:id/settings
 *
 * @returns {boolean} True if on course settings page
 */
export function isCourseSettingsPage() {
    const path = window.location.pathname;
    return /^\/courses\/\d+\/settings/.test(path);
}

/**
 * Extract student ID from teacher viewing student grades page
 *
 * @returns {string|null} Student ID or null if not on teacher viewing student grades page
 */
export function getStudentIdFromUrl() {
    const path = window.location.pathname;

    // Expected: /courses/:courseId/grades/:studentId  AKA teacher view of a student's grades
    const pattern = /^\/courses\/\d+\/grades\/(\d+)/;
    const match = path.match(pattern);

    if (!match) {
        logger.trace(
            '[getStudentIdFromUrl] No studentId found in URL',
            {path, expectedPattern: pattern.toString()}
        );
    }
    return match ? match[1] : null;
}

/**
 * Resolve the target student ID for grade fetching
 *
 * Handles three scenarios:
 * 1. Teacher viewing a specific student's grades → return student ID from URL
 * 2. Observer viewing observed student's grades → return associated_user_id from enrollment
 * 3. Student viewing their own grades → return current user ID
 *
 * @param {string} [courseId] - Course ID (required for observer detection)
 * @param {Object} [apiClient] - Canvas API client (required for observer detection)
 * @returns {Promise<string|null>} Student ID or null if not found
 */
export async function resolveTargetStudentId(courseId = null, apiClient = null) {
    // Scenario 1: Teacher viewing a specific student
    if (isTeacherViewingStudentGrades()) {
        const studentId = getStudentIdFromUrl();
        logger.trace(`[resolveTargetStudentId] Teacher viewing student ${studentId}`);
        return studentId;
    }

    // Scenario 2: Observer viewing observed student's grades
    // Check if user is an observer and get the associated student ID
    if (courseId && apiClient) {
        try {
            // Fetch enrollments for the current course
            const enrollments = await apiClient.get(
                `/api/v1/courses/${courseId}/enrollments?user_id=self`,
                {},
                'resolveTargetStudentId'
            );

            // Find observer enrollment with associated_user_id
            const observerEnrollment = enrollments.find(e =>
                (e.type === 'observer' || e.type === 'ObserverEnrollment') &&
                e.associated_user_id
            );

            if (observerEnrollment) {
                const studentId = String(observerEnrollment.associated_user_id);
                logger.trace(`[resolveTargetStudentId] Observer viewing student ${studentId} (observer ID: ${ENV?.current_user_id})`);
                return studentId;
            }
        } catch (error) {
            logger.warn(`[resolveTargetStudentId] Failed to fetch enrollments for observer check:`, error.message);
            // Fall through to default behavior
        }
    }

    // Scenario 3: Student (or anyone else) viewing "self"
    const userId = ENV?.current_user_id ? String(ENV.current_user_id) : null;
    logger.trace(`[resolveTargetStudentId] Student/user viewing self: ${userId}`);
    return userId;
}


/**
 * Check if current page is the Mastery Outlook page
 *
 * Matches:
 * - /courses/123/pages/mastery-outlook
 * - /courses/123/pages/mastery-outlook-* (auto-numbered variants)
 *
 * @returns {boolean} True if on mastery outlook page
 */
export function isMasteryOutlookPage() {
    const path = window.location.pathname;
    return path.includes('/pages/mastery-outlook');
}