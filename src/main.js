import { log, logBanner, exposeVersion } from "./utils/logger.js";

function init() {
    // Banner + version stamp
    logBanner(ENV_NAME, BUILD_VERSION);
    exposeVersion(ENV_NAME, BUILD_VERSION);

    if (ENV_DEV) {
        log("Running in DEV mode");
    }

    if (ENV_PROD) {
        log("Running in PROD mode");
    }

    log(`Build environment: ${ENV_NAME}`);
}

init();


