// src/speedgrader/speedgraderAutoGrade.js
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

let initialized = false;
let inFlight = false;
let lastRubricFingerprint = null;

/**
 * Parse SpeedGrader URL to extract IDs
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
 * Get storage (chrome.storage.local with localStorage fallback)
 */
async function getStorage(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || null);
            });
        });
    }
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
}

async function setStorage(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    }
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
 * Get CSRF token from cookie
 */
function getCsrfToken() {
    const cookies = document.cookie.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        const [key, value] = cookie.split('=', 2);
        if (key === '_csrf_token') {
            return decodeURIComponent(value);
        }
    }
    return null;
}

/**
 * Update grade input UI (React-controlled)
 */
function updateGradeInput(score) {
    const input = document.querySelector('input[data-testid="grade-input"]');
    if (!input) return;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

    const applyValue = () => {
        nativeInputValueSetter.call(input, score);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    applyValue();
    setTimeout(applyValue, 700);
}

/**
 * Submit grade to Canvas API
 */
async function submitGrade(courseId, assignmentId, studentId, score) {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        logger.error('[AutoGrade] CSRF token not found');
        return null;
    }

    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;
    const body = `submission[posted_grade]=${encodeURIComponent(score)}`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRF-Token': csrfToken
            },
            body
        });

        if (!response.ok) {
            logger.error('[AutoGrade] Failed to submit grade:', response.status);
            return null;
        }

        const data = await response.json();
        logger.debug('[AutoGrade] Grade submitted successfully:', data.entered_score);
        return data;
    } catch (error) {
        logger.error('[AutoGrade] Error submitting grade:', error);
        return null;
    }
}

/**
 * Fetch submission with rubric assessment
 */
async function fetchSubmission(courseId, assignmentId, studentId) {
    const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?include[]=rubric_assessment`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        return await response.json();
    } catch (error) {
        logger.error('[AutoGrade] Error fetching submission:', error);
        return null;
    }
}

/**
 * Handle rubric submission
 */
async function handleRubricSubmit(courseId, assignmentId, studentId) {
    if (inFlight) {
        logger.trace('[AutoGrade] Already processing, skipping');
        return;
    }

    inFlight = true;

    try {
        const settings = await getSettings(courseId, assignmentId);

        if (!settings.enabled) {
            logger.debug('[AutoGrade] Auto-grade disabled for this assignment');
            inFlight = false;
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 400));

        const submission = await fetchSubmission(courseId, assignmentId, studentId);
        if (!submission || !submission.rubric_assessment) {
            logger.debug('[AutoGrade] No rubric assessment found');
            inFlight = false;
            return;
        }

        const fingerprint = createRubricFingerprint(submission.rubric_assessment);
        if (fingerprint === lastRubricFingerprint) {
            logger.trace('[AutoGrade] Rubric unchanged, skipping');
            inFlight = false;
            return;
        }

        lastRubricFingerprint = fingerprint;

        const score = calculateGrade(submission.rubric_assessment, settings.method);
        logger.debug(`[AutoGrade] Calculated score: ${score} (method: ${settings.method})`);

        const result = await submitGrade(courseId, assignmentId, studentId, score);
        if (result) {
            updateGradeInput(result.entered_score || score);
            updateAssignmentScoreDisplay(result.entered_score || score);
        }
    } finally {
        inFlight = false;
    }
}

/**
 * Hook window.fetch to detect rubric submissions
 */
function hookFetch(courseId, assignmentId, studentId) {
    const originalFetch = window.fetch;

    window.fetch = function(...args) {
        const [url, options] = args;

        const promise = originalFetch.apply(this, args);

        if (typeof url === 'string' && url.includes('/api/graphql') && options?.method === 'POST') {
            promise.then(async (response) => {
                if (!response.ok) return response;

                const body = options.body || '';
                const isRubricSave = body.includes('SaveRubricAssessment') ||
                                    body.includes('rubricAssessment') ||
                                    body.includes('rubric_assessment');

                if (isRubricSave) {
                    logger.debug('[AutoGrade] Detected rubric submission');
                    handleRubricSubmit(courseId, assignmentId, studentId);
                }

                return response;
            });
        }

        if (typeof url === 'string' && url.includes('/api/v1/') && url.includes('/submissions/')) {
            logger.trace('[AutoGrade] Ignoring own submission fetch');
        }

        return promise;
    };
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
    const anchor = document.querySelector('span[data-testid="rubric-assessment-instructor-score"]');
    if (!anchor) {
        logger.trace('[AutoGrade] Instructor score anchor not found, will retry');
        return false;
    }

    if (document.querySelector('[data-cg-autograde-ui]')) {
        return true;
    }

    const settings = await getSettings(courseId, assignmentId);

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
        const newSettings = { ...settings, enabled: toggle.checked };
        await saveSettings(courseId, assignmentId, newSettings);
        logger.debug('[AutoGrade] Settings updated:', newSettings);
    });

    methodSelect.addEventListener('change', async () => {
        const newSettings = { ...settings, method: methodSelect.value };
        await saveSettings(courseId, assignmentId, newSettings);
        logger.debug('[AutoGrade] Settings updated:', newSettings);
    });

    anchor.parentElement.appendChild(container);
    logger.debug('[AutoGrade] UI controls created');
    return true;
}

/**
 * Initialize auto-grade module
 */
export async function initSpeedGraderAutoGrade() {
    if (initialized) return;
    initialized = true;

    logger.debug('[AutoGrade] Initializing SpeedGrader auto-grade module');

    const roleGroup = getUserRoleGroup();
    if (roleGroup !== 'teacher_like') {
        logger.debug(`[AutoGrade] Skipping - user is ${roleGroup}, not teacher_like`);
        return;
    }

    const { courseId, assignmentId, studentId } = parseSpeedGraderUrl();
    if (!courseId || !assignmentId || !studentId) {
        logger.warn('[AutoGrade] Missing required IDs from URL:', { courseId, assignmentId, studentId });
        return;
    }

    logger.debug(`[AutoGrade] Parsed IDs: course=${courseId}, assignment=${assignmentId}, student=${studentId}`);

    const apiClient = new CanvasApiClient();
    let snapshot = getCourseSnapshot(courseId);

    if (!snapshot) {
        logger.debug('[AutoGrade] No snapshot found, populating...');
        const courseName = document.title.split(':')[0]?.trim() || 'Unknown Course';
        snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
    }

    if (!snapshot) {
        logger.warn('[AutoGrade] Failed to get course snapshot');
        return;
    }

    if (snapshot.model !== 'standards') {
        logger.debug(`[AutoGrade] Skipping - course is ${snapshot.model} (reason: ${snapshot.modelReason})`);
        return;
    }

    logger.info('[AutoGrade] Initializing for standards-based course');

    hookFetch(courseId, assignmentId, studentId);

    const tryCreateUI = async () => {
        const success = await createUIControls(courseId, assignmentId);
        if (!success) {
            setTimeout(tryCreateUI, 1000);
        }
    };

    setTimeout(tryCreateUI, 500);
}