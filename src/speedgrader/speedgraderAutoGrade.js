// src/speedgrader/speedgraderAutoGrade.js
// noinspection SpellCheckingInspection

/**
 * SpeedGrader Auto-Grade Module
 *
 * Automatically calculates and stores assignment grades from rubric assessments
 * in standards-based courses. Runs only for teacher-like users.
 *
 * Features:
 * - Detects rubric submission via GraphQL fetch hook
 * - Calculates grade using MIN/AVG/MAX methods
 * - Writes grade via Canvas API
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
    const assignmentId = params.get('assignment_id');
    const studentId = params.get('student_id');

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
    const assignmentKey = `cg_speedgrader_autograde_settings::${host}::course::${courseId}::assignment::${assignmentId}`;
    const courseKey = `cg_speedgrader_autograde_default::${host}::course::${courseId}`;

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
    const assignmentKey = `cg_speedgrader_autograde_settings::${host}::course::${courseId}::assignment::${assignmentId}`;
    const courseKey = `cg_speedgrader_autograde_default::${host}::course::${courseId}`;

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
            logger.debug('[AutoGrade] Grade input not found for update');
            return;
        }

        // Filter to visible, enabled inputs
        const visibleInputs = allInputs.filter(el => {
            const visible = el.offsetParent !== null;
            const enabled = !el.disabled;
            return visible && enabled;
        });

        if (visibleInputs.length === 0) {
            logger.debug('[AutoGrade] No visible, enabled grade inputs found');
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
        logger.debug(`[AutoGrade] Applied value=${score}, read back value="${readBack}"`);
    };

    // Apply 3 times with delays
    applyValue();
    setTimeout(applyValue, 700);
    setTimeout(applyValue, 1500);

    logger.info(`[AutoGrade] Grade input update scheduled for score: ${score}`);
}

/**
 * Submit grade to Canvas API
 */
