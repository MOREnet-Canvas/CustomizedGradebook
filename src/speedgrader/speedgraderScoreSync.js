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

// Timing constants
const TIMING_CONSTANTS = {
    GRADE_INPUT_UPDATE_DELAYS: [0, 700, 1500],
    RUBRIC_FETCH_DELAYS: [200, 250, 350],
    UI_KEEPALIVE_INTERVAL: 600,
    UI_KEEPALIVE_DURATION: 12000,
    NAVIGATION_RECHECK_DELAY: 250,
    URL_PARSE_RETRY_DELAY: 500,
    URL_PARSE_MAX_ATTEMPTS: 3,
    SUBMIT_GRADE_TIMEOUT: 10000,
    SUBMIT_GRADE_MAX_RETRIES: 2
};

// UI color constants
const UI_COLORS = {
    CONTAINER_BG: 'rgb(245, 245, 245)',
    CONTAINER_BORDER: 'rgb(245, 245, 245)',
    LABEL_BG: 'rgb(245, 245, 245)',
    SCORE_BG: 'rgb(0, 142, 83)'
};

// Feature flags
const FEATURE_FLAGS = {
    UI_KEEPALIVE_ENABLED: true
};

// Module state
let initialized = false;
let inFlight = false;
const lastFingerprintByContext = new Map();
let apiClient = null;
let uiKeepaliveInterval = null;

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
 * Find best grade input element (Suggestion #6)
 * @returns {HTMLInputElement|null} Best input element or null
 */
function findBestGradeInput() {
    const allInputs = Array.from(document.querySelectorAll('input[data-testid="grade-input"]'));
    if (allInputs.length === 0) return null;

    // Filter to visible, enabled inputs
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
 * Check if request is a rubric submission mutation (only matches mutations, not queries)
 * @param {string} url - Request URL
 * @param {string} method - HTTP method
 * @param {string} bodyText - Request body text
 * @returns {boolean} True if rubric submission mutation
 */
function isRubricSubmission(url, method, bodyText) {
    if (!url.includes('/api/graphql')) return false;
    if (method !== 'POST') return false;

    // Match SaveRubricAssessment mutation patterns
    // Canvas uses operation names like "SpeedGrader_SaveRubricAssessment"
    // This matches mutations but excludes queries like "SpeedGrader_RubricAssessmentsQuery"
    const isSaveMutation =
        /"operationName"\s*:\s*"[^"]*SaveRubricAssessment[^"]*"/i.test(bodyText) ||
        /mutation\s+\w*SaveRubricAssessment/i.test(bodyText);

    return isSaveMutation;
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
 * Hook window.fetch to detect rubric submissions (Suggestion #17 - extracted detection logic)
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

        // Detect GraphQL rubric submissions
        if (res.ok && url.includes('/api/graphql') && method === 'POST') {
            const bodyText = await extractRequestBody(input, init);

            // Log GraphQL operations at trace level
            const operationMatch = bodyText.match(/"operationName"\s*:\s*"([^"]+)"/);
            const operationName = operationMatch ? operationMatch[1] : 'unknown';
            logger.trace(`[ScoreSync] GraphQL operation: ${operationName}`);

            if (isRubricSubmission(url, method, bodyText)) {
                logger.info(`[ScoreSync] ✅ RUBRIC SUBMISSION DETECTED`);
                logger.trace(`[ScoreSync] Call #${callId}: Operation: ${operationName}`);

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
 * Update assignment score display in UI
 */
function updateAssignmentScoreDisplay(score) {
    const display = document.querySelector('[data-cg-assignment-score]');
    if (display) {
        display.textContent = score;
    }
}

/**
 * Create UI controls (Suggestion #5, #13 - added error boundary, uses color constants)
 */
function createUIControls(courseId, assignmentId) {
    try {
        logger.trace('[ScoreSync] createUIControls called');

        // Find the Canvas flex container that holds the rubric view controls
        logger.trace('[ScoreSync] Looking for Canvas flex container: span[dir="ltr"][wrap="wrap"]');
        const flexContainer = document.querySelector('span[dir="ltr"][wrap="wrap"][direction="row"]');

        if (!flexContainer) {
            logger.trace('[ScoreSync] Flex container not found, trying fallback selector');
            // Fallback: find by class pattern
            const fallbackContainer = document.querySelector('span.css-jf6rsx-view--flex-flex');
            if (!fallbackContainer) {
                logger.trace('[ScoreSync] Canvas flex container not found in DOM');
                return false;
            }
            logger.trace('[ScoreSync] Found flex container via fallback selector');
        }

        const targetContainer = flexContainer || document.querySelector('span.css-jf6rsx-view--flex-flex');

        // Remove existing UI if present (handles navigation)
        const existing = document.querySelector('[data-cg-scoresync-ui]');
        if (existing) {
            logger.trace('[ScoreSync] Removing existing UI controls before re-creation');
            existing.remove();
        }

        logger.trace('[ScoreSync] Canvas flex container found, creating UI controls');
        const settings = getSettings(courseId, assignmentId);
        logger.trace(`[ScoreSync] Settings loaded: enabled=${settings.enabled}, method=${settings.method}`);

        const container = document.createElement('div');
        container.setAttribute('data-cg-scoresync-ui', 'true');
        container.setAttribute('data-cg-enabled', settings.enabled ? 'true' : 'false');
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
            opacity: ${settings.enabled ? '1' : '0.6'};
            overflow: hidden;
        `;

        container.innerHTML = `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0; white-space: nowrap;">
                <input type="checkbox" data-cg-toggle ${settings.enabled ? 'checked' : ''}
                       style="margin: 0; transform: scale(1.25); transform-origin: center; cursor: pointer;">
                <span style="font-weight: 600;">Score Sync</span>
            </label>
            <select class="ic-Input" data-cg-method ${settings.enabled ? '' : 'disabled'}
                    style="width: auto; min-width: 4rem; height: 2.375rem; min-height: 2.375rem; padding-top: 0.25rem; padding-bottom: 0.25rem; align-self: center;">
                <option value="min" ${settings.method === 'min' ? 'selected' : ''}>MIN</option>
                <option value="avg" ${settings.method === 'avg' ? 'selected' : ''}>AVG</option>
                <option value="max" ${settings.method === 'max' ? 'selected' : ''}>MAX</option>
                <option value="sum" ${settings.method === 'sum' ? 'selected' : ''}>SUM</option>
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

        const toggle = container.querySelector('[data-cg-toggle]');
        const methodSelect = container.querySelector('[data-cg-method]');

        toggle.addEventListener('change', () => {
            settings.enabled = toggle.checked;
            saveSettings(courseId, assignmentId, settings);

            // Update disabled state
            container.setAttribute('data-cg-enabled', settings.enabled ? 'true' : 'false');
            container.style.opacity = settings.enabled ? '1' : '0.6';
            methodSelect.disabled = !settings.enabled;
            methodSelect.style.cursor = settings.enabled ? 'pointer' : 'not-allowed';

            logger.info(`[ScoreSync] Score sync ${settings.enabled ? 'enabled' : 'disabled'}`);
        });

        methodSelect.addEventListener('change', () => {
            settings.method = methodSelect.value;
            saveSettings(courseId, assignmentId, settings);
            logger.info(`[ScoreSync] Method changed to: ${settings.method}`);
        });

        logger.trace('[ScoreSync] Appending UI container as flex item');
        targetContainer.appendChild(container);
        logger.info('[ScoreSync] ✅ UI controls created and inserted into DOM');
        return true;
    } catch (error) {
        logger.error('[ScoreSync] Failed to create UI controls:', error);
        return false;
    }
}

/**
 * Ensure ScoreSync UI is present (keepalive for React rerenders) (Suggestion #14 - better logging)
 */
function ensureScoreSyncUiPresent() {
    const { courseId, assignmentId } = parseSpeedGraderUrl();
    if (!courseId || !assignmentId) {
        logger.trace('[ScoreSync] Cannot ensure UI: missing IDs');
        return;
    }

    if (document.querySelector('[data-cg-scoresync-ui]')) return;

    const ok = createUIControls(courseId, assignmentId);
    if (ok) {
        logger.info(`[ScoreSync] UI re-injected for course=${courseId}, assignment=${assignmentId}`);
    } else {
        logger.warn('[ScoreSync] Failed to re-inject UI (container not found)');
    }
}

/**
 * Schedule UI recheck after navigation (Suggestion #4)
 */
function scheduleUiRecheck() {
    setTimeout(() => void ensureScoreSyncUiPresent(), 0);
    setTimeout(() => void ensureScoreSyncUiPresent(), TIMING_CONSTANTS.NAVIGATION_RECHECK_DELAY);
}

/**
 * Start temporary UI keepalive (UI Keepalive fix)
 */
function startTemporaryUiKeepalive() {
    // Clear existing interval if any
    if (uiKeepaliveInterval) {
        clearInterval(uiKeepaliveInterval);
    }

    // Start new interval
    uiKeepaliveInterval = setInterval(() => void ensureScoreSyncUiPresent(), TIMING_CONSTANTS.UI_KEEPALIVE_INTERVAL);
    logger.trace(`[ScoreSync] Temporary UI keepalive started (${TIMING_CONSTANTS.UI_KEEPALIVE_INTERVAL}ms checks for ${TIMING_CONSTANTS.UI_KEEPALIVE_DURATION}ms)`);

    // Auto-stop after duration
    setTimeout(() => {
        if (uiKeepaliveInterval) {
            clearInterval(uiKeepaliveInterval);
            uiKeepaliveInterval = null;
            logger.trace('[ScoreSync] Temporary UI keepalive stopped (duration expired)');
        }
    }, TIMING_CONSTANTS.UI_KEEPALIVE_DURATION);
}

/**
 * Hook History API to detect SpeedGrader navigation (Suggestion #4, UI Keepalive fix)
 */
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

    window.addEventListener('popstate', () => {
        scheduleUiRecheck();
        startTemporaryUiKeepalive();
    });

    logger.trace('[ScoreSync] History API hooks installed');
}

/**
 * Cleanup function (Suggestion #3)
 */
export function cleanup() {
    if (uiKeepaliveInterval) {
        clearInterval(uiKeepaliveInterval);
        uiKeepaliveInterval = null;
    }

    // Reset hooks
    window.__CG_SCORESYNC_FETCH_HOOKED__ = false;
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

    logger.trace('[ScoreSync] Installing fetch hook...');
    hookFetch();

    logger.trace('[ScoreSync] Installing history API hooks...');
    hookHistoryApi();

    // Use feature flag for UI keepalive (Suggestion #18)
    if (FEATURE_FLAGS.UI_KEEPALIVE_ENABLED) {
        logger.trace('[ScoreSync] Starting temporary UI keepalive...');
        startTemporaryUiKeepalive();
    }

    // Try immediate UI creation
    logger.trace('[ScoreSync] Attempting immediate UI creation...');
    createUIControls(courseId, assignmentId);

    logger.info('[ScoreSync] ========== INITIALIZATION COMPLETE ==========');
}