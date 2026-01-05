// src/utils/uiHelpers.js
/**
 * UI Helper Functions
 *
 * This module contains UI-related helper functions including:
 * - Elapsed time tracking and display
 * - Last update notice rendering
 * - Gradebook DOM waiting
 */

import { getCourseId } from "./canvas.js";
import { logger } from "./logger.js";

/**
 * Calculate elapsed time since the update started
 * Reads startTime from state machine context
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance
 * @param {Date|number} endTime - End time (default: now)
 * @returns {number} Elapsed time in seconds
 */
export function getElapsedTimeSinceStart(stateMachine, endTime = Date.now()) {
    if (!stateMachine) return 0;

    const context = stateMachine.getContext();
    if (!context.startTime) return 0;

    const startMs = new Date(context.startTime).getTime();
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
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance
 * @param {HTMLElement} box - Banner element to update
 */
export function startElapsedTimer(stateMachine, box) {
    if (!stateMachine || !box) return;

    // Use the inner text node created in showFloatingBanner
    const node = box.querySelector('.floating-banner__text') || box;

    // Kill any existing timer for this banner
    stopElapsedTimer(box);

    const re = /\(Elapsed time:\s*\d+s\)/; // match your current phrasing

    const tick = () => {
        const elapsed = getElapsedTimeSinceStart(stateMachine);
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