async function submitGrade(courseId, assignmentId, studentId, score, apiClient) {
    logger.debug(`[AutoGrade] submitGrade called with score=${score}`);

    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;
    logger.debug(`[AutoGrade] PUT ${url}`);

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

        logger.debug(`[AutoGrade] Response data:`, data);
        const enteredScore = data?.entered_score ?? score;
        logger.info(`[AutoGrade] ✅ Grade submitted successfully: ${enteredScore}`);
        return data;
    } catch (error) {
        logger.error('[AutoGrade] Exception in submitGrade:', error);
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

    logger.debug(`[AutoGrade] GET ${url}`);

    try {
        const response = await fetch(url, {
            credentials: 'same-origin'
        });

        logger.debug(`[AutoGrade] Fetch response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            logger.error(`[AutoGrade] Failed to fetch submission: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        logger.debug(`[AutoGrade] Submission data: id=${data.id}, user_id=${data.user_id}, rubric_assessment=${!!data.rubric_assessment}`);

        if (data.rubric_assessment) {
            const criteriaCount = Object.keys(data.rubric_assessment).length;
            logger.debug(`[AutoGrade] Rubric has ${criteriaCount} criteria`);
        }

        return data;
    } catch (error) {
        logger.error('[AutoGrade] Exception in fetchSubmission:', error);
        return null;
    }
}

/**
 * Handle rubric submission
 */
async function handleRubricSubmit(courseId, assignmentId, studentId, apiClient) {
    logger.info('[AutoGrade] ========== RUBRIC SUBMIT HANDLER CALLED ==========');
    logger.info(`[AutoGrade] Parameters: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`);

    if (inFlight) {
        logger.warn('[AutoGrade] Already processing another submission, skipping');
        return;
    }

    inFlight = true;
    logger.debug('[AutoGrade] Set inFlight=true');

    try {
        logger.debug('[AutoGrade] Fetching settings...');
        const settings = await getSettings(courseId, assignmentId);
        logger.info(`[AutoGrade] Settings: enabled=${settings.enabled}, method=${settings.method}`);

        if (!settings.enabled) {
            logger.info('[AutoGrade] SKIPPED - Auto-grade disabled for this assignment');
            inFlight = false;
            return;
        }

        logger.debug('[AutoGrade] Waiting 800ms for GraphQL commit...');
        await new Promise(resolve => setTimeout(resolve, 800));

        logger.debug('[AutoGrade] Fetching submission with rubric assessment...');
        const submission = await fetchSubmission(courseId, assignmentId, studentId);

        if (!submission) {
            logger.error('[AutoGrade] FAILED - fetchSubmission returned null');
            inFlight = false;
            return;
        }

        logger.debug(`[AutoGrade] Submission fetched: id=${submission.id}, workflow_state=${submission.workflow_state}`);
        logger.debug(`[AutoGrade] Rubric assessment present: ${!!submission.rubric_assessment}`);

        if (!submission.rubric_assessment) {
            logger.warn('[AutoGrade] FAILED - No rubric assessment found in submission');
            inFlight = false;
            return;
        }

        const rubricPoints = Object.values(submission.rubric_assessment).map(c => c.points);
        logger.info(`[AutoGrade] Rubric points: [${rubricPoints.join(', ')}]`);

        const contextKey = `${courseId}:${assignmentId}:${studentId}`;
        const fingerprint = createRubricFingerprint(submission.rubric_assessment);
        const lastFingerprint = lastFingerprintByContext.get(contextKey);

        logger.debug(`[AutoGrade] Context: ${contextKey}`);
        logger.debug(`[AutoGrade] Rubric fingerprint: ${fingerprint}`);
        logger.debug(`[AutoGrade] Last fingerprint for context: ${lastFingerprint || 'none'}`);

        if (fingerprint === lastFingerprint) {
            logger.info('[AutoGrade] SKIPPED - Rubric unchanged (fingerprint match)');
            inFlight = false;
            return;
        }

        lastFingerprintByContext.set(contextKey, fingerprint);
        logger.debug('[AutoGrade] Fingerprint updated for context');

        const score = calculateGrade(submission.rubric_assessment, settings.method);
        logger.info(`[AutoGrade] Calculated score: ${score} (method: ${settings.method})`);

        logger.debug('[AutoGrade] Submitting grade to Canvas API...');
        const result = await submitGrade(courseId, assignmentId, studentId, score, apiClient);

        if (!result) {
            logger.error('[AutoGrade] FAILED - submitGrade returned null');
            return;
        }

        logger.info(`[AutoGrade] Grade submission result: entered_score=${result.entered_score}, score=${result.score}, workflow_state=${result.workflow_state}`);

        const finalScore = result?.entered_score ?? score;
        logger.debug(`[AutoGrade] Updating UI with final score: ${finalScore}`);
        updateGradeInput(finalScore);
        updateAssignmentScoreDisplay(finalScore);

        logger.info('[AutoGrade] ✅ AUTO-GRADE COMPLETE');
    } catch (error) {
        logger.error('[AutoGrade] ERROR in handleRubricSubmit:', error);
    } finally {
        inFlight = false;
        logger.debug('[AutoGrade] Set inFlight=false');
    }
}

/**
 * Hook window.fetch to detect rubric submissions
 */
function hookFetch() {
    logger.info('[AutoGrade] Installing fetch hook...');

    if (window.__CG_AUTOGRADE_FETCH_HOOKED__) {
        logger.warn('[AutoGrade] Fetch hook already installed');
        return;
    }
    window.__CG_AUTOGRADE_FETCH_HOOKED__ = true;

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
                    logger.trace(`[AutoGrade] Could not read Request body: ${error.message}`);
                }
            }

            // Check for rubric save patterns
            const looksLikeRubricSave = /SaveRubricAssessment|rubricAssessment|rubric_assessment/i.test(bodyText);

            if (looksLikeRubricSave) {
                logger.info(`[AutoGrade] Call #${callId}: ✅ RUBRIC SUBMISSION DETECTED (input type: ${isRequest ? 'Request' : 'string'})`);
                logger.info(`[AutoGrade] Call #${callId}: Body preview: ${bodyText.substring(0, 200)}`);

                // Re-parse URL to get current context (handles navigation)
                const parsed = parseSpeedGraderUrl();
                logger.info(`[AutoGrade] Call #${callId}: Parsed IDs - courseId: ${parsed.courseId}, assignmentId: ${parsed.assignmentId}, studentId: ${parsed.studentId}`);

                if (parsed.courseId && parsed.assignmentId && parsed.studentId) {
                    logger.info(`[AutoGrade] Call #${callId}: Triggering handleRubricSubmit...`);
                    void handleRubricSubmit(parsed.courseId, parsed.assignmentId, parsed.studentId, apiClient);
                } else {
                    logger.warn(`[AutoGrade] Call #${callId}: Missing IDs, cannot handle rubric submit`);
                }
            }
        }

        return res;
    };

    logger.info('[AutoGrade] ✅ Fetch hook installed successfully');
    logger.info('[AutoGrade] Fetch hook verification: window.fetch is now wrapped:', window.fetch !== originalFetch);
    logger.info('[AutoGrade] To test: Submit a rubric assessment and watch for fetch logs');
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
    logger.debug('[AutoGrade] createUIControls called');

    // Check if UI already exists
    const existing = document.querySelector('[data-cg-autograde-ui]');
    if (existing) {
        logger.debug('[AutoGrade] UI controls already exist, skipping creation');
        return true;
    }

    logger.debug('[AutoGrade] Looking for anchor element: span[data-testid="rubric-assessment-instructor-score"]');
    const anchor = document.querySelector('span[data-testid="rubric-assessment-instructor-score"]');

    if (!anchor) {
        logger.debug('[AutoGrade] Anchor element not found in DOM');
        // Log what IS in the DOM for debugging
        const rubricElements = document.querySelectorAll('[data-testid*="rubric"]');
        logger.trace(`[AutoGrade] Found ${rubricElements.length} elements with data-testid containing "rubric"`);
        if (rubricElements.length > 0) {
            const testIds = Array.from(rubricElements).map(el => el.getAttribute('data-testid')).slice(0, 5);
            logger.trace(`[AutoGrade] Sample rubric testids: ${testIds.join(', ')}`);
        }
        return false;
    }

    logger.info('[AutoGrade] ✅ Anchor element found, creating UI controls');
    const settings = await getSettings(courseId, assignmentId);
    logger.debug(`[AutoGrade] Settings loaded: enabled=${settings.enabled}, method=${settings.method}`);

    const container = document.createElement('div');
    container.setAttribute('data-cg-autograde-ui', 'true');
    container.style.cssText = 'display: inline-flex; align-items: center; gap: 12px; margin-left: 16px; font-size: 14px;';

    container.innerHTML = `
        <span style="font-weight: 500;">Assignment Score: <span data-cg-assignment-score>--</span></span>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" data-cg-toggle ${settings.enabled ? 'checked' : ''} style="cursor: pointer;">
            <span>Auto-grade</span>
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
        logger.info(`[AutoGrade] Auto-grade ${settings.enabled ? 'enabled' : 'disabled'}`);
    });

    methodSelect.addEventListener('change', async () => {
        settings.method = methodSelect.value;
        await saveSettings(courseId, assignmentId, settings);
        logger.info(`[AutoGrade] Method changed to: ${settings.method}`);
    });

    logger.debug('[AutoGrade] Appending UI container to anchor parent element');
    anchor.parentElement.appendChild(container);
    logger.info('[AutoGrade] ✅ UI controls created and inserted into DOM');
    return true;
}

/**
 * Initialize auto-grade module
 */
export async function initSpeedGraderAutoGrade() {
    logger.info('[AutoGrade] ========== INITIALIZATION STARTED ==========');
    logger.info(`[AutoGrade] Current URL: ${window.location.href}`);

    if (initialized) {
        logger.warn('[AutoGrade] Already initialized, skipping');
        return;
    }
    initialized = true;

    logger.debug('[AutoGrade] Initializing SpeedGrader auto-grade module');

    const roleGroup = getUserRoleGroup();
    logger.info(`[AutoGrade] User role group: ${roleGroup}`);
    if (roleGroup !== 'teacher_like') {
        logger.info(`[AutoGrade] SKIPPED - user is ${roleGroup}, not teacher_like`);
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

        logger.info(`[AutoGrade] Parse attempt ${parseAttempt}/3 - courseId: ${courseId}, assignmentId: ${assignmentId}, studentId: ${studentId}`);

        if (courseId && assignmentId && studentId) {
            logger.info('[AutoGrade] ✅ All required IDs extracted successfully');
            break;
        }

        if (parseAttempt < 3) {
            logger.debug(`[AutoGrade] Missing IDs, waiting 500ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (!courseId || !assignmentId || !studentId) {
        logger.error('[AutoGrade] FAILED - Missing required IDs after 3 attempts:', { courseId, assignmentId, studentId });
        logger.error('[AutoGrade] Full URL:', window.location.href);
        logger.error('[AutoGrade] Query params:', window.location.search);
        initialized = false; // Allow retry on next navigation
        return;
    }

    logger.debug('[AutoGrade] Creating CanvasApiClient...');
    apiClient = new CanvasApiClient();
    logger.debug('[AutoGrade] CanvasApiClient created successfully');

    let snapshot = getCourseSnapshot(courseId);
    logger.info(`[AutoGrade] Course snapshot from cache: ${snapshot ? 'FOUND' : 'NOT FOUND'}`);

    if (!snapshot) {
        logger.info('[AutoGrade] Populating course snapshot...');
        const courseName = document.title.split(':')[0]?.trim() || 'Unknown Course';
        logger.debug(`[AutoGrade] Course name from title: "${courseName}"`);
        snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
        logger.info(`[AutoGrade] Snapshot population result: ${snapshot ? 'SUCCESS' : 'FAILED'}`);
    }

    if (!snapshot) {
        logger.error('[AutoGrade] FAILED - Could not get course snapshot');
        return;
    }

    logger.info(`[AutoGrade] Course model: ${snapshot.model} (reason: ${snapshot.modelReason})`);

    if (snapshot.model !== 'standards') {
        logger.info(`[AutoGrade] SKIPPED - course is ${snapshot.model}, not standards-based`);
        return;
    }

    logger.info('[AutoGrade] ✅ Course is standards-based, proceeding with initialization');

    logger.debug('[AutoGrade] Installing fetch hook...');
    hookFetch();

    // Try immediate UI creation
    logger.debug('[AutoGrade] Attempting immediate UI creation...');
    const immediateSuccess = await createUIControls(courseId, assignmentId);
    if (immediateSuccess) {
        logger.info('[AutoGrade] ✅ UI created immediately - initialization complete');
        return;
    }

    // Use MutationObserver to wait for rubric panel to appear
    logger.info('[AutoGrade] UI not ready yet, starting MutationObserver to wait for rubric panel...');
    createConditionalObserver(async () => {
        logger.trace('[AutoGrade] Observer mutation detected, checking for anchor...');
        const anchor = document.querySelector('span[data-testid="rubric-assessment-instructor-score"]');
        if (anchor) {
            logger.debug('[AutoGrade] Observer found anchor element, attempting UI creation...');
            const success = await createUIControls(courseId, assignmentId);
            if (success) {
                logger.info('[AutoGrade] ✅ UI created via observer - initialization complete');
                return true; // Disconnect observer
            }
        }
        return false; // Keep observing
    }, {
        config: OBSERVER_CONFIGS.CHILD_LIST,
        target: document.body,
        name: 'AutoGradeUIObserver',
        timeout: 30000
    });

    logger.info('[AutoGrade] ========== INITIALIZATION COMPLETE (observer running) ==========');
}