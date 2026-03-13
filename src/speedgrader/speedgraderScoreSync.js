// src/speedgrader/speedgraderScoreSync.js
// noinspection SpellCheckingInspection

/**
 * SpeedGrader Score Sync Module
 *
 * Automatically syncs assignment scores from rubric assessments
 * in standards-based courses. Runs on SpeedGrader pages (teacher-only by Canvas).
 *
 * Features:
 * - Detects rubric submission via GraphQL fetch hook
 * - Calculates score using MIN/AVG/MAX methods
 * - Writes score via Canvas API
 * - Updates grade input UI immediately
 * - Per-course defaults + per-assignment overrides
 * - Loop prevention via fingerprinting
 */

import { logger } from '../utils/logger.js';
import { getCourseSnapshot, populateCourseSnapshot } from '../services/courseSnapshotService.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import {
    initDockedPanel,
    updatePanelScore,
    addSyncControlsSection,
    addScoreDisplaySection,
    addPanelSettingsSection
} from './scoreSyncDockedPanel.js';

// Timing constants
const TIMING_CONSTANTS = {
    GRADE_INPUT_UPDATE_DELAYS: [0, 700, 1500],
    RUBRIC_FETCH_DELAYS: [200, 250, 350],
    NAVIGATION_RECHECK_DELAY: 250,
    URL_PARSE_RETRY_DELAY: 500,
    URL_PARSE_MAX_ATTEMPTS: 3,
    SUBMIT_GRADE_TIMEOUT: 10000,
    SUBMIT_GRADE_MAX_RETRIES: 2
};

// Module state
let initialized = false;
let inFlight = false;
const lastFingerprintByContext = new Map();
let apiClient = null;

// Metrics
const metrics = {
    attempts: 0,
    successes: 0,
    failures: 0,
    skipped: 0
};

// Cache native input value setter
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
).set;

/**
 * Parse SpeedGrader URL to extract IDs
 *
 * @returns {Object} { courseId, assignmentId, studentId }
 */
function parseSpeedGraderUrl() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    const courseIdMatch = path.match(/\/courses\/(\d+)\//);
    const courseId = courseIdMatch ? courseIdMatch[1] : null;

    // Extract and sanitize IDs - ensure only numeric values
    const assignmentIdRaw = params.get('assignment_id');
    const studentIdRaw = params.get('student_id');

    const assignmentId = assignmentIdRaw ? assignmentIdRaw.match(/^\d+/)?.[0] || null : null;
    const studentId = studentIdRaw ? studentIdRaw.match(/^\d+/)?.[0] || null : null;

    return { courseId, assignmentId, studentId };
}

/**
 * Parse SpeedGrader URL with retry logic (Suggestion #20)
 * @param {number} maxAttempts - Maximum number of parse attempts
 * @param {number} delayMs - Delay between attempts
 * @returns {Promise<Object>} { courseId, assignmentId, studentId }
 */
