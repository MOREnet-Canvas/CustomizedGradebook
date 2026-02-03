// src/speedgrader/speedgraderScoreSync.js
// noinspection SpellCheckingInspection

/**
 * SpeedGrader Score Sync Module
 *
 * Automatically syncs assignment scores from rubric assessments
 * in standards-based courses. Runs only for teacher-like users.
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
import { getUserRoleGroup } from '../utils/canvas.js';
import { getCourseSnapshot, populateCourseSnapshot } from '../services/courseSnapshotService.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';

let initialized = false;
let inFlight = false;
const lastFingerprintByContext = new Map();
let apiClient = null;

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
 * Get storage from localStorage
 */
async function getStorage(key) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
}

/**
 * Set storage in localStorage
 */
async function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Get settings for current assignment
 */
async function getSettings(courseId, assignmentId) {
    const host = window.location.hostname;
    const assignmentKey = `cg_speedgrader_scoresync_settings::${host}::course::${courseId}::assignment::${assignmentId}`;
    const courseKey = `cg_speedgrader_scoresync_default::${host}::course::${courseId}`;

    const assignmentSettings = await getStorage(assignmentKey);
    if (assignmentSettings) return assignmentSettings;

    const courseSettings = await getStorage(courseKey);
    if (courseSettings) return courseSettings;

    return { enabled: true, method: 'min' };
}

/**
 * Save settings (both assignment override and course default)
 */
