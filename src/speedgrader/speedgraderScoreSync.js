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
import { createConditionalObserver, OBSERVER_CONFIGS } from '../utils/observerHelpers.js';

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
    return Object.entries(rubricAssessment)
        .map(([id, data]) => `${id}:${data.points}`)
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
            logger.debug('[ScoreSync] Grade input not found for update');
            return;
        }

        // Filter to visible, enabled inputs
        const visibleInputs = allInputs.filter(el => {
            const visible = el.offsetParent !== null;
            const enabled = !el.disabled;
            return visible && enabled;
        });

        if (visibleInputs.length === 0) {
            logger.debug('[ScoreSync] No visible, enabled grade inputs found');
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
        logger.debug(`[ScoreSync] Applied value=${score}, read back value="${readBack}"`);
    };

    // Apply 3 times with delays
    applyValue();
    setTimeout(applyValue, 700);
    setTimeout(applyValue, 1500);

    logger.info(`[ScoreSync] Grade input update scheduled for score: ${score}`);
}

/**
 * Submit grade to Canvas API
 */
async function submitGrade(courseId, assignmentId, studentId, score, apiClient) {
    logger.debug(`[ScoreSync] submitGrade called with score=${score}`);

    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;
    logger.debug(`[ScoreSync] PUT ${url}`);

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

        logger.debug(`[ScoreSync] Response data:`, data);
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

    logger.debug(`[ScoreSync] GET ${url}`);

    try {
        const response = await fetch(url, {
            credentials: 'same-origin'
        });

        logger.debug(`[ScoreSync] Fetch response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            logger.error(`[ScoreSync] Failed to fetch submission: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        logger.debug(`[ScoreSync] Submission data: id=${data.id}, user_id=${data.user_id}, rubric_assessment=${!!data.rubric_assessment}`);

        if (data.rubric_assessment) {
            const criteriaCount = Object.keys(data.rubric_assessment).length;
            logger.debug(`[ScoreSync] Rubric has ${criteriaCount} criteria`);
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
    logger.info(`[ScoreSync] Parameters: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`);

    if (inFlight) {
        logger.warn('[ScoreSync] Already processing another submission, skipping');
        return;
    }

    inFlight = true;
    logger.debug('[ScoreSync] Set inFlight=true');

    try {
        logger.debug('[ScoreSync] Fetching settings...');
        const settings = await getSettings(courseId, assignmentId);
        logger.info(`[ScoreSync] Settings: enabled=${settings.enabled}, method=${settings.method}`);

        if (!settings.enabled) {
            logger.info('[ScoreSync] SKIPPED - Score sync disabled for this assignment');
            inFlight = false;
            return;
        }

        logger.debug('[ScoreSync] Waiting briefly for GraphQL commit, then polling rubric assessment...');

        const attemptDelaysMs = [200, 250, 350]; // total worst-case ≈800ms, but often faster
        let submission = null;

        for (let i = 0; i < attemptDelaysMs.length; i++) {
            await new Promise(r => setTimeout(r, attemptDelaysMs[i]));
            submission = await fetchSubmission(courseId, assignmentId, studentId);

            const ra = submission?.rubric_assessment;
            if (ra && Object.keys(ra).length > 0) break;
        }

        logger.debug('[ScoreSync] Fetching submission with rubric assessment complete');


        if (!submission) {
            logger.error('[ScoreSync] FAILED - fetchSubmission returned null');
            inFlight = false;
            return;
        }

        logger.debug(`[ScoreSync] Submission fetched: id=${submission.id}, workflow_state=${submission.workflow_state}`);
        logger.debug(`[ScoreSync] Rubric assessment present: ${!!submission.rubric_assessment}`);

        if (!submission.rubric_assessment) {
            logger.warn('[ScoreSync] FAILED - No rubric assessment found in submission');
            inFlight = false;
            return;
        }

        const rubricPoints = Object.values(submission.rubric_assessment).map(c => c.points);
        logger.info(`[ScoreSync] Rubric points: [${rubricPoints.join(', ')}]`);

        const contextKey = `${courseId}:${assignmentId}:${studentId}`;
        const fingerprint = createRubricFingerprint(submission.rubric_assessment);
        const lastFingerprint = lastFingerprintByContext.get(contextKey);

        logger.debug(`[ScoreSync] Context: ${contextKey}`);
        logger.debug(`[ScoreSync] Rubric fingerprint: ${fingerprint}`);
        logger.debug(`[ScoreSync] Last fingerprint for context: ${lastFingerprint || 'none'}`);

        if (fingerprint === lastFingerprint) {
            logger.info('[ScoreSync] SKIPPED - Rubric unchanged (fingerprint match)');
            inFlight = false;
            return;
        }

        lastFingerprintByContext.set(contextKey, fingerprint);
        logger.debug('[ScoreSync] Fingerprint updated for context');

        const score = calculateGrade(submission.rubric_assessment, settings.method);
        logger.info(`[ScoreSync] Calculated score: ${score} (method: ${settings.method})`);

        logger.debug('[ScoreSync] Submitting grade to Canvas API...');
        const result = await submitGrade(courseId, assignmentId, studentId, score, apiClient);

        if (!result) {
            logger.error('[ScoreSync] FAILED - submitGrade returned null');
            return;
        }

        logger.info(`[ScoreSync] Grade submission result: entered_score=${result.entered_score}, score=${result.score}, workflow_state=${result.workflow_state}`);

        const finalScore = result?.entered_score ?? score;
        logger.debug(`[ScoreSync] Updating UI with final score: ${finalScore}`);
        updateGradeInput(finalScore);
        updateAssignmentScoreDisplay(finalScore);

        logger.info('[ScoreSync] ✅ SCORE SYNC COMPLETE');
    } catch (error) {
        logger.error('[ScoreSync] ERROR in handleRubricSubmit:', error);
    } finally {
        inFlight = false;
        logger.debug('[ScoreSync] Set inFlight=false');
    }
}

/**
 * Hook window.fetch to detect rubric submissions
 */
function hookFetch() {
    logger.info('[ScoreSync] Installing fetch hook...');

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
                logger.info(`[ScoreSync] Call #${callId}: ✅ RUBRIC SUBMISSION DETECTED (input type: ${isRequest ? 'Request' : 'string'})`);
                logger.info(`[ScoreSync] Call #${callId}: Body preview: ${bodyText.substring(0, 200)}`);

                // Re-parse URL to get current context (handles navigation)
                const parsed = parseSpeedGraderUrl();
                logger.info(`[ScoreSync] Call #${callId}: Parsed IDs - courseId: ${parsed.courseId}, assignmentId: ${parsed.assignmentId}, studentId: ${parsed.studentId}`);

                if (parsed.courseId && parsed.assignmentId && parsed.studentId) {
                    logger.info(`[ScoreSync] Call #${callId}: Triggering handleRubricSubmit...`);
                    void handleRubricSubmit(parsed.courseId, parsed.assignmentId, parsed.studentId, apiClient);
                } else {
                    logger.warn(`[ScoreSync] Call #${callId}: Missing IDs, cannot handle rubric submit`);
                }
            }
        }

        return res;
    };

    logger.info('[ScoreSync] ✅ Fetch hook installed successfully');
    logger.info('[ScoreSync] Fetch hook verification: window.fetch is now wrapped:', window.fetch !== originalFetch);
    logger.info('[ScoreSync] To test: Submit a rubric assessment and watch for fetch logs');
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
    logger.debug('[ScoreSync] createUIControls called');

    // Check if UI already exists
    const existing = document.querySelector('[data-cg-scoresync-ui]');
    if (existing) {
        logger.debug('[ScoreSync] UI controls already exist, skipping creation');
        return true;
    }

    logger.debug('[ScoreSync] Looking for anchor element: span[data-testid="rubric-assessment-instructor-score"]');
    const anchor = document.querySelector('span[data-testid="rubric-assessment-instructor-score"]');

    if (!anchor) {
        logger.debug('[ScoreSync] Anchor element not found in DOM');
        // Log what IS in the DOM for debugging
        const rubricElements = document.querySelectorAll('[data-testid*="rubric"]');
        logger.trace(`[ScoreSync] Found ${rubricElements.length} elements with data-testid containing "rubric"`);
        if (rubricElements.length > 0) {
            const testIds = Array.from(rubricElements).map(el => el.getAttribute('data-testid')).slice(0, 5);
            logger.trace(`[ScoreSync] Sample rubric testids: ${testIds.join(', ')}`);
        }
        return false;
    }

    logger.info('[ScoreSync] ✅ Anchor element found, creating UI controls');
    const settings = await getSettings(courseId, assignmentId);
    logger.debug(`[ScoreSync] Settings loaded: enabled=${settings.enabled}, method=${settings.method}`);

    const container = document.createElement('div');
    container.setAttribute('data-cg-scoresync-ui', 'true');
    container.style.cssText = 'display: inline-flex; align-items: center; gap: 12px; margin-left: 16px; font-size: 14px;';

    container.innerHTML = `
        <span style="font-weight: 500;">Assignment Score: <span data-cg-assignment-score>--</span></span>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" data-cg-toggle ${settings.enabled ? 'checked' : ''} style="cursor: pointer;">
            <span>Score Sync</span>
        </label>
        <select data-cg-method style="padding: 2px 4px; cursor: pointer;">
            <option value="min" ${settings.method === 'min' ? 'selected' : ''}>MIN</option>
            <option value="avg" ${settings.method === 'avg' ? 'selected' : ''}>AVG</option>
            <option value="max" ${settings.method === 'max' ? 'selected' : ''}>MAX</option>
        </select>
    `;

    const toggle = container.querySelector('[data-cg-toggle]');
    const methodSelect = container.querySelector('[data-cg-method]');

    toggle.addEventListener('change', async () => {
        settings.enabled = toggle.checked;
        await saveSettings(courseId, assignmentId, settings);
        logger.info(`[ScoreSync] Score sync ${settings.enabled ? 'enabled' : 'disabled'}`);
    });

    methodSelect.addEventListener('change', async () => {
        settings.method = methodSelect.value;
        await saveSettings(courseId, assignmentId, settings);
        logger.info(`[ScoreSync] Method changed to: ${settings.method}`);
    });

    logger.debug('[ScoreSync] Appending UI container to anchor parent element');
    anchor.parentElement.appendChild(container);
    logger.info('[ScoreSync] ✅ UI controls created and inserted into DOM');
    return true;
}

