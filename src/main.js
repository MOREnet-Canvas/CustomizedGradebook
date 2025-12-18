import { logger, logBanner, exposeVersion } from "./utils/logger.js";
import { injectButtons } from "./gradebook/ui/buttonInjection.js";

(function init() {
    // Banner + version stamp
    logBanner(ENV_NAME, BUILD_VERSION);
    exposeVersion(ENV_NAME, BUILD_VERSION);

    if (ENV_DEV) {logger.info("Running in DEV mode");}
    if (ENV_PROD) {logger.info("Running in PROD mode");}
    logger.info(`Build environment: ${ENV_NAME}`);

    if (window.location.pathname.includes("/gradebook")) {injectButtons();}

})();


