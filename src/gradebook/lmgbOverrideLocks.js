// src/gradebook/lmgbOverrideLocks.js
/**
 * Learning Mastery Gradebook (LMGB) — locked Current Score override marker
 *
 * Adds a read-only 🔒 to a student's Current Score cell when the teacher has
 * locked a Current Score override in Mastery Outlook, so it's visible that
 * outcome saves and Update Current Score will leave that score alone.
 *
 * Cells are found by Canvas's `data-testid="student-outcome-score-{userId}-{outcomeId}"`
 * (never by name). Lock data comes from a localStorage snapshot (instant), then
 * the Mastery Outlook cache file.
 * Canvas virtualizes and re-renders cells, so a MutationObserver re-applies the
 * marker; every pass is idempotent. Nothing here writes to Canvas.
 */

import { logger } from '../utils/logger.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { createPersistentObserver } from '../utils/observerHelpers.js';
import {
    readMasteryOutlookCache, lockedCurrentScoreStudentsFrom, loadLmgbLockSnapshot, saveLmgbLockSnapshot,
} from '../masteryOutlook/masteryOutlookCacheService.js';

const LOG = '[LMGB Locks]';
/** Marks the 🔒 badges this module adds (lmgbMasteryColors ignores them when reading scores). */
export const LMGB_LOCK_ATTR = 'data-cg-lmgb-lock';
const STYLE_ID = 'cg-lmgb-lock-styles';
const CELL_TESTID_PREFIX = 'student-outcome-score-';

let state = null;

/**
 * Start marking the LMGB. Shows the last-known locks from localStorage right
 * away (saved by Mastery Outlook / the previous LMGB visit), then confirms them
 * against the Mastery Outlook cache file and updates the markers and snapshot.
 * Does nothing when nothing is locked. Safe to call more than once.
 *
 * @returns {Promise<boolean>} True if the marker is running
 */
export async function initLmgbOverrideLocks() {
    if (state) return true;

    const courseId = getCourseId();
    if (!courseId) return false;

    const snapshot = loadLmgbLockSnapshot(courseId);
    if (snapshot?.locks.size) start(snapshot.locks, snapshot.avgOutcomeId);

    let cache;
    try {
        cache = await readMasteryOutlookCache(courseId, new CanvasApiClient());
    } catch (err) {
        logger.warn(`${LOG} Could not read Mastery Outlook locks:`, err);
        return Boolean(state);
    }
    if (!cache) return Boolean(state);   // read failed or no cache — keep what's shown

    saveLmgbLockSnapshot(courseId, cache);
    const avgOutcomeId = cache.avg_assignment?.avg_outcome_id;
    const locks = lockedCurrentScoreStudentsFrom(cache);
    if (!avgOutcomeId || locks.size === 0) {
        logger.debug(`${LOG} No locked Current Score overrides`);
        stopLmgbOverrideLocks();
        return false;
    }

    if (state) {
        state.locks = locks;
        state.avgOutcomeId = String(avgOutcomeId);
        applyLmgbOverrideLocks(locks, avgOutcomeId);
    } else {
        start(locks, avgOutcomeId);
    }
    return true;
}

function start(locks, avgOutcomeId) {
    ensureLockStyles();
    const root = document.getElementById('learning_mastery_gradebook') || document.body;
    state = { locks, avgOutcomeId: String(avgOutcomeId), passScheduled: false, observer: null };
    state.observer = createPersistentObserver(onMutations, { target: root, name: `${LOG} observer` });
    logger.info(`${LOG} Marking ${locks.size} locked Current Score override(s)`);
    applyLmgbOverrideLocks(locks, avgOutcomeId);
}

/**
 * Stop marking and remove every 🔒 this module added.
 */
export function stopLmgbOverrideLocks() {
    state?.observer?.disconnect();
    state = null;
    document.querySelectorAll(`[${LMGB_LOCK_ATTR}]`).forEach(el => el.remove());
}

/**
 * Sync the 🔒 badges with `locks`: add one right after the score in each locked
 * student's Current Score pill, and remove badges from cells that are no longer
 * locked (including cells Canvas recycled for another student). Idempotent;
 * exported for tests and the debug console.
 *
 * @param {Map<string, { score: number, note: string, at: string|null }>} locks
 * @param {string|number} avgOutcomeId - the Current Score outcome
 * @param {ParentNode} [root]
 * @returns {number} badges added in this pass
 */
export function applyLmgbOverrideLocks(locks, avgOutcomeId, root = document) {
    const lockedTestIds = new Set([...locks.keys()].map(uid => `${CELL_TESTID_PREFIX}${uid}-${avgOutcomeId}`));
    root.querySelectorAll(`[${LMGB_LOCK_ATTR}]`).forEach(badge => {
        const testId = badge.closest(`[data-testid^="${CELL_TESTID_PREFIX}"]`)?.dataset.testid;
        if (!lockedTestIds.has(testId)) badge.remove();
    });

    let added = 0;
    for (const [userId, lock] of locks) {
        const cell = root.querySelector(`[data-testid="${CELL_TESTID_PREFIX}${userId}-${avgOutcomeId}"]`);
        if (!cell || cell.querySelector(`[${LMGB_LOCK_ATTR}]`)) continue;
        const badge = document.createElement('span');
        badge.className = 'cg-lmgb-lock';
        badge.setAttribute(LMGB_LOCK_ATTR, '');
        badge.title = lockTooltip(lock);
        badge.textContent = '🔒';
        // Right after the number, inside the pill's flex row; else at the end of the cell.
        const textEl = [...cell.querySelectorAll('[data-testid="score-cell-content"] span')]
            .find(el => el.children.length === 0 && el.textContent.trim());
        if (textEl) textEl.after(badge);
        else cell.appendChild(badge);
        added++;
    }
    return added;
}

/**
 * Tooltip text for a locked override.
 * @param {{ score: number, note: string, at: string|null }} lock
 * @returns {string}
 */
export function lockTooltip(lock) {
    const at = lock.at ? new Date(lock.at) : null;
    const date = at && !isNaN(at.getTime())
        ? at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
    return [
        'Current Score override locked in Mastery Outlook',
        Number(lock.score).toFixed(2),
        date ? `set ${date}` : '',
        lock.note ? `Note: ${lock.note}` : '',
    ].filter(Boolean).join(' · ');
}

function onMutations(mutations) {
    if (mutations.every(isOwnMutation)) return;
    if (!state || state.passScheduled) return;
    state.passScheduled = true;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    raf(() => {
        if (!state) return;
        state.passScheduled = false;
        applyLmgbOverrideLocks(state.locks, state.avgOutcomeId);
    });
}

/** True when a mutation only adds or removes our own badges. */
function isOwnMutation(m) {
    const nodes = [...m.addedNodes, ...m.removedNodes];
    return nodes.length > 0 && nodes.every(n => n instanceof Element && n.hasAttribute(LMGB_LOCK_ATTR));
}

function ensureLockStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '.cg-lmgb-lock { margin-left: 0.3em; font-size: 1em; line-height: 1; cursor: help; }';
    document.head.appendChild(style);
}
