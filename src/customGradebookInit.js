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
import { initStudentGradeCustomization } from "./student/studentGradeCustomization.js";
import { compareDataSourceApproaches } from "./student/allGradesDataSourceTest.js";
import { clearAllSnapshots, debugSnapshots, validateAllSnapshots } from "./services/courseSnapshotService.js";

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
        injectButtons();
        initAssignmentKebabMenuInjection();
    }

    // Dashboard grade display (student-side)
    if (isDashboardPage()) {
        initDashboardGradeDisplay();
    }

    // SpeedGrader grading dropdown auto-activator (teacher-side)
    if (isSpeedGraderPage()) {
        initSpeedGraderDropdown();
    }

    // Student grade customization (student-side)
    // Runs on grades pages, dashboard, and course pages for students
    initStudentGradeCustomization();

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