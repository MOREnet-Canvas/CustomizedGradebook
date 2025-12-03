export function log(...args) {
    console.log("[DEV]", ...args);
}

export function logBanner(envName, buildVersion) {
    console.log(
        "%cCustomized Gradebook Loaded",
        "color:#4CAF50; font-weight:bold;"
    );
    console.log(`Environment: ${envName}`);
    console.log(`Build Version: ${buildVersion}`);
}

export function exposeVersion(envName, buildVersion) {
    window.CG = {
        env: envName,
        version: buildVersion,
    };
}
