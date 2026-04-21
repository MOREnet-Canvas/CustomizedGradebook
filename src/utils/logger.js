// src/utils/logger.js
/**
 * Logging Utility
 *
 * Provides a centralized logging system with multiple log levels.
 * Log level is automatically determined by build environment (ENV_DEV/ENV_PROD)
 * and can be overridden via URL parameter (?debug=true, ?debug=trace, or ?debug=false).
 *
 * Log Levels:
 * - TRACE (-1): Very detailed debugging for high-frequency operations (only with ?debug=trace)
 * - DEBUG (0): Detailed debugging information (only in dev mode or with ?debug=true)
 * - INFO (1): Important operational messages (always shown)
 * - WARN (2): Warning messages (always shown)
 * - ERROR (3): Error messages (always shown)
 *
 * Usage:
 * ```javascript
 * import { logger } from "./utils/logger.js";
 *
 * logger.trace("Very detailed info in loops", data); // Only with ?debug=trace
 * logger.debug("Detailed info", data);
 * logger.info("Important message");
 * logger.warn("Warning message");
 * logger.error("Error message", error);
 * ```
 */

/**
 * Log level constants
 */
const LOG_LEVELS = {
    TRACE: -1,
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

/** sessionStorage key used to persist debug level across page navigations */
const SESSION_KEY = 'cg_debug';

/**
 * Determine the current log level.
 *
 * Priority (highest wins):
 *   1. URL parameter (?debug=true | trace | false) — also writes to sessionStorage
 *      so subsequent navigations in the same tab inherit the level automatically.
 *   2. sessionStorage key "cg_debug" — set once, persists for the browser session.
 *      Activate:  sessionStorage.setItem('cg_debug', 'true')   // or 'trace'
 *      Deactivate: sessionStorage.removeItem('cg_debug')         // then reload
 *   3. Build-time default (DEBUG in dev builds, INFO in prod builds).
 *
 * @returns {number} Current log level
 */
function determineLogLevel() {
    // Build-time default
    let logLevel = ENV_DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

    // 1. sessionStorage override (lower priority than URL param)
    try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored === 'trace')      logLevel = LOG_LEVELS.TRACE;
        else if (stored === 'true')  logLevel = LOG_LEVELS.DEBUG;
        else if (stored === 'false') logLevel = LOG_LEVELS.INFO;
    } catch (e) {
        // sessionStorage may be blocked in some private-browsing configurations
    }

    // 2. URL parameter override — takes priority and persists to sessionStorage
    try {
        const debugParam = new URLSearchParams(window.location.search).get('debug');

        if (debugParam === 'trace') {
            logLevel = LOG_LEVELS.TRACE;
            sessionStorage.setItem(SESSION_KEY, 'trace');
            console.log('[CG] Trace mode enabled via URL — persisted for this session.',
                'To clear: sessionStorage.removeItem("cg_debug")');
        } else if (debugParam === 'true') {
            logLevel = LOG_LEVELS.DEBUG;
            sessionStorage.setItem(SESSION_KEY, 'true');
            console.log('[CG] Debug mode enabled via URL — persisted for this session.',
                'To clear: sessionStorage.removeItem("cg_debug")');
        } else if (debugParam === 'false') {
            logLevel = LOG_LEVELS.INFO;
            sessionStorage.removeItem(SESSION_KEY);
            console.log('[CG] Debug mode disabled and cleared from session storage.');
        }
    } catch (e) {
        console.warn('[CG] Failed to read URL parameters for debug mode:', e);
    }

    return logLevel;
}

// Current log level (determined once at module load)
const currentLogLevel = determineLogLevel();

/**
 * Logger object with methods for each log level
 */
export const logger = {
    /**
     * Log trace messages (only shown with ?debug=trace)
     * Used for very detailed debugging in high-frequency operations like loops
     * @param {...any} args - Arguments to log
     */
    trace(...args) {
        if (currentLogLevel <= LOG_LEVELS.TRACE) {
            console.log("%c[TRACE]", "color: #888888", ...args);
        }
    },

    /**
     * Log debug messages (only shown in dev mode or with ?debug=true)
     * @param {...any} args - Arguments to log
     */
    debug(...args) {
        if (currentLogLevel <= LOG_LEVELS.DEBUG) {
            console.log("[DEBUG]", ...args);
        }
    },

    /**
     * Log informational messages (always shown)
     * @param {...any} args - Arguments to log
     */
    info(...args) {
        if (currentLogLevel <= LOG_LEVELS.INFO) {
            console.log("[INFO]", ...args);
        }
    },

    /**
     * Log warning messages (always shown)
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
        if (currentLogLevel <= LOG_LEVELS.WARN) {
            console.warn("[WARN]", ...args);
        }
    },

    /**
     * Log error messages (always shown)
     * @param {...any} args - Arguments to log
     */
    error(...args) {
        if (currentLogLevel <= LOG_LEVELS.ERROR) {
            console.error("[ERROR]", ...args);
        }
    },

    /**
     * Check if trace logging is enabled
     * @returns {boolean} True if trace logging is enabled
     */
    isTraceEnabled() {
        return currentLogLevel <= LOG_LEVELS.TRACE;
    },

    /**
     * Check if debug logging is enabled
     * @returns {boolean} True if debug logging is enabled
     */
    isDebugEnabled() {
        return currentLogLevel <= LOG_LEVELS.DEBUG;
    },

    /**
     * Get the current log level
     * @returns {number} Current log level
     */
    getLogLevel() {
        return currentLogLevel;
    }
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use logger.debug() instead
 */
export function log(...args) {
    logger.debug(...args);
}

/**
 * Display the application banner on startup
 * @param {string} envName - Environment name (dev/prod)
 * @param {string} buildVersion - Build version string
 */
export function logBanner(envName, buildVersion) {
    console.log(
        "%cCustomized Gradebook Loaded",
        "color:#4CAF50; font-weight:bold;"
    );
    console.log(`Environment: ${envName}`);
    console.log(`Build Version: ${buildVersion}`);

    // Show debug mode status
    if (logger.isTraceEnabled()) {
        console.log("%cTrace logging: ENABLED (very verbose)", "color:#888888; font-weight:bold;");
    } else if (logger.isDebugEnabled()) {
        console.log("%cDebug logging: ENABLED", "color:#FF9800; font-weight:bold;");
    } else {
        console.log("Debug logging: disabled");
    }
}

/**
 * Expose version information on window object
 * @param {string} envName - Environment name (dev/prod)
 * @param {string} buildVersion - Build version string
 */
export function exposeVersion(envName, buildVersion) {
    window.CG = {
        env: envName,
        version: buildVersion,
        traceEnabled: logger.isTraceEnabled(),
        debugEnabled: logger.isDebugEnabled(),
        logLevel: currentLogLevel
    };
}