/**
 * Initialize score sync module
 */
export async function initSpeedGraderAutoGrade() {
    logger.info('[ScoreSync] ========== INITIALIZATION STARTED ==========');
    logger.info(`[ScoreSync] Current URL: ${window.location.href}`);

    if (initialized) {
        logger.warn('[ScoreSync] Already initialized, skipping');
        return;
    }
    initialized = true;

    logger.debug('[ScoreSync] Initializing SpeedGrader score sync module');

    const roleGroup = getUserRoleGroup();
    logger.info(`[ScoreSync] User role group: ${roleGroup}`);
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

        logger.info(`[ScoreSync] Parse attempt ${parseAttempt}/3 - courseId: ${courseId}, assignmentId: ${assignmentId}, studentId: ${studentId}`);

        if (courseId && assignmentId && studentId) {
            logger.info('[ScoreSync] ✅ All required IDs extracted successfully');
            break;
        }

        if (parseAttempt < 3) {
            logger.debug(`[ScoreSync] Missing IDs, waiting 500ms before retry...`);
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

    logger.debug('[ScoreSync] Creating CanvasApiClient...');
    apiClient = new CanvasApiClient();
    logger.debug('[ScoreSync] CanvasApiClient created successfully');

    let snapshot = getCourseSnapshot(courseId);
    logger.info(`[ScoreSync] Course snapshot from cache: ${snapshot ? 'FOUND' : 'NOT FOUND'}`);

    if (!snapshot) {
        logger.info('[ScoreSync] Populating course snapshot...');
        const courseName = document.title.split(':')[0]?.trim() || 'Unknown Course';
        logger.debug(`[ScoreSync] Course name from title: "${courseName}"`);
        snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
        logger.info(`[ScoreSync] Snapshot population result: ${snapshot ? 'SUCCESS' : 'FAILED'}`);
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

    logger.debug('[ScoreSync] Installing fetch hook...');
    hookFetch();

    // Try immediate UI creation
    logger.debug('[ScoreSync] Attempting immediate UI creation...');
    const immediateSuccess = await createUIControls(courseId, assignmentId);
    if (immediateSuccess) {
        logger.info('[ScoreSync] ✅ UI created immediately - initialization complete');
        return;
    }

    // Use MutationObserver to wait for rubric panel to appear
    logger.info('[ScoreSync] UI not ready yet, starting MutationObserver to wait for rubric panel...');
    createConditionalObserver(async () => {
        logger.trace('[ScoreSync] Observer mutation detected, checking for anchor...');
        const anchor = document.querySelector('span[data-testid="rubric-assessment-instructor-score"]');
        if (anchor) {
            logger.debug('[ScoreSync] Observer found anchor element, attempting UI creation...');
            const success = await createUIControls(courseId, assignmentId);
            if (success) {
                logger.info('[ScoreSync] ✅ UI created via observer - initialization complete');
                return true; // Disconnect observer
            }
        }
        return false; // Keep observing
    }, {
        config: OBSERVER_CONFIGS.CHILD_LIST,
        target: document.body,
        name: 'ScoreSyncUIObserver',
        timeout: 30000
    });

    logger.info('[ScoreSync] ========== INITIALIZATION COMPLETE (observer running) ==========');
}