async function parseSpeedGraderUrlWithRetry(maxAttempts = TIMING_CONSTANTS.URL_PARSE_MAX_ATTEMPTS, delayMs = TIMING_CONSTANTS.URL_PARSE_RETRY_DELAY) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const parsed = parseSpeedGraderUrl();

        logger.trace(`[ScoreSync] Parse attempt ${attempt}/${maxAttempts} - courseId: ${parsed.courseId}, assignmentId: ${parsed.assignmentId}, studentId: ${parsed.studentId}`);

        if (parsed.courseId && parsed.assignmentId && parsed.studentId) {
            return parsed;
        }

        if (attempt < maxAttempts) {
            logger.trace(`[ScoreSync] Missing IDs, waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return { courseId: null, assignmentId: null, studentId: null };
}

/**
 * Get storage from localStorage (Suggestion #15 - removed async)
 */
function getStorage(key) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
}

/**
 * Set storage in localStorage (Suggestion #15 - removed async)
 */
function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Generate storage keys for settings (Suggestion #2)
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Canvas assignment ID
 * @returns {Object} { assignment, course }
 */
function getStorageKeys(courseId, assignmentId) {
    const host = window.location.hostname;
    return {
        assignment: `cg_speedgrader_scoresync_settings::${host}::course::${courseId}::assignment::${assignmentId}`,
        course: `cg_speedgrader_scoresync_default::${host}::course::${courseId}`
    };
}

/**
 * Generate context key for fingerprint tracking (Suggestion #9)
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Canvas assignment ID
 * @param {string} studentId - Canvas student ID
 * @returns {string} Context key
 */
function getContextKey(courseId, assignmentId, studentId) {
    return `${courseId}:${assignmentId}:${studentId}`;
}

/**
 * Validate settings object (Suggestion #8)
 * @param {Object} settings - Settings to validate
 * @returns {Object} Validated settings
 */
function validateSettings(settings) {
    const defaults = { enabled: true, method: 'min' };

    if (!settings || typeof settings !== 'object') return defaults;

    return {
        enabled: typeof settings.enabled === 'boolean' ? settings.enabled : defaults.enabled,
        method: ['min', 'avg', 'max', 'sum'].includes(settings.method) ? settings.method : defaults.method
    };
}

/**
 * Get settings for current assignment (Suggestion #2, #8 - uses helpers and validation)
 */
function getSettings(courseId, assignmentId) {
    const keys = getStorageKeys(courseId, assignmentId);

    const assignmentSettings = getStorage(keys.assignment);
    if (assignmentSettings) return validateSettings(assignmentSettings);

    const courseSettings = getStorage(keys.course);
    if (courseSettings) return validateSettings(courseSettings);

    return { enabled: true, method: 'min' };
}

/**
 * Save settings (both assignment override and course default) (Suggestion #2 - uses helper)
 */
function saveSettings(courseId, assignmentId, settings) {
    const keys = getStorageKeys(courseId, assignmentId);

    setStorage(keys.assignment, settings);
    setStorage(keys.course, settings);
}

/**
 * Calculate grade from rubric assessment
 */
function calculateGrade(rubricAssessment, method) {
    const points = Object.values(rubricAssessment)
        .map(criterion => criterion.points)
        .filter(p => typeof p === 'number' && !isNaN(p));

    if (points.length === 0) return 0;

    if (method === 'min') return Math.min(...points);
    if (method === 'max') return Math.max(...points);
    if (method === 'avg') return points.reduce((a, b) => a + b, 0) / points.length;
    if (method === 'sum') return points.reduce((a, b) => a + b, 0);

    return Math.min(...points);
}

/**
 * Create rubric fingerprint for loop prevention
 */
function createRubricFingerprint(rubricAssessment) {
    return Object.entries(rubricAssessment || {})
        .map(([id, data]) => {
            const n = Number(data?.points);
            if (!Number.isFinite(n)) return null;
            return `${id}:${n.toFixed(2)}`;
        })
        .filter(Boolean)
        .sort()
        .join('|');
}



/**
 * Find best grade input element
 * Supports both Enhanced SpeedGrader and Classic SpeedGrader
 * @returns {HTMLInputElement|null} Best input element or null
 */
function findBestGradeInput() {
    // Try Enhanced SpeedGrader first (React-based)
    let allInputs = Array.from(document.querySelectorAll('input[data-testid="grade-input"]'));

    // Fallback to Classic SpeedGrader
    if (allInputs.length === 0) {
        const classicInput = document.querySelector('#grading-box-extended');
        if (classicInput) {
            logger.trace('[ScoreSync] Using Classic SpeedGrader input: #grading-box-extended');
            return classicInput;
        }
        logger.trace('[ScoreSync] No grade input found (Enhanced or Classic)');
        return null;
    }

    // Enhanced SpeedGrader: Filter to visible, enabled inputs
    const visibleInputs = allInputs.filter(el => el.offsetParent !== null && !el.disabled);
    if (visibleInputs.length === 0) return null;

    // Prefer inputs inside grading panel
    const panelInputs = visibleInputs.filter(el =>
        el.closest('[data-testid="speedgrader-grading-panel"]') !== null
    );

    const candidates = panelInputs.length > 0 ? panelInputs : visibleInputs;

    // Return focused input if available
    const focused = candidates.find(el => el === document.activeElement);
    if (focused) return focused;

    // Return largest input
    return candidates.reduce((best, el) => {
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        const bestRect = best.getBoundingClientRect();
        const bestArea = bestRect.width * bestRect.height;
        return area > bestArea ? el : best;
    }, candidates[0]);
}

/**
 * Update grade input UI (React-controlled) (Suggestion #6, #11, #16 - extracted logic, uses cached setter, added JSDoc)
 * @param {number|string} score - The score to display
 * @returns {void}
 */
function updateGradeInput(score) {
    const applyValue = () => {
        // Re-query input each time (may be replaced on navigation)
        const input = findBestGradeInput();

        if (!input) {
            logger.trace('[ScoreSync] Grade input not found for update');
            return;
        }

        // Set input value using cached setter
        input.focus();
        nativeInputValueSetter.call(input, String(score));
        input.setAttribute('value', String(score));

        // Dispatch events
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        input.dispatchEvent(new Event('focusout', { bubbles: true }));

        // Read back and log
        const readBack = input.value;
        logger.trace(`[ScoreSync] Applied value=${score}, read back value="${readBack}"`);
    };

    // Apply with delays using constants (Suggestion #1)
    TIMING_CONSTANTS.GRADE_INPUT_UPDATE_DELAYS.forEach(delay => {
        setTimeout(applyValue, delay);
    });

    logger.trace(`[ScoreSync] Grade input update scheduled for score: ${score}`);
}

/**
 * Submit grade to Canvas API (Suggestion #12, #16 - added retry logic and JSDoc)
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Canvas assignment ID
 * @param {string} studentId - Canvas student ID
 * @param {number|string} score - Score to submit
 * @param {CanvasApiClient} apiClient - API client instance
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object|null>} Submission data or null on failure
 */
async function submitGrade(courseId, assignmentId, studentId, score, apiClient, retries = TIMING_CONSTANTS.SUBMIT_GRADE_MAX_RETRIES) {
    logger.trace(`[ScoreSync] submitGrade called with score=${score}, retries=${retries}`);

    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            logger.trace(`[ScoreSync] PUT ${url} (attempt ${attempt + 1}/${retries + 1})`);

            const data = await apiClient.put(
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
            const enteredScore = data?.entered_score ?? score;
            logger.info(`[ScoreSync] ✅ Grade submitted successfully: ${enteredScore}`);
            return data;
        } catch (error) {
            logger.error(`[ScoreSync] Submit attempt ${attempt + 1}/${retries + 1} failed:`, error);
            if (attempt < retries) {
                const backoffMs = 1000 * (attempt + 1);
                logger.trace(`[ScoreSync] Retrying in ${backoffMs}ms...`);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }

    logger.error('[ScoreSync] All submit attempts failed');
    return null;
}

/**
 * Fetch submission with rubric assessment
 */
async function fetchSubmission(courseId, assignmentId, studentId) {
    // Build URL with proper query parameters
    const params = new URLSearchParams();
    params.append('include[]', 'rubric_assessment');
    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?${params.toString()}`;

    logger.trace(`[ScoreSync] GET ${url}`);

    try {
        const response = await fetch(url, {
            credentials: 'same-origin'
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
        logger.error('[ScoreSync] Exception in fetchSubmission:', error);
        return null;
    }
}

/**
 * Handle rubric submission - internal implementation (Suggestion #10, #16 - added JSDoc)
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Canvas assignment ID
 * @param {string} studentId - Canvas student ID
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<void>}
 */
async function handleRubricSubmitInternal(courseId, assignmentId, studentId, apiClient) {
    logger.info('[ScoreSync] ========== RUBRIC SUBMIT HANDLER CALLED ==========');
    logger.trace(`[ScoreSync] Parameters: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`);

    if (inFlight) {
        logger.warn('[ScoreSync] Already processing another submission, skipping');
        metrics.skipped++;
        return;
    }

    inFlight = true;
    metrics.attempts++;
    logger.trace('[ScoreSync] Set inFlight=true');

    try {
        logger.trace('[ScoreSync] Fetching settings...');
        const settings = getSettings(courseId, assignmentId);
        logger.trace(`[ScoreSync] Settings: enabled=${settings.enabled}, method=${settings.method}`);

        if (!settings.enabled) {
            logger.info('[ScoreSync] SKIPPED - Score sync disabled for this assignment');
            metrics.skipped++;
            inFlight = false;
            return;
        }

        logger.trace('[ScoreSync] Waiting briefly for GraphQL commit, then polling rubric assessment...');

        // Use timing constants (Suggestion #1)
        let submission = null;

        for (let i = 0; i < TIMING_CONSTANTS.RUBRIC_FETCH_DELAYS.length; i++) {
            await new Promise(r => setTimeout(r, TIMING_CONSTANTS.RUBRIC_FETCH_DELAYS[i]));
            submission = await fetchSubmission(courseId, assignmentId, studentId);

            const ra = submission?.rubric_assessment;
            if (ra && Object.keys(ra).length > 0) break;
        }

        logger.trace('[ScoreSync] Fetching submission with rubric assessment complete');


        if (!submission) {
            logger.error('[ScoreSync] FAILED - fetchSubmission returned null');
            metrics.failures++;
            inFlight = false;
            return;
        }

        logger.trace(`[ScoreSync] Submission fetched: id=${submission.id}, workflow_state=${submission.workflow_state}`);
        logger.trace(`[ScoreSync] Rubric assessment present: ${!!submission.rubric_assessment}`);

        if (!submission.rubric_assessment) {
            logger.warn('[ScoreSync] FAILED - No rubric assessment found in submission');
            metrics.failures++;
            inFlight = false;
            return;
        }

        const rubricPoints = Object.values(submission.rubric_assessment).map(c => c.points);
        logger.trace(`[ScoreSync] Rubric points: [${rubricPoints.join(', ')}]`);

        // Use context key helper (Suggestion #9)
        const contextKey = getContextKey(courseId, assignmentId, studentId);
        const fingerprint = createRubricFingerprint(submission.rubric_assessment);
        const lastFingerprint = lastFingerprintByContext.get(contextKey);

        logger.trace(`[ScoreSync] Context: ${contextKey}`);
        logger.trace(`[ScoreSync] Current rubric fingerprint: ${fingerprint}`);
        logger.trace(`[ScoreSync] Last fingerprint for context: ${lastFingerprint || 'none'}`);

        if (fingerprint === lastFingerprint) {
            logger.info('[ScoreSync] SKIPPED - Rubric unchanged (fingerprint match - prevents duplicate submission)');
            logger.trace('[ScoreSync] This is likely a navigation event or Canvas fetching existing rubric data');
            metrics.skipped++;
            inFlight = false;
            return;
        }

        logger.trace('[ScoreSync] Fingerprint differs from last - this is a NEW or CHANGED rubric assessment');
        lastFingerprintByContext.set(contextKey, fingerprint);
        logger.trace('[ScoreSync] Fingerprint updated for context');

        const score = calculateGrade(submission.rubric_assessment, settings.method);
        logger.info(`[ScoreSync] Calculated score: ${score} (method: ${settings.method})`);

        logger.trace('[ScoreSync] Submitting grade to Canvas API...');
        const result = await submitGrade(courseId, assignmentId, studentId, score, apiClient);

        if (!result) {
            logger.error('[ScoreSync] FAILED - submitGrade returned null');
            metrics.failures++;
            return;
        }

        logger.trace(`[ScoreSync] Grade submission result: entered_score=${result.entered_score}, score=${result.score}, workflow_state=${result.workflow_state}`);

        const finalScore = result?.entered_score ?? score;
        logger.trace(`[ScoreSync] Updating UI with final score: ${finalScore}`);
        updateGradeInput(finalScore);
        updateAssignmentScoreDisplay(finalScore);

        metrics.successes++;
        logger.info('[ScoreSync] ✅ SCORE SYNC COMPLETE');
    } catch (error) {
        logger.error('[ScoreSync] ERROR in handleRubricSubmitInternal:', error);
        metrics.failures++;
    } finally {
        inFlight = false;
        logger.trace('[ScoreSync] Set inFlight=false');
    }
}

/**
 * Handle rubric submission with timeout (Suggestion #10)
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Canvas assignment ID
 * @param {string} studentId - Canvas student ID
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<void>}
 */
async function handleRubricSubmit(courseId, assignmentId, studentId, apiClient) {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Rubric submit handler timeout')), TIMING_CONSTANTS.SUBMIT_GRADE_TIMEOUT)
    );

    try {
        await Promise.race([
            handleRubricSubmitInternal(courseId, assignmentId, studentId, apiClient),
            timeoutPromise
        ]);
    } catch (error) {
        logger.error('[ScoreSync] Timeout or error in handleRubricSubmit:', error);
        metrics.failures++;
        inFlight = false;
    }
}

/**
 * Detect if a fetch request is a rubric submission
 * Supports both Enhanced SpeedGrader (GraphQL) and Classic SpeedGrader (REST API)
 *
 * @param {string} url - Request URL
 * @param {string} method - HTTP method
 * @param {string} bodyText - Request body text
 * @returns {Object} { isRubric: boolean, type: 'graphql'|'rest'|null }
 */
function isRubricSubmission(url, method, bodyText) {
    if (method !== 'POST') return { isRubric: false, type: null };

    // Enhanced SpeedGrader: GraphQL API
    if (url.includes('/api/graphql')) {
        // Match SaveRubricAssessment mutation patterns
        // Canvas uses operation names like "SpeedGrader_SaveRubricAssessment"
        // This matches mutations but excludes queries like "SpeedGrader_RubricAssessmentsQuery"
        const isSaveMutation =
            /"operationName"\s*:\s*"[^"]*SaveRubricAssessment[^"]*"/i.test(bodyText) ||
            /mutation\s+\w*SaveRubricAssessment/i.test(bodyText);

        if (isSaveMutation) {
            return { isRubric: true, type: 'graphql' };
        }
    }

    // Classic SpeedGrader: REST API
    // Pattern: /courses/{courseId}/rubric_associations/{rubricAssociationId}/assessments
    const restApiPattern = /\/courses\/\d+\/rubric_associations\/\d+\/assessments/;
    if (restApiPattern.test(url)) {
        logger.trace('[ScoreSync] Matched Classic SpeedGrader REST API pattern');
        return { isRubric: true, type: 'rest' };
    }

    return { isRubric: false, type: null };
}

/**
 * Extract request body text (Suggestion #17)
 * @param {Request|string} input - Fetch input
 * @param {Object} init - Fetch init options
 * @returns {Promise<string>} Body text
 */
async function extractRequestBody(input, init) {
    if (typeof init?.body === 'string') {
        return init.body;
    }

    if (input instanceof Request) {
        try {
            return await input.clone().text();
        } catch (error) {
            logger.trace(`[ScoreSync] Could not read Request body: ${error.message}`);
        }
    }

    return '';
}

/**
 * Hook window.fetch to detect rubric submissions (Enhanced SpeedGrader - GraphQL)
 */
function hookFetch() {
    logger.trace('[ScoreSync] Installing fetch hook...');

    if (window.__CG_SCORESYNC_FETCH_HOOKED__) {
        logger.warn('[ScoreSync] Fetch hook already installed');
        return;
    }
    window.__CG_SCORESYNC_FETCH_HOOKED__ = true;

    const originalFetch = window.fetch;
    let fetchCallCount = 0;

    window.fetch = async function(...args) {
        const callId = ++fetchCallCount;
        const input = args[0];
        const init = args[1];

        // Detect whether input is a Request object
        const isRequest = input instanceof Request;

        // Extract URL safely
        const url = isRequest ? input.url : String(input);

        // Extract HTTP method
        const method = (isRequest ? input.method : init?.method || 'GET').toUpperCase();

        // Call original fetch FIRST
        const res = await originalFetch(...args);

        // Ignore our own submission API calls to prevent loops
        if (url.includes('/api/v1/') && url.includes('/submissions/')) {
            return res;
        }

        // Detect rubric submissions (both GraphQL and REST API)
        if (res.ok && method === 'POST') {
            const bodyText = await extractRequestBody(input, init);
            const detection = isRubricSubmission(url, method, bodyText);

            if (detection.isRubric) {
                const apiType = detection.type === 'graphql' ? 'GraphQL (Enhanced)' : 'REST API (Fetch)';
                logger.info(`[ScoreSync] ✅ RUBRIC SUBMISSION DETECTED - ${apiType}`);

                // Log GraphQL operation name if available
                if (detection.type === 'graphql') {
                    const operationMatch = bodyText.match(/"operationName"\s*:\s*"([^"]+)"/);
                    const operationName = operationMatch ? operationMatch[1] : 'unknown';
                    logger.trace(`[ScoreSync] Call #${callId}: GraphQL Operation: ${operationName}`);
                } else {
                    logger.trace(`[ScoreSync] Call #${callId}: REST API endpoint: ${url}`);
                }

                // Re-parse URL to get current context (handles navigation)
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

    logger.info('[ScoreSync] ✅ Fetch hook installed successfully');
}

/**
 * Hook XMLHttpRequest to detect rubric submissions (Classic SpeedGrader - XHR/jQuery)
 */
function hookXMLHttpRequest() {
    logger.trace('[ScoreSync] Installing XHR hook...');

    if (window.__CG_SCORESYNC_XHR_HOOKED__) {
        logger.warn('[ScoreSync] XHR hook already installed');
        return;
    }
    window.__CG_SCORESYNC_XHR_HOOKED__ = true;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    let xhrCallCount = 0;

    // Hook open() to capture method and URL
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._cg_method = method;
        this._cg_url = url;
        return originalOpen.call(this, method, url, ...args);
    };

    // Hook send() to detect rubric submissions
    XMLHttpRequest.prototype.send = function(body) {
        const callId = ++xhrCallCount;
        const method = this._cg_method;
        const url = this._cg_url;
        const xhr = this;

        // Ignore our own submission API calls to prevent loops
        if (url && url.includes('/api/v1/') && url.includes('/submissions/')) {
            return originalSend.call(this, body);
        }

        // Detect rubric submissions
        if (method === 'POST' && url) {
            const detection = isRubricSubmission(url, method, body || '');

            if (detection.isRubric) {
                // Add load event listener to wait for successful response
                const originalOnload = xhr.onload;
                xhr.addEventListener('load', function() {
                    // Check if response was successful
                    if (xhr.status >= 200 && xhr.status < 300) {
                        logger.info(`[ScoreSync] ✅ RUBRIC SUBMISSION DETECTED - XHR (Classic)`);
                        logger.trace(`[ScoreSync] XHR Call #${callId}: ${method} ${url}`);

                        // Re-parse URL to get current context (handles navigation)
                        const parsed = parseSpeedGraderUrl();
                        logger.trace(`[ScoreSync] XHR Call #${callId}: Parsed IDs - courseId: ${parsed.courseId}, assignmentId: ${parsed.assignmentId}, studentId: ${parsed.studentId}`);

                        if (parsed.courseId && parsed.assignmentId && parsed.studentId) {
                            logger.trace(`[ScoreSync] XHR Call #${callId}: Triggering handleRubricSubmit...`);
                            void handleRubricSubmit(parsed.courseId, parsed.assignmentId, parsed.studentId, apiClient);
                        } else {
                            logger.warn(`[ScoreSync] XHR Call #${callId}: Missing IDs, cannot handle rubric submit`);
                        }
                    }
                });
            }
        }

        return originalSend.call(this, body);
    };

    logger.info('[ScoreSync] ✅ XHR hook installed successfully');
}

/**
 * Update assignment score display in docked panel
 */
function updateAssignmentScoreDisplay(score) {
    updatePanelScore(score);
}

/**
 * Create UI controls using docked panel
 */
function createUIControls(courseId, assignmentId) {
    try {
        logger.trace('[ScoreSync] createUIControls called');

        // Check if already initialized
        if (document.getElementById('cg-scoresync-root')) {
            logger.trace('[ScoreSync] Docked panel already exists');
            return true;
        }

        logger.trace('[ScoreSync] Creating docked panel UI');
        const settings = getSettings(courseId, assignmentId);
        logger.trace(`[ScoreSync] Settings loaded: enabled=${settings.enabled}, method=${settings.method}`);

        // Initialize docked panel
        const success = initDockedPanel();
        if (!success) {
            logger.error('[ScoreSync] Failed to initialize docked panel');
            return false;
        }

        // Add sync controls section
        addSyncControlsSection(
            settings,
            (enabled) => {
                settings.enabled = enabled;
                saveSettings(courseId, assignmentId, settings);
                logger.info(`[ScoreSync] Score sync ${enabled ? 'enabled' : 'disabled'}`);
            },
            (method) => {
                settings.method = method;
                saveSettings(courseId, assignmentId, settings);
                logger.info(`[ScoreSync] Method changed to: ${method}`);
            }
        );

        // Add score display section
        addScoreDisplaySection();

        // Add panel settings section
        addPanelSettingsSection();

        logger.info('[ScoreSync] ✅ Docked panel UI created');
        return true;
    } catch (error) {
        logger.error('[ScoreSync] Failed to create UI controls:', error);
        return false;
    }
}

// Removed: ensureScoreSyncUiPresent() - no longer needed with docked panel
// Removed: scheduleUiRecheck() - no longer needed with docked panel
// Removed: startTemporaryUiKeepalive() - no longer needed with docked panel

/**
 * Hook History API to detect SpeedGrader navigation
 * Note: Docked panel persists across navigation, no UI re-injection needed
 */
function hookHistoryApi() {
    if (window.__CG_SCORESYNC_HISTORY_HOOKED__) return;
    window.__CG_SCORESYNC_HISTORY_HOOKED__ = true;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        logger.trace('[ScoreSync] Navigation detected (pushState)');
    };

    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        logger.trace('[ScoreSync] Navigation detected (replaceState)');
    };

    window.addEventListener('popstate', () => {
        logger.trace('[ScoreSync] Navigation detected (popstate)');
    });

    logger.trace('[ScoreSync] History API hooks installed');
}

/**
 * Cleanup function
 */
export function cleanup() {
    // Reset hooks
    window.__CG_SCORESYNC_FETCH_HOOKED__ = false;
    window.__CG_SCORESYNC_XHR_HOOKED__ = false;
    window.__CG_SCORESYNC_HISTORY_HOOKED__ = false;

    // Reset state
    initialized = false;
    inFlight = false;
    lastFingerprintByContext.clear();
    apiClient = null;

    logger.trace('[ScoreSync] Cleanup complete');
}

/**
 * Get metrics (Suggestion #19)
 * @returns {Object} Metrics object
 */
export function getMetrics() {
    return { ...metrics };
}

/**
 * Initialize score sync module (Suggestion #18, #20 - uses feature flag and URL retry helper)
 */
export async function initSpeedGraderAutoGrade() {
    logger.info('[ScoreSync] ========== INITIALIZATION STARTED ==========');

    if (initialized) {
        logger.warn('[ScoreSync] Already initialized, skipping');
        return;
    }
    initialized = true;

    logger.trace('[ScoreSync] Initializing SpeedGrader score sync module');
    // Note: No role check needed - SpeedGrader is already restricted to teachers by Canvas

    // Use URL parsing with retry helper (Suggestion #20)
    const { courseId, assignmentId, studentId } = await parseSpeedGraderUrlWithRetry();

    if (!courseId || !assignmentId || !studentId) {
        logger.error('[ScoreSync] FAILED - Missing required IDs after retries:', { courseId, assignmentId, studentId });
        logger.error('[ScoreSync] Full URL:', window.location.href);
        logger.error('[ScoreSync] Query params:', window.location.search);
        initialized = false; // Allow retry on next navigation
        return;
    }

    logger.trace('[ScoreSync] Creating CanvasApiClient...');
    apiClient = new CanvasApiClient();
    logger.trace('[ScoreSync] CanvasApiClient created successfully');

    let snapshot = getCourseSnapshot(courseId);
    logger.trace(`[ScoreSync] Course snapshot from cache: ${snapshot ? 'FOUND' : 'NOT FOUND'}`);

    if (!snapshot) {
        logger.trace('[ScoreSync] Populating course snapshot...');
        const courseName = document.title.split(':')[0]?.trim() || 'Unknown Course';
        logger.trace(`[ScoreSync] Course name from title: "${courseName}"`);
        snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
        logger.trace(`[ScoreSync] Snapshot population result: ${snapshot ? 'SUCCESS' : 'FAILED'}`);
    }

    if (!snapshot) {
        logger.error('[ScoreSync] FAILED - Could not get course snapshot');
        return;
    }

    logger.info(`[ScoreSync] Course model: ${snapshot.model} (reason: ${snapshot.modelReason})`);

    if (snapshot.model !== 'standards') {
        logger.info(`[ScoreSync] SKIPPED - course is ${snapshot.model}, not standards-based`);
        return;
    }

    logger.info('[ScoreSync] ✅ Course is standards-based, proceeding with initialization');

    logger.trace('[ScoreSync] Installing fetch hook (Enhanced SpeedGrader)...');
    hookFetch();

    logger.trace('[ScoreSync] Installing XHR hook (Classic SpeedGrader)...');
    hookXMLHttpRequest();

    logger.trace('[ScoreSync] Installing history API hooks...');
    hookHistoryApi();

    // Create docked panel UI
    logger.trace('[ScoreSync] Creating docked panel UI...');
    createUIControls(courseId, assignmentId);

    logger.info('[ScoreSync] ========== INITIALIZATION COMPLETE ==========');
}