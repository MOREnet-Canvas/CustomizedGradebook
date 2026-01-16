(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
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
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

  // src/utils/logger.js
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
  var LOG_LEVELS, currentLogLevel, logger;
  var init_logger = __esm({
    "src/utils/logger.js"() {
      LOG_LEVELS = {
        TRACE: -1,
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
      };
      currentLogLevel = determineLogLevel();
      logger = {
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
    }
  });

  // src/config.js
  var _a, _b, ENABLE_STUDENT_GRADE_CUSTOMIZATION, _a2, _b2, REMOVE_ASSIGNMENT_TAB, _a3, _b3, PER_STUDENT_UPDATE_THRESHOLD, _a4, _b4, ENABLE_OUTCOME_UPDATES, _a5, _b5, ENABLE_GRADE_OVERRIDE, defaultOverrideScale, _a6, _b6, OVERRIDE_SCALE, _a7, _b7, UPDATE_AVG_BUTTON_LABEL, _a8, _b8, AVG_OUTCOME_NAME, _a9, _b9, AVG_ASSIGNMENT_NAME, _a10, _b10, AVG_RUBRIC_NAME, _a11, _b11, DEFAULT_MAX_POINTS, _a12, _b12, DEFAULT_MASTERY_THRESHOLD, defaultRatings, _a13, _b13, OUTCOME_AND_RUBRIC_RATINGS, defaultExcludedKeywords, _a14, _b14, EXCLUDED_OUTCOME_KEYWORDS;
  var init_config = __esm({
    "src/config.js"() {
      ENABLE_STUDENT_GRADE_CUSTOMIZATION = (_b = (_a = window.CG_CONFIG) == null ? void 0 : _a.ENABLE_STUDENT_GRADE_CUSTOMIZATION) != null ? _b : true;
      REMOVE_ASSIGNMENT_TAB = (_b2 = (_a2 = window.CG_CONFIG) == null ? void 0 : _a2.REMOVE_ASSIGNMENT_TAB) != null ? _b2 : false;
      PER_STUDENT_UPDATE_THRESHOLD = (_b3 = (_a3 = window.CG_CONFIG) == null ? void 0 : _a3.PER_STUDENT_UPDATE_THRESHOLD) != null ? _b3 : 25;
      ENABLE_OUTCOME_UPDATES = (_b4 = (_a4 = window.CG_CONFIG) == null ? void 0 : _a4.ENABLE_OUTCOME_UPDATES) != null ? _b4 : true;
      ENABLE_GRADE_OVERRIDE = (_b5 = (_a5 = window.CG_CONFIG) == null ? void 0 : _a5.ENABLE_GRADE_OVERRIDE) != null ? _b5 : true;
      defaultOverrideScale = (avg) => Number((avg * 25).toFixed(2));
      OVERRIDE_SCALE = (_b6 = (_a6 = window.CG_CONFIG) == null ? void 0 : _a6.OVERRIDE_SCALE) != null ? _b6 : defaultOverrideScale;
      UPDATE_AVG_BUTTON_LABEL = (_b7 = (_a7 = window.CG_CONFIG) == null ? void 0 : _a7.UPDATE_AVG_BUTTON_LABEL) != null ? _b7 : "Update Current Score";
      AVG_OUTCOME_NAME = (_b8 = (_a8 = window.CG_CONFIG) == null ? void 0 : _a8.AVG_OUTCOME_NAME) != null ? _b8 : "Current Score";
      AVG_ASSIGNMENT_NAME = (_b9 = (_a9 = window.CG_CONFIG) == null ? void 0 : _a9.AVG_ASSIGNMENT_NAME) != null ? _b9 : "Current Score Assignment";
      AVG_RUBRIC_NAME = (_b10 = (_a10 = window.CG_CONFIG) == null ? void 0 : _a10.AVG_RUBRIC_NAME) != null ? _b10 : "Current Score Rubric";
      DEFAULT_MAX_POINTS = (_b11 = (_a11 = window.CG_CONFIG) == null ? void 0 : _a11.DEFAULT_MAX_POINTS) != null ? _b11 : 4;
      DEFAULT_MASTERY_THRESHOLD = (_b12 = (_a12 = window.CG_CONFIG) == null ? void 0 : _a12.DEFAULT_MASTERY_THRESHOLD) != null ? _b12 : 3;
      defaultRatings = [
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
      OUTCOME_AND_RUBRIC_RATINGS = (_b13 = (_a13 = window.CG_CONFIG) == null ? void 0 : _a13.OUTCOME_AND_RUBRIC_RATINGS) != null ? _b13 : defaultRatings;
      defaultExcludedKeywords = [];
      EXCLUDED_OUTCOME_KEYWORDS = (_b14 = (_a14 = window.CG_CONFIG) == null ? void 0 : _a14.EXCLUDED_OUTCOME_KEYWORDS) != null ? _b14 : defaultExcludedKeywords;
    }
  });

  // src/utils/errorHandler.js
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
  var CanvasApiError, UserCancelledError, TimeoutError, ValidationError;
  var init_errorHandler = __esm({
    "src/utils/errorHandler.js"() {
      init_logger();
      CanvasApiError = class extends Error {
        constructor(message, statusCode, responseText) {
          super(message);
          this.name = "CanvasApiError";
          this.statusCode = statusCode;
          this.responseText = responseText;
        }
      };
      UserCancelledError = class extends Error {
        constructor(message = "User cancelled the operation") {
          super(message);
          this.name = "UserCancelledError";
        }
      };
      TimeoutError = class extends Error {
        constructor(message, timeoutMs) {
          super(message);
          this.name = "TimeoutError";
          this.timeoutMs = timeoutMs;
        }
      };
      ValidationError = class extends Error {
        constructor(message, field) {
          super(message);
          this.name = "ValidationError";
          this.field = field;
        }
      };
    }
  });

  // src/utils/canvasApiClient.js
  var _CanvasApiClient_instances, getTokenCookie_fn, makeRequest_fn, CanvasApiClient;
  var init_canvasApiClient = __esm({
    "src/utils/canvasApiClient.js"() {
      init_errorHandler();
      init_logger();
      CanvasApiClient = class {
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
        const _a15 = options, { headers: _optionsHeaders } = _a15, restOptions = __objRest(_a15, ["headers"]);
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
    }
  });

  // src/dashboard/gradeDataService.js
  var gradeDataService_exports = {};
  __export(gradeDataService_exports, {
    GRADE_SOURCE: () => GRADE_SOURCE,
    clearGradeCache: () => clearGradeCache,
    getCourseGrade: () => getCourseGrade,
    preCacheEnrollmentGrades: () => preCacheEnrollmentGrades
  });
  function getCachedGrade(courseId) {
    const cached = gradeCache.get(courseId);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      gradeCache.delete(courseId);
      logger.trace(`Cache expired for course ${courseId}`);
      return null;
    }
    logger.trace(`Cache hit for course ${courseId}, expires in ${Math.round((cached.expiresAt - Date.now()) / 1e3)}s`);
    return cached.value;
  }
  function cacheGrade(courseId, score, letterGrade, source) {
    const expiresAt = Date.now() + CACHE_TTL_MS;
    gradeCache.set(courseId, {
      value: { score, letterGrade, source },
      expiresAt
    });
    logger.trace(`Cached grade for course ${courseId}, expires at ${new Date(expiresAt).toISOString()}`);
  }
  function clearGradeCache() {
    const size = gradeCache.size;
    gradeCache.clear();
    logger.debug(`Grade cache cleared (${size} entries removed)`);
  }
  function preCacheEnrollmentGrades(courses) {
    var _a15, _b15, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    logger.debug(`Pre-caching enrollment grades for ${courses.length} courses`);
    let cachedCount = 0;
    for (const course of courses) {
      const { id: courseId, enrollmentData } = course;
      if (!enrollmentData) {
        logger.trace(`No enrollment data for course ${courseId}, skipping pre-cache`);
        continue;
      }
      let score = null;
      let letterGrade = null;
      if (enrollmentData.grades) {
        score = (_a15 = enrollmentData.grades.current_score) != null ? _a15 : enrollmentData.grades.final_score;
        letterGrade = (_e = (_d = (_c = (_b15 = enrollmentData.grades.current_grade) != null ? _b15 : enrollmentData.grades.final_grade) != null ? _c : null) == null ? void 0 : _d.trim()) != null ? _e : null;
      }
      if (score === null || score === void 0) {
        score = (_h = (_g = (_f = enrollmentData.computed_current_score) != null ? _f : enrollmentData.calculated_current_score) != null ? _g : enrollmentData.computed_final_score) != null ? _h : enrollmentData.calculated_final_score;
      }
      if (letterGrade === null && score !== null) {
        letterGrade = (_n = (_m = (_l = (_k = (_j = (_i = enrollmentData.computed_current_grade) != null ? _i : enrollmentData.calculated_current_grade) != null ? _j : enrollmentData.computed_final_grade) != null ? _k : enrollmentData.calculated_final_grade) != null ? _l : null) == null ? void 0 : _m.trim()) != null ? _n : null;
      }
      if (score !== null && score !== void 0) {
        cacheGrade(courseId, score, letterGrade, GRADE_SOURCE.ENROLLMENT);
        cachedCount++;
        logger.trace(`Pre-cached enrollment grade for course ${courseId}: ${score}% (${letterGrade || "no letter grade"})`);
      } else {
        logger.trace(`No valid enrollment score for course ${courseId}, skipping pre-cache`);
      }
    }
    logger.debug(`Pre-cached ${cachedCount} enrollment grades`);
  }
  async function fetchAvgAssignmentScore(courseId, apiClient) {
    try {
      const assignments = await apiClient.get(
        `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
        {},
        "fetchAvgAssignment"
      );
      const avgAssignment = assignments.find((a) => a.name === AVG_ASSIGNMENT_NAME);
      if (!avgAssignment) {
        logger.trace(`AVG assignment "${AVG_ASSIGNMENT_NAME}" not found in course ${courseId}`);
        return null;
      }
      const submission = await apiClient.get(
        `/api/v1/courses/${courseId}/assignments/${avgAssignment.id}/submissions/self`,
        {},
        "fetchAvgSubmission"
      );
      const score = submission == null ? void 0 : submission.score;
      if (score === null || score === void 0) {
        logger.trace(`No score found for AVG assignment in course ${courseId}`);
        return null;
      }
      let letterGrade = null;
      const cached = getCachedGrade(courseId);
      if (cached && cached.source === GRADE_SOURCE.ENROLLMENT) {
        letterGrade = cached.letterGrade;
        logger.trace(`Retrieved letter grade from pre-cached enrollment data for course ${courseId}: ${letterGrade || "no letter grade"}`);
      } else {
        logger.trace(`No pre-cached enrollment data available for letter grade in course ${courseId}`);
      }
      logger.trace(`AVG assignment data for course ${courseId}: ${score} (${letterGrade || "no letter grade"})`);
      return { score, letterGrade };
    } catch (error) {
      logger.warn(`Failed to fetch AVG assignment score for course ${courseId}:`, error.message);
      return null;
    }
  }
  async function fetchEnrollmentScore(courseId, apiClient) {
    var _a15, _b15, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    const cached = getCachedGrade(courseId);
    if (cached && cached.source === GRADE_SOURCE.ENROLLMENT) {
      logger.trace(`Using pre-cached enrollment grade for course ${courseId}: ${cached.score}% (${cached.letterGrade || "no letter grade"})`);
      return {
        score: cached.score,
        letterGrade: cached.letterGrade
      };
    }
    logger.trace(`Enrollment grade not pre-cached for course ${courseId}, fetching via API`);
    try {
      const enrollments = await apiClient.get(
        `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment`,
        {},
        "fetchEnrollment"
      );
      logger.trace(`Enrollment response for course ${courseId}:`, enrollments);
      const studentEnrollment = enrollments.find(
        (e) => e.type === "StudentEnrollment" || e.type === "student" || e.role === "StudentEnrollment"
      );
      if (!studentEnrollment) {
        logger.trace(`No student enrollment found for course ${courseId}`);
        if (logger.isTraceEnabled() && enrollments.length > 0) {
          logger.trace(`Available enrollment types:`, enrollments.map((e) => e.type || e.role));
        }
        return null;
      }
      logger.trace(`Student enrollment for course ${courseId}:`, studentEnrollment);
      let score = null;
      let letterGrade = null;
      if (studentEnrollment.grades) {
        score = (_a15 = studentEnrollment.grades.current_score) != null ? _a15 : studentEnrollment.grades.final_score;
        letterGrade = (_e = (_d = (_c = (_b15 = studentEnrollment.grades.current_grade) != null ? _b15 : studentEnrollment.grades.final_grade) != null ? _c : null) == null ? void 0 : _d.trim()) != null ? _e : null;
      }
      if (score === null || score === void 0) {
        score = (_h = (_g = (_f = studentEnrollment.computed_current_score) != null ? _f : studentEnrollment.calculated_current_score) != null ? _g : studentEnrollment.computed_final_score) != null ? _h : studentEnrollment.calculated_final_score;
      }
      if (letterGrade === null && score !== null) {
        letterGrade = (_n = (_m = (_l = (_k = (_j = (_i = studentEnrollment.computed_current_grade) != null ? _i : studentEnrollment.calculated_current_grade) != null ? _j : studentEnrollment.computed_final_grade) != null ? _k : studentEnrollment.calculated_final_grade) != null ? _l : null) == null ? void 0 : _m.trim()) != null ? _n : null;
      }
      if (score === null || score === void 0) {
        logger.trace(`No enrollment score found for course ${courseId}`);
        logger.trace(`Enrollment object:`, studentEnrollment);
        return null;
      }
      logger.trace(`Enrollment data for course ${courseId}: ${score}% (${letterGrade || "no letter grade"})`);
      return {
        score,
        letterGrade
      };
    } catch (error) {
      logger.warn(`Failed to fetch enrollment score for course ${courseId}:`, error.message);
      if (logger.isDebugEnabled()) {
        logger.warn(`Full error:`, error);
      }
      return null;
    }
  }
  async function getCourseGrade(courseId, apiClient) {
    logger.trace(`[Grade Source Debug] Course ${courseId}: Starting grade fetch with fallback hierarchy`);
    const cached = getCachedGrade(courseId);
    if (cached && cached.source === GRADE_SOURCE.ASSIGNMENT) {
      logger.trace(`[Grade Source Debug] Course ${courseId}: Using cached AVG assignment grade (score=${cached.score}, letterGrade=${cached.letterGrade})`);
      return {
        score: cached.score,
        letterGrade: cached.letterGrade,
        source: cached.source
      };
    }
    logger.trace(`[Grade Source Debug] Course ${courseId}: Checking priority 1 - AVG assignment...`);
    const avgData = await fetchAvgAssignmentScore(courseId, apiClient);
    if (avgData !== null) {
      logger.trace(`[Grade Source Debug] Course ${courseId}: AVG assignment found! score=${avgData.score}, letterGrade=${avgData.letterGrade}`);
      cacheGrade(courseId, avgData.score, avgData.letterGrade, GRADE_SOURCE.ASSIGNMENT);
      return { score: avgData.score, letterGrade: avgData.letterGrade, source: GRADE_SOURCE.ASSIGNMENT };
    }
    logger.trace(`[Grade Source Debug] Course ${courseId}: AVG assignment not found, checking priority 2...`);
    logger.trace(`[Grade Source Debug] Course ${courseId}: Checking priority 2 - enrollment grade...`);
    const enrollmentData = await fetchEnrollmentScore(courseId, apiClient);
    if (enrollmentData !== null) {
      logger.trace(`[Grade Source Debug] Course ${courseId}: Enrollment grade found! score=${enrollmentData.score}, letterGrade=${enrollmentData.letterGrade}`);
      if (!cached || cached.source !== GRADE_SOURCE.ENROLLMENT) {
        cacheGrade(courseId, enrollmentData.score, enrollmentData.letterGrade, GRADE_SOURCE.ENROLLMENT);
      }
      return {
        score: enrollmentData.score,
        letterGrade: enrollmentData.letterGrade,
        source: GRADE_SOURCE.ENROLLMENT
      };
    }
    logger.trace(`[Grade Source Debug] Course ${courseId}: Enrollment grade not found`);
    logger.trace(`[Grade Source Debug] Course ${courseId}: No grade available from any source`);
    return null;
  }
  var GRADE_SOURCE, CACHE_TTL_MS, gradeCache;
  var init_gradeDataService = __esm({
    "src/dashboard/gradeDataService.js"() {
      init_config();
      init_logger();
      init_canvasApiClient();
      GRADE_SOURCE = Object.freeze({
        ASSIGNMENT: "assignment",
        ENROLLMENT: "enrollment"
      });
      CACHE_TTL_MS = 5 * 60 * 1e3;
      gradeCache = /* @__PURE__ */ new Map();
    }
  });

  // src/customGradebookInit.js
  init_logger();

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

  // src/utils/canvas.js
  init_config();
  init_logger();
  function getCourseId() {
    var _a15, _b15;
    const envCourseId = ENV == null ? void 0 : ENV.COURSE_ID;
    const pathCourseId = (_b15 = (_a15 = window.location.pathname.match(/courses\/(\d+)/)) == null ? void 0 : _a15[1]) != null ? _b15 : null;
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
  function isDashboardPage() {
    const path = window.location.pathname;
    return path === "/" || path.startsWith("/dashboard");
  }
  async function courseHasAvgAssignment() {
    const courseId = getCourseId();
    if (!courseId) return false;
    const cacheKey = `hasAvgAssignment_${courseId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
      return cached === "true";
    }
    try {
      const response = await fetch(
        `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(
          AVG_ASSIGNMENT_NAME
        )}`
      );
      const assignments = await response.json();
      const hasAvg = assignments.some((a) => a.name === AVG_ASSIGNMENT_NAME);
      sessionStorage.setItem(cacheKey, hasAvg ? "true" : "false");
      return hasAvg;
    } catch (e) {
      console.warn("Could not verify assignment existence:", e);
      return false;
    }
  }

  // src/gradebook/ui/buttonInjection.js
  init_config();
  init_errorHandler();
  init_logger();

  // src/gradebook/stateMachine.js
  init_logger();
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
      var _a15;
      if (!this.canTransition(toState)) {
        throw new Error(
          `Invalid transition from ${this.currentState} to ${toState}. Valid transitions: ${((_a15 = VALID_TRANSITIONS[this.currentState]) == null ? void 0 : _a15.join(", ")) || "none"}`
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

  // src/gradebook/stateHandlers.js
  init_logger();
  init_config();
  init_errorHandler();
  init_canvasApiClient();

  // src/services/gradeCalculator.js
  init_config();
  init_logger();

  // src/services/gradeOverrideVerification.js
  init_canvasApiClient();
  init_config();
  init_logger();
  async function enableCourseOverride(courseId, apiClient) {
    if (!ENABLE_GRADE_OVERRIDE) {
      logger.debug("Grade override is disabled in config, skipping");
      return false;
    }
    try {
      logger.debug("Enabling final grade override for course");
      await apiClient.put(
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
  async function fetchOverrideGrades(courseId, apiClient) {
    var _a15;
    if (!ENABLE_GRADE_OVERRIDE) {
      logger.debug("Grade override is disabled in config, skipping fetch");
      return /* @__PURE__ */ new Map();
    }
    try {
      const response = await apiClient.get(
        `/courses/${courseId}/gradebook/final_grade_overrides`,
        {},
        "fetchOverrideGrades"
      );
      const overrideMap = /* @__PURE__ */ new Map();
      const overrides = response.final_grade_overrides || {};
      for (const [userId, data] of Object.entries(overrides)) {
        const percentage = (_a15 = data == null ? void 0 : data.course_grade) == null ? void 0 : _a15.percentage;
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
  async function verifyOverrideScores(courseId, averages, enrollmentMap, apiClient, tolerance = 0.01) {
    if (!ENABLE_GRADE_OVERRIDE) {
      logger.debug("Grade override is disabled in config, skipping verification");
      return [];
    }
    try {
      const overrideGrades = await fetchOverrideGrades(courseId, apiClient);
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
    var _a15, _b15;
    const map = {};
    ((_b15 = (_a15 = data == null ? void 0 : data.linked) == null ? void 0 : _a15.outcomes) != null ? _b15 : []).forEach((o) => {
      map[String(o.id)] = o.title;
    });
    return map;
  }
  function getCurrentOutcomeScore(scores, outcomeId) {
    var _a15;
    const match = scores.find((s) => {
      var _a16;
      return String((_a16 = s.links) == null ? void 0 : _a16.outcome) === String(outcomeId);
    });
    return (_a15 = match == null ? void 0 : match.score) != null ? _a15 : null;
  }
  function getRelevantScores(scores, outcomeMap, excludedOutcomeIds, excludedKeywords) {
    return scores.filter((s) => {
      var _a15;
      const id = String((_a15 = s.links) == null ? void 0 : _a15.outcome);
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
  async function calculateStudentAverages(data, outcomeId, courseId, apiClient) {
    var _a15, _b15, _c, _d;
    logger.info("Calculating student averages...");
    logger.debug(`Grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);
    const outcomeMap = buildOutcomeMap(data);
    const excludedOutcomeIds = /* @__PURE__ */ new Set([String(outcomeId)]);
    let overrideGrades = /* @__PURE__ */ new Map();
    if (ENABLE_GRADE_OVERRIDE && courseId && apiClient) {
      try {
        logger.debug("Fetching current override grades for initial check...");
        overrideGrades = await fetchOverrideGrades(courseId, apiClient);
        logger.debug(`Fetched ${overrideGrades.size} override grades for comparison`);
      } catch (error) {
        logger.warn("Failed to fetch override grades for initial check, continuing without override checking:", error);
      }
    }
    const results = [];
    for (const rollup of (_a15 = data == null ? void 0 : data.rollups) != null ? _a15 : []) {
      const userId = (_b15 = rollup.links) == null ? void 0 : _b15.user;
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

  // src/services/gradeSubmission.js
  init_canvasApiClient();
  init_config();

  // src/utils/uiHelpers.js
  init_logger();
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
  init_canvasApiClient();
  init_config();
  init_errorHandler();
  init_logger();
  var __enrollmentMapCache = /* @__PURE__ */ new Map();
  async function setOverrideScoreGQL(enrollmentId, overrideScore, apiClient) {
    var _a15, _b15, _c, _d, _e;
    const query = `
    mutation SetOverride($enrollmentId: ID!, $overrideScore: Float!) {
      setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        grades { customGradeStatusId overrideScore __typename }
        __typename
      }
    }`;
    const json = await apiClient.graphql(
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
    return (_e = (_d = (_c = (_b15 = (_a15 = json.data) == null ? void 0 : _a15.setOverrideScore) == null ? void 0 : _b15.grades) == null ? void 0 : _c[0]) == null ? void 0 : _d.overrideScore) != null ? _e : null;
  }
  async function getAllEnrollmentIds(courseId, apiClient) {
    const courseKey = String(courseId);
    if (__enrollmentMapCache.has(courseKey)) {
      return __enrollmentMapCache.get(courseKey);
    }
    const map = /* @__PURE__ */ new Map();
    let url = `/api/v1/courses/${courseKey}/enrollments?type[]=StudentEnrollment&per_page=100`;
    while (url) {
      const data = await apiClient.get(url, {}, "getAllEnrollmentIds");
      for (const e of data) {
        if ((e == null ? void 0 : e.user_id) && (e == null ? void 0 : e.id)) map.set(String(e.user_id), String(e.id));
      }
      url = null;
    }
    __enrollmentMapCache.set(courseKey, map);
    return map;
  }
  async function getEnrollmentIdForUser(courseId, userId, apiClient) {
    const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);
    return enrollmentMap.get(String(userId)) || null;
  }

  // src/services/gradeSubmission.js
  init_errorHandler();
  init_logger();
  async function submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, score, apiClient) {
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
    await apiClient.put(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      payload,
      {},
      `submitRubricScore:${userId}`
    );
    logger.trace("Score submitted successfully for user", userId);
  }
  async function beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages, apiClient) {
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
    const result = await apiClient.post(
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
  async function waitForBulkGrading(box, apiClient, stateMachine, timeout = 12e5, interval = 2e3) {
    const loopStartTime = Date.now();
    let state = "beginning upload";
    const courseId = getCourseId();
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    startElapsedTimer(stateMachine, box);
    while (Date.now() - loopStartTime < timeout) {
      const progress = await apiClient.get(`/api/v1/progress/${progressId}`, {}, "waitForBulkGrading");
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
  async function postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, apiClient, testing = false) {
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
          await submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, average, apiClient);
          if (ENABLE_GRADE_OVERRIDE) {
            try {
              const enrollmentId = await getEnrollmentIdForUser(courseId, userId, apiClient);
              if (enrollmentId) {
                const override = OVERRIDE_SCALE(average);
                await setOverrideScoreGQL(enrollmentId, override, apiClient);
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
      var _a15, _b15;
      const attempts = (_a15 = retryCountsById[userId]) != null ? _a15 : "";
      const failed = failedById[userId];
      const average = (_b15 = failed == null ? void 0 : failed.average) != null ? _b15 : "";
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

  // src/services/verification.js
  init_canvasApiClient();
  init_logger();
  async function verifyUIScores(courseId, averages, outcomeId, box, apiClient, stateMachine, waitTimeMs = 5e3, maxRetries = 50) {
    let state = "verifying";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let elapsed = getElapsedTimeSinceStart(stateMachine);
      box.soft(`Status ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
      startElapsedTimer(stateMachine, box);
      const newRollupData = await apiClient.get(
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
  init_errorHandler();
  init_canvasApiClient();
  init_config();
  init_logger();
  async function getRollup(courseId, apiClient) {
    const rollupData = await apiClient.get(
      `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
      {},
      "getRollup"
    );
    logger.debug("rollupData: ", rollupData);
    return rollupData;
  }
  function getOutcomeObjectByName(data) {
    var _a15, _b15;
    const outcomeTitle = AVG_OUTCOME_NAME;
    logger.debug("Outcome Title:", outcomeTitle);
    logger.debug("data:", data);
    const outcomes = (_b15 = (_a15 = data == null ? void 0 : data.linked) == null ? void 0 : _a15.outcomes) != null ? _b15 : [];
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
  async function createOutcome(courseId, apiClient) {
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const vendorGuid = `MOREnet_${randomSuffix}`;
    const ratingsCsv = OUTCOME_AND_RUBRIC_RATINGS.map((r) => `${r.points},"${r.description}"`).join(",");
    const csvContent = `vendor_guid,object_type,title,description,calculation_method,mastery_points
"${vendorGuid}",outcome,"${AVG_OUTCOME_NAME}","Auto-generated outcome: ${AVG_OUTCOME_NAME}",latest,"${DEFAULT_MASTERY_THRESHOLD}",${ratingsCsv}`;
    logger.debug("Importing outcome via CSV...");
    const importData = await apiClient.post(
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
      const pollData = await apiClient.get(
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
  init_canvasApiClient();
  init_config();
  init_logger();
  async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject, apiClient) {
    var _a15;
    const alignments = (_a15 = outcomeObject.alignments) != null ? _a15 : [];
    for (const alignment of alignments) {
      if (!alignment.startsWith("assignment_")) continue;
      const assignmentId = alignment.split("_")[1];
      try {
        const assignment = await apiClient.get(
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
  async function createAssignment(courseId, apiClient) {
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
    const assignment = await apiClient.post(
      `/api/v1/courses/${courseId}/assignments`,
      payload,
      {},
      "createAssignment"
    );
    logger.info("Assignment created:", assignment.name);
    return assignment.id;
  }

  // src/services/rubricService.js
  init_canvasApiClient();
  init_config();
  init_logger();
  async function getRubricForAssignment(courseId, assignmentId, apiClient) {
    const assignment = await apiClient.get(
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
  async function createRubric(courseId, assignmentId, outcomeId, apiClient) {
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
    const rubric = await apiClient.post(
      `/api/v1/courses/${courseId}/rubrics`,
      rubricPayload,
      {},
      "createRubric"
    );
    logger.debug("Rubric created and linked to outcome:", rubric);
    return rubric.id;
  }

  // src/utils/canvasHelpers.js
  init_config();
  init_logger();
  async function getAssignmentId(courseId) {
    const response = await fetch(`/api/v1/courses/${courseId}/assignments?per_page=100`);
    const assignments = await response.json();
    const avgAssignment = assignments.find((a) => a.name === AVG_ASSIGNMENT_NAME);
    return avgAssignment ? avgAssignment.id : null;
  }

  // src/gradebook/stateHandlers.js
  async function handleCheckingSetup(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
    const setupMessage = ENABLE_OUTCOME_UPDATES ? `Checking setup for "${AVG_OUTCOME_NAME}"...` : "Checking setup for grade overrides...";
    banner.setText(setupMessage);
    logger.debug(`Grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);
    const data = await getRollup(courseId, apiClient);
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
      let assignmentObj = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj, apiClient);
      if (!assignmentObj) {
        const assignmentIdFromName = await getAssignmentId(courseId);
        if (assignmentIdFromName) {
          assignmentObj = await apiClient.get(
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
      const result = await getRubricForAssignment(courseId, assignmentId, apiClient);
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
        await enableCourseOverride(courseId, apiClient);
      } catch (error) {
        logger.warn("Failed to enable course override, continuing anyway:", error);
      }
    }
    return STATES.CALCULATING;
  }
  async function handleCreatingOutcome(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
    banner.setText(`Creating "${AVG_OUTCOME_NAME}" Outcome...`);
    await createOutcome(courseId, apiClient);
    return STATES.CHECKING_SETUP;
  }
  async function handleCreatingAssignment(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
    banner.setText(`Creating "${AVG_ASSIGNMENT_NAME}" Assignment...`);
    const assignmentId = await createAssignment(courseId, apiClient);
    stateMachine.updateContext({ assignmentId });
    return STATES.CHECKING_SETUP;
  }
  async function handleCreatingRubric(stateMachine) {
    const { courseId, assignmentId, outcomeId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
    banner.setText(`Creating "${AVG_RUBRIC_NAME}" Rubric...`);
    const rubricId = await createRubric(courseId, assignmentId, outcomeId, apiClient);
    stateMachine.updateContext({ rubricId });
    return STATES.CHECKING_SETUP;
  }
  async function handleCalculating(stateMachine) {
    const { rollupData, outcomeId, courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
    const calculatingMessage = ENABLE_OUTCOME_UPDATES ? `Calculating "${AVG_OUTCOME_NAME}" scores...` : "Calculating student averages for grade overrides...";
    banner.setText(calculatingMessage);
    const averages = await calculateStudentAverages(rollupData, outcomeId, courseId, apiClient);
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
    const apiClient = new CanvasApiClient();
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
      await postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, banner, apiClient, false);
      logger.debug(`handleUpdatingGrades complete, transitioning to VERIFYING`);
      return STATES.VERIFYING;
    } else {
      const message = `Detected ${numberOfUpdates} changes - using bulk update`;
      banner.hold(message, 3e3);
      logger.debug(`Bulk update, detected ${numberOfUpdates} changes`);
      const progressId = await beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages, apiClient);
      stateMachine.updateContext({ progressId });
      logger.debug(`progressId: ${progressId}`);
      logger.debug(`handleUpdatingGrades complete, transitioning to POLLING_PROGRESS`);
      return STATES.POLLING_PROGRESS;
    }
  }
  async function handlePollingProgress(stateMachine) {
    const { banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
    logger.debug("Starting bulk update polling...");
    await waitForBulkGrading(banner, apiClient, stateMachine);
    logger.debug(`handlePollingProgress complete, transitioning to VERIFYING`);
    return STATES.VERIFYING;
  }
  async function handleVerifying(stateMachine) {
    const { courseId, averages, outcomeId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
    if (!ENABLE_OUTCOME_UPDATES) {
      logger.debug("Outcome updates disabled, skipping VERIFYING state");
      return STATES.VERIFYING_OVERRIDES;
    }
    logger.debug("Starting outcome score verification...");
    await verifyUIScores(courseId, averages, outcomeId, banner, apiClient, stateMachine);
    logger.debug(`handleVerifying complete, transitioning to VERIFYING_OVERRIDES`);
    return STATES.VERIFYING_OVERRIDES;
  }
  async function handleVerifyingOverrides(stateMachine) {
    const { courseId, averages, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();
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
        const enrollmentId = await getEnrollmentIdForUser(courseId, userId, apiClient);
        if (!enrollmentId) {
          logger.warn(`[override] No enrollmentId for user ${userId}`);
          failCount++;
          continue;
        }
        const override = OVERRIDE_SCALE(average);
        await setOverrideScoreGQL(enrollmentId, override, apiClient);
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
      const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        banner.soft(`Verifying grade overrides... (attempt ${attempt}/${maxRetries})`);
        logger.debug(`Override verification attempt ${attempt}/${maxRetries}...`);
        overrideMismatches = await verifyOverrideScores(courseId, averages, enrollmentMap, apiClient);
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
    const courseId = getCourseId();
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
  init_logger();
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

  // src/gradebook/updateFlowOrchestrator.js
  init_errorHandler();

  // src/utils/stateManagement.js
  init_logger();
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
  init_config();
  init_logger();
  async function startUpdateFlow(button = null) {
    var _a15;
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
      const buttonWrapper = (_a15 = document.querySelector("#update-scores-button")) == null ? void 0 : _a15.parentElement;
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

  // src/dashboard/gradeDisplay.js
  init_logger();
  init_canvasApiClient();
  init_gradeDataService();

  // src/dashboard/cardRenderer.js
  init_logger();
  init_config();
  init_gradeDataService();
  var GRADE_CLASS_PREFIX = "cg-dashboard-grade";
  var CARD_SELECTORS = [
    ".ic-DashboardCard",
    '[class*="DashboardCard"]',
    '[class*="CourseCard"]',
    ".course-list-item",
    ".dashboard-card"
  ];
  var HERO_SELECTORS = [
    ".ic-DashboardCard__header_hero",
    '[class*="hero"]',
    '[class*="Hero"]',
    ".ic-DashboardCard__header",
    '[class*="header"]',
    '[class*="Header"]'
  ];
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
    for (const link of links) {
      if (link.closest(".ic-app-header") || link.closest('[role="navigation"]') || link.closest(".menu")) {
        continue;
      }
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
  function isValidLetterGrade(letterGrade) {
    if (!letterGrade) {
      logger.trace(`[Letter Grade Validation] letterGrade is empty/null/undefined`);
      return false;
    }
    const rating = OUTCOME_AND_RUBRIC_RATINGS.find(
      (r) => r.description === letterGrade
    );
    const isValid = rating !== void 0;
    logger.trace(`[Letter Grade Validation] Checking "${letterGrade}" against rating scale: ${isValid ? "MATCH FOUND" : "NO MATCH"}`);
    if (!isValid && OUTCOME_AND_RUBRIC_RATINGS.length > 0) {
      logger.trace(`[Letter Grade Validation] Available rating descriptions:`, OUTCOME_AND_RUBRIC_RATINGS.map((r) => r.description));
    }
    return isValid;
  }
  function percentageToPoints(percentageScore) {
    return percentageScore / 100 * DEFAULT_MAX_POINTS;
  }
  function formatGradeDisplay(gradeData) {
    const { score, letterGrade, source } = gradeData;
    logger.trace(`[Grade Conversion Debug] Formatting grade data: source=${source}, score=${score}, letterGrade=${letterGrade}`);
    let displayValue;
    let ariaLabel;
    if (source === GRADE_SOURCE.ASSIGNMENT) {
      const scoreStr = score.toFixed(2);
      if (letterGrade) {
        displayValue = `${scoreStr} (${letterGrade})`;
        ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
      } else {
        displayValue = scoreStr;
        ariaLabel = `Grade: ${scoreStr}`;
      }
      logger.trace(`[Grade Conversion Debug] Assignment grade: display=${displayValue}`);
    } else if (source === GRADE_SOURCE.ENROLLMENT) {
      const isValidGrade = isValidLetterGrade(letterGrade);
      logger.trace(`[Grade Conversion Debug] isValidLetterGrade("${letterGrade}") = ${isValidGrade}`);
      if (isValidGrade) {
        const pointValue = percentageToPoints(score);
        const scoreStr = pointValue.toFixed(2);
        displayValue = `${scoreStr} (${letterGrade})`;
        ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
        logger.trace(`[Grade Conversion Debug] Converted to points: ${score}% -> ${pointValue} -> display="${displayValue}"`);
      } else {
        const percentageStr = `${score.toFixed(2)}%`;
        if (letterGrade) {
          displayValue = `${percentageStr} (${letterGrade})`;
          ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
          logger.trace(`[Grade Conversion Debug] Letter grade "${letterGrade}" not in rating scale, using percentage: display="${displayValue}"`);
        } else {
          displayValue = percentageStr;
          ariaLabel = `Grade: ${percentageStr}`;
          logger.trace(`[Grade Conversion Debug] No letter grade, using percentage: display="${displayValue}"`);
        }
      }
    } else {
      logger.warn(`[Grade Conversion Debug] Unknown grade source: ${source}`);
      const percentageStr = `${score.toFixed(2)}%`;
      if (letterGrade) {
        displayValue = `${percentageStr} (${letterGrade})`;
        ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
      } else {
        displayValue = percentageStr;
        ariaLabel = `Grade: ${percentageStr}`;
      }
    }
    return { displayValue, ariaLabel };
  }
  function createGradeBadge(gradeData, heroElement = null) {
    const { source } = gradeData;
    const { displayValue, ariaLabel } = formatGradeDisplay(gradeData);
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
      const displayInfo = gradeData.letterGrade ? `${gradeData.score}% (${gradeData.letterGrade})` : `${gradeData.score}`;
      logger.trace(`Grade badge rendered (${displayInfo}, source: ${gradeData.source})`);
      logger.trace(`Badge placed in: ${heroContainer.className || heroContainer.tagName}`);
    } else {
      logger.debug(`Grade badge rendered on card (source: ${gradeData.source})`);
    }
  }
  function removeGradeFromCard(cardElement) {
    const existingBadge = cardElement.querySelector(`.${GRADE_CLASS_PREFIX}`);
    if (existingBadge) {
      existingBadge.remove();
      logger.trace("Existing grade badge removed from card");
    }
  }

  // src/dashboard/gradeDisplay.js
  var initialized = false;
  var dashboardObserver = null;
  var CONCURRENT_WORKERS = 3;
  async function fetchActiveCourses(apiClient) {
    var _a15;
    try {
      const courses = await apiClient.get(
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
        if ((_a15 = firstCourse.enrollmentData) == null ? void 0 : _a15.grades) {
          logger.trace(`First course grades object:`, firstCourse.enrollmentData.grades);
        }
      }
      return coursesWithEnrollmentData;
    } catch (error) {
      logger.error("Failed to fetch active courses:", error);
      return [];
    }
  }
  async function updateCourseCard(courseId, apiClient) {
    try {
      const cardElement = findCourseCard(courseId);
      if (!cardElement) {
        logger.trace(`Card element not found for course ${courseId}, skipping`);
        return;
      }
      const gradeData = await getCourseGrade(courseId, apiClient);
      if (!gradeData) {
        logger.trace(`No grade available for course ${courseId}, skipping`);
        return;
      }
      renderGradeOnCard(cardElement, gradeData);
      const displayInfo = gradeData.letterGrade ? `${gradeData.score}% (${gradeData.letterGrade})` : `${gradeData.score}`;
      logger.trace(`Grade displayed for course ${courseId}: ${displayInfo} (source: ${gradeData.source})`);
    } catch (error) {
      logger.warn(`Failed to update grade for course ${courseId}:`, error.message);
    }
  }
  async function updateAllCourseCards() {
    try {
      const startTime = performance.now();
      const apiClient = new CanvasApiClient();
      const courses = await fetchActiveCourses(apiClient);
      if (courses.length === 0) {
        logger.info("No active student courses found");
        return;
      }
      logger.info(`Updating grades for ${courses.length} courses`);
      preCacheEnrollmentGrades(courses);
      const concurrency = CONCURRENT_WORKERS;
      const queue = courses.map((c) => c.id);
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;
      async function worker() {
        while (queue.length > 0) {
          const courseId = queue.shift();
          if (!courseId) break;
          try {
            await updateCourseCard(courseId, apiClient);
            processedCount++;
            successCount++;
            if (processedCount % 5 === 0) {
              logger.debug(`Progress: ${processedCount}/${courses.length} courses processed`);
            }
          } catch (error) {
            processedCount++;
            errorCount++;
            logger.warn(`Worker failed to process course ${courseId}:`, error.message);
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
  function getDashboardCardSelectors() {
    return [
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
  }
  function findDashboardCards() {
    const selectors = getDashboardCardSelectors();
    for (const selector of selectors) {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        logger.trace(`Found ${cards.length} dashboard cards using selector: ${selector}`);
        return cards;
      }
    }
    const courseLinks = document.querySelectorAll('a[href*="/courses/"]');
    if (courseLinks.length > 0) {
      logger.trace(`Found ${courseLinks.length} course links as fallback`);
      const dashboardLinks = Array.from(courseLinks).filter((link) => {
        const isDashboardArea = !link.closest(".ic-app-header") && !link.closest('[role="navigation"]') && !link.closest(".menu");
        return isDashboardArea;
      });
      if (dashboardLinks.length > 0) {
        logger.trace(`Found ${dashboardLinks.length} dashboard course links`);
        return dashboardLinks;
      }
    }
    logger.trace("No dashboard cards found with any selector");
    return null;
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
  function looksLikeDashboardCard(node) {
    var _a15, _b15;
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const element = node;
    if ((_a15 = element.hasAttribute) == null ? void 0 : _a15.call(element, "data-course-id")) return true;
    const className = element.className || "";
    if (typeof className === "string") {
      if (className.includes("DashboardCard") || className.includes("CourseCard") || className.includes("course-list-item") || className.includes("dashboard-card")) {
        return true;
      }
    }
    if ((_b15 = element.querySelector) == null ? void 0 : _b15.call(element, 'a[href*="/courses/"]')) {
      return true;
    }
    return false;
  }
  function setupDashboardObserver() {
    if (dashboardObserver) {
      dashboardObserver.disconnect();
    }
    dashboardObserver = new MutationObserver((mutations) => {
      const cardsAdded = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some((node) => {
          var _a15;
          return looksLikeDashboardCard(node) || ((_a15 = node.querySelector) == null ? void 0 : _a15.call(node, getDashboardCardSelectors().join(",")));
        });
      });
      if (cardsAdded) {
        logger.trace("Dashboard cards detected via MutationObserver, updating grades");
        updateAllCourseCards();
      }
    });
    const dashboardContainer = document.querySelector("#dashboard") || document.querySelector("#content") || document.body;
    dashboardObserver.observe(dashboardContainer, {
      childList: true,
      subtree: true
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
      const apiClient = new CanvasApiClient();
      const courses = await fetchActiveCourses(apiClient);
      if (courses.length === 0) {
        logger.warn("No courses found for performance testing");
        return { error: "No courses found" };
      }
      logger.info(`Testing with ${courses.length} courses`);
      preCacheEnrollmentGrades(courses);
      logger.info("Test 1: Sequential processing...");
      const sequentialStart = performance.now();
      for (const course of courses) {
        try {
          await getCourseGrade(course.id, apiClient);
        } catch (error) {
          logger.trace(`Sequential test error for course ${course.id}:`, error.message);
        }
      }
      const sequentialTime = performance.now() - sequentialStart;
      logger.info(`Sequential: ${sequentialTime.toFixed(0)}ms total, ${(sequentialTime / courses.length).toFixed(0)}ms per course`);
      const { clearGradeCache: clearGradeCache2 } = await Promise.resolve().then(() => (init_gradeDataService(), gradeDataService_exports));
      clearGradeCache2();
      preCacheEnrollmentGrades(courses);
      logger.info("Test 2: Concurrent processing...");
      const concurrentStart = performance.now();
      const concurrency = CONCURRENT_WORKERS;
      const queue = courses.map((c) => c.id);
      async function worker() {
        while (queue.length > 0) {
          const courseId = queue.shift();
          if (!courseId) break;
          try {
            await getCourseGrade(courseId, apiClient);
          } catch (error) {
            logger.trace(`Concurrent test error for course ${courseId}:`, error.message);
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
  init_logger();
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
    gradingDropdownObserver = new MutationObserver((mutations) => {
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
    });
    gradingDropdownObserver.observe(document.body, {
      childList: true,
      // Watch for nodes being added/removed
      subtree: true,
      // Watch all descendants, not just direct children
      attributes: true,
      // Watch for attribute changes
      attributeFilter: ["disabled", "readonly", "aria-disabled", "class"]
      // Only watch these attributes
    });
    logger.trace("Grading dropdown observer setup complete");
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

  // src/student/studentGradeCustomization.js
  init_config();

  // src/student/gradePageCustomizer.js
  init_config();

  // src/student/gradeExtractor.js
  init_config();
  init_logger();
  function scoreToGradeLevel(score) {
    var _a15;
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
    return ((_a15 = sortedRatings[sortedRatings.length - 1]) == null ? void 0 : _a15.description) || null;
  }
  function extractCurrentScoreFromPage() {
    var _a15, _b15;
    const assignmentLinks = document.querySelectorAll('a[href*="/assignments/"]');
    for (const link of assignmentLinks) {
      if (link.textContent.trim() !== AVG_ASSIGNMENT_NAME) {
        continue;
      }
      const row = link.closest("tr");
      if (!row) continue;
      const scoreCandidates = [
        row.querySelector(".original_score"),
        row.querySelector(".original_points"),
        row.querySelector(".assignment_score .grade")
      ];
      let score = null;
      for (const el of scoreCandidates) {
        if (!el) continue;
        const txt = (_a15 = el.textContent) == null ? void 0 : _a15.trim();
        if (!txt) continue;
        const match = txt.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          score = match[1];
          logger.trace(`Found ${AVG_ASSIGNMENT_NAME} score in table: ${score} (from ${el.className})`);
          break;
        }
      }
      if (!score) continue;
      let letterGrade = null;
      const letterGradeCandidates = [
        // Look for letter grade in tooltip or grade display
        row.querySelector(".assignment_score .tooltip"),
        row.querySelector(".assignment_score"),
        // Sometimes it's in a separate element
        row.querySelector(".letter-grade"),
        row.querySelector(".grade-display")
      ];
      for (const el of letterGradeCandidates) {
        if (!el) continue;
        const txt = (_b15 = el.textContent) == null ? void 0 : _b15.trim();
        if (!txt) continue;
        for (const rating of OUTCOME_AND_RUBRIC_RATINGS) {
          if (txt.includes(rating.description)) {
            letterGrade = rating.description;
            logger.trace(`Found letter grade in table: ${letterGrade}`);
            break;
          }
        }
        if (letterGrade) break;
      }
      if (!letterGrade) {
        letterGrade = scoreToGradeLevel(score);
        logger.trace(`Calculated letter grade from score: ${letterGrade}`);
      }
      logger.trace(`Extracted ${AVG_ASSIGNMENT_NAME}: score=${score}, letterGrade=${letterGrade}`);
      return { score, letterGrade };
    }
    logger.trace(`No ${AVG_ASSIGNMENT_NAME} found on page`);
    return null;
  }

  // src/student/gradePageCustomizer.js
  init_logger();
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
  function formatGradeDisplay2(score, letterGrade) {
    if (letterGrade) {
      return `${score} (${letterGrade})`;
    }
    return score;
  }
  function replaceRightSidebar(gradeData) {
    const { score, letterGrade } = gradeData;
    const displayValue = formatGradeDisplay2(score, letterGrade);
    const rightSide = getRightSideElement();
    if (!rightSide) {
      logger.trace("Right sidebar not found; deferring...");
      return;
    }
    if (rightSide.dataset.processed) {
      const masteryAside2 = document.getElementById("mastery-right-side");
      if (masteryAside2) {
        const span = masteryAside2.querySelector(".mastery-grade");
        if (span) span.textContent = displayValue;
      }
      return;
    }
    rightSide.style.display = "none";
    rightSide.dataset.processed = "true";
    const masteryAside = document.createElement("aside");
    masteryAside.id = "mastery-right-side";
    masteryAside.setAttribute("role", "complementary");
    masteryAside.style.cssText = `
        color: inherit; font-weight: inherit; font-size: inherit; font-family: inherit;
        margin: inherit; padding: inherit; background: inherit; border: inherit;
    `;
    masteryAside.innerHTML = `
        <div id="student-grades-right-content">
            <div class="student_assignment mastery_total">
                ${AVG_OUTCOME_NAME}: <span class="mastery-grade">${displayValue}</span>
            </div>
        </div>
    `;
    const headerEl = masteryAside.querySelector(".mastery_total");
    if (headerEl) {
      const ok = inheritFontStylesFrom("h1.screenreader-only, h1, .ic-app-nav-toggle-and-crumbs h1", headerEl);
      if (!ok) {
        headerEl.style.fontSize = "1.5em";
        headerEl.style.fontWeight = "bold";
      }
    }
    rightSide.parentNode.insertBefore(masteryAside, rightSide.nextSibling);
    logger.debug(`Sidebar replaced with ${AVG_OUTCOME_NAME}: ${displayValue}`);
  }
  function applyCustomizations(gradeData) {
    if (processed) return false;
    if (REMOVE_ASSIGNMENT_TAB) {
      ensureAssignmentsTabRemoved();
      goToLearningMasteryTab();
    }
    replaceRightSidebar(gradeData);
    processed = true;
    return true;
  }
  function runOnce() {
    if (processed) return true;
    const gradeData = extractCurrentScoreFromPage();
    if (gradeData === null) {
      return false;
    }
    return applyCustomizations(gradeData);
  }
  function initGradePageCustomizer() {
    logger.debug("Initializing grade page customizer");
    let didRun = runOnce();
    if (!didRun) {
      const obs = new MutationObserver(() => {
        if (runOnce()) {
          obs.disconnect();
          logger.debug("Student grade customization applied after DOM updates");
        }
      });
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      setTimeout(() => {
        obs.disconnect();
        logger.trace("Student grade customization observer disconnected (timeout)");
      }, 3e4);
    }
  }

  // src/student/gradeNormalizer.js
  init_config();
  init_logger();
  function removeFractionScores() {
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
    normalizeFinalGradeRow();
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
  function formatGradeDisplay3(score, letterGrade) {
    if (letterGrade) {
      return `${score} (${letterGrade})`;
    }
    return score;
  }
  function normalizeFinalGradeRow() {
    document.querySelectorAll("tr.student_assignment.hard_coded.final_grade").forEach((row) => {
      const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
      const possibleEl = row.querySelector(".details .possible.points_possible");
      if (gradeEl) {
        const gradeData = extractCurrentScoreFromPage();
        if (gradeData && gradeData.score) {
          const displayValue = formatGradeDisplay3(gradeData.score, gradeData.letterGrade);
          gradeEl.textContent = displayValue;
        } else {
          const raw = gradeEl.textContent.trim();
          if (/^\d+(\.\d+)?%$/.test(raw)) {
            gradeEl.textContent = "";
          }
        }
      }
      if (possibleEl) {
        const txt = possibleEl.textContent.trim();
        if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
          possibleEl.textContent = "";
        }
      }
    });
  }

  // src/student/cleanupObserver.js
  init_logger();
  function debounce(fn, delay) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(), delay);
    };
  }
  function isCoursePageNeedingCleanup() {
    const path = window.location.pathname;
    return window.location.href.includes("/courses/") && (path.includes("/grades") || path.includes("/assignments") || /^\/courses\/\d+$/.test(path));
  }
  function shouldClean() {
    return isDashboardPage() || isCoursePageNeedingCleanup();
  }
  function startCleanupObservers() {
    logger.debug("Starting cleanup observers for grade normalization");
    const debouncedClean = debounce(() => {
      if (shouldClean()) {
        removeFractionScores();
      }
    }, 100);
    setTimeout(() => {
      debouncedClean();
      const observer = new MutationObserver(() => {
        debouncedClean();
      });
      if (shouldClean()) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        logger.debug("MutationObserver started for grade cleanup");
      }
      let lastUrl = location.href;
      setInterval(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          debouncedClean();
        }
      }, 1e3);
    }, 500);
  }
  async function initCleanupObservers() {
    if (isDashboardPage()) {
      logger.debug("Initializing cleanup observers for dashboard");
      startCleanupObservers();
    } else {
      const hasAvg = await courseHasAvgAssignment();
      if (!hasAvg) {
        logger.debug("Skipping fraction cleanup \u2014 no Current Score Assignment in this course");
        return;
      }
      logger.debug("Initializing cleanup observers for course page");
      startCleanupObservers();
    }
  }

  // src/student/studentGradeCustomization.js
  init_logger();
  function isStudentGradesPage() {
    return window.location.href.includes("/courses/") && window.location.pathname.includes("/grades");
  }
  function initStudentGradeCustomization() {
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
    if (isStudentGradesPage()) {
      logger.debug("On student grades page, initializing grade page customizer");
      initGradePageCustomizer();
    }
    initCleanupObservers();
  }

  // src/customGradebookInit.js
  function isDashboardPage2() {
    const path = window.location.pathname;
    return path === "/" || path === "/dashboard" || path.startsWith("/dashboard/");
  }
  function isSpeedGraderPage() {
    return window.location.pathname.includes("/speed_grader");
  }
  (function init() {
    logBanner("dev", "2026-01-15 5:04:33 PM (dev, 1271e52)");
    exposeVersion("dev", "2026-01-15 5:04:33 PM (dev, 1271e52)");
    if (true) {
      logger.info("Running in DEV mode");
    }
    if (false) {
      logger.info("Running in PROD mode");
    }
    logger.info(`Build environment: ${"dev"}`);
    if (window.location.pathname.includes("/gradebook")) {
      injectButtons();
    }
    if (isDashboardPage2()) {
      initDashboardGradeDisplay();
    }
    if (isSpeedGraderPage()) {
      initSpeedGraderDropdown();
    }
    initStudentGradeCustomization();
  })();
})();
//# sourceMappingURL=customGradebookInit.js.map
