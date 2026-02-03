(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __typeError = (msg) => {
    throw TypeError(msg);
  };
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __objRest = (source, exclude) => {
    var target = {};
    for (var prop in source)
      if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
        target[prop] = source[prop];
    if (source != null && __getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(source)) {
        if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
          target[prop] = source[prop];
      }
    return target;
  };
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

  // src/utils/logger.js
  var LOG_LEVELS = {
    TRACE: -1,
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };
  function determineLogLevel() {
    let logLevel = true ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const debugParam = urlParams.get("debug");
      if (debugParam === "trace") {
        logLevel = LOG_LEVELS.TRACE;
      } else if (debugParam === "true") {
        logLevel = LOG_LEVELS.DEBUG;
      } else if (debugParam === "false") {
        logLevel = LOG_LEVELS.INFO;
      }
    } catch (e) {
      console.warn("Failed to parse URL parameters for debug mode:", e);
    }
    return logLevel;
  }
  var currentLogLevel = determineLogLevel();
  var logger = {
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
  function logBanner(envName, buildVersion) {
    console.log(
      "%cCustomized Gradebook Loaded",
      "color:#4CAF50; font-weight:bold;"
    );
    console.log(`Environment: ${envName}`);
    console.log(`Build Version: ${buildVersion}`);
    if (logger.isTraceEnabled()) {
      console.log("%cTrace logging: ENABLED (very verbose)", "color:#888888; font-weight:bold;");
    } else if (logger.isDebugEnabled()) {
      console.log("%cDebug logging: ENABLED", "color:#FF9800; font-weight:bold;");
    } else {
      console.log("Debug logging: disabled");
    }
  }
  function exposeVersion(envName, buildVersion) {
    window.CG = {
      env: envName,
      version: buildVersion,
      traceEnabled: logger.isTraceEnabled(),
      debugEnabled: logger.isDebugEnabled(),
      logLevel: currentLogLevel
    };
  }

  // src/utils/dom.js
  function inheritFontStylesFrom(selector, element) {
    const source = document.querySelector(selector);
    if (source) {
      const styles = getComputedStyle(source);
      element.style.fontSize = styles.fontSize;
      element.style.fontFamily = styles.fontFamily;
      element.style.fontWeight = styles.fontWeight;
      return true;
    }
    return false;
  }
  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // src/ui/buttons.js
  var BRAND_COLOR_FALLBACK = "#0c7d9d";
  function makeButton({ label, id = null, onClick = null, type = "primary", tooltip = null }) {
    const button = document.createElement("button");
    button.textContent = label;
    if (id) button.id = id;
    if (tooltip) button.title = tooltip;
    const foundFontStyles = inheritFontStylesFrom(".css-1f65ace-view-link", button);
    if (!foundFontStyles) {
      button.style.fontSize = "14px";
      button.style.fontFamily = "inherit";
      button.style.fontWeight = "600";
    }
    button.style.marginLeft = "1rem";
    button.style.padding = "0.5rem 1rem";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.cursor = "pointer";
    button.style.transition = "background 0.3s, color 0.3s";
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryButtonColor = rootStyles.getPropertyValue("--ic-brand-button--primary-bgd").trim() || BRAND_COLOR_FALLBACK;
    const textColor = rootStyles.getPropertyValue("--ic-brand-button--primary-text").trim() || "#ffffff";
    const secondaryButtonColor = rootStyles.getPropertyValue("--ic-brand-button--secondary-bgd").trim() || "#e0e0e0";
    const secondaryTextColor = rootStyles.getPropertyValue("--ic-brand-button--secondary-text").trim() || "#ffffff";
    if (type === "primary") {
      button.style.background = primaryButtonColor;
      button.style.color = textColor;
    } else if (type === "secondary") {
      button.style.background = secondaryButtonColor;
      button.style.color = secondaryTextColor;
      button.style.border = "1px solid #ccc";
    }
    if (onClick) {
      button.addEventListener("click", onClick);
    }
    return button;
  }
  function createButtonColumnContainer() {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "row";
    container.style.gap = "0.01rem";
    container.style.marginLeft = "1rem";
    return container;
  }

  // src/config.js
  var _a, _b;
  var ENABLE_STUDENT_GRADE_CUSTOMIZATION = (_b = (_a = window.CG_CONFIG) == null ? void 0 : _a.ENABLE_STUDENT_GRADE_CUSTOMIZATION) != null ? _b : true;
  var _a2, _b2;
  var REMOVE_ASSIGNMENT_TAB = (_b2 = (_a2 = window.CG_CONFIG) == null ? void 0 : _a2.REMOVE_ASSIGNMENT_TAB) != null ? _b2 : false;
  var _a3, _b3;
  var PER_STUDENT_UPDATE_THRESHOLD = (_b3 = (_a3 = window.CG_CONFIG) == null ? void 0 : _a3.PER_STUDENT_UPDATE_THRESHOLD) != null ? _b3 : 25;
  var _a4, _b4;
  var MASTERY_REFRESH_ENABLED = (_b4 = (_a4 = window.CG_CONFIG) == null ? void 0 : _a4.MASTERY_REFRESH_ENABLED) != null ? _b4 : true;
  var _a5, _b5;
  var ENABLE_OUTCOME_UPDATES = (_b5 = (_a5 = window.CG_CONFIG) == null ? void 0 : _a5.ENABLE_OUTCOME_UPDATES) != null ? _b5 : true;
  var _a6, _b6;
  var ENABLE_GRADE_OVERRIDE = (_b6 = (_a6 = window.CG_CONFIG) == null ? void 0 : _a6.ENABLE_GRADE_OVERRIDE) != null ? _b6 : true;
  var defaultOverrideScale = (avg) => Number((avg * 25).toFixed(2));
  var _a7, _b7;
  var OVERRIDE_SCALE = (_b7 = (_a7 = window.CG_CONFIG) == null ? void 0 : _a7.OVERRIDE_SCALE) != null ? _b7 : defaultOverrideScale;
  var _a8, _b8;
  var UPDATE_AVG_BUTTON_LABEL = (_b8 = (_a8 = window.CG_CONFIG) == null ? void 0 : _a8.UPDATE_AVG_BUTTON_LABEL) != null ? _b8 : "Update Current Score";
  var _a9, _b9;
  var AVG_OUTCOME_NAME = (_b9 = (_a9 = window.CG_CONFIG) == null ? void 0 : _a9.AVG_OUTCOME_NAME) != null ? _b9 : "Current Score";
  var _a10, _b10;
  var AVG_ASSIGNMENT_NAME = (_b10 = (_a10 = window.CG_CONFIG) == null ? void 0 : _a10.AVG_ASSIGNMENT_NAME) != null ? _b10 : "Current Score Assignment";
  var _a11, _b11;
  var AVG_RUBRIC_NAME = (_b11 = (_a11 = window.CG_CONFIG) == null ? void 0 : _a11.AVG_RUBRIC_NAME) != null ? _b11 : "Current Score Rubric";
  var _a12, _b12;
  var DEFAULT_MAX_POINTS = (_b12 = (_a12 = window.CG_CONFIG) == null ? void 0 : _a12.DEFAULT_MAX_POINTS) != null ? _b12 : 4;
  var _a13, _b13;
  var DEFAULT_MASTERY_THRESHOLD = (_b13 = (_a13 = window.CG_CONFIG) == null ? void 0 : _a13.DEFAULT_MASTERY_THRESHOLD) != null ? _b13 : 3;
  var defaultRatings = [
    { description: "Exemplary", points: 4 },
    { description: "Beyond Target", points: 3.5 },
    { description: "Target", points: 3 },
    { description: "Approaching Target", points: 2.5 },
    { description: "Developing", points: 2 },
    { description: "Beginning", points: 1.5 },
    { description: "Needs Partial Support", points: 1 },
    { description: "Needs Full Support", points: 0.5 },
    { description: "No Evidence", points: 0 }
  ];
  var _a14, _b14;
  var OUTCOME_AND_RUBRIC_RATINGS = (_b14 = (_a14 = window.CG_CONFIG) == null ? void 0 : _a14.OUTCOME_AND_RUBRIC_RATINGS) != null ? _b14 : defaultRatings;
  var defaultExcludedKeywords = [];
  var _a15, _b15;
  var EXCLUDED_OUTCOME_KEYWORDS = (_b15 = (_a15 = window.CG_CONFIG) == null ? void 0 : _a15.EXCLUDED_OUTCOME_KEYWORDS) != null ? _b15 : defaultExcludedKeywords;
  var defaultStandardsBasedPatterns = [
    "Standards Based",
    "SBG",
    "Mastery",
    /\[SBG\]/i,
    /^SBG[-\s]/i
  ];
  var _a16, _b16;
  var STANDARDS_BASED_COURSE_PATTERNS = (_b16 = (_a16 = window.CG_CONFIG) == null ? void 0 : _a16.STANDARDS_BASED_COURSE_PATTERNS) != null ? _b16 : defaultStandardsBasedPatterns;
  var _a17, _b17;
  var MASTERY_REFRESH_DELAY_MS = (_b17 = (_a17 = window.CG_CONFIG) == null ? void 0 : _a17.MASTERY_REFRESH_DELAY_MS) != null ? _b17 : 5e3;

  // src/utils/canvas.js
  function extractCourseIdFromHref(href) {
    const match = href.match(/^\/courses\/(\d+)\b/);
    return match ? match[1] : null;
  }
  function getCourseId() {
    const envCourseId = ENV == null ? void 0 : ENV.COURSE_ID;
    const pathCourseId = extractCourseIdFromHref(window.location.pathname);
    const courseId = envCourseId || pathCourseId;
    if (!courseId) {
      logger.error("Course ID not found on page.");
      return null;
    }
    return courseId;
  }
  function getUserRoleGroup() {
    const userId = (ENV == null ? void 0 : ENV.current_user_id) ? String(ENV.current_user_id) : "unknown_user";
    const cacheKeyGroup = `roleGroup_${userId}`;
    const cacheKeyDebug = `roleGroup_debug_${userId}`;
    const cachedGroup = sessionStorage.getItem(cacheKeyGroup);
    if (cachedGroup) {
      return cachedGroup;
    }
    const collected = /* @__PURE__ */ new Set();
    if (Array.isArray(ENV == null ? void 0 : ENV.current_user_roles)) {
      ENV.current_user_roles.forEach((r) => collected.add(String(r)));
    }
    if (Array.isArray(ENV == null ? void 0 : ENV.current_user_types)) {
      ENV.current_user_types.forEach((r) => collected.add(String(r)));
    }
    if (ENV == null ? void 0 : ENV.current_user_is_admin) collected.add("admin");
    if (ENV == null ? void 0 : ENV.current_user_is_student) collected.add("student");
    if (ENV == null ? void 0 : ENV.current_user_is_teacher) collected.add("teacher");
    if (ENV == null ? void 0 : ENV.current_user_is_observer) collected.add("observer");
    const normRoles = Array.from(collected).map((r) => r.toLowerCase());
    logger.debug("[role debug] userId:", userId);
    logger.debug("[role debug] normalized roles:", normRoles);
    const teacherLike = ["teacher", "admin", "root_admin", "designer", "ta", "accountadmin"];
    const studentLike = ["student", "observer"];
    let group = "other";
    if (normRoles.some((r) => studentLike.includes(r))) {
      group = "student_like";
    } else if (normRoles.some((r) => teacherLike.includes(r))) {
      group = "teacher_like";
    }
    sessionStorage.setItem(cacheKeyGroup, group);
    sessionStorage.setItem(
      cacheKeyDebug,
      JSON.stringify({ userId, normRoles, decided: group })
    );
    return group;
  }

  // src/utils/errorHandler.js
  var CanvasApiError = class extends Error {
    constructor(message, statusCode, responseText) {
      super(message);
      this.name = "CanvasApiError";
      this.statusCode = statusCode;
      this.responseText = responseText;
    }
  };
  var UserCancelledError = class extends Error {
    constructor(message = "User cancelled the operation") {
      super(message);
      this.name = "UserCancelledError";
    }
  };
  var TimeoutError = class extends Error {
    constructor(message, timeoutMs) {
      super(message);
      this.name = "TimeoutError";
      this.timeoutMs = timeoutMs;
    }
  };
  var ValidationError = class extends Error {
    constructor(message, field) {
      super(message);
      this.name = "ValidationError";
      this.field = field;
    }
  };
  function logError(error, context, metadata = {}) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const errorInfo = __spreadValues({
      timestamp,
      context,
      name: error.name,
      message: error.message
    }, metadata);
    logger.error(`[${context}] ${error.name}: ${error.message}`, errorInfo);
    if (logger.isDebugEnabled() && error.stack) {
      logger.error("Stack trace:", error.stack);
    }
    if (error instanceof CanvasApiError) {
      logger.error(`  Status: ${error.statusCode}`);
      if (logger.isDebugEnabled() && error.responseText) {
        logger.error(`  Response: ${error.responseText}`);
      }
    } else if (error instanceof TimeoutError) {
      logger.error(`  Timeout: ${error.timeoutMs}ms`);
    } else if (error instanceof ValidationError && error.field) {
      logger.error(`  Field: ${error.field}`);
    }
  }
  function getUserFriendlyMessage(error) {
    if (error instanceof UserCancelledError) {
      return error.message || "Operation cancelled.";
    }
    if (error instanceof TimeoutError) {
      return "The operation took too long and timed out. Please try again.";
    }
    if (error instanceof ValidationError) {
      return error.message;
    }
    if (error instanceof CanvasApiError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        return "You don't have permission to perform this action.";
      }
      if (error.statusCode === 404) {
        return "The requested resource was not found.";
      }
      if (error.statusCode >= 500) {
        return "Canvas server error. Please try again later.";
      }
      return `Canvas API error: ${error.message}`;
    }
    const message = error.message || "An unknown error occurred";
    const technicalKeywords = ["fetch", "JSON", "undefined", "null", "parse", "response"];
    const isTechnical = technicalKeywords.some(
      (keyword) => message.toLowerCase().includes(keyword.toLowerCase())
    );
    if (isTechnical) {
      return "An unexpected error occurred. Please try again or contact support.";
    }
    return message;
  }
  function handleError(error, context, options = {}) {
    const { showAlert = false, banner = null, metadata = {} } = options;
    logError(error, context, metadata);
    const userMessage = getUserFriendlyMessage(error);
    if (banner && typeof banner.setText === "function") {
      banner.setText(userMessage);
    }
    if (showAlert && !(error instanceof UserCancelledError)) {
      alert(userMessage);
    }
    return userMessage;
  }
  async function safeFetch(url, options = {}, context = "fetch") {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const responseText = await response.text();
        throw new CanvasApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          responseText
        );
      }
      return response;
    } catch (error) {
      if (error instanceof CanvasApiError) {
        throw error;
      }
      throw new CanvasApiError(
        `Network error: ${error.message}`,
        0,
        null
      );
    }
  }
  async function safeJsonParse(response, context = "parseJSON") {
    const rawText = await response.text();
    try {
      return JSON.parse(rawText);
    } catch (error) {
      if (logger.isDebugEnabled()) {
        logger.error(`[${context}] Failed to parse JSON:`, rawText);
      }
      throw new CanvasApiError(
        "Invalid JSON response from Canvas API",
        response.status,
        rawText
      );
    }
  }

  // src/gradebook/stateMachine.js
  var STATES = {
    IDLE: "IDLE",
    CHECKING_SETUP: "CHECKING_SETUP",
    CREATING_OUTCOME: "CREATING_OUTCOME",
    CREATING_ASSIGNMENT: "CREATING_ASSIGNMENT",
    CREATING_RUBRIC: "CREATING_RUBRIC",
    CALCULATING: "CALCULATING",
    UPDATING_GRADES: "UPDATING_GRADES",
    POLLING_PROGRESS: "POLLING_PROGRESS",
    VERIFYING: "VERIFYING",
    VERIFYING_OVERRIDES: "VERIFYING_OVERRIDES",
    COMPLETE: "COMPLETE",
    ERROR: "ERROR"
  };
  var VALID_TRANSITIONS = {
    [STATES.IDLE]: [STATES.CHECKING_SETUP],
    [STATES.CHECKING_SETUP]: [STATES.CREATING_OUTCOME, STATES.CREATING_ASSIGNMENT, STATES.CREATING_RUBRIC, STATES.CALCULATING, STATES.ERROR],
    [STATES.CREATING_OUTCOME]: [STATES.CHECKING_SETUP, STATES.ERROR],
    [STATES.CREATING_ASSIGNMENT]: [STATES.CHECKING_SETUP, STATES.ERROR],
    [STATES.CREATING_RUBRIC]: [STATES.CHECKING_SETUP, STATES.ERROR],
    [STATES.CALCULATING]: [STATES.UPDATING_GRADES, STATES.COMPLETE, STATES.ERROR],
    [STATES.UPDATING_GRADES]: [STATES.POLLING_PROGRESS, STATES.VERIFYING, STATES.ERROR],
    [STATES.POLLING_PROGRESS]: [STATES.POLLING_PROGRESS, STATES.VERIFYING, STATES.ERROR],
    [STATES.VERIFYING]: [STATES.VERIFYING, STATES.VERIFYING_OVERRIDES, STATES.ERROR],
    [STATES.VERIFYING_OVERRIDES]: [STATES.VERIFYING_OVERRIDES, STATES.COMPLETE, STATES.ERROR],
    [STATES.COMPLETE]: [STATES.IDLE],
    [STATES.ERROR]: [STATES.IDLE]
  };
  var UpdateFlowStateMachine = class {
    /**
     * Create a new state machine
     * @param {string} initialState - Initial state (default: IDLE)
     * @param {object} initialContext - Initial context data
     */
    constructor(initialState = STATES.IDLE, initialContext = {}) {
      this.currentState = initialState;
      this.context = __spreadValues({
        courseId: null,
        outcomeId: null,
        assignmentId: null,
        rubricId: null,
        rubricCriterionId: null,
        rollupData: null,
        averages: null,
        progressId: null,
        startTime: null,
        numberOfUpdates: 0,
        banner: null,
        error: null,
        retryCount: 0,
        updateMode: null
      }, initialContext);
      this.eventListeners = {};
      this.stateHistory = [initialState];
    }
    /**
     * Get the current state
     * @returns {string} Current state name
     */
    getCurrentState() {
      return this.currentState;
    }
    /**
     * Get the current context
     * @returns {object} Current context data
     */
    getContext() {
      return __spreadValues({}, this.context);
    }
    /**
     * Update context data
     * @param {object} updates - Context updates to merge
     */
    updateContext(updates) {
      this.context = __spreadValues(__spreadValues({}, this.context), updates);
    }
    /**
     * Check if a transition is valid
     * @param {string} toState - Target state
     * @returns {boolean} True if transition is valid
     */
    canTransition(toState) {
      const validStates = VALID_TRANSITIONS[this.currentState] || [];
      return validStates.includes(toState);
    }
    /**
     * Transition to a new state
     * @param {string} toState - Target state
     * @param {object} contextUpdates - Optional context updates
     * @throws {Error} If transition is invalid
     */
    transition(toState, contextUpdates = {}) {
      var _a18;
      if (!this.canTransition(toState)) {
        throw new Error(
          `Invalid transition from ${this.currentState} to ${toState}. Valid transitions: ${((_a18 = VALID_TRANSITIONS[this.currentState]) == null ? void 0 : _a18.join(", ")) || "none"}`
        );
      }
      const fromState = this.currentState;
      this.currentState = toState;
      this.stateHistory.push(toState);
      this.updateContext(contextUpdates);
      logger.debug(`State transition: ${fromState} \u2192 ${toState}`);
      this.emit("stateChange", {
        from: fromState,
        to: toState,
        context: this.getContext()
      });
    }
    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    on(event, callback) {
      if (!this.eventListeners[event]) {
        this.eventListeners[event] = [];
      }
      this.eventListeners[event].push(callback);
    }
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
      const listeners = this.eventListeners[event] || [];
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
    /**
     * Get state history
     * @returns {array} Array of state names in order
     */
    getStateHistory() {
      return [...this.stateHistory];
    }
    /**
     * Reset state machine to IDLE
     */
    reset() {
      this.currentState = STATES.IDLE;
      this.context = {
        courseId: this.context.courseId,
        // Keep courseId
        outcomeId: null,
        assignmentId: null,
        rubricId: null,
        rubricCriterionId: null,
        rollupData: null,
        averages: null,
        progressId: null,
        startTime: null,
        numberOfUpdates: 0,
        banner: null,
        error: null,
        retryCount: 0,
        updateMode: null
      };
      this.stateHistory = [STATES.IDLE];
      logger.debug("State machine reset to IDLE");
      this.emit("reset", {});
    }
  };

  // src/utils/canvasApiClient.js
  var _CanvasApiClient_instances, getTokenCookie_fn, makeRequest_fn;
  var CanvasApiClient = class {
    /**
     * Create a new Canvas API client
     * @throws {Error} If CSRF token is not found in cookies
     */
    constructor() {
      __privateAdd(this, _CanvasApiClient_instances);
      this.csrfToken = __privateMethod(this, _CanvasApiClient_instances, getTokenCookie_fn).call(this, "_csrf_token");
      if (!this.csrfToken) {
        throw new Error("CSRF token not found - user may not be authenticated");
      }
      logger.debug("CanvasApiClient initialized with cached CSRF token");
    }
    /**
     * Make a GET request to the Canvas API
     * @param {string} url - API endpoint URL (e.g., '/api/v1/courses/123/assignments')
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async get(url, options = {}, context = "get") {
      return __privateMethod(this, _CanvasApiClient_instances, makeRequest_fn).call(this, url, "GET", null, options, context);
    }
    /**
     * Make a POST request to the Canvas API
     * @param {string} url - API endpoint URL
     * @param {Object} data - Request body data
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async post(url, data, options = {}, context = "post") {
      return __privateMethod(this, _CanvasApiClient_instances, makeRequest_fn).call(this, url, "POST", data, options, context);
    }
    /**
     * Make a PUT request to the Canvas API
     * @param {string} url - API endpoint URL
     * @param {Object} data - Request body data
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async put(url, data, options = {}, context = "put") {
      return __privateMethod(this, _CanvasApiClient_instances, makeRequest_fn).call(this, url, "PUT", data, options, context);
    }
    /**
     * Make a DELETE request to the Canvas API
     * @param {string} url - API endpoint URL
     * @param {Object} options - Additional fetch options
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async delete(url, options = {}, context = "delete") {
      return __privateMethod(this, _CanvasApiClient_instances, makeRequest_fn).call(this, url, "DELETE", null, options, context);
    }
    /**
     * Make a GraphQL request to the Canvas API
     * @param {string} query - GraphQL query string
     * @param {Object} variables - GraphQL variables (optional)
     * @param {string} context - Context for error logging (optional)
     * @returns {Promise<any>} Parsed JSON response
     */
    async graphql(query, variables = {}, context = "graphql") {
      const url = "/api/graphql";
      const data = { query, variables };
      const options = {
        headers: {
          "Content-Type": "application/json"
        }
      };
      return __privateMethod(this, _CanvasApiClient_instances, makeRequest_fn).call(this, url, "POST", data, options, context);
    }
  };
  _CanvasApiClient_instances = new WeakSet();
  /**
   * Get CSRF token from browser cookies
   * @private
   * @param {string} name - Cookie name
   * @returns {string|null} Cookie value or null if not found
   */
  getTokenCookie_fn = function(name) {
    const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
    for (const cookie of cookies) {
      const [key, value] = cookie.split("=", 2);
      if (key === name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  };
  makeRequest_fn = async function(url, method, data, options = {}, context = "request") {
    const headers = __spreadProps(__spreadValues({
      "Content-Type": "application/json"
    }, options.headers), {
      "X-CSRF-Token": this.csrfToken
    });
    let body = null;
    if (data) {
      const contentType = headers["Content-Type"] || "application/json";
      const isJson = contentType.includes("application/json");
      if (isJson) {
        if (!data.authenticity_token) {
          data = __spreadProps(__spreadValues({}, data), { authenticity_token: this.csrfToken });
        }
        body = JSON.stringify(data);
      } else {
        body = data;
      }
    }
    const _a18 = options, { headers: _optionsHeaders } = _a18, restOptions = __objRest(_a18, ["headers"]);
    const response = await safeFetch(
      url,
      __spreadValues({
        method,
        credentials: "same-origin",
        headers,
        body
      }, restOptions),
      context
    );
    return await safeJsonParse(response, context);
  };

  // src/services/gradeOverrideVerification.js
  async function enableCourseOverride(courseId, apiClient2) {
    if (!ENABLE_GRADE_OVERRIDE) {
      logger.debug("Grade override is disabled in config, skipping");
      return false;
    }
    try {
      logger.debug("Enabling final grade override for course");
      await apiClient2.put(
        `/api/v1/courses/${courseId}/settings`,
        {
          allow_final_grade_override: true
        },
        {},
        "enableCourseOverride"
      );
      logger.info("Final grade override enabled for course");
      return true;
    } catch (error) {
      logger.error("Failed to enable final grade override:", error);
      throw error;
    }
  }
  async function fetchOverrideGrades(courseId, apiClient2) {
    var _a18;
    if (!ENABLE_GRADE_OVERRIDE) {
      logger.debug("Grade override is disabled in config, skipping fetch");
      return /* @__PURE__ */ new Map();
    }
    try {
      const response = await apiClient2.get(
        `/courses/${courseId}/gradebook/final_grade_overrides`,
        {},
        "fetchOverrideGrades"
      );
      const overrideMap = /* @__PURE__ */ new Map();
      const overrides = response.final_grade_overrides || {};
      for (const [userId, data] of Object.entries(overrides)) {
        const percentage = (_a18 = data == null ? void 0 : data.course_grade) == null ? void 0 : _a18.percentage;
        if (percentage !== null && percentage !== void 0) {
          overrideMap.set(userId, percentage);
          logger.trace(`Override grade for user ${userId}: ${percentage}%`);
        }
      }
      logger.debug(`Fetched ${overrideMap.size} override grades from Canvas API`);
      return overrideMap;
    } catch (error) {
      logger.error("Failed to fetch override grades:", error);
      throw error;
    }
  }
  async function verifyOverrideScores(courseId, averages, enrollmentMap, apiClient2, tolerance = 0.01) {
    if (!ENABLE_GRADE_OVERRIDE) {
      logger.debug("Grade override is disabled in config, skipping verification");
      return [];
    }
    try {
      const overrideGrades = await fetchOverrideGrades(courseId, apiClient2);
      const mismatches = [];
      let matchCount = 0;
      logger.debug(`Verifying ${averages.length} students' override grades...`);
      for (const { userId, average } of averages) {
        const expectedPercentage = OVERRIDE_SCALE(average);
        const actualPercentage = overrideGrades.get(String(userId));
        const enrollmentId = enrollmentMap.get(String(userId));
        logger.trace(`User ${userId}: expected=${expectedPercentage}%, actual=${actualPercentage}%`);
        if (actualPercentage === null || actualPercentage === void 0) {
          mismatches.push({
            userId,
            enrollmentId,
            expected: expectedPercentage,
            actual: null,
            reason: "No override grade found"
          });
          logger.trace(`  \u274C No override grade found for user ${userId}`);
          continue;
        }
        const diff = Math.abs(actualPercentage - expectedPercentage);
        if (diff > tolerance) {
          mismatches.push({
            userId,
            enrollmentId,
            expected: expectedPercentage,
            actual: actualPercentage,
            diff
          });
          logger.trace(`  \u274C Mismatch: expected ${expectedPercentage}%, got ${actualPercentage}% (diff: ${diff.toFixed(2)}%)`);
        } else {
          matchCount++;
          logger.trace(`  \u2713 Match: ${actualPercentage}%`);
        }
      }
      logger.debug(`Override verification complete: ${matchCount} matches, ${mismatches.length} mismatches`);
      if (mismatches.length > 0) {
        logger.debug(`Mismatches found:`, mismatches.map((m) => ({
          userId: m.userId,
          expected: m.expected,
          actual: m.actual,
          diff: m.diff
        })));
      }
      return mismatches;
    } catch (error) {
      logger.error("Failed to verify override scores:", error);
      throw error;
    }
  }

  // src/services/gradeCalculator.js
  function buildOutcomeMap(data) {
    var _a18, _b18;
    const map = {};
    ((_b18 = (_a18 = data == null ? void 0 : data.linked) == null ? void 0 : _a18.outcomes) != null ? _b18 : []).forEach((o) => {
      map[String(o.id)] = o.title;
    });
    return map;
  }
  function getCurrentOutcomeScore(scores, outcomeId) {
    var _a18;
    const match = scores.find((s) => {
      var _a19;
      return String((_a19 = s.links) == null ? void 0 : _a19.outcome) === String(outcomeId);
    });
    return (_a18 = match == null ? void 0 : match.score) != null ? _a18 : null;
  }
  function getRelevantScores(scores, outcomeMap, excludedOutcomeIds, excludedKeywords) {
    return scores.filter((s) => {
      var _a18;
      const id = String((_a18 = s.links) == null ? void 0 : _a18.outcome);
      const title = (outcomeMap[id] || "").toLowerCase();
      return typeof s.score === "number" && !excludedOutcomeIds.has(id) && !excludedKeywords.some((keyword) => title.includes(keyword.toLowerCase()));
    });
  }
  function computeAverage(scores) {
    const total = scores.reduce((sum, s) => sum + s.score, 0);
    return Number((total / scores.length).toFixed(2));
  }
  function needsOutcomeUpdate(oldAverage, newAverage) {
    return oldAverage !== newAverage;
  }
  function needsOverrideUpdate(userId, newAverage, overrideGrades, overrideScaleFn) {
    if (!overrideGrades || overrideGrades.size === 0) return false;
    const expected = overrideScaleFn(newAverage);
    const actual = overrideGrades.get(String(userId));
    if (actual === null || actual === void 0) return true;
    return Math.abs(actual - expected) > 0.01;
  }
  function logStudentCalculation(userId, relevantScores, oldAverage, newAverage, outcomeUpdate, overrideUpdate, overrideGrades, overrideScaleFn) {
    const total = relevantScores.reduce((sum, s) => sum + s.score, 0);
    logger.trace(`User ${userId}: total=${total}, count=${relevantScores.length}, average=${newAverage}`);
    logger.trace(`  Old average: ${oldAverage}, New average: ${newAverage}`);
    if (ENABLE_GRADE_OVERRIDE && overrideGrades.size > 0) {
      const expected = overrideScaleFn(newAverage);
      const actual = overrideGrades.get(String(userId));
      if (actual === null || actual === void 0) {
        logger.trace(`  Override: missing (expected ${expected}%) - needs update`);
      } else {
        const diff = Math.abs(actual - expected);
        if (diff > 0.01) {
          logger.trace(`  Override: mismatch (expected ${expected}%, got ${actual}%) - needs update`);
        } else {
          logger.trace(`  Override: matches (${actual}%)`);
        }
      }
    }
    if (outcomeUpdate || overrideUpdate) {
      if (outcomeUpdate && overrideUpdate) {
        logger.trace(`  \u2713 Including user ${userId}: both outcome and override need updates`);
      } else if (outcomeUpdate) {
        logger.trace(`  \u2713 Including user ${userId}: outcome needs update`);
      } else {
        logger.trace(`  \u2713 Including user ${userId}: override needs update`);
      }
    } else {
      logger.trace(`  \u2717 Skipping user ${userId}: no updates needed`);
    }
  }
  async function calculateStudentAverages(data, outcomeId, courseId, apiClient2) {
    var _a18, _b18, _c, _d;
    logger.info("Calculating student averages...");
    logger.debug(`Grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);
    const outcomeMap = buildOutcomeMap(data);
    const excludedOutcomeIds = /* @__PURE__ */ new Set([String(outcomeId)]);
    let overrideGrades = /* @__PURE__ */ new Map();
    if (ENABLE_GRADE_OVERRIDE && courseId && apiClient2) {
      try {
        logger.debug("Fetching current override grades for initial check...");
        overrideGrades = await fetchOverrideGrades(courseId, apiClient2);
        logger.debug(`Fetched ${overrideGrades.size} override grades for comparison`);
      } catch (error) {
        logger.warn("Failed to fetch override grades for initial check, continuing without override checking:", error);
      }
    }
    const results = [];
    for (const rollup of (_a18 = data == null ? void 0 : data.rollups) != null ? _a18 : []) {
      const userId = (_b18 = rollup.links) == null ? void 0 : _b18.user;
      if (!userId) continue;
      const oldAverage = getCurrentOutcomeScore((_c = rollup.scores) != null ? _c : [], outcomeId);
      const relevantScores = getRelevantScores(
        (_d = rollup.scores) != null ? _d : [],
        outcomeMap,
        excludedOutcomeIds,
        EXCLUDED_OUTCOME_KEYWORDS
      );
      if (relevantScores.length === 0) continue;
      const newAverage = computeAverage(relevantScores);
      const outcomeUpdate = ENABLE_OUTCOME_UPDATES && needsOutcomeUpdate(oldAverage, newAverage);
      const overrideUpdate = ENABLE_GRADE_OVERRIDE && needsOverrideUpdate(userId, newAverage, overrideGrades, OVERRIDE_SCALE);
      logStudentCalculation(
        userId,
        relevantScores,
        oldAverage,
        newAverage,
        outcomeUpdate,
        overrideUpdate,
        overrideGrades,
        OVERRIDE_SCALE
      );
      if (outcomeUpdate || overrideUpdate) {
        results.push({ userId, average: newAverage });
      }
    }
    logger.debug(`Calculation complete: ${results.length} students need updates`);
    if (ENABLE_OUTCOME_UPDATES && ENABLE_GRADE_OVERRIDE && overrideGrades.size > 0) {
      logger.debug(`  (checked both outcome scores and override grades)`);
    } else if (ENABLE_OUTCOME_UPDATES) {
      logger.debug(`  (checked outcome scores only)`);
    } else if (ENABLE_GRADE_OVERRIDE) {
      logger.debug(`  (checked override grades only)`);
    }
    return results;
  }

  // src/utils/uiHelpers.js
  function getElapsedTimeSinceStart(stateMachine, endTime = Date.now()) {
    if (!stateMachine) return 0;
    const context = stateMachine.getContext();
    if (!context.startTime) return 0;
    const startMs = new Date(context.startTime).getTime();
    const endMs = endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime();
    return Math.floor((endMs - startMs) / 1e3);
  }
  function startElapsedTimer(stateMachine, box) {
    if (!stateMachine || !box) return;
    const node = box.querySelector(".floating-banner__text") || box;
    stopElapsedTimer(box);
    const re = /\(Elapsed time:\s*\d+s\)/;
    const tick = () => {
      const elapsed = getElapsedTimeSinceStart(stateMachine);
      const current = node.textContent || "";
      if (re.test(current)) {
        node.textContent = current.replace(re, `(Elapsed time: ${elapsed}s)`);
      } else {
        node.textContent = current.trim().length ? `${current} (Elapsed time: ${elapsed}s)` : `(Elapsed time: ${elapsed}s)`;
      }
    };
    tick();
    box._elapsedTimerId = setInterval(tick, 1e3);
  }
  function stopElapsedTimer(box) {
    if (box && box._elapsedTimerId) {
      clearInterval(box._elapsedTimerId);
      delete box._elapsedTimerId;
    }
  }
  function renderLastUpdateNotice(container, courseId) {
    let row = container.querySelector("#avg-last-update");
    if (!row) {
      row = document.createElement("div");
      row.id = "avg-last-update";
      row.style.fontSize = "12px";
      row.style.marginTop = "4px";
      row.style.opacity = "0.8";
      container.appendChild(row);
    }
    const lastAt = localStorage.getItem(`lastUpdateAt_${courseId}`);
    const durSec = parseInt(localStorage.getItem(`duration_${courseId}`), 10);
    const formatDuration = (s) => Number.isFinite(s) ? `${Math.floor(s / 60)}m ${s % 60}s` : "N/A";
    row.textContent = lastAt ? `Last update: ${new Date(lastAt).toLocaleString()} | Duration: ${formatDuration(durSec)}` : `Last update: none yet`;
  }

  // src/services/gradeOverride.js
  var __enrollmentMapCache = /* @__PURE__ */ new Map();
  async function setOverrideScoreGQL(enrollmentId, overrideScore, apiClient2) {
    var _a18, _b18, _c, _d, _e;
    const query = `
    mutation SetOverride($enrollmentId: ID!, $overrideScore: Float!) {
      setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        grades { customGradeStatusId overrideScore __typename }
        __typename
      }
    }`;
    const json = await apiClient2.graphql(
      query,
      {
        enrollmentId: String(enrollmentId),
        overrideScore: Number(overrideScore)
      },
      "setOverrideScoreGQL"
    );
    if (json.errors) {
      const error = new Error(`GQL error: ${JSON.stringify(json.errors)}`);
      logError(error, "setOverrideScoreGQL", { enrollmentId, overrideScore });
      throw error;
    }
    return (_e = (_d = (_c = (_b18 = (_a18 = json.data) == null ? void 0 : _a18.setOverrideScore) == null ? void 0 : _b18.grades) == null ? void 0 : _c[0]) == null ? void 0 : _d.overrideScore) != null ? _e : null;
  }
  async function getAllEnrollmentIds(courseId, apiClient2) {
    const courseKey = String(courseId);
    if (__enrollmentMapCache.has(courseKey)) {
      return __enrollmentMapCache.get(courseKey);
    }
    const map = /* @__PURE__ */ new Map();
    let url = `/api/v1/courses/${courseKey}/enrollments?type[]=StudentEnrollment&per_page=100`;
    while (url) {
      const data = await apiClient2.get(url, {}, "getAllEnrollmentIds");
      for (const e of data) {
        if ((e == null ? void 0 : e.user_id) && (e == null ? void 0 : e.id)) map.set(String(e.user_id), String(e.id));
      }
      url = null;
    }
    __enrollmentMapCache.set(courseKey, map);
    return map;
  }
  async function getEnrollmentIdForUser(courseId, userId, apiClient2) {
    const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient2);
    return enrollmentMap.get(String(userId)) || null;
  }

  // src/services/gradeSubmission.js
  async function submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, score, apiClient2) {
    if (!ENABLE_OUTCOME_UPDATES) {
      logger.trace(`Outcome updates disabled, skipping rubric score submission for user ${userId}`);
      return;
    }
    const timeStamp = (/* @__PURE__ */ new Date()).toLocaleString();
    logger.trace("Submitting rubric score for student", userId);
    const payload = {
      rubric_assessment: {
        // updates the rubric score.
        [rubricCriterionId.toString()]: {
          points: score
        }
      },
      submission: {
        //updates assignment score to match rubric score.
        posted_grade: score.toString(),
        score
      },
      comment: {
        text_comment: "Score: " + score + "  Updated: " + timeStamp
      }
    };
    logger.trace("Submitting rubric score for student", userId, payload);
    await apiClient2.put(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      payload,
      {},
      `submitRubricScore:${userId}`
    );
    logger.trace("Score submitted successfully for user", userId);
  }
  async function beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages, apiClient2) {
    if (!ENABLE_OUTCOME_UPDATES) {
      logger.debug("Outcome updates disabled, skipping bulk update");
      return "SKIPPED_NO_OUTCOME_UPDATES";
    }
    const timeStamp = (/* @__PURE__ */ new Date()).toLocaleString();
    const gradeData = {};
    logger.debug("averages:", averages);
    for (const { userId, average } of averages) {
      logger.trace("userId:", userId, "score:", average);
      gradeData[userId] = {
        posted_grade: average,
        text_comment: "Score: " + average + "  Updated: " + timeStamp,
        rubric_assessment: {
          [rubricCriterionId.toString()]: {
            points: average
          }
        }
      };
    }
    logger.debug("bulk gradeData payload:", gradeData);
    const result = await apiClient2.post(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/update_grades`,
      {
        grade_data: gradeData
      },
      {},
      "beginBulkUpdate"
    );
    const progressId = result.id;
    localStorage.setItem(`progressId_${getCourseId()}`, progressId);
    logger.info("Waiting for grading to complete progress ID:", progressId);
    return progressId;
  }
  async function waitForBulkGrading(box, apiClient2, stateMachine, timeout = 12e5, interval = 2e3) {
    const loopStartTime = Date.now();
    let state = "beginning upload";
    const courseId = getCourseId();
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    startElapsedTimer(stateMachine, box);
    while (Date.now() - loopStartTime < timeout) {
      const progress = await apiClient2.get(`/api/v1/progress/${progressId}`, {}, "waitForBulkGrading");
      let elapsed = getElapsedTimeSinceStart(stateMachine);
      state = progress.workflow_state;
      logger.debug(`Bulk Uploading Status: ${state} (elapsed: ${elapsed}s)`);
      if (state !== "completed") {
        box.soft(`Bulk uploading status: ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
      }
      switch (state) {
        case "queued":
          break;
        case "running":
          break;
        case "failed":
          logger.error("Bulk update job failed.");
          throw new Error("Bulk update failed.");
        case "completed":
          logger.info("Bulk upload completed: " + progress.updated_at);
          return;
        default:
          break;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new TimeoutError(
      `Bulk update is taking longer than expected. In a few minutes try updating again. If there are no changes to be made the update completed`,
      timeout
    );
  }
  async function postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, apiClient2, testing = false) {
    const updateInterval = 1;
    const numberOfUpdates = averages.length;
    logger.debug(`Per-student grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);
    const updateMessage = ENABLE_OUTCOME_UPDATES && ENABLE_GRADE_OVERRIDE ? `Updating "${AVG_OUTCOME_NAME}" and grade overrides for ${numberOfUpdates} students...` : ENABLE_OUTCOME_UPDATES ? `Updating "${AVG_OUTCOME_NAME}" scores for ${numberOfUpdates} students...` : `Updating grade overrides for ${numberOfUpdates} students...`;
    box.setText(updateMessage);
    const failedUpdates = [];
    const retryCounts = {};
    const retriedStudents = /* @__PURE__ */ new Set();
    async function tryUpdateStudent(student, maxAttempts = 3) {
      const { userId, average } = student;
      let lastError = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, average, apiClient2);
          if (ENABLE_GRADE_OVERRIDE) {
            try {
              const enrollmentId = await getEnrollmentIdForUser(courseId, userId, apiClient2);
              if (enrollmentId) {
                const override = OVERRIDE_SCALE(average);
                await setOverrideScoreGQL(enrollmentId, override, apiClient2);
                logger.debug(`[override] user ${userId} \u2192 enrollment ${enrollmentId}: ${override}`);
              } else {
                logger.warn(`[override] no enrollmentId for user ${userId}`);
              }
            } catch (e) {
              logger.warn(`[override] failed for user ${userId}:`, (e == null ? void 0 : e.message) || e);
            }
          }
          retryCounts[userId] = attempt;
          if (attempt > 1) retriedStudents.add(userId);
          return true;
        } catch (err) {
          lastError = err;
          if (attempt === 1) retryCounts[userId] = 1;
          else retryCounts[userId]++;
          logger.warn(`Attempt ${attempt} failed for student ${userId}:`, err.message);
        }
      }
      return lastError;
    }
    const deferred = [];
    for (let i = 0; i < numberOfUpdates; i++) {
      const student = averages[i];
      const result = await tryUpdateStudent(student, 3);
      if (result !== true) {
        deferred.push(__spreadProps(__spreadValues({}, student), { error: result.message }));
      }
      if (i % updateInterval === 0 || i === numberOfUpdates - 1) {
        box.setText(`Updating "${AVG_OUTCOME_NAME}"  ${i + 1} of ${numberOfUpdates} students processed`);
      }
    }
    logger.info(`Retrying ${deferred.length} students...`);
    for (const student of deferred) {
      const retryResult = await tryUpdateStudent(student, 3);
      if (retryResult !== true) {
        failedUpdates.push({
          userId: student.userId,
          average: student.average,
          error: retryResult.message
        });
      }
    }
    const totalRetried = retriedStudents.size;
    const retrySummary = Object.entries(retryCounts).filter(([_, count]) => count > 1).map(([userId, count]) => ({ userId, attempts: count }));
    logger.info(`${totalRetried} students needed more than one attempt.`);
    console.table(retrySummary);
    let confirmSummaryDownload = false;
    if (testing) {
      confirmSummaryDownload = true;
    }
    if (failedUpdates.length > 0) {
      logger.warn("Scores of the following students failed to update:", failedUpdates);
    }
    if ((failedUpdates.length > 0 || retrySummary.length > 0) && !testing) {
      confirmSummaryDownload = confirm(`Export grade update attempt counts and failure logs to a file? 


           Note: Your browser settings or extensions may block automatic file downloads.

           If nothing downloads, please check your pop-up or download permissions.`);
    }
    if (confirmSummaryDownload) {
      downloadErrorSummary(retrySummary, failedUpdates);
    }
    return getElapsedTimeSinceStart();
  }
  function downloadErrorSummary(retryCounts, failedUpdates) {
    const note = 'Unless marked "UPDATE FAILED", the students score was successfully updated but took multiple attempts.\n';
    const headers = "User ID,Average Score,Attempts,Status,Error\n";
    const failedById = Object.fromEntries(
      failedUpdates.map((d) => [d.userId, d])
    );
    const allUserIds = /* @__PURE__ */ new Set([
      ...retryCounts.map((r) => r.userId),
      ...Object.keys(failedById)
    ]);
    const retryCountsById = Object.fromEntries(
      retryCounts.map((r) => [r.userId, r.attempts])
    );
    const rows = Array.from(allUserIds).map((userId) => {
      var _a18, _b18;
      const attempts = (_a18 = retryCountsById[userId]) != null ? _a18 : "";
      const failed = failedById[userId];
      const average = (_b18 = failed == null ? void 0 : failed.average) != null ? _b18 : "";
      const status = failed ? "UPDATE FAILED" : "";
      const error = (failed == null ? void 0 : failed.error) ? `"${failed.error.replace(/"/g, '""')}"` : "";
      return `${userId},${average},${attempts},${status},${error}`;
    });
    const content = note + headers + rows.join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "canvas_upload_error_summary.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  // src/services/avgOutcomeVerification.js
  async function verifyUIScores(courseId, averages, outcomeId, box, apiClient2, stateMachine, waitTimeMs = 5e3, maxRetries = 50) {
    let state = "verifying";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let elapsed = getElapsedTimeSinceStart(stateMachine);
      box.soft(`Status ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
      startElapsedTimer(stateMachine, box);
      const newRollupData = await apiClient2.get(
        `/api/v1/courses/${courseId}/outcome_rollups?outcome_ids[]=${outcomeId}&include[]=outcomes&include[]=users&per_page=100`,
        {},
        "verifyUIScores"
      );
      logger.debug("newRollupData: ", newRollupData);
      const mismatches = [];
      for (const { userId, average } of averages) {
        const matchingRollup = newRollupData.rollups.find(
          (r) => r.links.user.toString() === userId.toString()
        );
        if (!matchingRollup) {
          mismatches.push({ userId, reason: "No rollup found." });
          continue;
        }
        const scoreObj = matchingRollup.scores[0];
        if (!scoreObj) {
          mismatches.push({ userId, reason: "No score found." });
          continue;
        }
        const score = scoreObj.score;
        const matches = Math.abs(score - average) < 1e-3;
        if (!matches) {
          mismatches.push({ userId, expected: average, actual: score });
        }
      }
      if (mismatches.length === 0) {
        logger.info("All averages match backend scores.");
        localStorage.setItem(`lastUpdateAt_${getCourseId()}`, (/* @__PURE__ */ new Date()).toISOString());
        const durationSeconds = getElapsedTimeSinceStart(stateMachine);
        localStorage.setItem(`duration_${getCourseId()}`, durationSeconds);
        return;
      } else {
        logger.warn("Mismatches found:", mismatches);
        logger.info(`Waiting ${waitTimeMs / 1e3} seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      }
    }
  }

  // src/services/outcomeService.js
  async function getRollup(courseId, apiClient2) {
    const rollupData = await apiClient2.get(
      `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
      {},
      "getRollup"
    );
    logger.debug("rollupData: ", rollupData);
    return rollupData;
  }
  function getOutcomeObjectByName(data) {
    var _a18, _b18;
    const outcomeTitle = AVG_OUTCOME_NAME;
    logger.debug("Outcome Title:", outcomeTitle);
    logger.debug("data:", data);
    const outcomes = (_b18 = (_a18 = data == null ? void 0 : data.linked) == null ? void 0 : _a18.outcomes) != null ? _b18 : [];
    logger.debug("outcomes: ", outcomes);
    if (outcomes.length === 0) {
      logger.warn("No outcomes found in rollup data.");
      return null;
    }
    const match = outcomes.find((o) => o.title === outcomeTitle);
    logger.debug("match: ", match);
    if (!match) {
      logger.warn(`Outcome not found: "${outcomeTitle}"`);
    }
    return match != null ? match : null;
  }
  async function createOutcome(courseId, apiClient2) {
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const vendorGuid = `MOREnet_${randomSuffix}`;
    const ratingsCsv = OUTCOME_AND_RUBRIC_RATINGS.map((r) => `${r.points},"${r.description}"`).join(",");
    const csvContent = `vendor_guid,object_type,title,description,calculation_method,mastery_points
"${vendorGuid}",outcome,"${AVG_OUTCOME_NAME}","Auto-generated outcome: ${AVG_OUTCOME_NAME}",latest,"${DEFAULT_MASTERY_THRESHOLD}",${ratingsCsv}`;
    logger.debug("Importing outcome via CSV...");
    const importData = await apiClient2.post(
      `/api/v1/courses/${courseId}/outcome_imports?import_type=instructure_csv`,
      csvContent,
      {
        headers: {
          "Content-Type": "text/csv"
        }
      },
      "createOutcome"
    );
    const importId = importData.id;
    logger.debug(`Outcome import started: ID ${importId}`);
    let attempts = 0;
    let status = null;
    const maxAttempts = 15;
    const pollIntervalMs = 2e3;
    while (attempts++ < maxAttempts) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const pollData = await apiClient2.get(
        `/api/v1/courses/${courseId}/outcome_imports/${importId}`,
        {},
        "createOutcome:poll"
      );
      const state = pollData.workflow_state;
      logger.debug(`Poll attempt ${attempts}: ${state}`);
      if (state === "succeeded") {
        status = pollData;
        break;
      } else if (state === "failed") {
        throw new Error("Outcome import failed");
      }
    }
    if (!status) {
      throw new TimeoutError(
        "Timed out waiting for outcome import to complete",
        maxAttempts * pollIntervalMs
      );
    }
    logger.debug("Outcome fully created");
  }

  // src/services/assignmentService.js
  async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject, apiClient2) {
    var _a18;
    const alignments = (_a18 = outcomeObject.alignments) != null ? _a18 : [];
    for (const alignment of alignments) {
      if (!alignment.startsWith("assignment_")) continue;
      const assignmentId = alignment.split("_")[1];
      try {
        const assignment = await apiClient2.get(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
          {},
          "getAssignment"
        );
        if (assignment.name === AVG_ASSIGNMENT_NAME) {
          logger.debug("Assignment found:", assignment);
          return assignment;
        }
      } catch (error) {
        logger.debug(`Assignment ${assignmentId} not accessible:`, error.message);
        continue;
      }
    }
    logger.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in alignments`);
    return null;
  }
  async function createAssignment(courseId, apiClient2) {
    const payload = {
      assignment: {
        name: AVG_ASSIGNMENT_NAME,
        position: 1,
        submission_types: ["none"],
        // no student submissions needed
        published: true,
        notify_of_update: true,
        points_possible: DEFAULT_MAX_POINTS,
        grading_type: "gpa_scale",
        omit_from_final_grade: true
      }
    };
    const assignment = await apiClient2.post(
      `/api/v1/courses/${courseId}/assignments`,
      payload,
      {},
      "createAssignment"
    );
    logger.info("Assignment created:", assignment.name);
    return assignment.id;
  }

  // src/services/rubricService.js
  async function getRubricForAssignment(courseId, assignmentId, apiClient2) {
    const assignment = await apiClient2.get(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
      {},
      "getRubric"
    );
    const rubricSettings = assignment.rubric_settings;
    if (!rubricSettings || rubricSettings.title !== AVG_RUBRIC_NAME) {
      return null;
    }
    const rubricCriteria = assignment.rubric;
    if (!rubricCriteria || !Array.isArray(rubricCriteria) || rubricCriteria.length === 0) {
      return null;
    }
    const criterionId = rubricCriteria[0].id;
    const rubricId = rubricSettings.id;
    logger.debug("Found rubric and first criterion ID:", { rubricId, criterionId });
    return { rubricId, criterionId };
  }
  async function createRubric(courseId, assignmentId, outcomeId, apiClient2) {
    const rubricRatings = {};
    OUTCOME_AND_RUBRIC_RATINGS.forEach((rating, index) => {
      rubricRatings[index] = {
        description: rating.description,
        points: rating.points
      };
    });
    const rubricPayload = {
      "rubric": {
        "title": AVG_RUBRIC_NAME,
        "free_form_criterion_comments": false,
        "criteria": {
          "0": {
            "description": `${AVG_OUTCOME_NAME} criteria was used to create this rubric`,
            "criterion_use_range": false,
            "points": DEFAULT_MAX_POINTS,
            "mastery_points": DEFAULT_MASTERY_THRESHOLD,
            "learning_outcome_id": outcomeId,
            "ratings": rubricRatings
          }
        }
      },
      rubric_association: {
        association_type: "Assignment",
        association_id: assignmentId,
        use_for_grading: true,
        purpose: "grading",
        hide_points: true
      }
    };
    const rubric = await apiClient2.post(
      `/api/v1/courses/${courseId}/rubrics`,
      rubricPayload,
      {},
      "createRubric"
    );
    logger.debug("Rubric created and linked to outcome:", rubric);
    return rubric.id;
  }

  // src/utils/canvasHelpers.js
  async function getAssignmentId(courseId) {
    const response = await fetch(`/api/v1/courses/${courseId}/assignments?per_page=100`);
    const assignments = await response.json();
    const avgAssignment = assignments.find((a) => a.name === AVG_ASSIGNMENT_NAME);
    return avgAssignment ? avgAssignment.id : null;
  }

  // src/gradebook/stateHandlers.js
  async function handleCheckingSetup(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    const setupMessage = ENABLE_OUTCOME_UPDATES ? `Checking setup for "${AVG_OUTCOME_NAME}"...` : "Checking setup for grade overrides...";
    banner.setText(setupMessage);
    logger.debug(`Grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);
    const data = await getRollup(courseId, apiClient2);
    stateMachine.updateContext({ rollupData: data });
    if (ENABLE_OUTCOME_UPDATES) {
      const outcomeObj = getOutcomeObjectByName(data);
      const outcomeId = outcomeObj == null ? void 0 : outcomeObj.id;
      if (!outcomeId) {
        const confirmCreate = confirm(`Outcome "${AVG_OUTCOME_NAME}" not found.
Would you like to create it?`);
        if (!confirmCreate) throw new UserCancelledError("User declined to create missing outcome.");
        return STATES.CREATING_OUTCOME;
      }
      stateMachine.updateContext({ outcomeId });
      let assignmentObj = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj, apiClient2);
      if (!assignmentObj) {
        const assignmentIdFromName = await getAssignmentId(courseId);
        if (assignmentIdFromName) {
          assignmentObj = await apiClient2.get(
            `/api/v1/courses/${courseId}/assignments/${assignmentIdFromName}`,
            {},
            "getAssignment:fallback"
          );
          logger.debug("Fallback assignment found by name:", assignmentObj);
        }
      }
      const assignmentId = assignmentObj == null ? void 0 : assignmentObj.id;
      if (!assignmentId) {
        const confirmCreate = confirm(`Assignment "${AVG_ASSIGNMENT_NAME}" not found.
Would you like to create it?`);
        if (!confirmCreate) throw new UserCancelledError("User declined to create missing assignment.");
        return STATES.CREATING_ASSIGNMENT;
      }
      stateMachine.updateContext({ assignmentId });
      const result = await getRubricForAssignment(courseId, assignmentId, apiClient2);
      const rubricId = result == null ? void 0 : result.rubricId;
      const rubricCriterionId = result == null ? void 0 : result.criterionId;
      if (!rubricId) {
        const confirmCreate = confirm(`Rubric "${AVG_RUBRIC_NAME}" not found.
Would you like to create it?`);
        if (!confirmCreate) throw new UserCancelledError("User declined to create missing rubric.");
        return STATES.CREATING_RUBRIC;
      }
      stateMachine.updateContext({ rubricId, rubricCriterionId });
    } else {
      logger.debug("Outcome updates disabled, skipping outcome/assignment/rubric checks");
      const outcomeObj = getOutcomeObjectByName(data);
      const outcomeId = outcomeObj == null ? void 0 : outcomeObj.id;
      if (outcomeId) {
        stateMachine.updateContext({ outcomeId });
        logger.debug(`Found outcomeId ${outcomeId} for exclusion from average calculation`);
      } else {
        logger.debug("No outcome found - will calculate averages without excluding any outcome");
      }
    }
    if (ENABLE_GRADE_OVERRIDE) {
      try {
        await enableCourseOverride(courseId, apiClient2);
      } catch (error) {
        logger.warn("Failed to enable course override, continuing anyway:", error);
      }
    }
    return STATES.CALCULATING;
  }
  async function handleCreatingOutcome(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    banner.setText(`Creating "${AVG_OUTCOME_NAME}" Outcome...`);
    await createOutcome(courseId, apiClient2);
    return STATES.CHECKING_SETUP;
  }
  async function handleCreatingAssignment(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    banner.setText(`Creating "${AVG_ASSIGNMENT_NAME}" Assignment...`);
    const assignmentId = await createAssignment(courseId, apiClient2);
    stateMachine.updateContext({ assignmentId });
    return STATES.CHECKING_SETUP;
  }
  async function handleCreatingRubric(stateMachine) {
    const { courseId, assignmentId, outcomeId, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    banner.setText(`Creating "${AVG_RUBRIC_NAME}" Rubric...`);
    const rubricId = await createRubric(courseId, assignmentId, outcomeId, apiClient2);
    stateMachine.updateContext({ rubricId });
    return STATES.CHECKING_SETUP;
  }
  async function handleCalculating(stateMachine) {
    const { rollupData, outcomeId, courseId, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    const calculatingMessage = ENABLE_OUTCOME_UPDATES ? `Calculating "${AVG_OUTCOME_NAME}" scores...` : "Calculating student averages for grade overrides...";
    banner.setText(calculatingMessage);
    const averages = await calculateStudentAverages(rollupData, outcomeId, courseId, apiClient2);
    const numberOfUpdates = averages.length;
    stateMachine.updateContext({
      averages,
      numberOfUpdates,
      startTime: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (numberOfUpdates === 0) {
      stateMachine.updateContext({ zeroUpdates: true });
      return STATES.COMPLETE;
    }
    return STATES.UPDATING_GRADES;
  }
  async function handleUpdatingGrades(stateMachine) {
    const { averages, courseId, assignmentId, rubricCriterionId, numberOfUpdates, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    if (!ENABLE_OUTCOME_UPDATES) {
      logger.debug("Outcome updates disabled, skipping UPDATING_GRADES state");
      return STATES.VERIFYING;
    }
    const usePerStudent = numberOfUpdates < PER_STUDENT_UPDATE_THRESHOLD;
    const updateMode = usePerStudent ? "per-student" : "bulk";
    stateMachine.updateContext({ updateMode });
    if (usePerStudent) {
      const message = `Detected ${numberOfUpdates} changes - updating scores one at a time for quicker processing.`;
      banner.hold(message, 3e3);
      logger.debug("Per student update...");
      await postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, banner, apiClient2, false);
      logger.debug(`handleUpdatingGrades complete, transitioning to VERIFYING`);
      return STATES.VERIFYING;
    } else {
      const message = `Detected ${numberOfUpdates} changes - using bulk update`;
      banner.hold(message, 3e3);
      logger.debug(`Bulk update, detected ${numberOfUpdates} changes`);
      const progressId = await beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages, apiClient2);
      stateMachine.updateContext({ progressId });
      logger.debug(`progressId: ${progressId}`);
      logger.debug(`handleUpdatingGrades complete, transitioning to POLLING_PROGRESS`);
      return STATES.POLLING_PROGRESS;
    }
  }
  async function handlePollingProgress(stateMachine) {
    const { banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    logger.debug("Starting bulk update polling...");
    await waitForBulkGrading(banner, apiClient2, stateMachine);
    logger.debug(`handlePollingProgress complete, transitioning to VERIFYING`);
    return STATES.VERIFYING;
  }
  async function handleVerifying(stateMachine) {
    const { courseId, averages, outcomeId, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    if (!ENABLE_OUTCOME_UPDATES) {
      logger.debug("Outcome updates disabled, skipping VERIFYING state");
      return STATES.VERIFYING_OVERRIDES;
    }
    logger.debug("Starting outcome score verification...");
    await verifyUIScores(courseId, averages, outcomeId, banner, apiClient2, stateMachine);
    logger.debug(`handleVerifying complete, transitioning to VERIFYING_OVERRIDES`);
    return STATES.VERIFYING_OVERRIDES;
  }
  async function handleVerifyingOverrides(stateMachine) {
    const { courseId, averages, banner } = stateMachine.getContext();
    const apiClient2 = new CanvasApiClient();
    if (!ENABLE_GRADE_OVERRIDE) {
      logger.debug("Grade override disabled, skipping VERIFYING_OVERRIDES state");
      return STATES.COMPLETE;
    }
    logger.debug("Starting grade override submission and verification...");
    banner.soft("Submitting grade overrides...");
    let successCount = 0;
    let failCount = 0;
    for (const { userId, average } of averages) {
      try {
        const enrollmentId = await getEnrollmentIdForUser(courseId, userId, apiClient2);
        if (!enrollmentId) {
          logger.warn(`[override] No enrollmentId for user ${userId}`);
          failCount++;
          continue;
        }
        const override = OVERRIDE_SCALE(average);
        await setOverrideScoreGQL(enrollmentId, override, apiClient2);
        logger.trace(`[override] user ${userId} \u2192 enrollment ${enrollmentId}: ${override}`);
        successCount++;
      } catch (e) {
        logger.warn(`[override] Failed for user ${userId}:`, (e == null ? void 0 : e.message) || e);
        failCount++;
      }
    }
    logger.info(`Grade override submission complete: ${successCount} succeeded, ${failCount} failed`);
    const maxRetries = 3;
    const retryDelayMs = 2e3;
    let overrideMismatches = [];
    try {
      const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient2);
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        banner.soft(`Verifying grade overrides... (attempt ${attempt}/${maxRetries})`);
        logger.debug(`Override verification attempt ${attempt}/${maxRetries}...`);
        overrideMismatches = await verifyOverrideScores(courseId, averages, enrollmentMap, apiClient2);
        if (overrideMismatches.length === 0) {
          logger.info(`All override scores verified successfully on attempt ${attempt}`);
          break;
        }
        if (attempt < maxRetries) {
          logger.warn(`Found ${overrideMismatches.length} override score mismatches on attempt ${attempt}, retrying in ${retryDelayMs / 1e3}s...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        } else {
          logger.warn(`Found ${overrideMismatches.length} override score mismatches after ${maxRetries} attempts`);
          logger.warn("Final mismatches:", overrideMismatches.map((m) => ({
            userId: m.userId,
            expected: m.expected,
            actual: m.actual
          })));
        }
      }
    } catch (error) {
      logger.warn("Override verification failed, continuing anyway:", error);
    }
    logger.debug(`handleVerifyingOverrides complete, transitioning to COMPLETE`);
    return STATES.COMPLETE;
  }
  async function handleComplete(stateMachine) {
    const { numberOfUpdates, banner, courseId, zeroUpdates } = stateMachine.getContext();
    const elapsedTime = getElapsedTimeSinceStart(stateMachine);
    stopElapsedTimer(banner);
    const updateTarget = ENABLE_OUTCOME_UPDATES && ENABLE_GRADE_OVERRIDE ? `${AVG_OUTCOME_NAME} and grade overrides` : ENABLE_OUTCOME_UPDATES ? AVG_OUTCOME_NAME : "grade overrides";
    if (zeroUpdates || numberOfUpdates === 0) {
      banner.setText(`No changes to ${updateTarget} found.`);
      alert(`No changes to ${updateTarget} have been found. No updates performed.`);
      setTimeout(() => {
        banner.remove();
      }, 2e3);
      return STATES.IDLE;
    }
    banner.setText(`${numberOfUpdates} student ${updateTarget} updated successfully! (elapsed time: ${elapsedTime}s)`);
    localStorage.setItem(`duration_${courseId}`, elapsedTime);
    localStorage.setItem(`lastUpdateAt_${courseId}`, (/* @__PURE__ */ new Date()).toISOString());
    alert(`All ${updateTarget} have been updated. (elapsed time: ${elapsedTime}s)
You may need to refresh the page to see the new scores.`);
    return STATES.IDLE;
  }
  async function handleError2(stateMachine) {
    const { error, banner } = stateMachine.getContext();
    logger.error("Update ended prematurely:", error);
    if (banner) {
      banner.setText(`Update ended prematurely: ${error.message}. You can re-run the update to ensure all scores are correctly set.`);
      setTimeout(() => banner.remove(), 5e3);
    }
    return STATES.IDLE;
  }
  var STATE_HANDLERS = {
    [STATES.CHECKING_SETUP]: handleCheckingSetup,
    [STATES.CREATING_OUTCOME]: handleCreatingOutcome,
    [STATES.CREATING_ASSIGNMENT]: handleCreatingAssignment,
    [STATES.CREATING_RUBRIC]: handleCreatingRubric,
    [STATES.CALCULATING]: handleCalculating,
    [STATES.UPDATING_GRADES]: handleUpdatingGrades,
    [STATES.POLLING_PROGRESS]: handlePollingProgress,
    [STATES.VERIFYING]: handleVerifying,
    [STATES.VERIFYING_OVERRIDES]: handleVerifyingOverrides,
    [STATES.COMPLETE]: handleComplete,
    [STATES.ERROR]: handleError2
  };

  // src/utils/keys.js
  var k = (name, courseId) => `${name}_${courseId}`;

  // src/ui/banner.js
  var BRAND_COLOR = getComputedStyle(document.documentElement).getPropertyValue("--ic-brand-primary").trim() || "#0c7d9d";
  function showFloatingBanner({
    text = "",
    duration = null,
    // null = stays until removed; number = auto-hide after ms
    top = "20px",
    right = "20px",
    center = false,
    backgroundColor = BRAND_COLOR,
    textColor = "#ffffff",
    allowMultiple = false,
    // keep existing banners?
    ariaLive = "polite"
    // "polite" | "assertive" | "off"
  } = {}) {
    if (!allowMultiple) {
      document.querySelectorAll(".floating-banner").forEach((b) => b.remove());
    }
    const baseElement = document.querySelector(".ic-Layout-contentMain") || document.querySelector(".ic-app-header__menu-list-item__link") || document.body;
    const styles = getComputedStyle(baseElement);
    const fontFamily = styles.fontFamily;
    const fontSize = styles.fontSize;
    const fontWeight = styles.fontWeight;
    const banner = document.createElement("div");
    banner.className = "floating-banner";
    banner.setAttribute("role", "status");
    if (ariaLive && ariaLive !== "off") banner.setAttribute("aria-live", ariaLive);
    Object.assign(banner.style, {
      position: "fixed",
      top,
      background: backgroundColor,
      padding: "10px 20px",
      borderRadius: "8px",
      boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
      zIndex: "9999",
      fontSize,
      color: textColor,
      fontFamily,
      fontWeight,
      display: "inline-flex",
      alignItems: "center",
      gap: "12px",
      maxWidth: "min(90vw, 720px)",
      lineHeight: "1.35",
      wordBreak: "break-word"
    });
    if (center) {
      banner.style.left = "50%";
      banner.style.transform = "translateX(-50%)";
    } else {
      banner.style.right = right;
    }
    const msg = document.createElement("span");
    msg.className = "floating-banner__text";
    banner.appendChild(msg);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss message");
    closeBtn.textContent = "\xD7";
    Object.assign(closeBtn.style, {
      cursor: "pointer",
      fontWeight: "bold",
      border: "none",
      background: "transparent",
      color: "inherit",
      fontSize,
      lineHeight: "1"
    });
    closeBtn.onclick = () => destroy();
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);
    let lockedUntil = 0;
    let pending = null;
    let holdTimer = null;
    let autoTimer = null;
    const now = () => Date.now();
    const isLocked = () => now() < lockedUntil;
    const courseId = window.location.pathname.includes("/courses/") ? getCourseId() : null;
    const apply = (textValue) => {
      msg.textContent = textValue;
      if (courseId) localStorage.setItem(k("bannerLast", courseId), textValue);
    };
    const unlockAndFlush = () => {
      lockedUntil = 0;
      if (pending != null) {
        apply(pending);
        pending = null;
      }
    };
    banner.setText = (newText) => {
      if (isLocked()) {
        pending = newText;
      } else {
        apply(newText);
      }
    };
    banner.hold = (newText, ms = 3e3) => {
      const now2 = Date.now();
      if (now2 < lockedUntil) {
        pending = newText;
        return;
      }
      lockedUntil = now2 + ms;
      apply(newText);
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        lockedUntil = 0;
        if (pending != null) {
          apply(pending);
          pending = null;
        }
      }, ms);
    };
    banner.soft = (newText) => {
      if (!isLocked()) apply(newText);
    };
    function destroy() {
      if (holdTimer) clearTimeout(holdTimer);
      if (autoTimer) clearTimeout(autoTimer);
      banner.style.transition = "opacity 150ms";
      banner.style.opacity = "0";
      setTimeout(() => banner.remove(), 160);
    }
    banner.removeBanner = destroy;
    duration === "hold" ? banner.hold(text, 3e3) : banner.setText(text);
    if (typeof duration === "number" && isFinite(duration) && duration >= 0) {
      autoTimer = setTimeout(destroy, duration);
    }
    closeBtn.onclick = () => {
      destroy();
    };
    duration === "hold" ? banner.hold(text, 3e3) : banner.setText(text);
    return banner;
  }

  // src/gradebook/ui/debugPanel.js
  function updateDebugUI(stateMachine) {
    if (!logger.isDebugEnabled()) return;
    let debugPanel = document.getElementById("state-machine-debug-panel");
    if (!debugPanel) {
      debugPanel = document.createElement("div");
      debugPanel.id = "state-machine-debug-panel";
      debugPanel.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.85);
            color: #00ff00;
            padding: 12px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 10000;
            min-width: 250px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            border: 1px solid #00ff00;
        `;
      document.body.appendChild(debugPanel);
    }
    const context = stateMachine.getContext();
    const history2 = stateMachine.getStateHistory();
    const currentState = stateMachine.getCurrentState();
    debugPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #ffff00;">
            \u{1F527} STATE MACHINE DEBUG
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Current State:</strong> <span style="color: #00ffff;">${currentState}</span>
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Transitions:</strong> ${history2.length - 1}
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Update Mode:</strong> ${context.updateMode || "N/A"}
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Updates:</strong> ${context.numberOfUpdates || 0}
        </div>
        <div style="margin-bottom: 8px; font-size: 10px; color: #888;">
            Last 3: ${history2.slice(-3).join(" \u2192 ")}
        </div>
        <div style="font-size: 10px; color: #666; cursor: pointer;" onclick="this.parentElement.remove()">
            [Click to close]
        </div>
    `;
  }
  function removeDebugUI() {
    const debugPanel = document.getElementById("state-machine-debug-panel");
    if (debugPanel) {
      debugPanel.remove();
    }
  }

  // src/utils/stateManagement.js
  function cleanUpLocalStorage() {
    const courseId = getCourseId();
    if (!courseId) return;
    try {
      const legacyKey = `updateFlow_state_${courseId}`;
      if (localStorage.getItem(legacyKey)) {
        localStorage.removeItem(legacyKey);
        logger.debug(`Cleaned up legacy state machine data for course ${courseId}`);
      }
    } catch (error) {
      logger.error("Failed to clean up localStorage:", error);
    }
  }

  // src/gradebook/updateFlowOrchestrator.js
  async function startUpdateFlow(button = null) {
    var _a18;
    const courseId = getCourseId();
    if (!courseId) throw new ValidationError("Course ID not found", "courseId");
    const stateMachine = new UpdateFlowStateMachine();
    const initialMessage = ENABLE_OUTCOME_UPDATES && ENABLE_GRADE_OVERRIDE ? `Preparing to update "${AVG_OUTCOME_NAME}" and grade overrides: checking setup...` : ENABLE_OUTCOME_UPDATES ? `Preparing to update "${AVG_OUTCOME_NAME}": checking setup...` : "Preparing to update grade overrides: checking setup...";
    const banner = showFloatingBanner({
      text: initialMessage
    });
    stateMachine.updateContext({ courseId, banner, button });
    alert("You may minimize this browser or switch to another tab, but please keep this tab open until the process is fully complete.");
    try {
      stateMachine.transition(STATES.CHECKING_SETUP);
      while (stateMachine.getCurrentState() !== STATES.IDLE) {
        const currentState = stateMachine.getCurrentState();
        if (currentState === STATES.IDLE || currentState === STATES.ERROR) {
          break;
        }
        logger.debug(`Executing state: ${currentState}`);
        const handler = STATE_HANDLERS[currentState];
        if (!handler) {
          throw new Error(`No handler found for state: ${currentState}`);
        }
        const nextState = await handler(stateMachine);
        if (nextState !== currentState) {
          stateMachine.transition(nextState);
        }
        updateDebugUI(stateMachine);
      }
      const buttonWrapper = (_a18 = document.querySelector("#update-scores-button")) == null ? void 0 : _a18.parentElement;
      if (buttonWrapper) renderLastUpdateNotice(buttonWrapper, courseId);
      resetButtonToNormal(button);
      removeDebugUI();
    } catch (error) {
      stateMachine.updateContext({ error });
      stateMachine.transition(STATES.ERROR);
      if (error instanceof UserCancelledError) {
        const userMessage = getUserFriendlyMessage(error);
        alert(`Update cancelled: ${userMessage}`);
        banner.remove();
      } else {
        const userMessage = handleError(error, "startUpdateFlow", { banner });
        setTimeout(() => {
          banner.remove();
        }, 3e3);
      }
      resetButtonToNormal(button);
      removeDebugUI();
    } finally {
      cleanUpLocalStorage();
    }
  }

  // src/gradebook/ui/buttonInjection.js
  function injectButtons() {
    waitForGradebookAndToolbar((toolbar) => {
      const courseId = getCourseId();
      const buttonWrapper = document.createElement("div");
      buttonWrapper.style.display = "flex";
      buttonWrapper.style.flexDirection = "column";
      buttonWrapper.style.alignItems = "flex-end";
      const updateAveragesButton = makeButton({
        label: UPDATE_AVG_BUTTON_LABEL,
        id: "update-scores-button",
        onClick: async () => {
          try {
            await startUpdateFlow(updateAveragesButton);
          } catch (error) {
            handleError(error, "updateScores", { showAlert: true });
          }
        },
        type: "primary"
      });
      buttonWrapper.appendChild(updateAveragesButton);
      renderLastUpdateNotice(buttonWrapper, courseId);
      const buttonContainer = createButtonColumnContainer();
      buttonContainer.appendChild(buttonWrapper);
      toolbar.appendChild(buttonContainer);
    });
  }
  function resetButtonToNormal(button) {
    if (!button) return;
    button.textContent = UPDATE_AVG_BUTTON_LABEL;
    button.title = "";
    button.disabled = false;
    button.style.cursor = "pointer";
    button.style.opacity = "1";
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryButtonColor = rootStyles.getPropertyValue("--ic-brand-button--primary-bgd").trim() || "#0c7d9d";
    button.style.backgroundColor = primaryButtonColor;
    logger.debug("Button reset to normal state");
  }
  function waitForGradebookAndToolbar(callback) {
    let attempts = 0;
    const intervalId = setInterval(() => {
      const onGradebookPage = window.location.pathname.includes("/gradebook");
      const documentReady = document.readyState === "complete";
      const toolbar = document.querySelector(
        '.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]'
      );
      if (onGradebookPage && documentReady && toolbar) {
        clearInterval(intervalId);
        logger.debug("Gradebook page and toolbar found.");
        callback(toolbar);
      } else if (attempts++ > 33) {
        clearInterval(intervalId);
        logger.warn("Gradebook toolbar not found after 10 seconds, UI not injected.");
      }
    }, 300);
  }

  // src/services/masteryRefreshService.js
  var activeLocks = /* @__PURE__ */ new Set();
  async function fetchAssignmentWithRubric(courseId, assignmentId, apiClient2) {
    const assignment = await apiClient2.get(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
      { include: ["rubric"] },
      "fetchAssignmentWithRubric"
    );
    return assignment;
  }
  function deriveTempPoints(assignment) {
    let maxPoints = -Infinity;
    if (Array.isArray(assignment == null ? void 0 : assignment.rubric)) {
      for (const criterion of assignment.rubric) {
        for (const rating of (criterion == null ? void 0 : criterion.ratings) || []) {
          const points = Number(rating == null ? void 0 : rating.points);
          if (Number.isFinite(points)) {
            maxPoints = Math.max(maxPoints, points);
          }
        }
      }
    }
    if (Number.isFinite(maxPoints) && maxPoints > 0) {
      logger.debug(`[RefreshMastery] Using max points from rubric ratings: ${maxPoints}`);
      return maxPoints;
    }
    const pointsPossible = Number(assignment == null ? void 0 : assignment.points_possible);
    if (Number.isFinite(pointsPossible) && pointsPossible > 0) {
      logger.debug(`[RefreshMastery] Using assignment points_possible: ${pointsPossible}`);
      return pointsPossible;
    }
    logger.debug(`[RefreshMastery] Using fallback max points: ${DEFAULT_MAX_POINTS}`);
    return DEFAULT_MAX_POINTS;
  }
  async function updateAssignmentPoints(courseId, assignmentId, points, apiClient2) {
    const assignment = await apiClient2.put(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
      { assignment: { points_possible: points } },
      `updatePoints_${points}`
    );
    return assignment;
  }
  async function refreshMasteryForAssignment(courseId, assignmentId, options = {}) {
    var _a18, _b18;
    const lockKey = `${courseId}_${assignmentId}`;
    if (activeLocks.has(lockKey)) {
      logger.warn(`[RefreshMastery] Already running for assignment ${assignmentId}`);
      throw new Error("Refresh already in progress for this assignment");
    }
    activeLocks.add(lockKey);
    try {
      const apiClient2 = new CanvasApiClient();
      const delay = (_a18 = options.delay) != null ? _a18 : MASTERY_REFRESH_DELAY_MS;
      const skipRevert = (_b18 = options.skipRevert) != null ? _b18 : false;
      logger.info(`[RefreshMastery] Starting refresh for assignment ${assignmentId} in course ${courseId}`);
      const assignment = await fetchAssignmentWithRubric(courseId, assignmentId, apiClient2);
      const tempPoints = deriveTempPoints(assignment);
      logger.debug(`[RefreshMastery] Determined temp points: ${tempPoints}`, {
        courseId,
        assignmentId,
        tempPoints
      });
      logger.debug(`[RefreshMastery] Setting points_possible to ${tempPoints}`);
      await updateAssignmentPoints(courseId, assignmentId, tempPoints, apiClient2);
      logger.debug(`[RefreshMastery] Waiting ${delay}ms for Canvas to propagate changes`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (!skipRevert) {
        logger.debug(`[RefreshMastery] Reverting points_possible to 0`);
        await updateAssignmentPoints(courseId, assignmentId, 0, apiClient2);
      }
      logger.info(`[RefreshMastery] Successfully refreshed mastery for assignment ${assignmentId}`);
    } catch (error) {
      logger.error(`[RefreshMastery] Failed to refresh mastery for assignment ${assignmentId}:`, error);
      throw error;
    } finally {
      activeLocks.delete(lockKey);
    }
  }

  // src/ui/infoTooltip.js
  var activeTooltips = /* @__PURE__ */ new Set();
  function createInfoIconWithTooltip({
    tooltipId,
    ariaLabel = "Information",
    title,
    bodyParagraphs = [],
    footer = null,
    iconSize = 14,
    position = "right",
    offset = 8
  }) {
    if (!tooltipId) {
      throw new Error("tooltipId is required for createInfoIconWithTooltip");
    }
    const iconContainer = document.createElement("span");
    iconContainer.className = "cg-info-icon-container";
    iconContainer.setAttribute("role", "button");
    iconContainer.setAttribute("tabindex", "0");
    iconContainer.setAttribute("aria-label", ariaLabel);
    iconContainer.setAttribute("aria-describedby", tooltipId);
    iconContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 6px;
        cursor: help;
        vertical-align: middle;
    `;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", iconSize.toString());
    svg.setAttribute("height", iconSize.toString());
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = `
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        opacity: 0.7;
    `;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "8");
    circle.setAttribute("cy", "8");
    circle.setAttribute("r", "6.5");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", "8");
    dot.setAttribute("cy", "5.5");
    dot.setAttribute("r", "0.8");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    const stem = document.createElementNS("http://www.w3.org/2000/svg", "line");
    stem.setAttribute("x1", "8");
    stem.setAttribute("y1", "7.5");
    stem.setAttribute("x2", "8");
    stem.setAttribute("y2", "11");
    stem.setAttribute("stroke-width", "1.5");
    stem.setAttribute("stroke-linecap", "round");
    svg.appendChild(circle);
    svg.appendChild(dot);
    svg.appendChild(stem);
    iconContainer.appendChild(svg);
    const tooltip = document.createElement("div");
    tooltip.id = tooltipId;
    tooltip.className = "cg-info-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.style.cssText = `
        position: fixed;
        display: none;
        background: #2d3b45;
        color: #ffffff;
        padding: 12px 14px 10px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 280px;
        font-size: 13px;
        line-height: 1.5;
        pointer-events: none;
    `;
    let tooltipHTML = "";
    if (title) {
      tooltipHTML += `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${escapeHtml(title)}</div>`;
    }
    bodyParagraphs.forEach((paragraph, index) => {
      const marginBottom = index === bodyParagraphs.length - 1 && !footer ? "0" : "6px";
      tooltipHTML += `<div style="margin-bottom: ${marginBottom};">${escapeHtml(paragraph)}</div>`;
    });
    if (footer) {
      const topMargin = bodyParagraphs.length > 0 ? "10px" : "0";
      tooltipHTML += `<div style="font-size: 11px; opacity: 0.6; font-style: italic; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 6px; margin-top: ${topMargin};">${escapeHtml(footer)}</div>`;
    }
    tooltip.innerHTML = tooltipHTML;
    document.body.appendChild(tooltip);
    activeTooltips.add(tooltip);
    let isTooltipVisible = false;
    const showTooltip = () => {
      const rect = iconContainer.getBoundingClientRect();
      tooltip.style.display = "block";
      switch (position) {
        case "right":
          tooltip.style.left = `${rect.right + offset}px`;
          tooltip.style.top = `${rect.top}px`;
          break;
        case "left":
          tooltip.style.right = `${window.innerWidth - rect.left + offset}px`;
          tooltip.style.top = `${rect.top}px`;
          break;
        case "top":
          tooltip.style.left = `${rect.left}px`;
          tooltip.style.bottom = `${window.innerHeight - rect.top + offset}px`;
          break;
        case "bottom":
          tooltip.style.left = `${rect.left}px`;
          tooltip.style.top = `${rect.bottom + offset}px`;
          break;
        default:
          tooltip.style.left = `${rect.right + offset}px`;
          tooltip.style.top = `${rect.top}px`;
      }
      isTooltipVisible = true;
    };
    const hideTooltip = () => {
      tooltip.style.display = "none";
      isTooltipVisible = false;
    };
    iconContainer.addEventListener("mouseenter", showTooltip);
    iconContainer.addEventListener("mouseleave", hideTooltip);
    iconContainer.addEventListener("focus", showTooltip);
    iconContainer.addEventListener("blur", hideTooltip);
    iconContainer.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isTooltipVisible) {
        hideTooltip();
        e.stopPropagation();
      }
      if (e.key === " " || e.key === "Enter") {
        e.stopPropagation();
        e.preventDefault();
      }
    });
    iconContainer.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    return { iconContainer, tooltip };
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // src/gradebook/ui/assignmentKebabMenu.js
  var MENU_ITEM_ID = "cg-refresh-mastery-menuitem";
  var STYLE_ID = "cg-refresh-mastery-style";
  var lastKebabButton = null;
  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function isAssignmentActionsMenu(menuElement) {
    const menuItems = [...menuElement.querySelectorAll('[role="menuitem"]')];
    const texts = menuItems.map((item) => (item.innerText || item.textContent || "").trim());
    return texts.includes("SpeedGrader");
  }
  function extractAssignmentIdFromHeader(kebabButton) {
    var _a18;
    if (!kebabButton) {
      logger.warn("[RefreshMastery] No kebab button reference available");
      return null;
    }
    const headerColumn = kebabButton.closest(".slick-header-column.assignment");
    if (!headerColumn) {
      logger.warn("[RefreshMastery] Could not find parent .slick-header-column.assignment");
      return null;
    }
    const classMatch = headerColumn.className.match(/\bassignment_(\d+)\b/);
    if (classMatch) {
      return Number(classMatch[1]);
    }
    const assignmentLink = headerColumn.querySelector('a[href*="/assignments/"]');
    if (assignmentLink) {
      const hrefMatch = (_a18 = assignmentLink.getAttribute("href")) == null ? void 0 : _a18.match(/\/assignments\/(\d+)/);
      if (hrefMatch) {
        return Number(hrefMatch[1]);
      }
    }
    logger.warn("[RefreshMastery] Could not extract assignment ID from header column");
    return null;
  }
  function resetMenuFocus(menuElement) {
    try {
      menuElement.setAttribute("tabindex", "-1");
      menuElement.focus({ preventScroll: true });
    } catch (error) {
    }
    const firstMenuItem = menuElement.querySelector('[role="menuitem"]');
    if (firstMenuItem) {
      try {
        firstMenuItem.focus({ preventScroll: true });
      } catch (error) {
      }
    }
  }
  function createMenuItemLike(menuElement) {
    const template = menuElement.querySelector('a[role="menuitem"].css-1kq4kmj-menuItem') || menuElement.querySelector('button[role="menuitem"].css-1kq4kmj-menuItem') || menuElement.querySelector('span[role="menuitem"].css-1kq4kmj-menuItem');
    if (!template) {
      logger.warn("[RefreshMastery] Could not find menu item template to clone");
      return null;
    }
    const menuItem = template.cloneNode(true);
    menuItem.id = MENU_ITEM_ID;
    menuItem.removeAttribute("href");
    if (menuItem.tagName.toLowerCase() === "a") {
      menuItem.setAttribute("href", "#");
    }
    if (menuItem.tagName.toLowerCase() === "button") {
      menuItem.type = "button";
    }
    const walker = document.createTreeWalker(menuItem, NodeFilter.SHOW_TEXT);
    let textNode = null;
    while (walker.nextNode()) {
      const text = walker.currentNode.nodeValue;
      if (text && text.trim().length > 0) {
        textNode = walker.currentNode;
        break;
      }
    }
    if (textNode) {
      textNode.nodeValue = "Refresh Mastery";
      const { iconContainer } = createInfoIconWithTooltip({
        tooltipId: "cg-refresh-mastery-tooltip",
        ariaLabel: "About Refresh Mastery",
        title: "Refresh Mastery",
        bodyParagraphs: [
          "Temporarily gives this assignment points so Canvas recalculates mastery results.",
          "Does not change student grades.",
          "Points possible are automatically set back to zero.",
          "This does not update rubric scores, so outcome results are unchanged."
        ],
        footer: "MOREnet Gradebook Customization",
        iconSize: 14,
        position: "right",
        offset: 8
      });
      const textParent = textNode.parentElement;
      if (textParent) {
        textParent.appendChild(iconContainer);
      }
    }
    return menuItem;
  }
  function createInlineSpinner() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("role", "status");
    svg.setAttribute("aria-label", "Loading");
    svg.style.cssText = `
        display: inline-block;
        vertical-align: middle;
        margin-left: 6px;
        animation: cg-spinner-rotate 0.8s linear infinite;
    `;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "8");
    circle.setAttribute("cy", "8");
    circle.setAttribute("r", "6");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "currentColor");
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute("stroke-linecap", "round");
    circle.setAttribute("stroke-dasharray", "28");
    circle.setAttribute("stroke-dashoffset", "10");
    svg.appendChild(circle);
    return svg;
  }
  async function updateGradebookSettings(courseId, assignmentId) {
    try {
      logger.debug(`[RefreshMastery] Updating gradebook settings for assignment ${assignmentId}`);
      const apiClient2 = new CanvasApiClient();
      const payload = {
        gradebook_settings: {
          enter_grades_as: {
            [assignmentId]: "gradingScheme"
          }
        }
      };
      logger.debug("[RefreshMastery] Sending gradebook settings update:", payload);
      await apiClient2.put(
        `/api/v1/courses/${courseId}/gradebook_settings`,
        payload,
        {},
        // options
        "updateGradebookSettings"
        // context
      );
      logger.info(`[RefreshMastery] Successfully updated gradebook settings for assignment ${assignmentId}`);
    } catch (error) {
      logger.warn("[RefreshMastery] Failed to update gradebook settings (non-critical):", error);
    }
  }
  function injectRefreshMasteryMenuItem(menuElement) {
    if (!menuElement || !isAssignmentActionsMenu(menuElement)) {
      return;
    }
    resetMenuFocus(menuElement);
    if (menuElement.querySelector(`#${MENU_ITEM_ID}`)) {
      return;
    }
    const menuItem = createMenuItemLike(menuElement);
    if (!menuItem) {
      return;
    }
    menuItem.setAttribute("tabindex", "0");
    menuItem.addEventListener("mouseenter", () => {
      try {
        menuItem.focus({ preventScroll: true });
      } catch (error) {
        menuItem.focus();
      }
    });
    menuItem.addEventListener("click", async (e) => {
      var _a18;
      e.preventDefault();
      const courseId = getCourseId();
      const assignmentId = extractAssignmentIdFromHeader(lastKebabButton);
      if (!courseId || !assignmentId) {
        logger.error("[RefreshMastery] Missing courseId or assignmentId", { courseId, assignmentId });
        showFloatingBanner({
          text: "Refresh Mastery failed (missing context)",
          duration: 3e3
        });
        return;
      }
      const originalLabel = ((_a18 = menuItem.querySelector("span")) == null ? void 0 : _a18.textContent) || "Refresh Mastery";
      const labelSpan = menuItem.querySelector("span");
      menuItem.setAttribute("aria-disabled", "true");
      menuItem.setAttribute("aria-busy", "true");
      menuItem.style.pointerEvents = "none";
      if (labelSpan) {
        labelSpan.textContent = "Refreshing";
        const spinner = createInlineSpinner();
        labelSpan.appendChild(spinner);
      }
      try {
        logger.info(`[RefreshMastery] Starting refresh for assignment ${assignmentId}`);
        await refreshMasteryForAssignment(courseId, assignmentId);
        logger.info(`[RefreshMastery] Successfully refreshed assignment ${assignmentId}`);
        await updateGradebookSettings(courseId, assignmentId);
        showFloatingBanner({
          text: "\u2713 Mastery Levels updated - Reload the page in ~30 seconds to see changes",
          duration: 5e3
        });
      } catch (error) {
        logger.error("[RefreshMastery] Refresh failed:", error);
        showFloatingBanner({
          text: "\u2717 Refresh Mastery failed - Please try again",
          duration: 3500
        });
      } finally {
        if (labelSpan) {
          labelSpan.textContent = originalLabel;
        }
        menuItem.removeAttribute("aria-disabled");
        menuItem.removeAttribute("aria-busy");
        menuItem.style.pointerEvents = "";
      }
    });
    menuElement.appendChild(menuItem);
    logger.debug("[RefreshMastery] Injected menu item");
  }
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        #${MENU_ITEM_ID}:hover,
        #${MENU_ITEM_ID}:focus {
            color: white !important;
        }
        #${MENU_ITEM_ID}:hover *,
        #${MENU_ITEM_ID}:focus * {
            color: white !important;
        }

        /* Info icon visibility on hover/focus */
        #${MENU_ITEM_ID}:hover .cg-info-icon-container,
        #${MENU_ITEM_ID}:focus .cg-info-icon-container,
        .cg-info-icon-container:hover,
        .cg-info-icon-container:focus {
            opacity: 1 !important;
        }

        /* Info icon focus outline */
        .cg-info-icon-container:focus {
            outline: 2px solid rgba(255, 255, 255, 0.5);
            outline-offset: 2px;
            border-radius: 50%;
        }

        /* Spinner rotation animation */
        @keyframes cg-spinner-rotate {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }
    `;
    document.head.appendChild(style);
    logger.debug("[RefreshMastery] Injected CSS styles");
  }
  function initAssignmentKebabMenuInjection() {
    if (!MASTERY_REFRESH_ENABLED) {
      logger.debug("[RefreshMastery] Feature disabled via config");
      return;
    }
    logger.info("[RefreshMastery] Initializing kebab menu injection");
    injectStyles();
    document.addEventListener("click", (e) => {
      const kebabButton = e.target.closest('button[aria-haspopup="true"][data-popover-trigger="true"]');
      if (kebabButton) {
        lastKebabButton = kebabButton;
        logger.debug("[RefreshMastery] Tracked kebab button click");
      }
    }, true);
    const observer = new MutationObserver(() => {
      const allMenus = [...document.querySelectorAll('[role="menu"]')].filter(isVisible);
      const menu = allMenus[allMenus.length - 1];
      if (menu) {
        injectRefreshMasteryMenuItem(menu);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    logger.info("[RefreshMastery] Kebab menu injection initialized");
  }

  // src/utils/courseDetection.js
  function matchesCourseNamePattern(courseName) {
    if (!courseName) return false;
    return STANDARDS_BASED_COURSE_PATTERNS.some((pattern) => {
      if (typeof pattern === "string") {
        return courseName.toLowerCase().includes(pattern.toLowerCase());
      } else if (pattern instanceof RegExp) {
        return pattern.test(courseName);
      }
      return false;
    });
  }
  function isValidLetterGrade(letterGrade) {
    if (!letterGrade || typeof letterGrade !== "string") {
      return false;
    }
    const trimmed = letterGrade.trim();
    if (!trimmed) return false;
    const rating = OUTCOME_AND_RUBRIC_RATINGS.find(
      (r) => r.description.toLowerCase() === trimmed.toLowerCase()
    );
    return rating !== void 0;
  }
  async function hasAvgAssignment(courseId, apiClient2) {
    try {
      const assignments = await apiClient2.get(
        `/api/v1/courses/${courseId}/assignments`,
        { search_term: AVG_ASSIGNMENT_NAME },
        "checkAvgAssignment"
      );
      return assignments.some((a) => a.name === AVG_ASSIGNMENT_NAME);
    } catch (error) {
      logger.warn(`Could not check assignments for course ${courseId}:`, error.message);
      return false;
    }
  }
  async function determineCourseModel(course, sessionData, options) {
    const { courseId, courseName } = course;
    const { apiClient: apiClient2 } = options;
    if (!courseId || !courseName) {
      logger.warn("[CourseModel] determineCourseModel called without required courseId or courseName");
      return { model: "traditional", reason: "invalid-input" };
    }
    logger.trace(`[CourseModel] Classifying course ${courseId} "${courseName}"`);
    const matchesPattern = matchesCourseNamePattern(courseName);
    logger.trace(`[CourseModel] Rule 1 - Pattern match: ${matchesPattern ? "YES" : "NO"}`);
    if (matchesPattern) {
      logger.debug(`[CourseModel] \u2705 Course "${courseName}" \u2192 standards (name-pattern)`);
      return { model: "standards", reason: "name-pattern" };
    }
    if (!apiClient2) {
      logger.warn(`[CourseModel] No apiClient provided for course ${courseId}, defaulting to traditional`);
      return { model: "traditional", reason: "no-api-client" };
    }
    logger.trace(`[CourseModel] Rule 2 - Checking AVG Assignment presence...`);
    const hasAvg = await hasAvgAssignment(courseId, apiClient2);
    logger.trace(`[CourseModel] Rule 2 - AVG Assignment: ${hasAvg ? "FOUND" : "NOT FOUND"}`);
    if (hasAvg) {
      logger.debug(`[CourseModel] \u2705 Course "${courseName}" \u2192 standards (avg-assignment)`);
      return { model: "standards", reason: "avg-assignment" };
    }
    logger.debug(`[CourseModel] \u274C Course "${courseName}" \u2192 traditional`);
    return { model: "traditional", reason: "no-match" };
  }

  // src/services/enrollmentService.js
  function parseEnrollmentGrade(enrollmentData) {
    var _a18, _b18, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    if (!enrollmentData) {
      return null;
    }
    let score = null;
    let letterGrade = null;
    if (enrollmentData.grades) {
      score = (_a18 = enrollmentData.grades.current_score) != null ? _a18 : enrollmentData.grades.final_score;
      letterGrade = (_e = (_d = (_c = (_b18 = enrollmentData.grades.current_grade) != null ? _b18 : enrollmentData.grades.final_grade) != null ? _c : null) == null ? void 0 : _d.trim()) != null ? _e : null;
    }
    if (score === null || score === void 0) {
      score = (_h = (_g = (_f = enrollmentData.computed_current_score) != null ? _f : enrollmentData.calculated_current_score) != null ? _g : enrollmentData.computed_final_score) != null ? _h : enrollmentData.calculated_final_score;
    }
    if (letterGrade === null && score !== null) {
      letterGrade = (_n = (_m = (_l = (_k = (_j = (_i = enrollmentData.computed_current_grade) != null ? _i : enrollmentData.calculated_current_grade) != null ? _j : enrollmentData.computed_final_grade) != null ? _k : enrollmentData.calculated_final_grade) != null ? _l : null) == null ? void 0 : _m.trim()) != null ? _n : null;
    }
    if (score === null && letterGrade === null) {
      return null;
    }
    return { score, letterGrade };
  }
  async function fetchSingleEnrollment(courseId, apiClient2) {
    try {
      const enrollments = await apiClient2.get(
        `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment`,
        {},
        "fetchSingleEnrollment"
      );
      logger.trace(`[EnrollmentService] Fetched ${enrollments.length} enrollment(s) for course ${courseId}`);
      const studentEnrollment = enrollments.find(
        (e) => e.type === "StudentEnrollment" || e.type === "student" || e.role === "StudentEnrollment"
      );
      if (!studentEnrollment) {
        logger.trace(`[EnrollmentService] No student enrollment found for course ${courseId}`);
        if (logger.isTraceEnabled() && enrollments.length > 0) {
          logger.trace(`[EnrollmentService] Available enrollment types:`, enrollments.map((e) => e.type || e.role));
        }
        return null;
      }
      logger.trace(`[EnrollmentService] Found student enrollment for course ${courseId}`);
      return studentEnrollment;
    } catch (error) {
      logger.warn(`[EnrollmentService] Failed to fetch enrollment for course ${courseId}:`, error.message);
      return null;
    }
  }

  // src/utils/pageDetection.js
  function isDashboardPage() {
    const path = window.location.pathname;
    return path === "/" || path.startsWith("/dashboard");
  }
  function isAllGradesPage() {
    const path = window.location.pathname;
    return path === "/grades" || path.includes("/grades") && !path.includes("/courses/");
  }
  function isSingleCourseGradesPage() {
    return window.location.href.includes("/courses/") && window.location.pathname.includes("/grades");
  }
  function isCoursePageNeedingCleanup() {
    const path = window.location.pathname;
    return window.location.href.includes("/courses/") && (path.includes("/grades") || path.includes("/assignments") || /^\/courses\/\d+$/.test(path));
  }
  function isTeacherViewingStudentGrades() {
    const path = window.location.pathname;
    return /^\/courses\/\d+\/grades\/\d+/.test(path);
  }
  function isSpeedGraderPage() {
    return window.location.pathname.includes("/speed_grader");
  }
  function getStudentIdFromUrl() {
    const path = window.location.pathname;
    const pattern = /^\/courses\/\d+\/grades\/(\d+)/;
    const match = path.match(pattern);
    if (!match) {
      logger.trace(
        "[getStudentIdFromUrl] No studentId found in URL",
        { path, expectedPattern: pattern.toString() }
      );
    }
    return match ? match[1] : null;
  }
  function resolveTargetStudentId() {
    if (isTeacherViewingStudentGrades()) {
      return getStudentIdFromUrl();
    }
    return (ENV == null ? void 0 : ENV.current_user_id) ? String(ENV.current_user_id) : null;
  }

  // src/services/gradeDataService.js
  var GRADE_SOURCE = Object.freeze({
    ASSIGNMENT: "assignment",
    ENROLLMENT: "enrollment"
  });
  async function fetchAvgAssignmentScore(courseId, studentId, apiClient2) {
    try {
      const assignments = await apiClient2.get(
        `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
        {},
        "fetchAvgAssignment"
      );
      const avgAssignment = assignments.find((a) => a.name === AVG_ASSIGNMENT_NAME);
      if (!avgAssignment) {
        logger.trace(`AVG assignment "${AVG_ASSIGNMENT_NAME}" not found in course ${courseId}`);
        return null;
      }
      logger.trace(`AVG assignment found: ${avgAssignment.id}, ${avgAssignment.name}`);
      logger.trace(`looking for assignment submission for student: ${studentId}`);
      const submission = await apiClient2.get(
        `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/${studentId}`,
        {},
        "fetchAvgSubmission"
      );
      logger.trace(
        `[fetchAvgAssignmentScore] Submission fetched`,
        {
          courseId,
          studentId,
          assignmentId: avgAssignment.id,
          score: submission == null ? void 0 : submission.score,
          grade: submission == null ? void 0 : submission.grade
        }
      );
      const score = submission == null ? void 0 : submission.score;
      const grade = submission == null ? void 0 : submission.grade;
      if (score === null || score === void 0) {
        logger.trace(`No score found for AVG assignment in course ${courseId}`);
        return null;
      }
      if (grade === null || grade === void 0) {
        logger.trace(`No grade found for AVG assignment in course ${courseId}`);
      }
      logger.trace(`AVG assignment score for course ${courseId}: ${score}, grade: ${grade}`);
      return { score, grade };
    } catch (error) {
      logger.warn(`Failed to fetch AVG assignment score for course ${courseId}:`, error.message);
      return null;
    }
  }
  async function fetchEnrollmentScore(courseId, apiClient2) {
    const studentEnrollment = await fetchSingleEnrollment(courseId, apiClient2);
    if (!studentEnrollment) {
      return null;
    }
    const gradeData = parseEnrollmentGrade(studentEnrollment);
    if (!gradeData || gradeData.score === null || gradeData.score === void 0) {
      logger.trace(`No enrollment score found for course ${courseId}`);
      return null;
    }
    logger.trace(`Enrollment data for course ${courseId}: ${gradeData.score}% (${gradeData.letterGrade || "no letter grade"})`);
    return {
      score: gradeData.score,
      letterGrade: gradeData.letterGrade
    };
  }
  async function getCourseGrade(courseId, apiClient2) {
    logger.trace(`[Grade Fetch] Course ${courseId}: Starting grade fetch with fallback hierarchy`);
    logger.trace(`[Grade Fetch] Course ${courseId}: Checking priority 1 - AVG assignment...`);
    const studentId = resolveTargetStudentId();
    if (!studentId) {
      logger.trace(`[Grade Fetch] Course ${courseId}: No target studentId available for submission lookup`);
      return null;
    }
    const avgResult = await fetchAvgAssignmentScore(courseId, studentId, apiClient2);
    if ((avgResult == null ? void 0 : avgResult.score) != null) {
      const { score, grade } = avgResult;
      logger.trace(
        `[Grade Fetch] Course ${courseId}: AVG assignment found! score=${score}, letterGrade=${grade != null ? grade : "(none)"}`
      );
      return {
        score,
        letterGrade: grade != null ? grade : null,
        // ✅ normalize to the field snapshot expects
        source: GRADE_SOURCE.ASSIGNMENT
      };
    }
    logger.trace(`[Grade Fetch] Course ${courseId}: AVG assignment not found, checking priority 2...`);
    logger.trace(`[Grade Fetch] Course ${courseId}: Checking priority 2 - enrollment grade...`);
    const enrollmentData = await fetchEnrollmentScore(courseId, apiClient2);
    if (enrollmentData !== null) {
      logger.trace(`[Grade Fetch] Course ${courseId}: Enrollment grade found! score=${enrollmentData.score}, letterGrade=${enrollmentData.letterGrade}`);
      return {
        score: enrollmentData.score,
        letterGrade: enrollmentData.letterGrade,
        source: GRADE_SOURCE.ENROLLMENT
      };
    }
    logger.trace(`[Grade Fetch] Course ${courseId}: Enrollment grade not found`);
    logger.trace(`[Grade Fetch] Course ${courseId}: No grade available from any source`);
    return null;
  }

  // src/utils/gradeFormatting.js
  function formatGradeDisplay(score, letterGrade) {
    const scoreStr = typeof score === "number" ? score.toFixed(2) : String(score);
    if (letterGrade) {
      return `${scoreStr} (${letterGrade})`;
    }
    return scoreStr;
  }
  function percentageToPoints(percentage) {
    return percentage / 100 * DEFAULT_MAX_POINTS;
  }
  var DISPLAY_SOURCE = {
    /** Grade from AVG Assignment (0-4 scale) */
    ASSIGNMENT: "assignment",
    /** Grade from Enrollment API (percentage) */
    ENROLLMENT: "enrollment",
    /** Grade from percentage value (generic) */
    PERCENTAGE: "percentage"
  };
  function calculateDisplayValue(options) {
    const {
      score,
      letterGrade = null,
      source = DISPLAY_SOURCE.PERCENTAGE,
      includeAriaLabel = true
    } = options;
    let displayValue;
    let ariaLabel;
    if (source === DISPLAY_SOURCE.ASSIGNMENT) {
      const scoreStr = score.toFixed(2);
      const isNumericLetterGrade = typeof letterGrade === "string" && /^[0-9]+(\.[0-9]+)?$/.test(letterGrade.trim());
      if (isNumericLetterGrade) {
        logger.trace(
          `[Grade Display] Suppressing numeric letterGrade "${letterGrade}" for assignment source`
        );
      }
      if (letterGrade && !isNumericLetterGrade) {
        displayValue = `${scoreStr} (${letterGrade})`;
        ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
      } else {
        displayValue = scoreStr;
        ariaLabel = `Grade: ${scoreStr}`;
      }
      logger.trace(`[Grade Display] Assignment grade: display=${displayValue}`);
    } else if (source === DISPLAY_SOURCE.ENROLLMENT) {
      const isValidGrade = isValidLetterGrade(letterGrade);
      if (!letterGrade) {
        logger.trace(`[Grade Display] Letter grade is empty/null/undefined`);
      } else {
        logger.trace(`[Grade Display] Checking "${letterGrade}" against rating scale: ${isValidGrade ? "MATCH FOUND" : "NO MATCH"}`);
      }
      if (isValidGrade) {
        const pointValue = percentageToPoints(score);
        const scoreStr = pointValue.toFixed(2);
        displayValue = `${scoreStr} (${letterGrade})`;
        ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
        logger.trace(`[Grade Display] Converted to points: ${score}% -> ${pointValue} -> display="${displayValue}"`);
      } else {
        const percentageStr = `${score.toFixed(2)}%`;
        if (letterGrade) {
          displayValue = `${percentageStr} (${letterGrade})`;
          ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
          logger.trace(`[Grade Display] Letter grade "${letterGrade}" not in rating scale, using percentage: display="${displayValue}"`);
        } else {
          displayValue = percentageStr;
          ariaLabel = `Grade: ${percentageStr}`;
          logger.trace(`[Grade Display] No letter grade, using percentage: display="${displayValue}"`);
        }
      }
    } else {
      const percentageStr = `${score.toFixed(2)}%`;
      if (letterGrade) {
        displayValue = `${percentageStr} (${letterGrade})`;
        ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
      } else {
        displayValue = percentageStr;
        ariaLabel = `Grade: ${percentageStr}`;
      }
      logger.trace(`[Grade Display] Percentage grade: display=${displayValue}`);
    }
    if (includeAriaLabel) {
      return { displayValue, ariaLabel };
    } else {
      return { displayValue };
    }
  }

  // src/services/courseSnapshotService.js
  var SNAPSHOT_KEY_PREFIX = "cg_courseSnapshot_";
  var USER_ID_KEY = "cg_userId";
  var SNAPSHOT_TTL_MS = 10 * 60 * 1e3;
  var PAGE_CONTEXT = Object.freeze({
    DASHBOARD: "dashboard",
    ALL_GRADES: "allGrades",
    COURSE_GRADES: "courseGrades"
  });
  function isAuthorizedPage() {
    return isDashboardPage() || isAllGradesPage() || isSingleCourseGradesPage() || isTeacherViewingStudentGrades() || isSpeedGraderPage();
  }
  function validateUserOwnership() {
    const currentUserId = (ENV == null ? void 0 : ENV.current_user_id) ? String(ENV.current_user_id) : null;
    if (!currentUserId) {
      logger.warn("[Snapshot] Cannot validate user ownership - ENV.current_user_id not available");
      return false;
    }
    const cachedUserId = sessionStorage.getItem(USER_ID_KEY);
    if (!cachedUserId) {
      sessionStorage.setItem(USER_ID_KEY, currentUserId);
      logger.debug(`[Snapshot] Initialized user ownership tracking for user ${currentUserId}`);
      return true;
    }
    if (cachedUserId !== currentUserId) {
      logger.warn(`[Snapshot] User changed from ${cachedUserId} to ${currentUserId} - clearing all snapshots`);
      const count = clearAllSnapshots();
      sessionStorage.setItem(USER_ID_KEY, currentUserId);
      logger.info(`[Snapshot] Cleared ${count} snapshots due to user change`);
      return true;
    }
    return true;
  }
  function validateAllSnapshots() {
    const currentUserId = (ENV == null ? void 0 : ENV.current_user_id) ? String(ENV.current_user_id) : null;
    if (!currentUserId) {
      logger.warn("[Snapshot] Cannot validate snapshots - ENV.current_user_id not available");
      return 0;
    }
    const cachedUserId = sessionStorage.getItem(USER_ID_KEY);
    if (!cachedUserId || cachedUserId !== currentUserId) {
      logger.warn(`[Snapshot] User validation failed on init (cached=${cachedUserId}, current=${currentUserId}) - clearing all snapshots`);
      const count = clearAllSnapshots();
      sessionStorage.setItem(USER_ID_KEY, currentUserId);
      return count;
    }
    const keys = Object.keys(sessionStorage);
    const snapshotKeys = keys.filter((k2) => k2.startsWith(SNAPSHOT_KEY_PREFIX));
    let clearedCount = 0;
    snapshotKeys.forEach((key) => {
      try {
        const snapshot = JSON.parse(sessionStorage.getItem(key));
        if (snapshot.userId && snapshot.userId !== currentUserId) {
          logger.warn(`[Snapshot] Removing snapshot with mismatched userId: ${key}`);
          sessionStorage.removeItem(key);
          clearedCount++;
          return;
        }
        if (snapshot.expiresAt && Date.now() > snapshot.expiresAt) {
          logger.debug(`[Snapshot] Removing expired snapshot: ${key}`);
          sessionStorage.removeItem(key);
          clearedCount++;
        }
      } catch (error) {
        logger.warn(`[Snapshot] Failed to parse snapshot ${key}, removing:`, error.message);
        sessionStorage.removeItem(key);
        clearedCount++;
      }
    });
    if (clearedCount > 0) {
      logger.info(`[Snapshot] Cleared ${clearedCount} invalid/expired snapshots on init`);
    } else {
      logger.debug("[Snapshot] All existing snapshots validated successfully");
    }
    return clearedCount;
  }
  function getCourseSnapshot(courseId) {
    if (!validateUserOwnership()) {
      return null;
    }
    const key = `${SNAPSHOT_KEY_PREFIX}${courseId}`;
    const cached = sessionStorage.getItem(key);
    if (!cached) {
      logger.trace(`[Snapshot] Cache MISS for course ${courseId}`);
      return null;
    }
    try {
      const snapshot = JSON.parse(cached);
      const currentUserId = (ENV == null ? void 0 : ENV.current_user_id) ? String(ENV.current_user_id) : null;
      if (snapshot.userId && snapshot.userId !== currentUserId) {
        logger.warn(`[Snapshot] User ID mismatch for course ${courseId}, removing snapshot`);
        sessionStorage.removeItem(key);
        return null;
      }
      if (snapshot.expiresAt && Date.now() > snapshot.expiresAt) {
        logger.debug(`[Snapshot] Snapshot expired for course ${courseId}, removing`);
        sessionStorage.removeItem(key);
        return null;
      }
      logger.trace(`[Snapshot] Cache HIT for course ${courseId}: isStandardsBased=${snapshot.isStandardsBased}, score=${snapshot.score}, source=${snapshot.gradeSource}`);
      return snapshot;
    } catch (error) {
      logger.warn(`[Snapshot] Failed to parse snapshot for course ${courseId}:`, error.message);
      sessionStorage.removeItem(key);
      return null;
    }
  }
  async function populateCourseSnapshot(courseId, courseName, apiClient2) {
    if (!validateUserOwnership()) {
      logger.warn(`[Snapshot] Cannot populate snapshot - user ownership validation failed`);
      return null;
    }
    if (!isAuthorizedPage()) {
      logger.trace(`[Snapshot] Skipping snapshot population - unauthorized page`);
      return null;
    }
    const currentUserId = (ENV == null ? void 0 : ENV.current_user_id) ? String(ENV.current_user_id) : null;
    if (!currentUserId) {
      logger.warn(`[Snapshot] Cannot populate snapshot - ENV.current_user_id not available`);
      return null;
    }
    const roleGroup = getUserRoleGroup();
    logger.debug(`[Snapshot] Populating snapshot for course ${courseId} "${courseName}" (user role: ${roleGroup})`);
    try {
      logger.trace(`[Snapshot] Step 1: Fetching grade for ${courseId}...`);
      const gradeData = await getCourseGrade(courseId, apiClient2);
      if (gradeData) {
        logger.trace(`[Snapshot] Course ${courseId} grade: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}, source=${gradeData.source}`);
      } else {
        logger.trace(`[Snapshot] No grade data available for course ${courseId} (user may not be enrolled)`);
      }
      logger.trace(`[Snapshot] Step 2: Classifying course model for ${courseId}...`);
      const classification = await determineCourseModel(
        { courseId, courseName },
        null,
        { apiClient: apiClient2 }
      );
      logger.trace(`[Snapshot] Course ${courseId} classification: model=${classification.model}, reason=${classification.reason}`);
      const isStandardsBased = classification.model === "standards";
      let displayScore = null;
      let displayLetterGrade = null;
      let displayType = null;
      let score = null;
      let letterGrade = null;
      let gradeSource = null;
      if (gradeData) {
        logger.trace(`[Snapshot] Step 3: Calculating display values for ${courseId}...`);
        score = gradeData.score;
        letterGrade = gradeData.letterGrade;
        gradeSource = gradeData.source;
        displayScore = gradeData.score;
        displayLetterGrade = gradeData.letterGrade;
        displayType = "percentage";
        const displaySource = gradeData.source === GRADE_SOURCE.ASSIGNMENT ? DISPLAY_SOURCE.ASSIGNMENT : DISPLAY_SOURCE.ENROLLMENT;
        const displayCalc = calculateDisplayValue({
          score: gradeData.score,
          letterGrade: gradeData.letterGrade,
          source: displaySource,
          includeAriaLabel: false
        });
        if (displayCalc.displayValue.includes("(") && !displayCalc.displayValue.includes("%")) {
          displayType = "points";
          const match = displayCalc.displayValue.match(/^([\d.]+)\s*\(([^)]+)\)/);
          if (match) {
            displayScore = parseFloat(match[1]);
            displayLetterGrade = match[2];
          }
        } else if (displayCalc.displayValue.includes("%")) {
          displayType = "percentage";
          const match = displayCalc.displayValue.match(/^([\d.]+)%/);
          if (match) {
            displayScore = parseFloat(match[1]);
          }
        } else {
          displayType = "points";
          displayScore = parseFloat(displayCalc.displayValue);
        }
        logger.trace(`[Snapshot] Display values: displayScore=${displayScore}, displayType=${displayType}, displayLetterGrade=${displayLetterGrade}`);
      } else {
        logger.trace(`[Snapshot] Step 3: Skipping display value calculation (no grade data)`);
      }
      const snapshot = {
        courseId,
        courseName,
        model: classification.model,
        modelReason: classification.reason,
        isStandardsBased,
        // DEPRECATED: for backward compatibility
        score,
        letterGrade,
        gradeSource,
        displayScore,
        displayLetterGrade,
        displayType,
        timestamp: Date.now(),
        userId: currentUserId,
        expiresAt: Date.now() + SNAPSHOT_TTL_MS
      };
      const key = `${SNAPSHOT_KEY_PREFIX}${courseId}`;
      sessionStorage.setItem(key, JSON.stringify(snapshot));
      if (gradeData) {
        logger.debug(`[Snapshot] \u2705 Populated snapshot for course ${courseId}: model=${classification.model} (${classification.reason}), display=${displayScore} (${displayType}), source=${gradeSource}, expiresAt=${new Date(snapshot.expiresAt).toISOString()}`);
      } else {
        logger.debug(`[Snapshot] \u2705 Populated snapshot for course ${courseId}: model=${classification.model} (${classification.reason}), no grade data, expiresAt=${new Date(snapshot.expiresAt).toISOString()}`);
      }
      return snapshot;
    } catch (error) {
      logger.warn(`[Snapshot] Failed to populate snapshot for course ${courseId}:`, error.message);
      return null;
    }
  }
  function shouldRefreshGrade(courseId, pageContext) {
    if (!isAuthorizedPage()) {
      logger.trace(`[Refresh] Course ${courseId}: Unauthorized page, no refresh allowed`);
      return false;
    }
    const snapshot = getCourseSnapshot(courseId);
    if (!snapshot) {
      logger.trace(`[Refresh] Course ${courseId}: No snapshot exists, needs population`);
      return true;
    }
    if (snapshot.isStandardsBased) {
      logger.trace(`[Refresh] Course ${courseId}: Standards-based, no refresh needed (page=${pageContext})`);
      return false;
    }
    const refreshPages = [PAGE_CONTEXT.ALL_GRADES, PAGE_CONTEXT.COURSE_GRADES];
    const shouldRefresh = refreshPages.includes(pageContext);
    const reason = shouldRefresh ? `page ${pageContext} requires fresh grade` : `page ${pageContext} uses cached grade`;
    logger.trace(`[Refresh] Course ${courseId}: Non-standards-based, ${reason}`);
    return shouldRefresh;
  }
  async function refreshCourseSnapshot(courseId, courseName, apiClient2, pageContext, force = false) {
    if (!validateUserOwnership()) {
      logger.warn(`[Refresh] Cannot refresh snapshot - user ownership validation failed`);
      return null;
    }
    if (!force && !isAuthorizedPage()) {
      logger.trace(`[Refresh] Cannot refresh snapshot - unauthorized page`);
      return getCourseSnapshot(courseId);
    }
    if (force) {
      logger.debug(`[Refresh] Force refresh for course ${courseId} (page=${pageContext})`);
      return await populateCourseSnapshot(courseId, courseName, apiClient2);
    }
    const needsRefresh = shouldRefreshGrade(courseId, pageContext);
    if (needsRefresh) {
      logger.debug(`[Refresh] Refreshing snapshot for course ${courseId} (page=${pageContext})`);
      return await populateCourseSnapshot(courseId, courseName, apiClient2);
    } else {
      logger.trace(`[Refresh] Using existing snapshot for course ${courseId} (page=${pageContext})`);
      return getCourseSnapshot(courseId);
    }
  }
  function clearAllSnapshots() {
    const keys = Object.keys(sessionStorage);
    const snapshotKeys = keys.filter((k2) => k2.startsWith("cg_"));
    snapshotKeys.forEach((k2) => sessionStorage.removeItem(k2));
    logger.debug(`[Snapshot] Cleared all snapshots (${snapshotKeys.length} entries removed)`);
    return snapshotKeys.length;
  }
  function debugSnapshots() {
    const snapshots = {};
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
        const courseId = key.replace(SNAPSHOT_KEY_PREFIX, "");
        try {
          snapshots[courseId] = JSON.parse(sessionStorage.getItem(key));
        } catch (error) {
          snapshots[courseId] = { error: "Failed to parse" };
        }
      }
    });
    logger.info("[Snapshot] All cached snapshots:", snapshots);
    logger.info(`[Snapshot] Total snapshots: ${Object.keys(snapshots).length}`);
    const stats = {
      total: Object.keys(snapshots).length,
      standardsBased: 0,
      traditional: 0,
      assignmentSource: 0,
      enrollmentSource: 0
    };
    Object.values(snapshots).forEach((snapshot) => {
      if (snapshot.error) return;
      if (snapshot.isStandardsBased) stats.standardsBased++;
      else stats.traditional++;
      if (snapshot.gradeSource === "assignment") stats.assignmentSource++;
      else if (snapshot.gradeSource === "enrollment") stats.enrollmentSource++;
    });
    logger.info("[Snapshot] Statistics:", stats);
    return snapshots;
  }

  // src/utils/domExtractors.js
  function extractCourseLinks(container, excludeNavigation = true) {
    const links = container.querySelectorAll('a[href*="/courses/"]');
    if (!excludeNavigation) {
      return Array.from(links);
    }
    return Array.from(links).filter((link) => {
      const isNavigation = link.closest(".ic-app-header") || link.closest('[role="navigation"]') || link.closest(".menu");
      return !isNavigation;
    });
  }
  function extractGradeFromCell(gradeCell) {
    if (!gradeCell) return null;
    const gradeText = gradeCell.textContent.trim();
    if (!gradeText) return null;
    const percentageMatch = gradeText.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentageMatch) {
      return parseFloat(percentageMatch[1]);
    }
    return null;
  }
  function extractCourseDataFromRow(row) {
    try {
      const courseLink = row.querySelector('a[href*="/courses/"]');
      if (!courseLink) {
        logger.trace("[DOM Extractor] No course link found in row");
        return null;
      }
      const courseName = courseLink.textContent.trim();
      const href = courseLink.getAttribute("href");
      const courseId = extractCourseIdFromHref(href);
      if (!courseId) {
        logger.trace(`[DOM Extractor] Could not extract course ID from href: ${href}`);
        return null;
      }
      const gradeCell = row.querySelector(".percent");
      const percentage = extractGradeFromCell(gradeCell);
      const matchesPattern = matchesCourseNamePattern(courseName);
      logger.trace(`[DOM Extractor] Extracted course: ${courseName} (${courseId}), grade=${percentage}%, matchesPattern=${matchesPattern}`);
      return {
        courseId,
        courseName,
        percentage,
        matchesPattern,
        courseUrl: `/courses/${courseId}/grades`
      };
    } catch (error) {
      logger.warn("[DOM Extractor] Failed to extract course data from row:", error);
      return null;
    }
  }
  function findTableRows() {
    const table = document.querySelector("table.course_details.student_grades");
    if (!table) {
      logger.trace("[DOM Extractor] Grades table not found");
      return [];
    }
    const rows = table.querySelectorAll("tbody tr");
    logger.trace(`[DOM Extractor] Found ${rows.length} table rows`);
    return Array.from(rows);
  }

  // src/dashboard/cardSelectors.js
  var CARD_SELECTORS = [
    "[data-course-id]",
    // Older Canvas versions
    ".ic-DashboardCard",
    // Common Canvas class
    '[class*="DashboardCard"]',
    // Any class containing DashboardCard
    ".course-list-item",
    // Alternative Canvas layout
    '[class*="CourseCard"]',
    // Modern Canvas
    'div[id^="dashboard_card_"]',
    // ID-based cards
    ".dashboard-card"
    // Lowercase variant
  ];
  var HERO_SELECTORS = [
    ".ic-DashboardCard__header_hero",
    '[class*="hero"]',
    '[class*="Hero"]',
    ".ic-DashboardCard__header",
    '[class*="header"]',
    '[class*="Header"]'
  ];
  function getDashboardCardSelectors() {
    return CARD_SELECTORS;
  }
  function looksLikeDashboardCard(node) {
    var _a18, _b18;
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const element = node;
    if ((_a18 = element.hasAttribute) == null ? void 0 : _a18.call(element, "data-course-id")) return true;
    const className = element.className || "";
    if (typeof className === "string") {
      if (className.includes("DashboardCard") || className.includes("CourseCard") || className.includes("course-list-item") || className.includes("dashboard-card")) {
        return true;
      }
    }
    const id = element.id || "";
    if (id.startsWith("dashboard_card_")) return true;
    if ((_b18 = element.querySelector) == null ? void 0 : _b18.call(element, 'a[href*="/courses/"]')) {
      return true;
    }
    return false;
  }
  function findDashboardCards() {
    for (const selector of CARD_SELECTORS) {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        logger.trace(`Found ${cards.length} dashboard cards using selector: ${selector}`);
        return cards;
      }
    }
    const dashboardLinks = extractCourseLinks(document.body, true);
    if (dashboardLinks.length > 0) {
      logger.trace(`Found ${dashboardLinks.length} dashboard course links`);
      return dashboardLinks;
    }
    logger.trace("No dashboard cards found with any selector");
    return null;
  }
  function findCourseCard(courseId) {
    let card = document.querySelector(`[data-course-id="${courseId}"]`);
    if (card) {
      logger.trace(`Found card for course ${courseId} using data-course-id`);
      return card;
    }
    const courseUrl = `/courses/${courseId}`;
    const links = document.querySelectorAll(`a[href*="${courseUrl}"]`);
    for (const link of links) {
      for (const selector of CARD_SELECTORS) {
        const cardContainer = link.closest(selector);
        if (cardContainer) {
          const cardLink = cardContainer.querySelector(`a[href*="${courseUrl}"]`);
          if (cardLink) {
            logger.trace(`Found card for course ${courseId} using href strategy with selector: ${selector}`);
            return cardContainer;
          }
        }
      }
    }
    const dashboardLinks = extractCourseLinks(document.body, true).filter((link) => {
      const href = link.getAttribute("href");
      return href && href.includes(courseUrl);
    });
    for (const link of dashboardLinks) {
      let parent = link;
      for (let i = 0; i < 5; i++) {
        parent = parent.parentElement;
        if (!parent) break;
        const hasCardClass = parent.className && (parent.className.includes("Card") || parent.className.includes("card") || parent.className.includes("course"));
        if (hasCardClass) {
          logger.trace(`Found card for course ${courseId} using parent traversal`);
          return parent;
        }
      }
    }
    logger.trace(`Dashboard card not found for course ${courseId}`);
    return null;
  }

  // src/dashboard/cardRenderer.js
  var GRADE_CLASS_PREFIX = "cg-dashboard-grade";
  function formatGradeDisplay2(gradeData) {
    const { score, letterGrade, displayType } = gradeData;
    logger.trace(`[Grade Display] Formatting display values: score=${score}, letterGrade=${letterGrade}, displayType=${displayType}`);
    let displayValue;
    let ariaLabel;
    if (displayType === "points") {
      const scoreStr = score.toFixed(2);
      if (letterGrade) {
        displayValue = `${scoreStr} (${letterGrade})`;
        ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
      } else {
        displayValue = scoreStr;
        ariaLabel = `Grade: ${scoreStr}`;
      }
    } else {
      const percentageStr = `${score.toFixed(2)}%`;
      if (letterGrade) {
        displayValue = `${percentageStr} (${letterGrade})`;
        ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
      } else {
        displayValue = percentageStr;
        ariaLabel = `Grade: ${percentageStr}`;
      }
    }
    logger.trace(`[Grade Display] Formatted: displayValue="${displayValue}"`);
    return { displayValue, ariaLabel };
  }
  function createGradeBadge(gradeData, heroElement = null) {
    const { source, displayType } = gradeData;
    const { displayValue, ariaLabel } = formatGradeDisplay2(gradeData);
    const badge = document.createElement("div");
    badge.className = `${GRADE_CLASS_PREFIX}`;
    badge.setAttribute("data-source", source);
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-label", ariaLabel);
    badge.textContent = displayValue;
    let badgeBackground = "rgba(64, 64, 64, 0.85)";
    if (heroElement) {
      const heroStyles = window.getComputedStyle(heroElement);
      const heroColor = heroStyles.backgroundColor;
      if (heroColor && heroColor !== "transparent" && heroColor !== "rgba(0, 0, 0, 0)") {
        badgeBackground = deriveTranslucentColor(heroColor);
        logger.trace(`Derived badge background from hero color: ${heroColor} -> ${badgeBackground}`);
      }
    }
    badge.style.cssText = `
        position: absolute;
        bottom: 8px;
        right: 8px;
        font-size: 0.875rem;
        line-height: 1.4;
        border-radius: 8px;
        background: ${badgeBackground};
        color: #fff;
        display: inline-block;
        text-align: center;
        box-sizing: border-box;
        padding: 6px 10px;
        font-weight: 600;
        white-space: nowrap;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 10;
    `;
    return badge;
  }
  function deriveTranslucentColor(colorString) {
    const rgb = parseColor(colorString);
    if (!rgb) {
      return "rgba(64, 64, 64, 0.75)";
    }
    const r = Math.max(0, Math.floor(rgb.r * 0.7));
    const g = Math.max(0, Math.floor(rgb.g * 0.7));
    const b = Math.max(0, Math.floor(rgb.b * 0.7));
    return `rgba(${r}, ${g}, ${b}, 0.75)`;
  }
  function parseColor(colorString) {
    const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10)
      };
    }
    const hexMatch = colorString.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16)
      };
    }
    return null;
  }
  function findGradeContainer(cardElement) {
    for (const selector of HERO_SELECTORS) {
      const container = cardElement.querySelector(selector);
      if (container) {
        const styles = window.getComputedStyle(container);
        if (styles.position === "static") {
          container.style.position = "relative";
        }
        logger.trace(`Using container for grade badge placement: ${selector}`);
        return container;
      }
    }
    logger.warn("Could not find hero or header element, using card itself (fallback)");
    const cardStyles = window.getComputedStyle(cardElement);
    if (cardStyles.position === "static") {
      cardElement.style.position = "relative";
    }
    return cardElement;
  }
  function renderGradeOnCard(cardElement, gradeData) {
    removeGradeFromCard(cardElement);
    const heroContainer = findGradeContainer(cardElement);
    if (!heroContainer) {
      logger.warn("Could not find suitable container for grade badge");
      logger.warn("Card element:", cardElement);
      return;
    }
    const badge = createGradeBadge(gradeData, heroContainer);
    heroContainer.appendChild(badge);
    if (logger.isTraceEnabled()) {
      const suffix = gradeData.displayType === "percentage" ? "%" : "";
      const displayInfo = gradeData.letterGrade ? `${gradeData.score}${suffix} (${gradeData.letterGrade})` : `${gradeData.score}${suffix}`;
      logger.trace(`Grade badge rendered (${displayInfo}, type: ${gradeData.displayType}, source: ${gradeData.source})`);
      logger.trace(`Badge placed in: ${heroContainer.className || heroContainer.tagName}`);
    } else {
      logger.debug(`Grade badge rendered on card (type: ${gradeData.displayType}, source: ${gradeData.source})`);
    }
  }
  function removeGradeFromCard(cardElement) {
    const existingBadge = cardElement.querySelector(`.${GRADE_CLASS_PREFIX}`);
    if (existingBadge) {
      existingBadge.remove();
      logger.trace("Existing grade badge removed from card");
    }
  }

  // src/utils/observerHelpers.js
  var OBSERVER_CONFIGS = {
    /**
     * Watch for child elements being added/removed in entire subtree
     * Use for: Detecting new content, lazy-loaded elements
     */
    CHILD_LIST: {
      childList: true,
      subtree: true
    },
    /**
     * Watch for child elements and attribute changes in entire subtree
     * Use for: Comprehensive DOM monitoring
     */
    CHILD_LIST_AND_ATTRIBUTES: {
      childList: true,
      subtree: true,
      attributes: true
    },
    /**
     * Watch for specific attributes only
     * Use for: Monitoring state changes on specific elements
     * @param {string[]} attributeFilter - Array of attribute names to watch
     */
    ATTRIBUTES_ONLY: (attributeFilter = []) => ({
      attributes: true,
      attributeFilter
    }),
    /**
     * Full monitoring - child list, attributes, and character data
     * Use for: Comprehensive change detection (use sparingly - performance impact)
     */
    FULL: {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    }
  };
  function createConditionalObserver(callback, options = {}) {
    const {
      timeout = 3e4,
      config = OBSERVER_CONFIGS.CHILD_LIST,
      target = document.body,
      name = "Observer"
    } = options;
    let disconnected = false;
    const observer = new MutationObserver((mutations) => {
      if (disconnected) return;
      const shouldDisconnect = callback(mutations);
      if (shouldDisconnect) {
        observer.disconnect();
        disconnected = true;
        logger.trace(`${name} disconnected (condition met)`);
      }
    });
    observer.observe(target, config);
    logger.trace(`${name} started, will auto-disconnect after ${timeout}ms or when condition met`);
    setTimeout(() => {
      if (!disconnected) {
        observer.disconnect();
        disconnected = true;
        logger.trace(`${name} auto-disconnected (timeout)`);
      }
    }, timeout);
    return observer;
  }
  function createPersistentObserver(callback, options = {}) {
    const {
      config = OBSERVER_CONFIGS.CHILD_LIST,
      target = document.body,
      name = "Observer"
    } = options;
    const observer = new MutationObserver(callback);
    observer.observe(target, config);
    logger.trace(`${name} started (persistent - remember to disconnect manually)`);
    return observer;
  }

  // src/dashboard/gradeDisplay.js
  var initialized = false;
  var dashboardObserver = null;
  var CONCURRENT_WORKERS = 3;
  async function fetchActiveCourses(apiClient2) {
    var _a18;
    try {
      const courses = await apiClient2.get(
        "/api/v1/courses?enrollment_state=active&include[]=total_scores",
        {},
        "fetchActiveCourses"
      );
      logger.trace(`Raw courses response:`, courses);
      logger.trace(`Number of courses returned: ${(courses == null ? void 0 : courses.length) || 0}`);
      if (courses && courses.length > 0) {
        logger.trace(`First course structure:`, courses[0]);
        logger.trace(`First course enrollments:`, courses[0].enrollments);
      }
      const studentCourses = courses.filter((course) => {
        const enrollments = course.enrollments || [];
        const hasStudentEnrollment = enrollments.some(
          (e) => e.type === "student" || e.type === "StudentEnrollment" || e.role === "StudentEnrollment"
        );
        if (logger.isTraceEnabled() && enrollments.length > 0) {
          logger.trace(`Course ${course.id} (${course.name}): enrollments =`, enrollments.map((e) => e.type));
        }
        return hasStudentEnrollment;
      });
      const coursesWithEnrollmentData = studentCourses.map((course) => {
        const enrollments = course.enrollments || [];
        const studentEnrollment = enrollments.find(
          (e) => e.type === "student" || e.type === "StudentEnrollment" || e.role === "StudentEnrollment"
        );
        return {
          id: String(course.id),
          name: course.name,
          enrollmentData: studentEnrollment || null
        };
      });
      logger.info(`Found ${coursesWithEnrollmentData.length} active student courses out of ${courses.length} total courses`);
      if (logger.isTraceEnabled() && coursesWithEnrollmentData.length > 0) {
        const firstCourse = coursesWithEnrollmentData[0];
        logger.trace(`First course enrollment data:`, firstCourse.enrollmentData);
        if ((_a18 = firstCourse.enrollmentData) == null ? void 0 : _a18.grades) {
          logger.trace(`First course grades object:`, firstCourse.enrollmentData.grades);
        }
      }
      return coursesWithEnrollmentData;
    } catch (error) {
      logger.error("Failed to fetch active courses:", error);
      return [];
    }
  }
  async function updateCourseCard(courseId, courseName, apiClient2) {
    try {
      const cardElement = findCourseCard(courseId);
      if (!cardElement) {
        logger.trace(`Card element not found for course ${courseId}, skipping`);
        return;
      }
      let snapshot = getCourseSnapshot(courseId);
      if (!snapshot) {
        logger.trace(`No snapshot for course ${courseId}, populating...`);
        snapshot = await populateCourseSnapshot(courseId, courseName, apiClient2);
      }
      if (!snapshot) {
        logger.trace(`No grade available for course ${courseId}, skipping`);
        return;
      }
      const gradeData = {
        score: snapshot.displayScore,
        letterGrade: snapshot.displayLetterGrade,
        source: snapshot.gradeSource,
        displayType: snapshot.displayType
      };
      renderGradeOnCard(cardElement, gradeData);
      const displayInfo = snapshot.displayLetterGrade ? `${snapshot.displayScore} (${snapshot.displayLetterGrade})` : `${snapshot.displayScore}`;
      logger.trace(`Grade displayed for course ${courseId}: ${displayInfo} ${snapshot.displayType} (source: ${snapshot.gradeSource})`);
    } catch (error) {
      logger.warn(`Failed to update grade for course ${courseId}:`, error.message);
    }
  }
  async function updateAllCourseCards() {
    try {
      const startTime = performance.now();
      const apiClient2 = new CanvasApiClient();
      const courses = await fetchActiveCourses(apiClient2);
      if (courses.length === 0) {
        logger.info("No active student courses found");
        return;
      }
      logger.info(`Updating grades for ${courses.length} courses`);
      const concurrency = CONCURRENT_WORKERS;
      const queue = courses.map((c) => ({ id: c.id, name: c.name }));
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;
      async function worker() {
        while (queue.length > 0) {
          const course = queue.shift();
          if (!course) break;
          try {
            await updateCourseCard(course.id, course.name, apiClient2);
            processedCount++;
            successCount++;
            if (processedCount % 5 === 0) {
              logger.debug(`Progress: ${processedCount}/${courses.length} courses processed`);
            }
          } catch (error) {
            processedCount++;
            errorCount++;
            logger.warn(`Worker failed to process course ${course.id}:`, error.message);
          }
        }
      }
      const processingStartTime = performance.now();
      logger.debug(`Starting ${concurrency} concurrent workers for ${courses.length} courses`);
      await Promise.all(
        Array.from({ length: concurrency }, () => worker())
      );
      const processingTime = performance.now() - processingStartTime;
      const totalTime = performance.now() - startTime;
      const avgTimePerCourse = processingTime / courses.length;
      logger.info(`Dashboard grade display update complete`);
      logger.info(`Performance: ${courses.length} courses processed in ${totalTime.toFixed(0)}ms total (${processingTime.toFixed(0)}ms processing)`);
      logger.info(`Success: ${successCount}/${courses.length} courses, ${errorCount} errors`);
      logger.info(`Average: ${avgTimePerCourse.toFixed(0)}ms per course with ${concurrency} concurrent workers`);
      const estimatedSequentialTime = avgTimePerCourse * courses.length;
      const speedup = estimatedSequentialTime / processingTime;
      logger.debug(`Estimated speedup: ${speedup.toFixed(1)}x faster than sequential processing`);
    } catch (error) {
      logger.error("Failed to update dashboard grades:", error);
    }
  }
  function waitForDashboardCards(maxWaitMs = 5e3) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkCards = () => {
        const cards = findDashboardCards();
        if (cards && cards.length > 0) {
          logger.info(`Dashboard cards found: ${cards.length}`);
          if (logger.isTraceEnabled() && cards[0]) {
            logger.trace("First card element:", cards[0]);
            logger.trace("First card classes:", cards[0].className);
            logger.trace("First card attributes:", Array.from(cards[0].attributes).map((a) => `${a.name}="${a.value}"`));
          }
          resolve(true);
          return;
        }
        if (Date.now() - startTime > maxWaitMs) {
          logger.warn("Timeout waiting for dashboard cards");
          logger.warn("Tried selectors:", getDashboardCardSelectors());
          logger.warn("Current URL:", window.location.href);
          logger.warn("Dashboard container exists:", !!document.querySelector("#dashboard"));
          resolve(false);
          return;
        }
        setTimeout(checkCards, 100);
      };
      checkCards();
    });
  }
  function setupDashboardObserver() {
    if (dashboardObserver) {
      dashboardObserver.disconnect();
    }
    const dashboardContainer = document.querySelector("#dashboard") || document.querySelector("#content") || document.body;
    dashboardObserver = createPersistentObserver((mutations) => {
      const cardsAdded = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some((node) => {
          var _a18;
          return looksLikeDashboardCard(node) || ((_a18 = node.querySelector) == null ? void 0 : _a18.call(node, getDashboardCardSelectors().join(",")));
        });
      });
      if (cardsAdded) {
        logger.trace("Dashboard cards detected via MutationObserver, updating grades");
        updateAllCourseCards();
      }
    }, {
      config: OBSERVER_CONFIGS.CHILD_LIST,
      target: dashboardContainer,
      name: "DashboardGradeDisplay"
    });
    logger.trace("Dashboard observer setup complete, observing:", dashboardContainer.id || dashboardContainer.tagName);
  }
  function diagnosticDashboardCards() {
    console.log("=== Dashboard Card Diagnostic ===");
    console.log("Current URL:", window.location.href);
    console.log("Is dashboard page:", window.location.pathname === "/" || window.location.pathname.startsWith("/dashboard"));
    const selectors = getDashboardCardSelectors();
    console.log("Trying selectors:", selectors);
    selectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`\u2713 Found ${elements.length} elements with selector: ${selector}`);
          console.log("  First element:", elements[0]);
        } else {
          console.log(`\u2717 No elements found with selector: ${selector}`);
        }
      } catch (e) {
        console.log(`\u2717 Error with selector ${selector}:`, e.message);
      }
    });
    const courseLinks = document.querySelectorAll('a[href*="/courses/"]');
    console.log(`Found ${courseLinks.length} total course links`);
    const dashboardLinks = Array.from(courseLinks).filter((link) => {
      return !link.closest(".ic-app-header") && !link.closest('[role="navigation"]') && !link.closest(".menu");
    });
    console.log(`Found ${dashboardLinks.length} dashboard course links`);
    if (dashboardLinks.length > 0) {
      console.log("First dashboard link:", dashboardLinks[0]);
      console.log("First dashboard link parent:", dashboardLinks[0].parentElement);
    }
    console.log("=== End Diagnostic ===");
  }
  async function initDashboardGradeDisplay() {
    if (initialized) {
      logger.trace("Dashboard grade display already initialized");
      return;
    }
    initialized = true;
    logger.info("Initializing dashboard grade display");
    if (!window.CG) window.CG = {};
    window.CG.diagnosticDashboard = diagnosticDashboardCards;
    window.CG.testConcurrentPerformance = testConcurrentPerformance;
    logger.info("Diagnostic function available: window.CG.diagnosticDashboard()");
    logger.info("Performance test available: window.CG.testConcurrentPerformance()");
    const cardsFound = await waitForDashboardCards();
    if (!cardsFound) {
      logger.warn("Dashboard cards not found, grade display may not work");
      logger.warn("Run window.CG.diagnosticDashboard() in console for more info");
    }
    await updateAllCourseCards();
    setupDashboardObserver();
  }
  async function testConcurrentPerformance() {
    try {
      logger.info("=== Performance Test: Sequential vs Concurrent Processing ===");
      const apiClient2 = new CanvasApiClient();
      const courses = await fetchActiveCourses(apiClient2);
      if (courses.length === 0) {
        logger.warn("No courses found for performance testing");
        return { error: "No courses found" };
      }
      logger.info(`Testing with ${courses.length} courses`);
      logger.info("Test 1: Sequential processing...");
      const sequentialStart = performance.now();
      for (const course of courses) {
        try {
          await populateCourseSnapshot(course.id, course.name, apiClient2);
        } catch (error) {
          logger.trace(`Sequential test error for course ${course.id}:`, error.message);
        }
      }
      const sequentialTime = performance.now() - sequentialStart;
      logger.info(`Sequential: ${sequentialTime.toFixed(0)}ms total, ${(sequentialTime / courses.length).toFixed(0)}ms per course`);
      logger.info("Test 2: Concurrent processing...");
      const concurrentStart = performance.now();
      const concurrency = CONCURRENT_WORKERS;
      const queue = courses.map((c) => ({ id: c.id, name: c.name }));
      async function worker() {
        while (queue.length > 0) {
          const course = queue.shift();
          if (!course) break;
          try {
            await populateCourseSnapshot(course.id, course.name, apiClient2);
          } catch (error) {
            logger.trace(`Concurrent test error for course ${course.id}:`, error.message);
          }
        }
      }
      await Promise.all(
        Array.from({ length: concurrency }, () => worker())
      );
      const concurrentTime = performance.now() - concurrentStart;
      logger.info(`Concurrent: ${concurrentTime.toFixed(0)}ms total, ${(concurrentTime / courses.length).toFixed(0)}ms per course`);
      const speedup = sequentialTime / concurrentTime;
      const improvement = (sequentialTime - concurrentTime) / sequentialTime * 100;
      const results = {
        courses: courses.length,
        concurrency,
        sequential: {
          total: Math.round(sequentialTime),
          perCourse: Math.round(sequentialTime / courses.length)
        },
        concurrent: {
          total: Math.round(concurrentTime),
          perCourse: Math.round(concurrentTime / courses.length)
        },
        speedup: speedup.toFixed(2),
        improvement: improvement.toFixed(1) + "%",
        timeSaved: Math.round(sequentialTime - concurrentTime) + "ms"
      };
      logger.info("=== Performance Test Results ===");
      logger.info(`Speedup: ${results.speedup}x faster (${results.improvement} improvement)`);
      logger.info(`Time saved: ${results.timeSaved}`);
      logger.info("Full results:", results);
      return results;
    } catch (error) {
      logger.error("Performance test failed:", error);
      return { error: error.message };
    }
  }

  // src/speedgrader/gradingDropdown.js
  var initialized2 = false;
  var gradingDropdownObserver = null;
  var GRADING_DROPDOWN_ID = "grading-box-extended";
  function activateGradingDropdown() {
    const gradingBox = document.getElementById(GRADING_DROPDOWN_ID);
    if (!gradingBox) {
      logger.trace(`Grading dropdown element #${GRADING_DROPDOWN_ID} not found`);
      return;
    }
    if (!gradingBox.hasAttribute("disabled") && !gradingBox.hasAttribute("readonly") && !gradingBox.hasAttribute("aria-disabled")) {
      logger.trace("Grading dropdown already active");
      return;
    }
    gradingBox.removeAttribute("disabled");
    gradingBox.removeAttribute("readonly");
    gradingBox.removeAttribute("aria-disabled");
    gradingBox.classList.remove("ui-state-disabled");
    logger.debug("Grading dropdown activated - removed disabled/readonly attributes");
  }
  function setupGradingDropdownObserver() {
    if (gradingDropdownObserver) {
      gradingDropdownObserver.disconnect();
    }
    const customConfig = __spreadProps(__spreadValues({}, OBSERVER_CONFIGS.CHILD_LIST_AND_ATTRIBUTES), {
      attributeFilter: ["disabled", "readonly", "aria-disabled", "class"]
    });
    gradingDropdownObserver = createPersistentObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.id === GRADING_DROPDOWN_ID) {
                logger.trace("Grading dropdown added to DOM, activating");
                activateGradingDropdown();
              } else if (node.querySelector && node.querySelector(`#${GRADING_DROPDOWN_ID}`)) {
                logger.trace("Grading dropdown found in added subtree, activating");
                activateGradingDropdown();
              }
            }
          });
        } else if (mutation.type === "attributes" && mutation.target.id === GRADING_DROPDOWN_ID) {
          logger.trace(`Grading dropdown attribute changed: ${mutation.attributeName}`);
          activateGradingDropdown();
        }
      });
    }, {
      config: customConfig,
      target: document.body,
      name: "GradingDropdownObserver"
    });
  }
  function initSpeedGraderDropdown() {
    if (initialized2) {
      logger.trace("SpeedGrader grading dropdown already initialized");
      return;
    }
    initialized2 = true;
    logger.info("Initializing SpeedGrader grading dropdown auto-activator");
    activateGradingDropdown();
    setupGradingDropdownObserver();
    logger.info("SpeedGrader grading dropdown auto-activator started");
  }

  // src/speedgrader/speedgraderScoreSync.js
  var TIMING_CONSTANTS = {
    GRADE_INPUT_UPDATE_DELAYS: [0, 700, 1500],
    RUBRIC_FETCH_DELAYS: [200, 250, 350],
    UI_KEEPALIVE_INTERVAL: 600,
    UI_KEEPALIVE_DURATION: 12e3,
    NAVIGATION_RECHECK_DELAY: 250,
    URL_PARSE_RETRY_DELAY: 500,
    URL_PARSE_MAX_ATTEMPTS: 3,
    SUBMIT_GRADE_TIMEOUT: 1e4,
    SUBMIT_GRADE_MAX_RETRIES: 2
  };
  var UI_COLORS = {
    CONTAINER_BG: "rgb(245, 245, 245)",
    CONTAINER_BORDER: "rgb(245, 245, 245)",
    LABEL_BG: "rgb(245, 245, 245)",
    SCORE_BG: "rgb(0, 142, 83)"
  };
  var FEATURE_FLAGS = {
    UI_KEEPALIVE_ENABLED: true
  };
  var initialized3 = false;
  var inFlight = false;
  var lastFingerprintByContext = /* @__PURE__ */ new Map();
  var apiClient = null;
  var uiKeepaliveInterval = null;
  var metrics = {
    attempts: 0,
    successes: 0,
    failures: 0,
    skipped: 0
  };
  var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  ).set;
  function parseSpeedGraderUrl() {
    var _a18, _b18;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const courseIdMatch = path.match(/\/courses\/(\d+)\//);
    const courseId = courseIdMatch ? courseIdMatch[1] : null;
    const assignmentIdRaw = params.get("assignment_id");
    const studentIdRaw = params.get("student_id");
    const assignmentId = assignmentIdRaw ? ((_a18 = assignmentIdRaw.match(/^\d+/)) == null ? void 0 : _a18[0]) || null : null;
    const studentId = studentIdRaw ? ((_b18 = studentIdRaw.match(/^\d+/)) == null ? void 0 : _b18[0]) || null : null;
    return { courseId, assignmentId, studentId };
  }
  async function parseSpeedGraderUrlWithRetry(maxAttempts = TIMING_CONSTANTS.URL_PARSE_MAX_ATTEMPTS, delayMs = TIMING_CONSTANTS.URL_PARSE_RETRY_DELAY) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const parsed = parseSpeedGraderUrl();
      logger.trace(`[ScoreSync] Parse attempt ${attempt}/${maxAttempts} - courseId: ${parsed.courseId}, assignmentId: ${parsed.assignmentId}, studentId: ${parsed.studentId}`);
      if (parsed.courseId && parsed.assignmentId && parsed.studentId) {
        return parsed;
      }
      if (attempt < maxAttempts) {
        logger.trace(`[ScoreSync] Missing IDs, waiting ${delayMs}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return { courseId: null, assignmentId: null, studentId: null };
  }
  function getStorage(key) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }
  function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function getStorageKeys(courseId, assignmentId) {
    const host = window.location.hostname;
    return {
      assignment: `cg_speedgrader_scoresync_settings::${host}::course::${courseId}::assignment::${assignmentId}`,
      course: `cg_speedgrader_scoresync_default::${host}::course::${courseId}`
    };
  }
  function getContextKey(courseId, assignmentId, studentId) {
    return `${courseId}:${assignmentId}:${studentId}`;
  }
  function validateSettings(settings) {
    const defaults = { enabled: true, method: "min" };
    if (!settings || typeof settings !== "object") return defaults;
    return {
      enabled: typeof settings.enabled === "boolean" ? settings.enabled : defaults.enabled,
      method: ["min", "avg", "max"].includes(settings.method) ? settings.method : defaults.method
    };
  }
  function getSettings(courseId, assignmentId) {
    const keys = getStorageKeys(courseId, assignmentId);
    const assignmentSettings = getStorage(keys.assignment);
    if (assignmentSettings) return validateSettings(assignmentSettings);
    const courseSettings = getStorage(keys.course);
    if (courseSettings) return validateSettings(courseSettings);
    return { enabled: true, method: "min" };
  }
  function saveSettings(courseId, assignmentId, settings) {
    const keys = getStorageKeys(courseId, assignmentId);
    setStorage(keys.assignment, settings);
    setStorage(keys.course, settings);
  }
  function calculateGrade(rubricAssessment, method) {
    const points = Object.values(rubricAssessment).map((criterion) => criterion.points).filter((p) => typeof p === "number" && !isNaN(p));
    if (points.length === 0) return 0;
    if (method === "min") return Math.min(...points);
    if (method === "max") return Math.max(...points);
    if (method === "avg") return points.reduce((a, b) => a + b, 0) / points.length;
    return Math.min(...points);
  }
  function createRubricFingerprint(rubricAssessment) {
    return Object.entries(rubricAssessment || {}).map(([id, data]) => {
      const n = Number(data == null ? void 0 : data.points);
      if (!Number.isFinite(n)) return null;
      return `${id}:${n.toFixed(2)}`;
    }).filter(Boolean).sort().join("|");
  }
  function findBestGradeInput() {
    const allInputs = Array.from(document.querySelectorAll('input[data-testid="grade-input"]'));
    if (allInputs.length === 0) return null;
    const visibleInputs = allInputs.filter((el) => el.offsetParent !== null && !el.disabled);
    if (visibleInputs.length === 0) return null;
    const panelInputs = visibleInputs.filter(
      (el) => el.closest('[data-testid="speedgrader-grading-panel"]') !== null
    );
    const candidates = panelInputs.length > 0 ? panelInputs : visibleInputs;
    const focused = candidates.find((el) => el === document.activeElement);
    if (focused) return focused;
    return candidates.reduce((best, el) => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const bestRect = best.getBoundingClientRect();
      const bestArea = bestRect.width * bestRect.height;
      return area > bestArea ? el : best;
    }, candidates[0]);
  }
  function updateGradeInput(score) {
    const applyValue = () => {
      const input = findBestGradeInput();
      if (!input) {
        logger.trace("[ScoreSync] Grade input not found for update");
        return;
      }
      input.focus();
      nativeInputValueSetter.call(input, String(score));
      input.setAttribute("value", String(score));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      input.dispatchEvent(new Event("focusout", { bubbles: true }));
      const readBack = input.value;
      logger.trace(`[ScoreSync] Applied value=${score}, read back value="${readBack}"`);
    };
    TIMING_CONSTANTS.GRADE_INPUT_UPDATE_DELAYS.forEach((delay) => {
      setTimeout(applyValue, delay);
    });
    logger.trace(`[ScoreSync] Grade input update scheduled for score: ${score}`);
  }
  async function submitGrade(courseId, assignmentId, studentId, score, apiClient2, retries = TIMING_CONSTANTS.SUBMIT_GRADE_MAX_RETRIES) {
    var _a18;
    logger.trace(`[ScoreSync] submitGrade called with score=${score}, retries=${retries}`);
    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.trace(`[ScoreSync] PUT ${url} (attempt ${attempt + 1}/${retries + 1})`);
        const data = await apiClient2.put(
          url,
          {
            submission: {
              posted_grade: score.toString()
            }
          },
          {},
          `submitGrade:${studentId}`
        );
        logger.trace(`[ScoreSync] Response data:`, data);
        const enteredScore = (_a18 = data == null ? void 0 : data.entered_score) != null ? _a18 : score;
        logger.info(`[ScoreSync] \u2705 Grade submitted successfully: ${enteredScore}`);
        return data;
      } catch (error) {
        logger.error(`[ScoreSync] Submit attempt ${attempt + 1}/${retries + 1} failed:`, error);
        if (attempt < retries) {
          const backoffMs = 1e3 * (attempt + 1);
          logger.trace(`[ScoreSync] Retrying in ${backoffMs}ms...`);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }
    logger.error("[ScoreSync] All submit attempts failed");
    return null;
  }
  async function fetchSubmission(courseId, assignmentId, studentId) {
    const params = new URLSearchParams();
    params.append("include[]", "rubric_assessment");
    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?${params.toString()}`;
    logger.trace(`[ScoreSync] GET ${url}`);
    try {
      const response = await fetch(url, {
        credentials: "same-origin"
      });
      logger.trace(`[ScoreSync] Fetch response status: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        logger.error(`[ScoreSync] Failed to fetch submission: ${response.status} ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      logger.trace(`[ScoreSync] Submission data: id=${data.id}, user_id=${data.user_id}, rubric_assessment=${!!data.rubric_assessment}`);
      if (data.rubric_assessment) {
        const criteriaCount = Object.keys(data.rubric_assessment).length;
        logger.trace(`[ScoreSync] Rubric has ${criteriaCount} criteria`);
      }
      return data;
    } catch (error) {
      logger.error("[ScoreSync] Exception in fetchSubmission:", error);
      return null;
    }
  }
  async function handleRubricSubmitInternal(courseId, assignmentId, studentId, apiClient2) {
    var _a18;
    logger.info("[ScoreSync] ========== RUBRIC SUBMIT HANDLER CALLED ==========");
    logger.trace(`[ScoreSync] Parameters: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`);
    if (inFlight) {
      logger.warn("[ScoreSync] Already processing another submission, skipping");
      metrics.skipped++;
      return;
    }
    inFlight = true;
    metrics.attempts++;
    logger.trace("[ScoreSync] Set inFlight=true");
    try {
      logger.trace("[ScoreSync] Fetching settings...");
      const settings = getSettings(courseId, assignmentId);
      logger.trace(`[ScoreSync] Settings: enabled=${settings.enabled}, method=${settings.method}`);
      if (!settings.enabled) {
        logger.info("[ScoreSync] SKIPPED - Score sync disabled for this assignment");
        metrics.skipped++;
        inFlight = false;
        return;
      }
      logger.trace("[ScoreSync] Waiting briefly for GraphQL commit, then polling rubric assessment...");
      let submission = null;
      for (let i = 0; i < TIMING_CONSTANTS.RUBRIC_FETCH_DELAYS.length; i++) {
        await new Promise((r) => setTimeout(r, TIMING_CONSTANTS.RUBRIC_FETCH_DELAYS[i]));
        submission = await fetchSubmission(courseId, assignmentId, studentId);
        const ra = submission == null ? void 0 : submission.rubric_assessment;
        if (ra && Object.keys(ra).length > 0) break;
      }
      logger.trace("[ScoreSync] Fetching submission with rubric assessment complete");
      if (!submission) {
        logger.error("[ScoreSync] FAILED - fetchSubmission returned null");
        metrics.failures++;
        inFlight = false;
        return;
      }
      logger.trace(`[ScoreSync] Submission fetched: id=${submission.id}, workflow_state=${submission.workflow_state}`);
      logger.trace(`[ScoreSync] Rubric assessment present: ${!!submission.rubric_assessment}`);
      if (!submission.rubric_assessment) {
        logger.warn("[ScoreSync] FAILED - No rubric assessment found in submission");
        metrics.failures++;
        inFlight = false;
        return;
      }
      const rubricPoints = Object.values(submission.rubric_assessment).map((c) => c.points);
      logger.trace(`[ScoreSync] Rubric points: [${rubricPoints.join(", ")}]`);
      const contextKey = getContextKey(courseId, assignmentId, studentId);
      const fingerprint = createRubricFingerprint(submission.rubric_assessment);
      const lastFingerprint = lastFingerprintByContext.get(contextKey);
      logger.trace(`[ScoreSync] Context: ${contextKey}`);
      logger.trace(`[ScoreSync] Rubric fingerprint: ${fingerprint}`);
      logger.trace(`[ScoreSync] Last fingerprint for context: ${lastFingerprint || "none"}`);
      if (fingerprint === lastFingerprint) {
        logger.info("[ScoreSync] SKIPPED - Rubric unchanged (fingerprint match)");
        metrics.skipped++;
        inFlight = false;
        return;
      }
      lastFingerprintByContext.set(contextKey, fingerprint);
      logger.trace("[ScoreSync] Fingerprint updated for context");
      const score = calculateGrade(submission.rubric_assessment, settings.method);
      logger.info(`[ScoreSync] Calculated score: ${score} (method: ${settings.method})`);
      logger.trace("[ScoreSync] Submitting grade to Canvas API...");
      const result = await submitGrade(courseId, assignmentId, studentId, score, apiClient2);
      if (!result) {
        logger.error("[ScoreSync] FAILED - submitGrade returned null");
        metrics.failures++;
        return;
      }
      logger.trace(`[ScoreSync] Grade submission result: entered_score=${result.entered_score}, score=${result.score}, workflow_state=${result.workflow_state}`);
      const finalScore = (_a18 = result == null ? void 0 : result.entered_score) != null ? _a18 : score;
      logger.trace(`[ScoreSync] Updating UI with final score: ${finalScore}`);
      updateGradeInput(finalScore);
      updateAssignmentScoreDisplay(finalScore);
      metrics.successes++;
      logger.info("[ScoreSync] \u2705 SCORE SYNC COMPLETE");
    } catch (error) {
      logger.error("[ScoreSync] ERROR in handleRubricSubmitInternal:", error);
      metrics.failures++;
    } finally {
      inFlight = false;
      logger.trace("[ScoreSync] Set inFlight=false");
    }
  }
  async function handleRubricSubmit(courseId, assignmentId, studentId, apiClient2) {
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("Rubric submit handler timeout")), TIMING_CONSTANTS.SUBMIT_GRADE_TIMEOUT)
    );
    try {
      await Promise.race([
        handleRubricSubmitInternal(courseId, assignmentId, studentId, apiClient2),
        timeoutPromise
      ]);
    } catch (error) {
      logger.error("[ScoreSync] Timeout or error in handleRubricSubmit:", error);
      metrics.failures++;
      inFlight = false;
    }
  }
  function isRubricSubmission(url, method, bodyText) {
    if (!url.includes("/api/graphql")) return false;
    if (method !== "POST") return false;
    return /SaveRubricAssessment|rubricAssessment|rubric_assessment/i.test(bodyText);
  }
  async function extractRequestBody(input, init2) {
    if (typeof (init2 == null ? void 0 : init2.body) === "string") {
      return init2.body;
    }
    if (input instanceof Request) {
      try {
        return await input.clone().text();
      } catch (error) {
        logger.trace(`[ScoreSync] Could not read Request body: ${error.message}`);
      }
    }
    return "";
  }
  function hookFetch() {
    logger.trace("[ScoreSync] Installing fetch hook...");
    if (window.__CG_SCORESYNC_FETCH_HOOKED__) {
      logger.warn("[ScoreSync] Fetch hook already installed");
      return;
    }
    window.__CG_SCORESYNC_FETCH_HOOKED__ = true;
    const originalFetch = window.fetch;
    let fetchCallCount = 0;
    window.fetch = async function(...args) {
      const callId = ++fetchCallCount;
      const input = args[0];
      const init2 = args[1];
      const isRequest = input instanceof Request;
      const url = isRequest ? input.url : String(input);
      const method = (isRequest ? input.method : (init2 == null ? void 0 : init2.method) || "GET").toUpperCase();
      const res = await originalFetch(...args);
      if (url.includes("/api/v1/") && url.includes("/submissions/")) {
        return res;
      }
      if (res.ok) {
        const bodyText = await extractRequestBody(input, init2);
        if (isRubricSubmission(url, method, bodyText)) {
          logger.info(`[ScoreSync] \u2705 RUBRIC SUBMISSION DETECTED`);
          logger.trace(`[ScoreSync] Call #${callId}: input type: ${isRequest ? "Request" : "string"}`);
          logger.trace(`[ScoreSync] Call #${callId}: Body preview: ${bodyText.substring(0, 200)}`);
          const parsed = parseSpeedGraderUrl();
          logger.trace(`[ScoreSync] Call #${callId}: Parsed IDs - courseId: ${parsed.courseId}, assignmentId: ${parsed.assignmentId}, studentId: ${parsed.studentId}`);
          if (parsed.courseId && parsed.assignmentId && parsed.studentId) {
            logger.trace(`[ScoreSync] Call #${callId}: Triggering handleRubricSubmit...`);
            void handleRubricSubmit(parsed.courseId, parsed.assignmentId, parsed.studentId, apiClient);
          } else {
            logger.warn(`[ScoreSync] Call #${callId}: Missing IDs, cannot handle rubric submit`);
          }
        }
      }
      return res;
    };
    logger.info("[ScoreSync] \u2705 Fetch hook installed successfully");
  }
  function updateAssignmentScoreDisplay(score) {
    const display = document.querySelector("[data-cg-assignment-score]");
    if (display) {
      display.textContent = score;
    }
  }
  function createUIControls(courseId, assignmentId) {
    try {
      logger.trace("[ScoreSync] createUIControls called");
      logger.trace('[ScoreSync] Looking for Canvas flex container: span[dir="ltr"][wrap="wrap"]');
      const flexContainer = document.querySelector('span[dir="ltr"][wrap="wrap"][direction="row"]');
      if (!flexContainer) {
        logger.trace("[ScoreSync] Flex container not found, trying fallback selector");
        const fallbackContainer = document.querySelector("span.css-jf6rsx-view--flex-flex");
        if (!fallbackContainer) {
          logger.trace("[ScoreSync] Canvas flex container not found in DOM");
          return false;
        }
        logger.trace("[ScoreSync] Found flex container via fallback selector");
      }
      const targetContainer = flexContainer || document.querySelector("span.css-jf6rsx-view--flex-flex");
      const existing = document.querySelector("[data-cg-scoresync-ui]");
      if (existing) {
        logger.trace("[ScoreSync] Removing existing UI controls before re-creation");
        existing.remove();
      }
      logger.trace("[ScoreSync] Canvas flex container found, creating UI controls");
      const settings = getSettings(courseId, assignmentId);
      logger.trace(`[ScoreSync] Settings loaded: enabled=${settings.enabled}, method=${settings.method}`);
      const container = document.createElement("div");
      container.setAttribute("data-cg-scoresync-ui", "true");
      container.setAttribute("data-cg-enabled", settings.enabled ? "true" : "false");
      container.style.cssText = `
            display: inline-flex;
            align-items: stretch;
            gap: 0.75rem;
            margin-left: 0.75rem;
            padding-left: 0.75rem;
            padding-right: 0;
            height: 3rem;
            border-radius: 0.35rem;
            background: ${UI_COLORS.CONTAINER_BG};
            border: 1px solid ${UI_COLORS.CONTAINER_BORDER};
            flex-shrink: 0;
            font: inherit;
            color: inherit;
            transition: opacity 0.2s ease;
            opacity: ${settings.enabled ? "1" : "0.6"};
            overflow: hidden;
        `;
      container.innerHTML = `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0; white-space: nowrap;">
                <input type="checkbox" data-cg-toggle ${settings.enabled ? "checked" : ""}
                       style="margin: 0; transform: scale(1.25); transform-origin: center; cursor: pointer;">
                <span style="font-weight: 600;">Score Sync</span>
            </label>
            <select class="ic-Input" data-cg-method ${settings.enabled ? "" : "disabled"}
                    style="width: auto; min-width: 4rem; height: 2.375rem; min-height: 2.375rem; padding-top: 0.25rem; padding-bottom: 0.25rem; align-self: center;">
                <option value="min" ${settings.method === "min" ? "selected" : ""}>MIN</option>
                <option value="avg" ${settings.method === "avg" ? "selected" : ""}>AVG</option>
                <option value="max" ${settings.method === "max" ? "selected" : ""}>MAX</option>
            </select>
            <div style="display: flex; height: 100%; flex-shrink: 0; margin: 0;">
                <div style="display: flex; align-items: center; padding-left: 0.75rem; padding-right: 0.75rem; height: 100%; background-color: ${UI_COLORS.LABEL_BG};">
                    <span style="font-weight: 600; white-space: nowrap;">Assignment Score</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: center; padding: 0 0.75rem; height: 100%; background-color: ${UI_COLORS.SCORE_BG};">
                    <span style="color: #fff; font-weight: 700; white-space: nowrap;"><span data-cg-assignment-score>--</span> pts</span>
                </div>
            </div>
        `;
      const toggle = container.querySelector("[data-cg-toggle]");
      const methodSelect = container.querySelector("[data-cg-method]");
      toggle.addEventListener("change", () => {
        settings.enabled = toggle.checked;
        saveSettings(courseId, assignmentId, settings);
        container.setAttribute("data-cg-enabled", settings.enabled ? "true" : "false");
        container.style.opacity = settings.enabled ? "1" : "0.6";
        methodSelect.disabled = !settings.enabled;
        methodSelect.style.cursor = settings.enabled ? "pointer" : "not-allowed";
        logger.info(`[ScoreSync] Score sync ${settings.enabled ? "enabled" : "disabled"}`);
      });
      methodSelect.addEventListener("change", () => {
        settings.method = methodSelect.value;
        saveSettings(courseId, assignmentId, settings);
        logger.info(`[ScoreSync] Method changed to: ${settings.method}`);
      });
      logger.trace("[ScoreSync] Appending UI container as flex item");
      targetContainer.appendChild(container);
      logger.info("[ScoreSync] \u2705 UI controls created and inserted into DOM");
      return true;
    } catch (error) {
      logger.error("[ScoreSync] Failed to create UI controls:", error);
      return false;
    }
  }
  function ensureScoreSyncUiPresent() {
    const { courseId, assignmentId } = parseSpeedGraderUrl();
    if (!courseId || !assignmentId) {
      logger.trace("[ScoreSync] Cannot ensure UI: missing IDs");
      return;
    }
    if (document.querySelector("[data-cg-scoresync-ui]")) return;
    const ok = createUIControls(courseId, assignmentId);
    if (ok) {
      logger.info(`[ScoreSync] UI re-injected for course=${courseId}, assignment=${assignmentId}`);
    } else {
      logger.warn("[ScoreSync] Failed to re-inject UI (container not found)");
    }
  }
  function scheduleUiRecheck() {
    setTimeout(() => void ensureScoreSyncUiPresent(), 0);
    setTimeout(() => void ensureScoreSyncUiPresent(), TIMING_CONSTANTS.NAVIGATION_RECHECK_DELAY);
  }
  function startTemporaryUiKeepalive() {
    if (uiKeepaliveInterval) {
      clearInterval(uiKeepaliveInterval);
    }
    uiKeepaliveInterval = setInterval(() => void ensureScoreSyncUiPresent(), TIMING_CONSTANTS.UI_KEEPALIVE_INTERVAL);
    logger.trace(`[ScoreSync] Temporary UI keepalive started (${TIMING_CONSTANTS.UI_KEEPALIVE_INTERVAL}ms checks for ${TIMING_CONSTANTS.UI_KEEPALIVE_DURATION}ms)`);
    setTimeout(() => {
      if (uiKeepaliveInterval) {
        clearInterval(uiKeepaliveInterval);
        uiKeepaliveInterval = null;
        logger.trace("[ScoreSync] Temporary UI keepalive stopped (duration expired)");
      }
    }, TIMING_CONSTANTS.UI_KEEPALIVE_DURATION);
  }
  function hookHistoryApi() {
    if (window.__CG_SCORESYNC_HISTORY_HOOKED__) return;
    window.__CG_SCORESYNC_HISTORY_HOOKED__ = true;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      scheduleUiRecheck();
      startTemporaryUiKeepalive();
    };
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      scheduleUiRecheck();
      startTemporaryUiKeepalive();
    };
    window.addEventListener("popstate", () => {
      scheduleUiRecheck();
      startTemporaryUiKeepalive();
    });
    logger.trace("[ScoreSync] History API hooks installed");
  }
  async function initSpeedGraderAutoGrade() {
    var _a18;
    logger.info("[ScoreSync] ========== INITIALIZATION STARTED ==========");
    if (initialized3) {
      logger.warn("[ScoreSync] Already initialized, skipping");
      return;
    }
    initialized3 = true;
    logger.trace("[ScoreSync] Initializing SpeedGrader score sync module");
    const roleGroup = getUserRoleGroup();
    logger.trace(`[ScoreSync] User role group: ${roleGroup}`);
    if (roleGroup !== "teacher_like") {
      logger.info(`[ScoreSync] SKIPPED - user is ${roleGroup}, not teacher_like`);
      return;
    }
    const { courseId, assignmentId, studentId } = await parseSpeedGraderUrlWithRetry();
    if (!courseId || !assignmentId || !studentId) {
      logger.error("[ScoreSync] FAILED - Missing required IDs after retries:", { courseId, assignmentId, studentId });
      logger.error("[ScoreSync] Full URL:", window.location.href);
      logger.error("[ScoreSync] Query params:", window.location.search);
      initialized3 = false;
      return;
    }
    logger.trace("[ScoreSync] Creating CanvasApiClient...");
    apiClient = new CanvasApiClient();
    logger.trace("[ScoreSync] CanvasApiClient created successfully");
    let snapshot = getCourseSnapshot(courseId);
    logger.trace(`[ScoreSync] Course snapshot from cache: ${snapshot ? "FOUND" : "NOT FOUND"}`);
    if (!snapshot) {
      logger.trace("[ScoreSync] Populating course snapshot...");
      const courseName = ((_a18 = document.title.split(":")[0]) == null ? void 0 : _a18.trim()) || "Unknown Course";
      logger.trace(`[ScoreSync] Course name from title: "${courseName}"`);
      snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
      logger.trace(`[ScoreSync] Snapshot population result: ${snapshot ? "SUCCESS" : "FAILED"}`);
    }
    if (!snapshot) {
      logger.error("[ScoreSync] FAILED - Could not get course snapshot");
      return;
    }
    logger.info(`[ScoreSync] Course model: ${snapshot.model} (reason: ${snapshot.modelReason})`);
    if (snapshot.model !== "standards") {
      logger.info(`[ScoreSync] SKIPPED - course is ${snapshot.model}, not standards-based`);
      return;
    }
    logger.info("[ScoreSync] \u2705 Course is standards-based, proceeding with initialization");
    logger.trace("[ScoreSync] Installing fetch hook...");
    hookFetch();
    logger.trace("[ScoreSync] Installing history API hooks...");
    hookHistoryApi();
    if (FEATURE_FLAGS.UI_KEEPALIVE_ENABLED) {
      logger.trace("[ScoreSync] Starting temporary UI keepalive...");
      startTemporaryUiKeepalive();
    }
    logger.trace("[ScoreSync] Attempting immediate UI creation...");
    createUIControls(courseId, assignmentId);
    logger.info("[ScoreSync] ========== INITIALIZATION COMPLETE ==========");
  }

  // src/student/gradePageCustomizer.js
  var processed = false;
  function getAssignmentsTabLI() {
    return document.querySelector('li[aria-controls="assignments"]');
  }
  function getLearningMasteryLink() {
    return document.querySelector('li[aria-controls="outcomes"] a[href="#outcomes"]');
  }
  function getRightSideElement() {
    return document.querySelector("#right-side-wrapper") || document.querySelector("#right-side");
  }
  function ensureAssignmentsTabRemoved(retries = 20, everyMs = 250) {
    const li = getAssignmentsTabLI();
    if (li) {
      li.remove();
      logger.debug("Assignments tab removed");
      return true;
    }
    if (retries > 0) {
      setTimeout(() => ensureAssignmentsTabRemoved(retries - 1, everyMs), everyMs);
    } else {
      logger.trace("Assignments tab not found after retries");
    }
    return false;
  }
  function goToLearningMasteryTab() {
    if (location.hash !== "#tab-outcomes") {
      history.replaceState(null, "", location.pathname + location.search + "#tab-outcomes");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    const link = getLearningMasteryLink();
    if (link) {
      link.click();
    } else {
      setTimeout(goToLearningMasteryTab, 300);
    }
  }
  function replaceRightSidebar(gradeData) {
    const { score, letterGrade } = gradeData;
    const rightSide = getRightSideElement();
    if (!rightSide) {
      logger.trace("Right sidebar not found; deferring...");
      return;
    }
    const finalGradeDiv = rightSide.querySelector(".student_assignment.final_grade");
    if (!finalGradeDiv) {
      logger.trace("Final grade element (.student_assignment.final_grade) not found in sidebar; deferring...");
      return;
    }
    if (rightSide.dataset.processed) {
      const gradeSpan2 = finalGradeDiv.querySelector(".grade");
      const letterGradeSpan2 = finalGradeDiv.querySelector(".letter_grade");
      if (gradeSpan2) {
        gradeSpan2.textContent = typeof score === "number" ? score.toFixed(2) : String(score);
      }
      if (letterGradeSpan2 && letterGrade) {
        letterGradeSpan2.textContent = letterGrade;
      }
      logger.trace("Grade display updated in existing sidebar");
      return;
    }
    const gradeSpan = finalGradeDiv.querySelector(".grade");
    const letterGradeSpan = finalGradeDiv.querySelector(".letter_grade");
    if (gradeSpan) {
      gradeSpan.textContent = typeof score === "number" ? score.toFixed(2) : String(score);
    }
    if (letterGradeSpan && letterGrade) {
      letterGradeSpan.textContent = letterGrade;
    }
    rightSide.dataset.processed = "true";
    const displayValue = formatGradeDisplay(score, letterGrade);
    logger.debug(`Sidebar grade updated to: ${displayValue}`);
  }
  function updateBottomGradeRow(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);
    document.querySelectorAll("tr.student_assignment.hard_coded.final_grade").forEach((row) => {
      const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
      const possibleEl = row.querySelector(".details .possible.points_possible");
      if (gradeEl) {
        if (gradeEl.textContent !== displayValue) {
          gradeEl.textContent = displayValue;
          gradeEl.dataset.normalized = "true";
        }
      }
      if (possibleEl) {
        const txt = possibleEl.textContent.trim();
        if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
          possibleEl.textContent = "";
        }
      }
    });
    logger.debug(`Bottom grade row updated to: ${displayValue}`);
  }
  function applyCustomizations(gradeData) {
    if (processed) return false;
    if (REMOVE_ASSIGNMENT_TAB) {
      ensureAssignmentsTabRemoved();
      goToLearningMasteryTab();
    }
    replaceRightSidebar(gradeData);
    updateBottomGradeRow(gradeData);
    processed = true;
    return true;
  }
  async function runOnce() {
    var _a18, _b18;
    if (processed) return true;
    const courseId = getCourseId();
    if (!courseId) {
      logger.warn("Cannot get course ID from URL");
      return false;
    }
    const courseName = ((_b18 = (_a18 = document.querySelector(".course-title, h1, #breadcrumbs li:last-child")) == null ? void 0 : _a18.textContent) == null ? void 0 : _b18.trim()) || "Course";
    let snapshot = getCourseSnapshot(courseId);
    if (!snapshot || shouldRefreshGrade(courseId, PAGE_CONTEXT.COURSE_GRADES)) {
      logger.trace(`Fetching grade data from API for course ${courseId}...`);
      const apiClient2 = new CanvasApiClient();
      snapshot = await refreshCourseSnapshot(courseId, courseName, apiClient2, PAGE_CONTEXT.COURSE_GRADES);
    }
    if (!snapshot) {
      logger.trace("No grade data available from snapshot");
      return false;
    }
    if (snapshot.model !== "standards") {
      logger.debug(`Skipping grade page customization - course is ${snapshot.model} (reason: ${snapshot.modelReason})`);
      return false;
    }
    const gradeData = {
      score: snapshot.displayScore,
      letterGrade: snapshot.displayLetterGrade
    };
    logger.trace(`Using display grade data from snapshot: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}, type=${snapshot.displayType}`);
    return applyCustomizations(gradeData);
  }
  async function initGradePageCustomizer() {
    logger.debug("Initializing grade page customizer");
    let didRun = await runOnce();
    if (!didRun) {
      createConditionalObserver(async () => {
        const success = await runOnce();
        if (success) {
          logger.debug("Student grade customization applied after DOM updates");
        }
        return success;
      }, {
        timeout: 3e4,
        config: OBSERVER_CONFIGS.CHILD_LIST_AND_ATTRIBUTES,
        target: document.body,
        name: "GradePageCustomizer"
      });
    }
  }

  // src/student/allGradesPageCustomizer.js
  var processed2 = false;
  async function fetchActiveCourses2(apiClient2) {
    var _a18;
    try {
      const courses = await apiClient2.get(
        "/api/v1/courses?enrollment_state=active&include[]=total_scores",
        {},
        "fetchActiveCourses"
      );
      logger.trace(`[All-Grades] Raw courses response: ${(courses == null ? void 0 : courses.length) || 0} courses`);
      if (logger.isTraceEnabled() && courses && courses.length > 0) {
        logger.trace(`[All-Grades] First course structure:`, courses[0]);
        logger.trace(`[All-Grades] First course enrollments:`, courses[0].enrollments);
      }
      const studentCourses = courses.filter((course) => {
        const enrollments = course.enrollments || [];
        const hasStudentEnrollment = enrollments.some(
          (e) => e.type === "student" || e.type === "StudentEnrollment" || e.role === "StudentEnrollment"
        );
        if (logger.isTraceEnabled() && enrollments.length > 0) {
          logger.trace(`[All-Grades] Course ${course.id} (${course.name}): enrollments =`, enrollments.map((e) => e.type));
        }
        return hasStudentEnrollment;
      });
      const coursesWithEnrollmentData = studentCourses.map((course) => {
        const enrollments = course.enrollments || [];
        const studentEnrollment = enrollments.find(
          (e) => e.type === "student" || e.type === "StudentEnrollment" || e.role === "StudentEnrollment"
        );
        return {
          id: String(course.id),
          name: course.name,
          enrollmentData: studentEnrollment || null
        };
      });
      logger.info(`[All-Grades] Found ${coursesWithEnrollmentData.length} active student courses out of ${courses.length} total courses`);
      if (logger.isTraceEnabled() && coursesWithEnrollmentData.length > 0) {
        const firstCourse = coursesWithEnrollmentData[0];
        logger.trace(`[All-Grades] First course enrollment data:`, firstCourse.enrollmentData);
        if ((_a18 = firstCourse.enrollmentData) == null ? void 0 : _a18.grades) {
          logger.trace(`[All-Grades] First course grades object:`, firstCourse.enrollmentData.grades);
        }
      }
      return coursesWithEnrollmentData;
    } catch (error) {
      logger.error("[All-Grades] Failed to fetch active courses:", error);
      return [];
    }
  }
  async function enrichCoursesWithSnapshots(courses, apiClient2) {
    const startTime = performance.now();
    const enrichedPromises = courses.map(async (course) => {
      const { id: courseId, name: courseName } = course;
      const needsRefresh = shouldRefreshGrade(courseId, PAGE_CONTEXT.ALL_GRADES);
      let snapshot = getCourseSnapshot(courseId);
      if (!snapshot || needsRefresh) {
        logger.trace(`[All-Grades] ${!snapshot ? "Populating" : "Refreshing"} snapshot for course ${courseId}...`);
        snapshot = await refreshCourseSnapshot(courseId, courseName, apiClient2, PAGE_CONTEXT.ALL_GRADES);
      }
      if (!snapshot) {
        logger.trace(`[All-Grades] No snapshot available for course ${courseId}, skipping`);
        return null;
      }
      const displayScore = snapshot.displayScore;
      const displayLetterGrade = snapshot.displayLetterGrade;
      const displayType = snapshot.displayType;
      const isStandardsBased = snapshot.isStandardsBased;
      logger.trace(`[All-Grades] Course "${courseName}" (${courseId}): displayScore=${displayScore}, displayType=${displayType}, displayLetterGrade=${displayLetterGrade}, isStandardsBased=${isStandardsBased}`);
      return {
        courseId,
        courseName,
        courseUrl: `/courses/${courseId}/grades`,
        displayScore,
        displayLetterGrade,
        displayType,
        isStandardsBased,
        gradeSource: snapshot.gradeSource
      };
    });
    const enrichedCourses = (await Promise.all(enrichedPromises)).filter((c) => c !== null);
    logger.trace(`[All-Grades] Enriched ${enrichedCourses.length} courses in ${(performance.now() - startTime).toFixed(2)}ms`);
    return enrichedCourses;
  }
  async function fetchCourseGrades() {
    const startTime = performance.now();
    const apiClient2 = new CanvasApiClient();
    try {
      logger.trace("[All-Grades] Step 1: Fetching active courses from API...");
      const courses = await fetchActiveCourses2(apiClient2);
      if (courses.length === 0) {
        logger.warn("[All-Grades] No active student courses found");
        return [];
      }
      logger.trace(`[All-Grades] Found ${courses.length} active student courses`);
      logger.trace(`[All-Grades] Step 2: Enriching courses with snapshots...`);
      const enrichedCourses = await enrichCoursesWithSnapshots(courses, apiClient2);
      logger.trace(`[All-Grades] Total processing time: ${(performance.now() - startTime).toFixed(2)}ms`);
      const withGrades = enrichedCourses.filter((c) => c.displayScore !== null).length;
      const withoutGrades = enrichedCourses.length - withGrades;
      const fromEnrollment = enrichedCourses.filter((c) => c.gradeSource === "enrollment").length;
      const fromSnapshot = enrichedCourses.filter((c) => c.gradeSource === "snapshot").length;
      const standardsBased = enrichedCourses.filter((c) => c.isStandardsBased).length;
      const traditional = enrichedCourses.length - standardsBased;
      logger.debug(`[All-Grades] Processed ${enrichedCourses.length} courses: ${standardsBased} standards-based, ${traditional} traditional`);
      logger.debug(`[All-Grades] Grade sources: ${fromEnrollment} from enrollment, ${fromSnapshot} from snapshot`);
      if (logger.isTraceEnabled()) {
        logger.trace("[All-Grades] Course breakdown:");
        enrichedCourses.forEach((c) => {
          const type = c.isStandardsBased ? "SBG" : "TRAD";
          const display = c.displayScore !== null ? c.isStandardsBased ? `${c.displayScore.toFixed(2)} (${c.displayLetterGrade || "N/A"})` : `${c.displayScore.toFixed(2)}%` : "N/A";
          logger.trace(`  [${type}] ${c.courseName}: ${display}`);
        });
      }
      return enrichedCourses;
    } catch (error) {
      logger.error("[All-Grades] Failed to fetch course grades:", error);
      throw error;
    }
  }
  function createGradesTable(courses) {
    const table = document.createElement("table");
    table.className = "ic-Table ic-Table--hover-row ic-Table--striped customized-grades-table";
    table.style.cssText = "width: 100%; margin-top: 1rem;";
    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th class="ic-Table-header" style="text-align: left; padding: 0.75rem;">Course</th>
            <th class="ic-Table-header" style="text-align: right; padding: 0.75rem;">Grade</th>
        </tr>
    `;
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const course of courses) {
      const row = document.createElement("tr");
      row.className = "ic-Table-row";
      const nameCell = document.createElement("td");
      nameCell.className = "ic-Table-cell";
      nameCell.style.padding = "0.75rem";
      const courseLink = document.createElement("a");
      courseLink.href = course.courseUrl;
      courseLink.textContent = course.courseName;
      courseLink.style.cssText = "color: #0374B5; text-decoration: none;";
      courseLink.addEventListener("mouseenter", () => {
        courseLink.style.textDecoration = "underline";
      });
      courseLink.addEventListener("mouseleave", () => {
        courseLink.style.textDecoration = "none";
      });
      nameCell.appendChild(courseLink);
      const gradeCell = document.createElement("td");
      gradeCell.className = "ic-Table-cell";
      gradeCell.style.cssText = "text-align: right; padding: 0.75rem; font-weight: bold;";
      if (course.displayScore !== null) {
        if (course.displayType === "points") {
          gradeCell.textContent = formatGradeDisplay(course.displayScore, course.displayLetterGrade);
          gradeCell.style.color = "#0B874B";
          logger.trace(`[Table] ${course.courseName}: Rendering as SBG (${course.displayScore.toFixed(2)} ${course.displayLetterGrade})`);
        } else {
          gradeCell.textContent = `${course.displayScore.toFixed(2)}%`;
          gradeCell.style.color = "#2D3B45";
          logger.trace(`[Table] ${course.courseName}: Rendering as traditional (${course.displayScore.toFixed(2)}%)`);
        }
      } else {
        gradeCell.textContent = "N/A";
        gradeCell.style.color = "#73818C";
        logger.trace(`[Table] ${course.courseName}: No grade available`);
      }
      logger.trace(`[Table] ${course.courseName} details: isStandardsBased=${course.isStandardsBased}, displayType=${course.displayType}, displayScore=${course.displayScore}`);
      row.appendChild(nameCell);
      row.appendChild(gradeCell);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
  }
  function replaceGradesTable(courses) {
    const originalTable = document.querySelector("table.course_details.student_grades");
    if (!originalTable) {
      logger.warn("Original grades table not found");
      return;
    }
    const existingCustomTable = document.getElementById("customized-grades-table");
    if (existingCustomTable) {
      logger.debug("Removing existing customized table to prevent duplicates");
      existingCustomTable.remove();
    }
    originalTable.style.display = "none";
    originalTable.dataset.customized = "true";
    const newTable = createGradesTable(courses);
    newTable.id = "customized-grades-table";
    originalTable.parentNode.insertBefore(newTable, originalTable.nextSibling);
    logger.info(`Replaced grades table with ${courses.length} courses`);
  }
  async function applyCustomizations2() {
    if (processed2) {
      logger.debug("All-grades customizations already applied");
      return;
    }
    try {
      logger.info("Applying all-grades page customizations...");
      const courses = await fetchCourseGrades();
      if (courses.length === 0) {
        logger.warn("No courses found, skipping customization");
        return;
      }
      replaceGradesTable(courses);
      const standardsBasedCount = courses.filter((c) => c.isStandardsBased).length;
      const traditionalCount = courses.length - standardsBasedCount;
      logger.info(`All-grades customization complete: ${courses.length} courses (${standardsBasedCount} SBG, ${traditionalCount} traditional)`);
      processed2 = true;
      document.body.classList.remove("cg_processing_grades");
    } catch (error) {
      logger.error("Failed to apply all-grades customizations:", error);
      document.body.classList.remove("cg_processing_grades");
    }
  }
  function initAllGradesPageCustomizer() {
    logger.debug("Initializing all-grades page customizer");
    applyCustomizations2();
    createPersistentObserver(() => {
      const table = document.querySelector("table.course_details.student_grades");
      if (table && !table.dataset.customized && !processed2) {
        logger.debug("Grades table detected, applying customizations...");
        applyCustomizations2();
      }
    }, {
      config: OBSERVER_CONFIGS.CHILD_LIST,
      target: document.body,
      name: "AllGradesPageCustomizer"
    });
  }

  // src/student/gradeNormalizer.js
  async function removeFractionScores() {
    document.querySelectorAll(".score-display").forEach((scoreEl) => {
      const html = scoreEl.innerHTML;
      const cleaned = html.replace(/<\/b>\s*\/\s*\d+(\.\d+)?\s*pts/i, "</b>");
      if (html !== cleaned) scoreEl.innerHTML = cleaned;
    });
    document.querySelectorAll("span.tooltip").forEach((tooltipEl) => {
      Array.from(tooltipEl.children).forEach((child) => {
        if (child.childNodes.length === 1 && child.childNodes[0].nodeType === Node.TEXT_NODE && /^\/\s*\d+(\.\d+)?$/.test(child.textContent.trim())) {
          child.remove();
        }
      });
    });
    document.querySelectorAll("span.grade").forEach((gradeEl) => {
      if (gradeEl.dataset.normalized === "true") {
        return;
      }
      const txt = gradeEl.textContent.trim();
      if (/\([^)]+\)/.test(txt)) {
        return;
      }
      const match = txt.match(/^(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?$/);
      if (match) {
        gradeEl.textContent = match[1];
      }
    });
    document.querySelectorAll("span, div, td").forEach((el) => {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE && /\/\s*\d+(\.\d+)?\s*pts/i.test(el.textContent)) {
        el.textContent = el.textContent.replace(/\/\s*\d+(\.\d+)?\s*pts/gi, "");
      }
    });
    document.querySelectorAll(".screenreader-only").forEach((srEl) => {
      const txt = srEl.textContent;
      const cleanedTxt = txt.replace(/out of\s*\d+(\.\d+)?\s*points?\.?/i, "").trim();
      if (txt !== cleanedTxt) srEl.textContent = cleanedTxt;
    });
    document.querySelectorAll("span.css-1jyml41-text").forEach((scoreEl) => {
      const txt = scoreEl.textContent.trim();
      const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
      if (m) scoreEl.textContent = m[1];
    });
    document.querySelectorAll("span.points-value strong").forEach((strongEl) => {
      const txt = strongEl.textContent.trim();
      const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
      if (m) strongEl.textContent = m[1];
    });
    document.querySelectorAll("span.css-7cbhck-text").forEach((scoreEl) => {
      const txt = scoreEl.textContent.trim();
      const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
      if (m) scoreEl.textContent = m[1];
    });
    document.querySelectorAll('a[data-track-category="dashboard"][data-track-label="recent feedback"]').forEach((cardEl) => {
      const titleEl = cardEl.querySelector(".recent_feedback_title");
      const strongEl = cardEl.querySelector(".event-details strong");
      if (!titleEl || !strongEl) return;
      const titleText = titleEl.textContent.trim().replace(/\s+/g, " ").toLowerCase();
      const targetName = AVG_ASSIGNMENT_NAME.trim().replace(/\s+/g, " ").toLowerCase();
      if (titleText !== targetName) return;
      const scoreText = strongEl.textContent.trim();
      const m = scoreText.match(/^(\d+(\.\d+)?)\s+out of\s+\d+(\.\d+)?$/i);
      if (m) {
        strongEl.textContent = m[1];
      }
    });
    normalizeGroupTotalsRow();
  }
  function normalizeGroupTotalsRow() {
    document.querySelectorAll("tr.student_assignment.hard_coded.group_total").forEach((row) => {
      const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
      if (gradeEl) {
        const raw = gradeEl.textContent.trim();
        if (/^\d+(\.\d+)?%?$/.test(raw)) {
          gradeEl.textContent = "";
        }
      }
      const possibleEl = row.querySelector(".details .possible.points_possible");
      if (possibleEl) {
        const txt = possibleEl.textContent.trim();
        if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
          possibleEl.textContent = "";
        }
      }
    });
  }

  // src/student/cleanupObserver.js
  function shouldClean() {
    return isDashboardPage() || isCoursePageNeedingCleanup();
  }
  function startCleanupObservers() {
    logger.debug("Starting cleanup observers for grade normalization");
    if (shouldClean()) {
      removeFractionScores().catch((err) => {
        logger.warn("Error in initial removeFractionScores:", err);
      });
    }
    const debouncedClean = debounce(() => {
      if (shouldClean()) {
        removeFractionScores().catch((err) => {
          logger.warn("Error in removeFractionScores:", err);
        });
      }
    }, 100);
    setTimeout(() => {
      if (shouldClean()) {
        createPersistentObserver(() => {
          debouncedClean();
        }, {
          config: OBSERVER_CONFIGS.CHILD_LIST,
          target: document.body,
          name: "GradeCleanupObserver"
        });
      }
      let lastUrl = location.href;
      setInterval(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          debouncedClean();
        }
      }, 1e3);
    }, 0);
  }
  async function initCleanupObservers(retryCount = 0, maxRetries = 5) {
    if (isAllGradesPage()) {
      logger.trace("Skipping cleanup observers on all-grades page (no course context)");
      return;
    }
    if (isDashboardPage()) {
      logger.debug("Initializing cleanup observers for dashboard");
      startCleanupObservers();
    } else {
      const courseId = getCourseId();
      if (!courseId) {
        logger.trace("Skipping cleanup observers - no course ID");
        return;
      }
      const snapshot = getCourseSnapshot(courseId);
      if (!snapshot) {
        if (retryCount < maxRetries) {
          const delay = Math.min(1e3, 200 * Math.pow(1.5, retryCount));
          logger.trace(`No snapshot available yet, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
          setTimeout(async () => {
            await initCleanupObservers(retryCount + 1, maxRetries);
          }, delay);
        } else {
          logger.trace("Skipping cleanup observers - no snapshot available after max retries");
        }
        return;
      }
      if (snapshot.model !== "standards") {
        logger.debug(`Skipping fraction cleanup \u2014 course is ${snapshot.model} (reason: ${snapshot.modelReason})`);
        return;
      }
      logger.debug("Initializing cleanup observers for standards-based course page");
      startCleanupObservers();
    }
  }

  // src/student/studentGradeCustomization.js
  async function initStudentGradeCustomization() {
    if (!ENABLE_STUDENT_GRADE_CUSTOMIZATION) {
      logger.debug("Student grade customization disabled");
      return;
    }
    const roleGroup = getUserRoleGroup();
    if (roleGroup !== "student_like") {
      logger.debug("User is not student-like, skipping student customizations");
      return;
    }
    logger.info("Initializing student grade customizations");
    if (isAllGradesPage()) {
      logger.debug("On all-grades page, initializing all-grades customizer");
      initAllGradesPageCustomizer();
    } else if (isSingleCourseGradesPage()) {
      logger.debug("On single-course grades page, initializing grade page customizer");
      await initGradePageCustomizer();
    }
    await initCleanupObservers();
  }

  // src/student/gradeExtractor.js
  function scoreToGradeLevel(score) {
    var _a18;
    const numScore = typeof score === "string" ? parseFloat(score) : score;
    if (isNaN(numScore)) {
      logger.trace(`Invalid score for grade level conversion: ${score}`);
      return null;
    }
    const sortedRatings = [...OUTCOME_AND_RUBRIC_RATINGS].sort((a, b) => b.points - a.points);
    for (const rating of sortedRatings) {
      if (numScore >= rating.points) {
        return rating.description;
      }
    }
    return ((_a18 = sortedRatings[sortedRatings.length - 1]) == null ? void 0 : _a18.description) || null;
  }

  // src/teacher/teacherStudentGradeCustomizer.js
  var processed3 = false;
  var currentStudentId = null;
  var urlChangeDetectionSetup = false;
  async function fetchStudentAvgScore(courseId, studentId, apiClient2) {
    var _a18, _b18;
    logger.trace(`[Teacher] fetchStudentAvgScore: courseId=${courseId}, studentId=${studentId}`);
    try {
      logger.trace(`[Teacher] Searching for AVG assignment "${AVG_ASSIGNMENT_NAME}"...`);
      const assignments = await apiClient2.get(
        `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
        {},
        "fetchAvgAssignment"
      );
      logger.trace(`[Teacher] Found ${(assignments == null ? void 0 : assignments.length) || 0} assignments matching "${AVG_ASSIGNMENT_NAME}"`);
      const avgAssignment = assignments == null ? void 0 : assignments.find((a) => a.name === AVG_ASSIGNMENT_NAME);
      if (!avgAssignment) {
        logger.warn(`[Teacher] AVG assignment "${AVG_ASSIGNMENT_NAME}" not found in course ${courseId}`);
        return null;
      }
      logger.trace(`[Teacher] Found AVG assignment: id=${avgAssignment.id}, name="${avgAssignment.name}"`);
      logger.trace(`[Teacher] Fetching submission for student ${studentId}, assignment ${avgAssignment.id}...`);
      const submission = await apiClient2.get(
        `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/${studentId}`,
        {},
        "fetchAvgSubmission"
      );
      logger.trace(
        `[Teacher] Submission fetched`,
        {
          courseId,
          studentId,
          assignmentId: avgAssignment.id,
          score: submission == null ? void 0 : submission.score,
          grade: submission == null ? void 0 : submission.grade,
          workflow_state: submission == null ? void 0 : submission.workflow_state
        }
      );
      const score = submission == null ? void 0 : submission.score;
      if (score === null || score === void 0) {
        logger.warn(`[Teacher] No score found in AVG assignment submission for student ${studentId}`);
        return null;
      }
      logger.trace(`[Teacher] Student score found: ${score}`);
      let letterGrade = (_b18 = (_a18 = submission == null ? void 0 : submission.grade) != null ? _a18 : submission == null ? void 0 : submission.entered_grade) != null ? _b18 : null;
      if (!letterGrade || !isNaN(parseFloat(letterGrade))) {
        logger.trace(`[Teacher] No valid letter grade from submission API (got: ${letterGrade}), calculating from score...`);
        letterGrade = scoreToGradeLevel(score);
        if (letterGrade) {
          logger.trace(`[Teacher] Calculated letter grade from score ${score}: "${letterGrade}"`);
        }
      } else {
        logger.trace(`[Teacher] Letter grade from submission API: "${letterGrade}"`);
      }
      logger.debug(`[Teacher] \u2705 Student ${studentId} AVG score: ${score}, letter grade: ${letterGrade}`);
      return { score, letterGrade };
    } catch (error) {
      logger.warn(`[Teacher] \u274C Failed to fetch student AVG score:`, error.message);
      return null;
    }
  }
  function updateFinalGradeRow(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay(score, letterGrade);
    logger.trace(`updateFinalGradeRow called with score=${score}, letterGrade=${letterGrade}, displayValue="${displayValue}"`);
    const finalGradeRows = [
      ...document.querySelectorAll("tr.student_assignment.hard_coded.final_grade"),
      ...document.querySelectorAll("tr.student_assignment.final_grade"),
      ...document.querySelectorAll("tr.final_grade")
    ];
    if (finalGradeRows.length === 0) {
      logger.trace("No final grade rows found");
      return;
    }
    logger.trace(`Found ${finalGradeRows.length} final grade row(s)`);
    finalGradeRows.forEach((row, index) => {
      const gradeEl = row.querySelector(".assignment_score .tooltip .grade") || row.querySelector(".assignment_score .grade") || row.querySelector(".tooltip .grade") || row.querySelector(".grade");
      if (gradeEl) {
        const currentText = gradeEl.textContent.trim();
        if (currentText !== displayValue) {
          gradeEl.textContent = displayValue;
          gradeEl.dataset.normalized = "true";
          logger.trace(`Updated final grade row ${index}: "${currentText}" -> "${displayValue}"`);
        } else {
          logger.trace(`Final grade row ${index} already has correct value: "${currentText}"`);
        }
      } else {
        logger.trace(`Final grade row ${index}: grade element not found`);
      }
      const possibleEl = row.querySelector(".details .possible.points_possible");
      if (possibleEl) {
        const txt = possibleEl.textContent.trim();
        if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
          possibleEl.textContent = "";
        }
      }
    });
    logger.debug(`Final grade row updated to: ${displayValue}`);
  }
  function updateSidebarGrade(gradeData) {
    const { score, letterGrade } = gradeData;
    const scoreStr = typeof score === "number" ? score.toFixed(2) : String(score);
    const rightSide = document.querySelector("#right-side-wrapper") || document.querySelector("#right-side");
    if (!rightSide) {
      logger.trace("Right sidebar not found");
      return;
    }
    const finalGradeDiv = rightSide.querySelector(".student_assignment.final_grade");
    if (!finalGradeDiv) {
      logger.trace("Final grade element not found in sidebar");
      return;
    }
    const gradeSpan = finalGradeDiv.querySelector(".grade");
    if (gradeSpan) {
      const currentText = gradeSpan.textContent.trim();
      if (currentText.includes("/") || currentText !== scoreStr) {
        gradeSpan.textContent = scoreStr;
        logger.trace(`Updated sidebar grade: "${currentText}" -> "${scoreStr}"`);
      }
    }
    const letterGradeSpan = finalGradeDiv.querySelector(".letter_grade");
    if (letterGradeSpan && letterGrade) {
      const currentLetter = letterGradeSpan.textContent.trim();
      if (currentLetter !== letterGrade) {
        letterGradeSpan.textContent = letterGrade;
        logger.trace(`Updated sidebar letter grade: "${currentLetter}" -> "${letterGrade}"`);
      }
    }
    logger.debug(`Sidebar grade updated to: ${scoreStr} (${letterGrade})`);
  }
  function applyCustomizations3(gradeData, retryCount = 0) {
    if (processed3) return true;
    const MAX_RETRIES = 10;
    const RETRY_DELAY = 200;
    const hasFinalGradeRow = document.querySelector("tr.student_assignment.hard_coded.final_grade") !== null;
    const hasSidebar = (document.querySelector("#right-side-wrapper") || document.querySelector("#right-side")) !== null;
    if (!hasFinalGradeRow || !hasSidebar) {
      if (retryCount < MAX_RETRIES) {
        logger.trace(`DOM not ready (retry ${retryCount + 1}/${MAX_RETRIES}), waiting...`);
        setTimeout(() => applyCustomizations3(gradeData, retryCount + 1), RETRY_DELAY);
        return false;
      } else {
        logger.warn("DOM elements not found after max retries");
        return false;
      }
    }
    logger.trace(`Applying customizations with gradeData: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}`);
    updateFinalGradeRow(gradeData);
    updateSidebarGrade(gradeData);
    processed3 = true;
    logger.debug("Teacher student grade customizations applied successfully");
    return true;
  }
  function startCleanupObservers2(gradeData = null) {
    logger.debug("Starting cleanup observers for teacher student grade page");
    removeFractionScores().catch((err) => {
      logger.warn("Error in initial removeFractionScores:", err);
    });
    const debouncedClean = debounce(() => {
      removeFractionScores().catch((err) => {
        logger.warn("Error in removeFractionScores:", err);
      });
    }, 100);
    let debouncedGradeUpdate = null;
    if (gradeData) {
      debouncedGradeUpdate = debounce(() => {
        updateFinalGradeRow(gradeData);
        updateSidebarGrade(gradeData);
      }, 150);
    }
    setTimeout(() => {
      createPersistentObserver(() => {
        debouncedClean();
        if (debouncedGradeUpdate) {
          debouncedGradeUpdate();
        }
      }, {
        config: OBSERVER_CONFIGS.CHILD_LIST,
        target: document.body,
        name: "TeacherStudentGradeCleanupObserver"
      });
    }, 0);
  }
  async function initTeacherStudentGradeCustomizer() {
    var _a18, _b18;
    logger.debug("[Teacher] Initializing teacher student grade page customizer");
    const courseId = getCourseId();
    const studentId = getStudentIdFromUrl();
    if (!courseId || !studentId) {
      logger.trace("[Teacher] Cannot get course ID or student ID from URL");
      startCleanupObservers2();
      return;
    }
    if (currentStudentId && currentStudentId !== studentId) {
      logger.debug(`[Teacher] Student ID changed from ${currentStudentId} to ${studentId}, resetting customizations`);
      processed3 = false;
    }
    currentStudentId = studentId;
    logger.debug(`[Teacher] Teacher viewing student ${studentId} grades for course ${courseId}`);
    const courseName = ((_b18 = (_a18 = document.querySelector(".course-title, h1, #breadcrumbs li:last-child")) == null ? void 0 : _a18.textContent) == null ? void 0 : _b18.trim()) || "Course";
    const apiClient2 = new CanvasApiClient();
    let snapshot = getCourseSnapshot(courseId);
    if (!snapshot) {
      logger.debug(`[Teacher] No snapshot for course ${courseId}, populating snapshot...`);
      snapshot = await populateCourseSnapshot(courseId, courseName, apiClient2);
    }
    if (!snapshot) {
      logger.warn(`[Teacher] Failed to create snapshot for course ${courseId}`);
      startCleanupObservers2();
      return;
    }
    logger.debug(`[Teacher] Course ${courseId} snapshot: model=${snapshot.model}, reason=${snapshot.modelReason}`);
    if (snapshot.model !== "standards") {
      logger.debug(`[Teacher] Skipping teacher student grade customization - course is ${snapshot.model}`);
      startCleanupObservers2();
      return;
    }
    logger.debug(`[Teacher] Fetching AVG assignment score for student ${studentId}...`);
    const gradeData = await fetchStudentAvgScore(courseId, studentId, apiClient2);
    if (!gradeData) {
      logger.warn(`[Teacher] \u274C No AVG assignment score found for student ${studentId} - skipping grade customizations`);
      startCleanupObservers2();
      return;
    }
    logger.debug(`[Teacher] \u2705 Applying teacher student grade customizations for student ${studentId}: score=${gradeData.score}, letterGrade=${gradeData.letterGrade}`);
    applyCustomizations3(gradeData);
    startCleanupObservers2(gradeData);
    setupUrlChangeDetection();
  }
  function setupUrlChangeDetection() {
    if (urlChangeDetectionSetup) {
      logger.trace("[Teacher] URL change detection already set up, skipping");
      return;
    }
    urlChangeDetectionSetup = true;
    logger.debug("[Teacher] Setting up URL change detection for student navigation");
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        const newStudentId = getStudentIdFromUrl();
        if (newStudentId && newStudentId !== currentStudentId) {
          logger.debug(`[Teacher] URL changed, detected new student: ${newStudentId} (was: ${currentStudentId})`);
          lastUrl = location.href;
          initTeacherStudentGradeCustomizer();
        } else {
          lastUrl = location.href;
        }
      }
    }, 1e3);
  }

  // src/student/allGradesDataSourceTest.js
  async function testDOMParsingApproach() {
    const startTime = performance.now();
    const results = {
      approach: "DOM Parsing + Individual API Calls",
      courses: [],
      errors: [],
      metrics: {}
    };
    try {
      const rows = findTableRows();
      if (rows.length === 0) {
        throw new Error("Grades table not found or has no rows");
      }
      logger.info(`[DOM Approach] Found ${rows.length} course rows`);
      const apiClient2 = new CanvasApiClient();
      const coursePromises = [];
      for (const row of rows) {
        coursePromises.push(extractCourseFromRow(row, apiClient2));
      }
      const courseResults = await Promise.allSettled(coursePromises);
      for (const result of courseResults) {
        if (result.status === "fulfilled" && result.value) {
          results.courses.push(result.value);
        } else if (result.status === "rejected") {
          results.errors.push(result.reason.message);
        }
      }
    } catch (error) {
      results.errors.push(error.message);
      logger.error("[DOM Approach] Fatal error:", error);
    }
    const endTime = performance.now();
    results.metrics = {
      totalTime: endTime - startTime,
      coursesFound: results.courses.length,
      errorCount: results.errors.length,
      avgTimePerCourse: results.courses.length > 0 ? (endTime - startTime) / results.courses.length : 0
    };
    return results;
  }
  async function extractCourseFromRow(row, apiClient2) {
    const courseData = extractCourseDataFromRow(row);
    if (!courseData) return null;
    const { courseId, courseName, percentage } = courseData;
    const detectionStart = performance.now();
    const isStandardsBased = await detectStandardsBasedCourse(courseId, courseName, apiClient2);
    const detectionTime = performance.now() - detectionStart;
    return {
      courseId,
      courseName,
      percentage,
      isStandardsBased,
      detectionTime,
      source: "DOM"
    };
  }
  async function testEnrollmentsAPIApproach() {
    const startTime = performance.now();
    const results = {
      approach: "Enrollments API",
      courses: [],
      errors: [],
      metrics: {}
    };
    try {
      const apiClient2 = new CanvasApiClient();
      const apiCallStart = performance.now();
      const enrollments = await apiClient2.get(
        "/api/v1/users/self/enrollments",
        {
          "type[]": "StudentEnrollment",
          "state[]": "active",
          "include[]": "total_scores"
        },
        "testEnrollmentsAPI"
      );
      const apiCallTime = performance.now() - apiCallStart;
      logger.info(`[API Approach] Fetched ${enrollments.length} enrollments in ${apiCallTime.toFixed(2)}ms`);
      const coursePromises = enrollments.map(
        (enrollment) => processCourseFromEnrollment(enrollment, apiClient2)
      );
      const courseResults = await Promise.allSettled(coursePromises);
      for (const result of courseResults) {
        if (result.status === "fulfilled" && result.value) {
          results.courses.push(result.value);
        } else if (result.status === "rejected") {
          results.errors.push(result.reason.message);
        }
      }
    } catch (error) {
      results.errors.push(error.message);
      logger.error("[API Approach] Fatal error:", error);
    }
    const endTime = performance.now();
    results.metrics = {
      totalTime: endTime - startTime,
      coursesFound: results.courses.length,
      errorCount: results.errors.length,
      avgTimePerCourse: results.courses.length > 0 ? (endTime - startTime) / results.courses.length : 0
    };
    return results;
  }
  async function processCourseFromEnrollment(enrollment, apiClient2) {
    var _a18, _b18, _c, _d, _e, _f;
    const courseId = (_a18 = enrollment.course_id) == null ? void 0 : _a18.toString();
    if (!courseId) return null;
    const grades = enrollment.grades || {};
    const percentage = (_c = (_b18 = grades.current_score) != null ? _b18 : grades.final_score) != null ? _c : null;
    let courseName = (_d = enrollment.course) == null ? void 0 : _d.name;
    if (!courseName) {
      try {
        const course = await apiClient2.get(
          `/api/v1/courses/${courseId}`,
          {},
          "getCourseDetails"
        );
        courseName = course.name;
      } catch (error) {
        logger.warn(`[API Approach] Could not fetch course name for ${courseId}:`, error.message);
        courseName = `Course ${courseId}`;
      }
    }
    const detectionStart = performance.now();
    const isStandardsBased = await detectStandardsBasedCourse(courseId, courseName, apiClient2);
    const detectionTime = performance.now() - detectionStart;
    return {
      courseId,
      courseName,
      percentage,
      isStandardsBased,
      detectionTime,
      source: "API",
      letterGrade: (_f = (_e = grades.current_grade) != null ? _e : grades.final_grade) != null ? _f : null
    };
  }
  async function detectStandardsBasedCourse(courseId, courseName, apiClient2) {
    const classification = await determineCourseModel(
      { courseId, courseName },
      null,
      { apiClient: apiClient2 }
    );
    return classification.model === "standards";
  }
  async function compareDataSourceApproaches() {
    logger.info("=".repeat(80));
    logger.info("ALL-GRADES PAGE DATA SOURCE COMPARISON TEST");
    logger.info("=".repeat(80));
    logger.info("\n\u{1F4CA} Running DOM Parsing Approach...");
    const domResults = await testDOMParsingApproach();
    logger.info("\n\u{1F4CA} Running Enrollments API Approach...");
    const apiResults = await testEnrollmentsAPIApproach();
    logger.info("\n" + "=".repeat(80));
    logger.info("COMPARISON RESULTS");
    logger.info("=".repeat(80));
    console.table([
      {
        Approach: domResults.approach,
        "Total Time (ms)": domResults.metrics.totalTime.toFixed(2),
        "Courses Found": domResults.metrics.coursesFound,
        "Errors": domResults.metrics.errorCount,
        "Avg Time/Course (ms)": domResults.metrics.avgTimePerCourse.toFixed(2)
      },
      {
        Approach: apiResults.approach,
        "Total Time (ms)": apiResults.metrics.totalTime.toFixed(2),
        "Courses Found": apiResults.metrics.coursesFound,
        "Errors": apiResults.metrics.errorCount,
        "Avg Time/Course (ms)": apiResults.metrics.avgTimePerCourse.toFixed(2)
      }
    ]);
    logger.info("\n\u{1F4CB} Course Details (DOM Approach):");
    console.table(domResults.courses.map((c) => ({
      "Course ID": c.courseId,
      "Course Name": c.courseName.substring(0, 40),
      "Percentage": c.percentage,
      "Standards-Based": c.isStandardsBased,
      "Detection Time (ms)": c.detectionTime.toFixed(2)
    })));
    logger.info("\n\u{1F4CB} Course Details (API Approach):");
    console.table(apiResults.courses.map((c) => ({
      "Course ID": c.courseId,
      "Course Name": c.courseName.substring(0, 40),
      "Percentage": c.percentage,
      "Standards-Based": c.isStandardsBased,
      "Letter Grade": c.letterGrade,
      "Detection Time (ms)": c.detectionTime.toFixed(2)
    })));
    logger.info("\n" + "=".repeat(80));
    logger.info("RECOMMENDATION");
    logger.info("=".repeat(80));
    const recommendation = generateRecommendation(domResults, apiResults);
    logger.info(recommendation);
    return { domResults, apiResults, recommendation };
  }
  function generateRecommendation(domResults, apiResults) {
    const timeDiff = domResults.metrics.totalTime - apiResults.metrics.totalTime;
    const timeDiffPercent = timeDiff / domResults.metrics.totalTime * 100;
    let recommendation = "";
    if (apiResults.metrics.totalTime < domResults.metrics.totalTime) {
      recommendation += `\u2705 RECOMMENDED: Enrollments API Approach

`;
      recommendation += `Reasons:
`;
      recommendation += `- Faster by ${Math.abs(timeDiff).toFixed(2)}ms (${Math.abs(timeDiffPercent).toFixed(1)}%)
`;
      recommendation += `- More reliable (single API call for initial data)
`;
      recommendation += `- Provides letter grades directly from Canvas
`;
      recommendation += `- Less dependent on DOM structure
`;
    } else {
      recommendation += `\u2705 RECOMMENDED: DOM Parsing Approach

`;
      recommendation += `Reasons:
`;
      recommendation += `- Faster by ${Math.abs(timeDiff).toFixed(2)}ms (${Math.abs(timeDiffPercent).toFixed(1)}%)
`;
      recommendation += `- No additional API calls for initial data
`;
      recommendation += `- Works even if API is slow/unavailable
`;
    }
    if (domResults.metrics.errorCount > 0 || apiResults.metrics.errorCount > 0) {
      recommendation += `
\u26A0\uFE0F  Errors detected:
`;
      recommendation += `- DOM Approach: ${domResults.metrics.errorCount} errors
`;
      recommendation += `- API Approach: ${apiResults.metrics.errorCount} errors
`;
    }
    return recommendation;
  }
  if (typeof window !== "undefined") {
    window.CG_testAllGradesDataSources = compareDataSourceApproaches;
  }

  // src/customGradebookInit.js
  function isDashboardPage2() {
    const path = window.location.pathname;
    return path === "/" || path === "/dashboard" || path.startsWith("/dashboard/");
  }
  function isSpeedGraderPage2() {
    return window.location.pathname.includes("/speed_grader");
  }
  (function init() {
    logBanner("dev", "2026-02-03 11:12:36 AM (dev, fee7a08)");
    exposeVersion("dev", "2026-02-03 11:12:36 AM (dev, fee7a08)");
    if (true) {
      logger.info("Running in DEV mode");
    }
    if (false) {
      logger.info("Running in PROD mode");
    }
    logger.info(`Build environment: ${"dev"}`);
    validateAllSnapshots();
    if (window.location.pathname.includes("/gradebook")) {
      injectButtons();
      initAssignmentKebabMenuInjection();
    }
    if (isDashboardPage2()) {
      initDashboardGradeDisplay();
    }
    if (isSpeedGraderPage2()) {
      initSpeedGraderDropdown();
      if (getUserRoleGroup() === "teacher_like") {
        initSpeedGraderAutoGrade();
      }
    }
    initStudentGradeCustomization();
    if (isTeacherViewingStudentGrades() && getUserRoleGroup() === "teacher_like") {
      initTeacherStudentGradeCustomizer();
    }
    if (true) {
      window.CG_testAllGradesDataSources = compareDataSourceApproaches;
      window.CG_clearAllSnapshots = clearAllSnapshots;
      window.CG_debugSnapshots = debugSnapshots;
      logger.debug("Debug functions exposed:");
      logger.debug("  - window.CG_testAllGradesDataSources()");
      logger.debug("  - window.CG_clearAllSnapshots() - Clear all cached snapshots");
      logger.debug("  - window.CG_debugSnapshots() - Show all cached snapshots");
    }
    if (!window.CG) window.CG = {};
    window.CG.clearAllSnapshots = clearAllSnapshots;
  })();
})();
//# sourceMappingURL=customGradebookInit.js.map