async function saveSettings(courseId, assignmentId, settings) {
    const host = window.location.hostname;
    const assignmentKey = `cg_speedgrader_scoresync_settings::${host}::course::${courseId}::assignment::${assignmentId}`;
    const courseKey = `cg_speedgrader_scoresync_default::${host}::course::${courseId}`;

    await setStorage(assignmentKey, settings);
    await setStorage(courseKey, settings);
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
 * Update grade input UI (React-controlled)
 */
function updateGradeInput(score) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

    const applyValue = () => {
        // Re-query input each time (may be replaced on navigation)
        const allInputs = Array.from(document.querySelectorAll('input[data-testid="grade-input"]'));

        if (allInputs.length === 0) {
            logger.trace('[ScoreSync] Grade input not found for update');
            return;
        }

        // Filter to visible, enabled inputs
        const visibleInputs = allInputs.filter(el => {
            const visible = el.offsetParent !== null;
            const enabled = !el.disabled;
            return visible && enabled;
        });

        if (visibleInputs.length === 0) {
            logger.trace('[ScoreSync] No visible, enabled grade inputs found');
            return;
        }

        // Prefer inputs inside grading panel
        const panelInputs = visibleInputs.filter(el => {
            return el.closest('[data-testid="speedgrader-grading-panel"]') !== null;
        });

        let candidates = panelInputs.length > 0 ? panelInputs : visibleInputs;

        // Choose best candidate: largest area or currently focused
        let input = candidates[0];
        if (candidates.length > 1) {
            const focused = candidates.find(el => el === document.activeElement);
            if (focused) {
                input = focused;
            } else {
                let maxArea = 0;
                for (const el of candidates) {
                    const rect = el.getBoundingClientRect();
                    const area = rect.width * rect.height;
                    if (area > maxArea) {
                        maxArea = area;
                        input = el;
                    }
                }
            }
        }

        // Set input value
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

    // Apply 3 times with delays
    applyValue();
    setTimeout(applyValue, 700);
    setTimeout(applyValue, 1500);

    logger.trace(`[ScoreSync] Grade input update scheduled for score: ${score}`);
}

/**
 * Submit grade to Canvas API
 */
async function submitGrade(courseId, assignmentId, studentId, score, apiClient) {
    logger.trace(`[ScoreSync] submitGrade called with score=${score}`);

    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;
    logger.trace(`[ScoreSync] PUT ${url}`);

    try {
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
        logger.error('[ScoreSync] Exception in submitGrade:', error);
        return null;
    }
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
 * Handle rubric submission
 */
async function handleRubricSubmit(courseId, assignmentId, studentId, apiClient) {
    logger.info('[ScoreSync] ========== RUBRIC SUBMIT HANDLER CALLED ==========');
    logger.trace(`[ScoreSync] Parameters: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`);

    if (inFlight) {
        logger.warn('[ScoreSync] Already processing another submission, skipping');
        return;
    }

    inFlight = true;
    logger.trace('[ScoreSync] Set inFlight=true');

    try {
        logger.trace('[ScoreSync] Fetching settings...');
        const settings = await getSettings(courseId, assignmentId);
        logger.trace(`[ScoreSync] Settings: enabled=${settings.enabled}, method=${settings.method}`);

        if (!settings.enabled) {
            logger.info('[ScoreSync] SKIPPED - Score sync disabled for this assignment');
            inFlight = false;
            return;
        }

        logger.trace('[ScoreSync] Waiting briefly for GraphQL commit, then polling rubric assessment...');

        const attemptDelaysMs = [200, 250, 350]; // total worst-case ≈800ms, but often faster
        let submission = null;

        for (let i = 0; i < attemptDelaysMs.length; i++) {
            await new Promise(r => setTimeout(r, attemptDelaysMs[i]));
            submission = await fetchSubmission(courseId, assignmentId, studentId);

            const ra = submission?.rubric_assessment;
            if (ra && Object.keys(ra).length > 0) break;
        }

        logger.trace('[ScoreSync] Fetching submission with rubric assessment complete');


        if (!submission) {
            logger.error('[ScoreSync] FAILED - fetchSubmission returned null');
            inFlight = false;
            return;
        }

        logger.trace(`[ScoreSync] Submission fetched: id=${submission.id}, workflow_state=${submission.workflow_state}`);
        logger.trace(`[ScoreSync] Rubric assessment present: ${!!submission.rubric_assessment}`);

        if (!submission.rubric_assessment) {
            logger.warn('[ScoreSync] FAILED - No rubric assessment found in submission');
            inFlight = false;
            return;
        }

        const rubricPoints = Object.values(submission.rubric_assessment).map(c => c.points);
        logger.trace(`[ScoreSync] Rubric points: [${rubricPoints.join(', ')}]`);

        const contextKey = `${courseId}:${assignmentId}:${studentId}`;
        const fingerprint = createRubricFingerprint(submission.rubric_assessment);
        const lastFingerprint = lastFingerprintByContext.get(contextKey);

        logger.trace(`[ScoreSync] Context: ${contextKey}`);
        logger.trace(`[ScoreSync] Rubric fingerprint: ${fingerprint}`);
        logger.trace(`[ScoreSync] Last fingerprint for context: ${lastFingerprint || 'none'}`);

        if (fingerprint === lastFingerprint) {
            logger.info('[ScoreSync] SKIPPED - Rubric unchanged (fingerprint match)');
            inFlight = false;
            return;
        }

        lastFingerprintByContext.set(contextKey, fingerprint);
        logger.trace('[ScoreSync] Fingerprint updated for context');

        const score = calculateGrade(submission.rubric_assessment, settings.method);
        logger.info(`[ScoreSync] Calculated score: ${score} (method: ${settings.method})`);

        logger.trace('[ScoreSync] Submitting grade to Canvas API...');
        const result = await submitGrade(courseId, assignmentId, studentId, score, apiClient);

        if (!result) {
            logger.error('[ScoreSync] FAILED - submitGrade returned null');
            return;
        }

        logger.trace(`[ScoreSync] Grade submission result: entered_score=${result.entered_score}, score=${result.score}, workflow_state=${result.workflow_state}`);

        const finalScore = result?.entered_score ?? score;
        logger.trace(`[ScoreSync] Updating UI with final score: ${finalScore}`);
        updateGradeInput(finalScore);
        updateAssignmentScoreDisplay(finalScore);

        logger.info('[ScoreSync] ✅ SCORE SYNC COMPLETE');
    } catch (error) {
        logger.error('[ScoreSync] ERROR in handleRubricSubmit:', error);
    } finally {
        inFlight = false;
        logger.trace('[ScoreSync] Set inFlight=false');
    }
}

/**
 * Hook window.fetch to detect rubric submissions
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
        if (url.includes('/api/graphql') && res.ok && method === 'POST') {
            // Extract body text robustly
            let bodyText = '';

            if (typeof init?.body === 'string') {
                bodyText = init.body;
            } else if (isRequest) {
                try {
                    bodyText = await input.clone().text();
                } catch (error) {
                    logger.trace(`[ScoreSync] Could not read Request body: ${error.message}`);
                }
            }

            // Check for rubric save patterns
            const looksLikeRubricSave = /SaveRubricAssessment|rubricAssessment|rubric_assessment/i.test(bodyText);

            if (looksLikeRubricSave) {
                logger.info(`[ScoreSync] ✅ RUBRIC SUBMISSION DETECTED`);
                logger.trace(`[ScoreSync] Call #${callId}: input type: ${isRequest ? 'Request' : 'string'}`);
                logger.trace(`[ScoreSync] Call #${callId}: Body preview: ${bodyText.substring(0, 200)}`);

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
 * Create UI controls
 */
async function createUIControls(courseId, assignmentId) {
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
    const settings = await getSettings(courseId, assignmentId);
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
        background: #f5f5f5;
        border: 1px solid #d1d5db;
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
                style="width: auto; min-width: 4rem;">
            <option value="min" ${settings.method === 'min' ? 'selected' : ''}>MIN</option>
            <option value="avg" ${settings.method === 'avg' ? 'selected' : ''}>AVG</option>
            <option value="max" ${settings.method === 'max' ? 'selected' : ''}>MAX</option>
        </select>
        <div style="display: flex; height: 100%; flex-shrink: 0; margin: 0;">
            <div style="display: flex; align-items: center; padding-left: 0.75rem; padding-right: 0.75rem; height: 100%; background-color: rgb(245, 245, 245);">
                <span style="font-weight: 600; white-space: nowrap;">Assignment Score</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; padding: 0 0.75rem; height: 100%; background-color: rgb(0, 142, 83);">
                <span style="color: #fff; font-weight: 700; white-space: nowrap;"><span data-cg-assignment-score>--</span> pts</span>
            </div>
        </div>
    `;

    const toggle = container.querySelector('[data-cg-toggle]');
    const methodSelect = container.querySelector('[data-cg-method]');

    toggle.addEventListener('change', async () => {
        settings.enabled = toggle.checked;
        await saveSettings(courseId, assignmentId, settings);

        // Update disabled state
        container.setAttribute('data-cg-enabled', settings.enabled ? 'true' : 'false');
        container.style.opacity = settings.enabled ? '1' : '0.6';
        methodSelect.disabled = !settings.enabled;
        methodSelect.style.cursor = settings.enabled ? 'pointer' : 'not-allowed';

        logger.info(`[ScoreSync] Score sync ${settings.enabled ? 'enabled' : 'disabled'}`);
    });

    methodSelect.addEventListener('change', async () => {
        settings.method = methodSelect.value;
        await saveSettings(courseId, assignmentId, settings);
        logger.info(`[ScoreSync] Method changed to: ${settings.method}`);
    });

    logger.trace('[ScoreSync] Appending UI container as flex item');
    targetContainer.appendChild(container);
    logger.info('[ScoreSync] ✅ UI controls created and inserted into DOM');
    return true;
}

/**
 * Ensure ScoreSync UI is present (keepalive for React rerenders)
 */
async function ensureScoreSyncUiPresent() {
    const { courseId, assignmentId } = parseSpeedGraderUrl();
    if (!courseId || !assignmentId) return;

    if (document.querySelector('[data-cg-scoresync-ui]')) return;

    const ok = await createUIControls(courseId, assignmentId);
    if (ok) {
        logger.info(`[ScoreSync] UI re-injected for course=${courseId}, assignment=${assignmentId}`);
    }
}

/**
 * Hook History API to detect SpeedGrader navigation
 */
function hookHistoryApi() {
    if (window.__CG_SCORESYNC_HISTORY_HOOKED__) return;
    window.__CG_SCORESYNC_HISTORY_HOOKED__ = true;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        setTimeout(() => void ensureScoreSyncUiPresent(), 0);
        setTimeout(() => void ensureScoreSyncUiPresent(), 250);
    };

    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        setTimeout(() => void ensureScoreSyncUiPresent(), 0);
        setTimeout(() => void ensureScoreSyncUiPresent(), 250);
    };

    window.addEventListener('popstate', () => {
        setTimeout(() => void ensureScoreSyncUiPresent(), 0);
        setTimeout(() => void ensureScoreSyncUiPresent(), 250);
    });

    logger.trace('[ScoreSync] History API hooks installed');
}

/**
 * Start UI keepalive interval
 */
function startUiKeepalive() {
    setInterval(() => void ensureScoreSyncUiPresent(), 600);
    logger.trace('[ScoreSync] UI keepalive interval started (600ms)');
}

/**
 * Initialize score sync module
 */
export async function initSpeedGraderAutoGrade() {
    logger.info('[ScoreSync] ========== INITIALIZATION STARTED ==========');

    if (initialized) {
        logger.warn('[ScoreSync] Already initialized, skipping');
        return;
    }
    initialized = true;

    logger.trace('[ScoreSync] Initializing SpeedGrader score sync module');

    const roleGroup = getUserRoleGroup();
    logger.trace(`[ScoreSync] User role group: ${roleGroup}`);
    if (roleGroup !== 'teacher_like') {
        logger.info(`[ScoreSync] SKIPPED - user is ${roleGroup}, not teacher_like`);
        return;
    }

    // Try to parse URL with retries (SpeedGrader uses client-side routing)
    let parseAttempt = 0;
    let courseId, assignmentId, studentId;

    while (parseAttempt < 3) {
        parseAttempt++;
        const parsed = parseSpeedGraderUrl();
        courseId = parsed.courseId;
        assignmentId = parsed.assignmentId;
        studentId = parsed.studentId;

        logger.trace(`[ScoreSync] Parse attempt ${parseAttempt}/3 - courseId: ${courseId}, assignmentId: ${assignmentId}, studentId: ${studentId}`);

        if (courseId && assignmentId && studentId) {
            logger.trace('[ScoreSync] All required IDs extracted successfully');
            break;
        }

        if (parseAttempt < 3) {
            logger.trace(`[ScoreSync] Missing IDs, waiting 500ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (!courseId || !assignmentId || !studentId) {
        logger.error('[ScoreSync] FAILED - Missing required IDs after 3 attempts:', { courseId, assignmentId, studentId });
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

    logger.trace('[ScoreSync] Starting UI keepalive interval...');
    startUiKeepalive();

    // Try immediate UI creation
    logger.trace('[ScoreSync] Attempting immediate UI creation...');
    await createUIControls(courseId, assignmentId);

    logger.info('[ScoreSync] ========== INITIALIZATION COMPLETE ==========');
}