(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
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
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/utils/logger.js
  function determineLogLevel() {
    let logLevel = true ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const debugParam = urlParams.get("debug");
      if (debugParam === "true") {
        logLevel = LOG_LEVELS.DEBUG;
      } else if (debugParam === "false") {
        logLevel = LOG_LEVELS.INFO;
      }
    } catch (e) {
      console.warn("Failed to parse URL parameters for debug mode:", e);
    }
    return logLevel;
  }
  function log(...args) {
    logger.debug(...args);
  }
  function logBanner(envName, buildVersion) {
    console.log(
      "%cCustomized Gradebook Loaded",
      "color:#4CAF50; font-weight:bold;"
    );
    console.log(`Environment: ${envName}`);
    console.log(`Build Version: ${buildVersion}`);
    if (logger.isDebugEnabled()) {
      console.log("%cDebug logging: ENABLED", "color:#FF9800; font-weight:bold;");
    } else {
      console.log("Debug logging: disabled");
    }
  }
  function exposeVersion(envName, buildVersion) {
    window.CG = {
      env: envName,
      version: buildVersion,
      debugEnabled: logger.isDebugEnabled(),
      logLevel: currentLogLevel
    };
  }
  var LOG_LEVELS, currentLogLevel, logger;
  var init_logger = __esm({
    "src/utils/logger.js"() {
      LOG_LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
      };
      currentLogLevel = determineLogLevel();
      logger = {
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
  var init_dom = __esm({
    "src/utils/dom.js"() {
    }
  });

  // src/ui/buttons.js
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
  var BRAND_COLOR_FALLBACK;
  var init_buttons = __esm({
    "src/ui/buttons.js"() {
      init_dom();
      BRAND_COLOR_FALLBACK = "#0c7d9d";
    }
  });

  // src/config.js
  var PER_STUDENT_UPDATE_THRESHOLD, ENABLE_GRADE_OVERRIDE, OVERRIDE_SCALE, UPDATE_AVG_BUTTON_LABEL, AVG_OUTCOME_NAME, AVG_ASSIGNMENT_NAME, AVG_RUBRIC_NAME, DEFAULT_MAX_POINTS, DEFAULT_MASTERY_THRESHOLD, OUTCOME_AND_RUBRIC_RATINGS, EXCLUDED_OUTCOME_KEYWORDS;
  var init_config = __esm({
    "src/config.js"() {
      PER_STUDENT_UPDATE_THRESHOLD = 25;
      ENABLE_GRADE_OVERRIDE = true;
      OVERRIDE_SCALE = (avg) => Number((avg * 25).toFixed(2));
      UPDATE_AVG_BUTTON_LABEL = "Update Current Score";
      AVG_OUTCOME_NAME = "Current Score";
      AVG_ASSIGNMENT_NAME = "Current Score Assignment";
      AVG_RUBRIC_NAME = "Current Score Rubric";
      DEFAULT_MAX_POINTS = 4;
      DEFAULT_MASTERY_THRESHOLD = 3;
      OUTCOME_AND_RUBRIC_RATINGS = [
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
      EXCLUDED_OUTCOME_KEYWORDS = ["Homework Completion"];
    }
  });

  // src/utils/canvas.js
  function getCourseId() {
    var _a, _b;
    const envCourseId = ENV == null ? void 0 : ENV.COURSE_ID;
    const pathCourseId = (_b = (_a = window.location.pathname.match(/courses\/(\d+)/)) == null ? void 0 : _a[1]) != null ? _b : null;
    const courseId = envCourseId || pathCourseId;
    if (!courseId) {
      logger.error("Course ID not found on page.");
      return null;
    }
    return courseId;
  }
  function getTokenCookie(name) {
    const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
    let cookieValue = null;
    let i = 0;
    while (i < cookies.length && cookieValue === null) {
      const cookie = cookies[i].split("=", 2);
      if (cookie[0] === name) {
        cookieValue = decodeURIComponent(cookie[1]);
      }
      i++;
    }
    if (!cookieValue) {
      throw new Error("CSRF token / cookie not found.");
    }
    return cookieValue;
  }
  var init_canvas = __esm({
    "src/utils/canvas.js"() {
      init_config();
      init_logger();
    }
  });

  // src/utils/keys.js
  var k;
  var init_keys = __esm({
    "src/utils/keys.js"() {
      k = (name, courseId) => `${name}_${courseId}`;
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

  // src/services/gradeOverride.js
  async function setOverrideScoreGQL(enrollmentId, overrideScore) {
    var _a, _b, _c, _d, _e;
    const csrfToken = getTokenCookie("_csrf_token");
    if (!csrfToken) {
      const error = new Error("No CSRF token found.");
      logError(error, "setOverrideScoreGQL");
      throw error;
    }
    const query = `
    mutation SetOverride($enrollmentId: ID!, $overrideScore: Float!) {
      setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        grades { customGradeStatusId overrideScore __typename }
        __typename
      }
    }`;
    const res = await safeFetch(
      "/api/graphql",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({
          query,
          variables: {
            enrollmentId: String(enrollmentId),
            overrideScore: Number(overrideScore)
          }
        })
      },
      "setOverrideScoreGQL"
    );
    const json = await safeJsonParse(res, "setOverrideScoreGQL");
    if (json.errors) {
      const error = new Error(`GQL error: ${JSON.stringify(json.errors)}`);
      logError(error, "setOverrideScoreGQL", { enrollmentId, overrideScore });
      throw error;
    }
    return (_e = (_d = (_c = (_b = (_a = json.data) == null ? void 0 : _a.setOverrideScore) == null ? void 0 : _b.grades) == null ? void 0 : _c[0]) == null ? void 0 : _d.overrideScore) != null ? _e : null;
  }
  async function getEnrollmentIdForUser(courseId, userId) {
    var _a, _b;
    const courseKey = String(courseId);
    const userKey = String(userId);
    if (__enrollmentMapCache.has(courseKey)) {
      const cachedMap = __enrollmentMapCache.get(courseKey);
      return cachedMap.get(userKey) || null;
    }
    const map = /* @__PURE__ */ new Map();
    let url = `/api/v1/courses/${courseKey}/enrollments?type[]=StudentEnrollment&per_page=100`;
    while (url) {
      const res = await safeFetch(url, { credentials: "same-origin" }, "getEnrollmentIdForUser");
      const data = await safeJsonParse(res, "getEnrollmentIdForUser");
      for (const e of data) {
        if ((e == null ? void 0 : e.user_id) && (e == null ? void 0 : e.id)) map.set(String(e.user_id), e.id);
      }
      const link = res.headers.get("Link");
      const next = link == null ? void 0 : link.split(",").find((s) => s.includes('rel="next"'));
      url = next ? (_b = (_a = next.match(/<([^>]+)>/)) == null ? void 0 : _a[1]) != null ? _b : null : null;
    }
    __enrollmentMapCache.set(courseKey, map);
    return map.get(userKey) || null;
  }
  async function queueOverride(courseId, userId, average) {
    if (!ENABLE_GRADE_OVERRIDE) return;
    try {
      const enrollmentId = await getEnrollmentIdForUser(courseId, userId);
      if (!enrollmentId) {
        logger.warn(`[override/concurrent] no enrollmentId for user ${userId}`);
        return;
      }
      const override = OVERRIDE_SCALE(average);
      await setOverrideScoreGQL(enrollmentId, override);
      logger.debug(`[override/concurrent] user ${userId} \u2192 enrollment ${enrollmentId}: ${override}`);
    } catch (e) {
      logger.warn(`[override/concurrent] failed for user ${userId}:`, (e == null ? void 0 : e.message) || e);
    }
  }
  var __enrollmentMapCache;
  var init_gradeOverride = __esm({
    "src/services/gradeOverride.js"() {
      init_canvas();
      init_config();
      init_errorHandler();
      init_logger();
      __enrollmentMapCache = /* @__PURE__ */ new Map();
    }
  });

  // src/services/gradeSubmission.js
  var gradeSubmission_exports = {};
  __export(gradeSubmission_exports, {
    beginBulkUpdate: () => beginBulkUpdate,
    downloadErrorSummary: () => downloadErrorSummary,
    postPerStudentGrades: () => postPerStudentGrades,
    submitRubricScore: () => submitRubricScore,
    waitForBulkGrading: () => waitForBulkGrading
  });
  async function submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, score) {
    const csrfToken = getTokenCookie("_csrf_token");
    logger.debug("csrfToken:", csrfToken);
    const timeStamp = (/* @__PURE__ */ new Date()).toLocaleString();
    logger.debug("Submitting rubric score for student", userId);
    const payload = {
      authenticity_token: csrfToken,
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
    logger.debug("Submitting rubric score for student", userId, payload);
    const response = await safeFetch(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      },
      `submitRubricScore:${userId}`
    );
    logger.debug("Score submitted successfully for user", userId);
  }
  async function beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages) {
    const csrfToken = getTokenCookie("_csrf_token");
    if (!csrfToken) {
      const error = new Error("CSRF token not found.");
      logError(error, "beginBulkUpdate");
      throw error;
    }
    const timeStamp = (/* @__PURE__ */ new Date()).toLocaleString();
    const gradeData = {};
    logger.debug("averages:", averages);
    for (const { userId, average } of averages) {
      logger.debug("userId:", userId, "score:", average);
      gradeData[userId] = {
        posted_grade: average,
        text_comment: "Score: " + average + "  Updated: " + timeStamp,
        rubric_assessment: {
          [rubricCriterionId.toString()]: {
            points: average
          }
        }
      };
      if (ENABLE_GRADE_OVERRIDE) {
        await queueOverride(courseId, userId, average);
      }
    }
    logger.debug("bulk gradeData payload:", gradeData);
    const response = await safeFetch(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/update_grades`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          authenticity_token: csrfToken,
          grade_data: gradeData
        })
      },
      "beginBulkUpdate"
    );
    const result = await safeJsonParse(response, "beginBulkUpdate");
    const progressId = result.id;
    localStorage.setItem(`progressId_${getCourseId()}`, progressId);
    logger.info("Waiting for grading to complete progress ID:", progressId);
    return progressId;
  }
  async function waitForBulkGrading(box, timeout = 12e5, interval = 2e3) {
    const loopStartTime = Date.now();
    let state = "beginning upload";
    const courseId = getCourseId();
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    startElapsedTimer(courseId, box);
    while (Date.now() - loopStartTime < timeout) {
      const res = await safeFetch(`/api/v1/progress/${progressId}`, {}, "waitForBulkGrading");
      const progress = await safeJsonParse(res, "waitForBulkGrading");
      let elapsed = getElapsedTimeSinceStart();
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
          localStorage.setItem(`uploadFinishTime_${getCourseId()}`, progress.updated_at);
          localStorage.removeItem(`updateInProgress_${getCourseId()}`);
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
  async function postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, testing = false) {
    const updateInterval = 1;
    const numberOfUpdates = averages.length;
    box.setText(`Updating "${AVG_OUTCOME_NAME}" scores for ${numberOfUpdates} students...`);
    const failedUpdates = [];
    const retryCounts = {};
    const retriedStudents = /* @__PURE__ */ new Set();
    async function tryUpdateStudent(student, maxAttempts = 3) {
      const { userId, average } = student;
      let lastError = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, average);
          if (ENABLE_GRADE_OVERRIDE) {
            try {
              const enrollmentId = await getEnrollmentIdForUser(courseId, userId);
              if (enrollmentId) {
                const override = OVERRIDE_SCALE(average);
                await setOverrideScoreGQL(enrollmentId, override);
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
      var _a, _b;
      const attempts = (_a = retryCountsById[userId]) != null ? _a : "";
      const failed = failedById[userId];
      const average = (_b = failed == null ? void 0 : failed.average) != null ? _b : "";
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
  var init_gradeSubmission = __esm({
    "src/services/gradeSubmission.js"() {
      init_canvas();
      init_config();
      init_uiHelpers();
      init_gradeOverride();
      init_errorHandler();
      init_logger();
    }
  });

  // src/services/verification.js
  var verification_exports = {};
  __export(verification_exports, {
    verifyUIScores: () => verifyUIScores
  });
  async function verifyUIScores(courseId, averages, outcomeId, box, waitTimeMs = 5e3, maxRetries = 50) {
    let state = "verifying";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let elapsed = getElapsedTimeSinceStart();
      box.soft(`Verification status: ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
      startElapsedTimer(courseId, box);
      const response = await fetch(`/api/v1/courses/${courseId}/outcome_rollups?&outcome_ids[]=${outcomeId}&include[]=outcomes&include[]=users&per_page=100`);
      if (!response.ok) {
        throw new Error("Failed to fetch outcome results for update verification");
      }
      const newRollupData = await response.json();
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
        const durationSeconds = getElapsedTimeSinceStart();
        localStorage.setItem(`duration_${getCourseId()}`, durationSeconds);
        return;
      } else {
        logger.warn("Mismatches found:", mismatches);
        logger.info(`Waiting ${waitTimeMs / 1e3} seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      }
    }
  }
  var init_verification = __esm({
    "src/services/verification.js"() {
      init_canvas();
      init_uiHelpers();
      init_logger();
    }
  });

  // src/utils/uiHelpers.js
  function getElapsedTimeSinceStart(endTime = Date.now()) {
    const start = localStorage.getItem(`startTime_${getCourseId()}`);
    if (!start) return 0;
    const startMs = new Date(start).getTime();
    const endMs = endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime();
    return Math.floor((endMs - startMs) / 1e3);
  }
  function startElapsedTimer(courseId, box) {
    const node = box.querySelector(".floating-banner__text") || box;
    stopElapsedTimer(box);
    const re = /\(Elapsed time:\s*\d+s\)/;
    const tick = () => {
      const elapsed = getElapsedTimeSinceStart();
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
  function ensureStatusPill(courseId) {
    var _a;
    if (document.getElementById("avg-status-pill")) return;
    const safeParse = (s) => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    };
    const buttonWrapper = (_a = document.querySelector("#update-scores-button")) == null ? void 0 : _a.parentElement;
    if (!buttonWrapper) {
      const pill2 = document.createElement("button");
      pill2.id = "avg-status-pill";
      pill2.textContent = "Show status";
      Object.assign(pill2.style, {
        position: "fixed",
        bottom: "16px",
        right: "16px",
        padding: "6px 10px",
        borderRadius: "16px",
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        zIndex: 1e4
      });
      pill2.onclick = () => {
        pill2.remove();
        localStorage.setItem(k("bannerDismissed", getCourseId()), "false");
        const text = localStorage.getItem(k("bannerLast", getCourseId())) || "Working";
        showFloatingBanner({ courseId: getCourseId(), text });
      };
      document.body.appendChild(pill2);
      return;
    }
    const pill = makeButton({
      label: "Show Status",
      id: "avg-status-pill",
      tooltip: "Show last update status",
      onClick: async () => {
        pill.remove();
        localStorage.setItem(k("bannerDismissed", getCourseId()), "false");
        const courseId2 = getCourseId();
        const inProgress = localStorage.getItem(`updateInProgress_${courseId2}`) === "true";
        const verificationPending = localStorage.getItem(`verificationPending_${courseId2}`) === "true";
        const progressId = localStorage.getItem(`progressId_${courseId2}`);
        const outcomeId = localStorage.getItem(`outcomeId_${courseId2}`);
        const expectedAverages = safeParse(localStorage.getItem(`expectedAverages_${courseId2}`));
        const { waitForBulkGrading: waitForBulkGrading2 } = await Promise.resolve().then(() => (init_gradeSubmission(), gradeSubmission_exports));
        const { verifyUIScores: verifyUIScores2 } = await Promise.resolve().then(() => (init_verification(), verification_exports));
        if (inProgress && progressId) {
          const box = showFloatingBanner({ text: "Resuming: checking upload status" });
          await waitForBulkGrading2(box);
          return;
        }
        if (verificationPending && courseId2 && outcomeId && Array.isArray(expectedAverages)) {
          const box = showFloatingBanner({ text: "Verifying updated scores" });
          try {
            await verifyUIScores2(courseId2, expectedAverages, outcomeId, box);
            box.setText(`All ${expectedAverages.length} scores verified!`);
          } catch (e) {
            console.warn("Verification on resume failed:", e);
            box.setText("Verification failed. You can try updating again.");
          }
          return;
        }
        const text = localStorage.getItem(k("bannerLast", getCourseId())) || "Working";
        showFloatingBanner({ text });
      },
      type: "secondary"
    });
    pill.style.fontSize = "11px";
    pill.style.padding = "4px 8px";
    pill.style.marginBottom = "4px";
    pill.style.marginLeft = "0";
    buttonWrapper.insertBefore(pill, buttonWrapper.firstChild);
  }
  var init_uiHelpers = __esm({
    "src/utils/uiHelpers.js"() {
      init_canvas();
      init_keys();
      init_banner();
      init_buttons();
      init_logger();
    }
  });

  // src/ui/banner.js
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
      if (courseId) localStorage.setItem(k("bannerDismissed", courseId), "true");
      destroy();
      ensureStatusPill(courseId);
    };
    if (courseId) localStorage.setItem(k("bannerDismissed", courseId), "false");
    duration === "hold" ? banner.hold(text, 3e3) : banner.setText(text);
    return banner;
  }
  var BRAND_COLOR;
  var init_banner = __esm({
    "src/ui/banner.js"() {
      init_canvas();
      init_keys();
      init_uiHelpers();
      BRAND_COLOR = getComputedStyle(document.documentElement).getPropertyValue("--ic-brand-primary").trim() || "#0c7d9d";
    }
  });

  // src/main.js
  init_logger();

  // src/gradebook/ui/buttonInjection.js
  init_buttons();
  init_banner();
  init_canvas();
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
    [STATES.VERIFYING]: [STATES.VERIFYING, STATES.COMPLETE, STATES.ERROR],
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
      var _a;
      if (!this.canTransition(toState)) {
        throw new Error(
          `Invalid transition from ${this.currentState} to ${toState}. Valid transitions: ${((_a = VALID_TRANSITIONS[this.currentState]) == null ? void 0 : _a.join(", ")) || "none"}`
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
     * Serialize state machine to JSON
     * @returns {object} Serialized state
     */
    serialize() {
      return {
        currentState: this.currentState,
        context: __spreadProps(__spreadValues({}, this.context), {
          banner: null
          // Don't serialize UI references
        }),
        stateHistory: this.stateHistory,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    /**
     * Deserialize state machine from JSON
     * @param {object} data - Serialized state data
     */
    deserialize(data) {
      if (!data) return;
      this.currentState = data.currentState || STATES.IDLE;
      this.context = __spreadProps(__spreadValues(__spreadValues({}, this.context), data.context), {
        timestamp: data.timestamp
        // Preserve timestamp from serialization
      });
      this.stateHistory = data.stateHistory || [this.currentState];
      logger.debug(`State machine restored to ${this.currentState}`);
    }
    /**
     * Save state to localStorage
     * @param {string} courseId - Course ID for storage key
     */
    saveToLocalStorage(courseId) {
      if (!courseId) {
        logger.warn("Cannot save state: courseId is required");
        return;
      }
      try {
        const serialized = this.serialize();
        localStorage.setItem(`updateFlow_state_${courseId}`, JSON.stringify(serialized));
        logger.debug(`State saved to localStorage for course ${courseId}`);
      } catch (error) {
        logger.error("Failed to save state to localStorage:", error);
      }
    }
    /**
     * Load state from localStorage
     * @param {string} courseId - Course ID for storage key
     * @returns {boolean} True if state was loaded
     */
    loadFromLocalStorage(courseId) {
      if (!courseId) {
        logger.warn("Cannot load state: courseId is required");
        return false;
      }
      try {
        const stored = localStorage.getItem(`updateFlow_state_${courseId}`);
        if (!stored) return false;
        const data = JSON.parse(stored);
        const timestamp = new Date(data.timestamp);
        const now = /* @__PURE__ */ new Date();
        const ageInMinutes = (now - timestamp) / 1e3 / 60;
        if (ageInMinutes > 60) {
          logger.debug(`Stored state is ${ageInMinutes.toFixed(0)} minutes old, ignoring`);
          this.clearLocalStorage(courseId);
          return false;
        }
        this.deserialize(data);
        logger.info(`State restored from ${ageInMinutes.toFixed(1)} minutes ago`);
        return true;
      } catch (error) {
        logger.error("Failed to load state from localStorage:", error);
        return false;
      }
    }
    /**
     * Clear state from localStorage
     * @param {string} courseId - Course ID for storage key
     */
    clearLocalStorage(courseId) {
      if (!courseId) return;
      try {
        localStorage.removeItem(`updateFlow_state_${courseId}`);
        logger.debug(`State cleared from localStorage for course ${courseId}`);
      } catch (error) {
        logger.error("Failed to clear state from localStorage:", error);
      }
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

  // src/services/gradeCalculator.js
  init_config();
  init_logger();
  function calculateStudentAverages(data, outcomeId) {
    var _a, _b, _c;
    const averages = [];
    logger.info("Calculating student averages...");
    const excludedOutcomeIds = /* @__PURE__ */ new Set([String(outcomeId)]);
    const outcomeMap = {};
    ((_b = (_a = data == null ? void 0 : data.linked) == null ? void 0 : _a.outcomes) != null ? _b : []).forEach((o) => outcomeMap[o.id] = o.title);
    function getCurrentOutcomeScore(scores) {
      var _a2;
      logger.debug("Scores: ", scores);
      const match = scores.find((s) => {
        var _a3;
        return String((_a3 = s.links) == null ? void 0 : _a3.outcome) === String(outcomeId);
      });
      return (_a2 = match == null ? void 0 : match.score) != null ? _a2 : null;
    }
    logger.debug("data: data being sent to calculateStudentAverages", data);
    for (const rollup of data.rollups) {
      const userId = (_c = rollup.links) == null ? void 0 : _c.user;
      const oldAverage = getCurrentOutcomeScore(rollup.scores);
      const relevantScores = rollup.scores.filter((s) => {
        var _a2;
        const id = String((_a2 = s.links) == null ? void 0 : _a2.outcome);
        const title = (outcomeMap[id] || "").toLowerCase();
        return typeof s.score === "number" && // must have a numeric score
        !excludedOutcomeIds.has(id) && // not in the excluded IDs set
        !EXCLUDED_OUTCOME_KEYWORDS.some(
          (keyword) => title.includes(keyword.toLowerCase())
          // title doesn't contain any keyword
        );
      });
      if (relevantScores.length === 0) continue;
      const total = relevantScores.reduce((sum, s) => sum + s.score, 0);
      let newAverage = total / relevantScores.length;
      newAverage = parseFloat(newAverage.toFixed(2));
      logger.debug(`User ${userId}  total: ${total}, count: ${relevantScores.length}, average: ${newAverage}`);
      logger.debug(`Old average: ${oldAverage} New average: ${newAverage}`);
      if (oldAverage === newAverage) {
        logger.debug("old average matches new average");
        continue;
      }
      averages.push({ userId, average: newAverage });
    }
    logger.debug("averages after calculations:", averages);
    return averages;
  }

  // src/gradebook/stateHandlers.js
  init_gradeSubmission();
  init_verification();
  init_uiHelpers();

  // src/services/outcomeService.js
  init_errorHandler();
  init_canvas();
  init_config();
  init_logger();
  async function getRollup(courseId) {
    const response = await safeFetch(
      `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
      {},
      "getRollup"
    );
    const rollupData = await safeJsonParse(response, "getRollup");
    logger.debug("rollupData: ", rollupData);
    return rollupData;
  }
  function getOutcomeObjectByName(data) {
    var _a, _b;
    const outcomeTitle = AVG_OUTCOME_NAME;
    logger.debug("Outcome Title:", outcomeTitle);
    logger.debug("data:", data);
    const outcomes = (_b = (_a = data == null ? void 0 : data.linked) == null ? void 0 : _a.outcomes) != null ? _b : [];
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
  async function createOutcome(courseId) {
    const csrfToken = getTokenCookie("_csrf_token");
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const vendorGuid = `MOREnet_${randomSuffix}`;
    const ratingsCsv = OUTCOME_AND_RUBRIC_RATINGS.map((r) => `${r.points},"${r.description}"`).join(",");
    const csvContent = `vendor_guid,object_type,title,description,calculation_method,mastery_points
"${vendorGuid}",outcome,"${AVG_OUTCOME_NAME}","Auto-generated outcome: ${AVG_OUTCOME_NAME}",latest,"${DEFAULT_MASTERY_THRESHOLD}",${ratingsCsv}`;
    logger.debug("Importing outcome via CSV...");
    const importRes = await safeFetch(
      `/api/v1/courses/${courseId}/outcome_imports?import_type=instructure_csv`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "text/csv",
          "X-CSRF-Token": csrfToken
        },
        body: csvContent
      },
      "createOutcome"
    );
    const importData = await safeJsonParse(importRes, "createOutcome");
    const importId = importData.id;
    logger.debug(`Outcome import started: ID ${importId}`);
    let attempts = 0;
    let status = null;
    const maxAttempts = 15;
    const pollIntervalMs = 2e3;
    while (attempts++ < maxAttempts) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const pollRes = await safeFetch(
        `/api/v1/courses/${courseId}/outcome_imports/${importId}`,
        {},
        "createOutcome:poll"
      );
      const pollData = await safeJsonParse(pollRes, "createOutcome:poll");
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
  init_errorHandler();
  init_canvas();
  init_config();
  init_logger();
  async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject) {
    var _a;
    const alignments = (_a = outcomeObject.alignments) != null ? _a : [];
    for (const alignment of alignments) {
      if (!alignment.startsWith("assignment_")) continue;
      const assignmentId = alignment.split("_")[1];
      const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
      if (!res.ok) continue;
      const assignment = await res.json();
      if (assignment.name === AVG_ASSIGNMENT_NAME) {
        logger.debug("Assignment found:", assignment);
        return assignment;
      }
    }
    logger.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in alignments`);
    return null;
  }
  async function createAssignment(courseId) {
    const csrfToken = getTokenCookie("_csrf_token");
    const payload = {
      authenticity_token: csrfToken,
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
    const res = await safeFetch(
      `/api/v1/courses/${courseId}/assignments`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify(payload)
      },
      "createAssignment"
    );
    const assignment = await safeJsonParse(res, "createAssignment");
    logger.info("Assignment created:", assignment.name);
    return assignment.id;
  }

  // src/services/rubricService.js
  init_errorHandler();
  init_canvas();
  init_config();
  init_logger();
  async function getRubricForAssignment(courseId, assignmentId) {
    const response = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
    const assignment = await response.json();
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
  async function createRubric(courseId, assignmentId, outcomeId) {
    const csrfToken = getTokenCookie("_csrf_token");
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
    const response = await safeFetch(
      `/api/v1/courses/${courseId}/rubrics`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify(rubricPayload)
      },
      "createRubric"
    );
    const rubric = await safeJsonParse(response, "createRubric");
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
    banner.setText(`Checking setup for "${AVG_OUTCOME_NAME}"...`);
    const data = await getRollup(courseId);
    stateMachine.updateContext({ rollupData: data });
    const outcomeObj = getOutcomeObjectByName(data);
    const outcomeId = outcomeObj == null ? void 0 : outcomeObj.id;
    if (!outcomeId) {
      const confirmCreate = confirm(`Outcome "${AVG_OUTCOME_NAME}" not found.
Would you like to create it?`);
      if (!confirmCreate) throw new UserCancelledError("User declined to create missing outcome.");
      return STATES.CREATING_OUTCOME;
    }
    stateMachine.updateContext({ outcomeId });
    let assignmentObj = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj);
    if (!assignmentObj) {
      const assignmentIdFromName = await getAssignmentId(courseId);
      if (assignmentIdFromName) {
        const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentIdFromName}`);
        assignmentObj = await res.json();
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
    const result = await getRubricForAssignment(courseId, assignmentId);
    const rubricId = result == null ? void 0 : result.rubricId;
    const rubricCriterionId = result == null ? void 0 : result.criterionId;
    if (!rubricId) {
      const confirmCreate = confirm(`Rubric "${AVG_RUBRIC_NAME}" not found.
Would you like to create it?`);
      if (!confirmCreate) throw new UserCancelledError("User declined to create missing rubric.");
      return STATES.CREATING_RUBRIC;
    }
    stateMachine.updateContext({ rubricId, rubricCriterionId });
    return STATES.CALCULATING;
  }
  async function handleCreatingOutcome(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    banner.setText(`Creating "${AVG_OUTCOME_NAME}" Outcome...`);
    await createOutcome(courseId);
    return STATES.CHECKING_SETUP;
  }
  async function handleCreatingAssignment(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    banner.setText(`Creating "${AVG_ASSIGNMENT_NAME}" Assignment...`);
    const assignmentId = await createAssignment(courseId);
    stateMachine.updateContext({ assignmentId });
    return STATES.CHECKING_SETUP;
  }
  async function handleCreatingRubric(stateMachine) {
    const { courseId, assignmentId, outcomeId, banner } = stateMachine.getContext();
    banner.setText(`Creating "${AVG_RUBRIC_NAME}" Rubric...`);
    const rubricId = await createRubric(courseId, assignmentId, outcomeId);
    stateMachine.updateContext({ rubricId });
    return STATES.CHECKING_SETUP;
  }
  async function handleCalculating(stateMachine) {
    const { rollupData, outcomeId, courseId, banner } = stateMachine.getContext();
    banner.setText(`Calculating "${AVG_OUTCOME_NAME}" scores...`);
    const averages = calculateStudentAverages(rollupData, outcomeId);
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
    localStorage.setItem(`verificationPending_${courseId}`, "true");
    localStorage.setItem(`expectedAverages_${courseId}`, JSON.stringify(averages));
    localStorage.setItem(`outcomeId_${courseId}`, String(outcomeId));
    localStorage.setItem(`startTime_${courseId}`, (/* @__PURE__ */ new Date()).toISOString());
    return STATES.UPDATING_GRADES;
  }
  async function handleUpdatingGrades(stateMachine) {
    const { averages, courseId, assignmentId, rubricCriterionId, numberOfUpdates, banner } = stateMachine.getContext();
    const usePerStudent = numberOfUpdates < PER_STUDENT_UPDATE_THRESHOLD;
    const updateMode = usePerStudent ? "per-student" : "bulk";
    stateMachine.updateContext({ updateMode });
    if (usePerStudent) {
      const message = `Detected ${numberOfUpdates} changes - updating scores one at a time for quicker processing.`;
      banner.hold(message, 3e3);
      logger.debug("Per student update...");
      await postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, banner, false);
      logger.debug(`handleUpdatingGrades complete, transitioning to VERIFYING`);
      return STATES.VERIFYING;
    } else {
      const message = `Detected ${numberOfUpdates} changes - using bulk update for error prevention`;
      banner.hold(message, 3e3);
      logger.debug(`Bulk update, detected ${numberOfUpdates} changes`);
      const progressId = await beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages);
      stateMachine.updateContext({ progressId });
      logger.debug(`progressId: ${progressId}`);
      logger.debug(`handleUpdatingGrades complete, transitioning to POLLING_PROGRESS`);
      return STATES.POLLING_PROGRESS;
    }
  }
  async function handlePollingProgress(stateMachine) {
    const { banner } = stateMachine.getContext();
    logger.debug("Starting bulk update polling...");
    await waitForBulkGrading(banner);
    logger.debug(`handlePollingProgress complete, transitioning to VERIFYING`);
    return STATES.VERIFYING;
  }
  async function handleVerifying(stateMachine) {
    const { courseId, averages, outcomeId, banner } = stateMachine.getContext();
    logger.debug("Starting verification...");
    await verifyUIScores(courseId, averages, outcomeId, banner);
    logger.debug(`handleVerifying complete, transitioning to COMPLETE`);
    return STATES.COMPLETE;
  }
  async function handleComplete(stateMachine) {
    const { numberOfUpdates, banner, courseId, zeroUpdates } = stateMachine.getContext();
    const elapsedTime = getElapsedTimeSinceStart();
    stopElapsedTimer(banner);
    if (zeroUpdates || numberOfUpdates === 0) {
      banner.setText(`No changes to ${AVG_OUTCOME_NAME} found.`);
      alert(`No changes to ${AVG_OUTCOME_NAME} have been found. No updates performed.`);
      setTimeout(() => {
        banner.remove();
      }, 2e3);
      return STATES.IDLE;
    }
    banner.setText(`${numberOfUpdates} student scores updated successfully! (elapsed time: ${elapsedTime}s)`);
    localStorage.setItem(`duration_${courseId}`, elapsedTime);
    localStorage.setItem(`lastUpdateAt_${courseId}`, (/* @__PURE__ */ new Date()).toISOString());
    alert(`All "${AVG_OUTCOME_NAME}" scores have been updated. (elapsed time: ${elapsedTime}s)
You may need to refresh the page to see the new scores.`);
    return STATES.IDLE;
  }
  async function handleError2(stateMachine) {
    const { error, banner } = stateMachine.getContext();
    logger.error("Update flow error:", error);
    if (banner) {
      banner.setText(`Error: ${error.message}`);
      setTimeout(() => banner.remove(), 3e3);
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
    [STATES.COMPLETE]: handleComplete,
    [STATES.ERROR]: handleError2
  };

  // src/gradebook/updateFlowOrchestrator.js
  init_banner();

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
    const history = stateMachine.getStateHistory();
    const currentState = stateMachine.getCurrentState();
    debugPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #ffff00;">
            \u{1F527} STATE MACHINE DEBUG
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Current State:</strong> <span style="color: #00ffff;">${currentState}</span>
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Transitions:</strong> ${history.length - 1}
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Update Mode:</strong> ${context.updateMode || "N/A"}
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Updates:</strong> ${context.numberOfUpdates || 0}
        </div>
        <div style="margin-bottom: 8px; font-size: 10px; color: #888;">
            Last 3: ${history.slice(-3).join(" \u2192 ")}
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
  init_canvas();

  // src/utils/stateManagement.js
  init_canvas();
  init_banner();
  init_gradeSubmission();
  init_verification();
  init_uiHelpers();
  init_errorHandler();
  init_logger();
  function cleanUpLocalStorage() {
    let courseId = getCourseId();
    localStorage.removeItem(`verificationPending_${courseId}`);
    localStorage.removeItem(`expectedAverages_${courseId}`);
    localStorage.removeItem(`uploadFinishTime_${courseId}`);
    localStorage.removeItem(`updateInProgress_${courseId}`);
    localStorage.removeItem(`startTime_${courseId}`);
  }

  // src/gradebook/updateFlowOrchestrator.js
  init_uiHelpers();
  init_config();
  init_logger();
  async function startUpdateFlow(button = null) {
    const courseId = getCourseId();
    if (!courseId) throw new ValidationError("Course ID not found", "courseId");
    const stateMachine = new UpdateFlowStateMachine();
    const restored = stateMachine.loadFromLocalStorage(courseId);
    if (restored) {
      logger.info("Resuming update flow from saved state:", stateMachine.getCurrentState());
    }
    const banner = showFloatingBanner({
      text: `Preparing to update "${AVG_OUTCOME_NAME}": checking setup...`
    });
    stateMachine.updateContext({ courseId, banner, button });
    alert("You may minimize this browser or switch to another tab, but please keep this tab open until the process is fully complete.");
    try {
      if (!restored) {
        stateMachine.transition(STATES.CHECKING_SETUP);
      }
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
        stateMachine.saveToLocalStorage(courseId);
        logger.debug(`State saved to localStorage: ${stateMachine.getCurrentState()}`);
        updateDebugUI(stateMachine);
      }
      const toolbar = document.querySelector('.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]');
      if (toolbar) renderLastUpdateNotice(toolbar, courseId);
      resetButtonToNormal(button);
      removeDebugUI();
    } catch (error) {
      stateMachine.updateContext({ error });
      stateMachine.transition(STATES.ERROR);
      stateMachine.saveToLocalStorage(courseId);
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
      cleanUpLocalStorage();
      resetButtonToNormal(button);
      removeDebugUI();
    } finally {
      stateMachine.clearLocalStorage(courseId);
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
      const buttonContainer = createButtonColumnContainer();
      buttonContainer.appendChild(buttonWrapper);
      toolbar.appendChild(buttonContainer);
      checkForResumableState(courseId, updateAveragesButton);
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
  function checkForResumableState(courseId, button) {
    const stateMachine = new UpdateFlowStateMachine();
    const restored = stateMachine.loadFromLocalStorage(courseId);
    if (restored) {
      const currentState = stateMachine.getCurrentState();
      const stateTimestamp = stateMachine.getContext().timestamp || (/* @__PURE__ */ new Date()).toISOString();
      const minutesAgo = Math.round((Date.now() - new Date(stateTimestamp).getTime()) / 6e4);
      button.textContent = `Resume Update`;
      button.style.backgroundColor = "#ff9800";
      button.title = `Resume from ${currentState} (${minutesAgo} min ago)`;
      const banner = showFloatingBanner({
        text: `Previous update interrupted at ${currentState} (${minutesAgo} min ago). Click "Resume Update" to continue.`
      });
      setTimeout(() => {
        banner.remove();
      }, 1e4);
      logger.info(`Resumable state found: ${currentState} from ${minutesAgo} minutes ago`);
    }
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

  // src/main.js
  (function init() {
    logBanner("dev", "2025-12-16 2:03:38 PM (dev, 662803c)");
    exposeVersion("dev", "2025-12-16 2:03:38 PM (dev, 662803c)");
    if (true) {
      log("Running in DEV mode");
    }
    if (false) {
      log("Running in PROD mode");
    }
    log(`Build environment: ${"dev"}`);
    if (window.location.pathname.includes("/gradebook")) {
      injectButtons();
    }
  })();
})();
//# sourceMappingURL=main.js.map
