// src/customGradebookInit.js
/**
 * CustomizedGradebook - Main Entry Point & Initialization
 * 
 * This file serves as the primary entry point for the CustomizedGradebook Canvas extension.
 * It orchestrates the initialization of different modules based on the current Canvas page type.
 * 
 * Responsibilities:
 * - Detect current Canvas page type (dashboard, gradebook, SpeedGrader)
 * - Initialize appropriate modules for each page type
 * - Display version information and logging configuration
 * - Coordinate module loading and startup sequence
 * 
 * Page Type Detection & Module Routing:
 * - Dashboard pages → initDashboardGradeDisplay() (student-side grade display)
 * - Gradebook pages → injectButtons() (teacher-side gradebook customization)
 * - SpeedGrader pages → initSpeedGraderDropdown() (teacher-side grading dropdown activation)
 * - Student pages → initStudentGradeCustomization() (student-side grade normalization)
 */

import { logger, logBanner, exposeVersion } from "./utils/logger.js";
import { injectButtons } from "./gradebook/ui/buttonInjection.js";
import { initAssignmentKebabMenuInjection } from "./gradebook/ui/assignmentKebabMenu.js";
import { initDashboardGradeDisplay } from "./dashboard/gradeDisplay.js";
import { initSpeedGraderDropdown } from "./speedgrader/gradingDropdown.js";
import { initSpeedGraderAutoGrade } from "./speedgrader/speedgraderScoreSync.js";
import { initStudentGradeCustomization } from "./student/studentGradeCustomization.js";
import { initTeacherStudentGradeCustomizer } from "./teacher/teacherStudentGradeCustomizer.js";
import { compareDataSourceApproaches } from "./student/allGradesDataSourceTest.js";
import { clearAllSnapshots, debugSnapshots, validateAllSnapshots, getCourseSnapshot, populateCourseSnapshot } from "./services/courseSnapshotService.js";
import { getUserRoleGroup, getCourseId } from "./utils/canvas.js";
import { isTeacherViewingStudentGrades } from "./utils/pageDetection.js";
import { CanvasApiClient } from "./utils/canvasApiClient.js";

/**
 * Check if current page is the dashboard
 * @returns {boolean} True if on dashboard page
 */
function isDashboardPage() {
    const path = window.location.pathname;
    return path === "/" || path === "/dashboard" || path.startsWith("/dashboard/");
}

/**
 * Check if current page is SpeedGrader
 * @returns {boolean} True if on SpeedGrader page
 */
function isSpeedGraderPage() {
    return window.location.pathname.includes('/speed_grader');
}

/**
 * Main initialization function
 * Immediately invoked on script load to bootstrap the CustomizedGradebook extension
 */
(function init() {
    // Banner + version stamp
    logBanner(ENV_NAME, BUILD_VERSION);
    exposeVersion(ENV_NAME, BUILD_VERSION);

    if (ENV_DEV) {logger.info("Running in DEV mode");}
    if (ENV_PROD) {logger.info("Running in PROD mode");}
    logger.info(`Build environment: ${ENV_NAME}`);

    // Validate all existing snapshots on initialization (security)
    validateAllSnapshots();

    // Gradebook functionality (teacher-side)
    if (window.location.pathname.includes("/gradebook")) {
        injectButtons(); // Always run for all courses

        // Async block for Refresh Mastery initialization (standards-based courses only)
        (async () => {
            // Early course type detection - only initialize Refresh Mastery for standards-based courses
            const courseId = getCourseId();
            if (!courseId) {
                logger.debug('[Init] Cannot get course ID, skipping Refresh Mastery initialization');
                return;
            }

            // Check for existing snapshot
            let snapshot = getCourseSnapshot(courseId);

            // If no snapshot exists, populate it
            if (!snapshot) {
                const apiClient = new CanvasApiClient();
                const courseName = document.querySelector('.course-title, h1, #breadcrumbs li:last-child')?.textContent?.trim() || 'Course';
                snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
            }

            // Skip initialization for traditional courses
            if (!snapshot || snapshot.model !== 'standards') {
                logger.debug('[Init] Course is traditional, skipping Refresh Mastery initialization');
                return;
            }

            // Course is standards-based - proceed with initialization
            logger.debug('[Init] Course is standards-based, initializing Refresh Mastery');
            await initAssignmentKebabMenuInjection();
        })().catch(err => {
            logger.warn('[Init] Failed to initialize assignment kebab menu injection:', err);
        });
    }

    // Dashboard grade display (student-side)
    if (isDashboardPage()) {
        initDashboardGradeDisplay();
    }

    // SpeedGrader grading dropdown auto-activator (teacher-side)
    if (isSpeedGraderPage()) {
        initSpeedGraderDropdown();

        // SpeedGrader auto-grade module (teacher-like only)
        if (getUserRoleGroup() === 'teacher_like') {
            initSpeedGraderAutoGrade();
        }
    }

    // Student grade customization (student-side)
    // Runs on grades pages, dashboard, and course pages for students
    initStudentGradeCustomization();

    // Teacher viewing student grades customization (teacher-side)
    // Runs on /courses/{courseId}/grades/{studentId} for teachers
    if (isTeacherViewingStudentGrades() && getUserRoleGroup() === 'teacher_like') {
        initTeacherStudentGradeCustomizer();
    }

    // Expose debug and utility functions
    if (ENV_DEV) {
        // Test function for all-grades page data source comparison
        window.CG_testAllGradesDataSources = compareDataSourceApproaches;

        // Snapshot debugging and management
        window.CG_clearAllSnapshots = clearAllSnapshots;
        window.CG_debugSnapshots = debugSnapshots;

        logger.debug('Debug functions exposed:');
        logger.debug('  - window.CG_testAllGradesDataSources()');
        logger.debug('  - window.CG_clearAllSnapshots() - Clear all cached snapshots');
        logger.debug('  - window.CG_debugSnapshots() - Show all cached snapshots');
    }

    // Always expose clearAllSnapshots for logout/user change scenarios
    if (!window.CG) window.CG = {};
    window.CG.clearAllSnapshots = clearAllSnapshots;




})();