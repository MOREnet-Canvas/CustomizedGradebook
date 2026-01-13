import { logger, logBanner, exposeVersion } from "./utils/logger.js";
import { injectButtons } from "./gradebook/ui/buttonInjection.js";
import { initDashboardGradeDisplay } from "./dashboard/gradeDisplay.js";

/**
 * Check if current page is the dashboard
 * @returns {boolean} True if on dashboard page
 */
function isDashboardPage() {
    const path = window.location.pathname;
    return path === "/" || path === "/dashboard" || path.startsWith("/dashboard/");
}

(function init() {
    // Banner + version stamp
    logBanner(ENV_NAME, BUILD_VERSION);
    exposeVersion(ENV_NAME, BUILD_VERSION);

    if (ENV_DEV) {logger.info("Running in DEV mode");}
    if (ENV_PROD) {logger.info("Running in PROD mode");}
    logger.info(`Build environment: ${ENV_NAME}`);

    // Gradebook functionality (teacher-side)
    if (window.location.pathname.includes("/gradebook")) {
        injectButtons();
    }

    // Dashboard grade display (student-side)
    if (isDashboardPage()) {
        initDashboardGradeDisplay();
    }

})();


