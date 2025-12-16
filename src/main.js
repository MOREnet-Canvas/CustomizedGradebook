import { log, logBanner, exposeVersion } from "./utils/logger.js";
//import { VERBOSE_LOGGING, ENABLE_STUDENT_GRADE_CUSTOMIZATION, REMOVE_ASSIGNMENT_TAB } from "./config.js";
//import { getUserRoleGroup, isDashboardPage, courseHasAvgAssignment } from "./utils/canvas.js";
//import { debounce } from "./utils/dom.js";
import { injectButtons } from "./gradebook/ui/buttonInjection.js";

(function init() {
    // Banner + version stamp
    logBanner(ENV_NAME, BUILD_VERSION);
    exposeVersion(ENV_NAME, BUILD_VERSION);

    if (ENV_DEV) {log("Running in DEV mode");}
    if (ENV_PROD) {log("Running in PROD mode");}
    log(`Build environment: ${ENV_NAME}`);

    if (window.location.pathname.includes("/gradebook")) {injectButtons();}

})();


