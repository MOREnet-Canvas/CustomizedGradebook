// src/utils/uiHelpers.js
/**
 * UI Helper Functions
 *
 * This module contains UI-related helper functions including:
 * - Elapsed time tracking and display
 * - Last update notice rendering
 * - Status pill creation
 * - Gradebook DOM waiting
 */

import { getCourseId } from "./canvas.js";
import { k } from "./keys.js";
import { showFloatingBanner } from "../ui/banner.js";
import { makeButton } from "../ui/buttons.js";
import { logger } from "./logger.js";

/**
 * Calculate elapsed time since the update started
 * @param {Date|number} endTime - End time (default: now)
 * @returns {number} Elapsed time in seconds
 */
export function getElapsedTimeSinceStart(endTime = Date.now()) {
    const start = localStorage.getItem(`startTime_${getCourseId()}`);
    if (!start) return 0;

    const startMs = new Date(start).getTime();
    const endMs = (endTime instanceof Date) ? endTime.getTime() : new Date(endTime).getTime();

    return Math.floor((endMs - startMs) / 1000); // seconds
}

/**
 * Format duration in seconds as "Xm Ys" or "Ys"
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(seconds) {
    if (seconds == null || isNaN(seconds)) return "N/A";
    seconds = Math.max(0, Math.floor(Number(seconds)));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Start a live elapsed time display in a banner
 * Updates the banner text every second with current elapsed time
 * @param {string} courseId - Course ID
 * @param {HTMLElement} box - Banner element to update
 */
export function startElapsedTimer(courseId, box) {
    // Use the inner text node created in showFloatingBanner
    const node = box.querySelector('.floating-banner__text') || box;

    // Kill any existing timer for this banner
    stopElapsedTimer(box);

    const re = /\(Elapsed time:\s*\d+s\)/; // match your current phrasing

    const tick = () => {
        const elapsed = getElapsedTimeSinceStart(); // already per-course via startTime_${getCourseId()}
        const current = node.textContent || "";

        if (re.test(current)) {
            node.textContent = current.replace(re, `(Elapsed time: ${elapsed}s)`);
        } else {
            // If message doesn't have elapsed yet, append it once
            node.textContent = current.trim().length
                ? `${current} (Elapsed time: ${elapsed}s)`
                : `(Elapsed time: ${elapsed}s)`;
        }
    };

    tick(); // show immediately
    box._elapsedTimerId = setInterval(tick, 1000);
}

/**
 * Stop the elapsed time display timer
 * @param {HTMLElement} box - Banner element with timer
 */
export function stopElapsedTimer(box) {
    if (box && box._elapsedTimerId) {
        clearInterval(box._elapsedTimerId);
        delete box._elapsedTimerId;
    }
}

/**
 * Render a "last update" notice showing timestamp and duration
 * @param {HTMLElement} container - Container element to render notice in
 * @param {string} courseId - Course ID
 */
export function renderLastUpdateNotice(container, courseId) {
    let row = container.querySelector('#avg-last-update');
    if (!row) {
        row = document.createElement('div');
        row.id = 'avg-last-update';
        row.style.fontSize = '12px';
        row.style.marginTop = '4px';
        row.style.opacity = '0.8';
        container.appendChild(row);
    }

    const lastAt = localStorage.getItem(`lastUpdateAt_${courseId}`);
    const durSec = parseInt(localStorage.getItem(`duration_${courseId}`), 10);
    const formatDuration = (s) => Number.isFinite(s) ? `${Math.floor(s / 60)}m ${s % 60}s` : 'N/A';

    row.textContent = lastAt
        ? `Last update: ${new Date(lastAt).toLocaleString()} | Duration: ${formatDuration(durSec)}`
        : `Last update: none yet`;
}

/**
 * Wait for the gradebook page and toolbar to be ready
 * @param {Function} callback - Function to call when ready, receives toolbar element
 */
export function waitForGradebookAndToolbar(callback) {
    let attempts = 0;
    const intervalId = setInterval(() => {
        const onGradebookPage = window.location.pathname.includes('/gradebook');
        const documentReady = document.readyState === 'complete';
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



/**
 * Create a "Show Status" pill button that can restore the banner
 * This is shown when the user dismisses the banner but an update is still in progress
 * @param {string} courseId - Course ID
 */
export function ensureStatusPill(courseId) {
    if (document.getElementById('avg-status-pill')) return;

    // Import these functions dynamically to avoid circular dependencies
    // They will be available when this function is called
    const safeParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

    // Find the button wrapper where the main button is located
    const buttonWrapper = document.querySelector('#update-scores-button')?.parentElement;
    if (!buttonWrapper) {
        // Fallback to old behavior if button wrapper not found
        const pill = document.createElement('button');
        pill.id = 'avg-status-pill';
        pill.textContent = 'Show status';
        Object.assign(pill.style, {
            position: 'fixed', bottom: '16px', right: '16px',
            padding: '6px 10px', borderRadius: '16px', border: '1px solid #ccc',
            background: '#fff', cursor: 'pointer', zIndex: 10000
        });

        pill.onclick = () => {
            pill.remove();
            localStorage.setItem(k('bannerDismissed', getCourseId()), 'false');
            const text = localStorage.getItem(k('bannerLast', getCourseId())) || 'Working';
            showFloatingBanner({ courseId: getCourseId(), text });
        };

        document.body.appendChild(pill);
        return;
    }

    // Create the status pill button to match existing UI
    const pill = makeButton({
        label: 'Show Status',
        id: 'avg-status-pill',
        tooltip: 'Show last update status',
        onClick: async () => {
            pill.remove();
            localStorage.setItem(k('bannerDismissed', getCourseId()), 'false');

            // Check if there's an active process that needs dynamic updating
            const courseId = getCourseId();
            const inProgress = localStorage.getItem(`updateInProgress_${courseId}`) === "true";
            const verificationPending = localStorage.getItem(`verificationPending_${courseId}`) === "true";
            const progressId = localStorage.getItem(`progressId_${courseId}`);
            const outcomeId = localStorage.getItem(`outcomeId_${courseId}`);
            const expectedAverages = safeParse(localStorage.getItem(`expectedAverages_${courseId}`));

            // Import these dynamically to avoid circular dependencies at module load time
            const { waitForBulkGrading } = await import("../services/gradeSubmission.js");
            const { verifyUIScores } = await import("../services/verification.js");

            // If there's an active process, resume with dynamic updating
            if (inProgress && progressId) {
                const box = showFloatingBanner({ text: "Resuming: checking upload status" });
                await waitForBulkGrading(box);
                return;
            }

            if (verificationPending && courseId && outcomeId && Array.isArray(expectedAverages)) {
                const box = showFloatingBanner({ text: "Verifying updated scores" });
                try {
                    await verifyUIScores(courseId, expectedAverages, outcomeId, box);
                    box.setText(`All ${expectedAverages.length} scores verified!`);
                } catch (e) {
                    console.warn("Verification on resume failed:", e);
                    box.setText("Verification failed. You can try updating again.");
                }
                return;
            }

            // Otherwise, just show the last static message
            const text = localStorage.getItem(k('bannerLast', getCourseId())) || 'Working';
            showFloatingBanner({ text });
        },
        type: "secondary"
    });

    // Style the pill to be smaller and positioned above the main button
    pill.style.fontSize = '11px';
    pill.style.padding = '4px 8px';
    pill.style.marginBottom = '4px';
    pill.style.marginLeft = '0';

    // Insert the pill at the top of the button wrapper (above the main button)
    buttonWrapper.insertBefore(pill, buttonWrapper.firstChild);
}
