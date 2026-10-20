// src/gradebook/lmgbOverrideLocks.js
/**
 * Learning Mastery Gradebook (LMGB) — locked Current Score override marker
 *
 * Adds a read-only 🔒 to a student's Current Score cell when the teacher has
 * locked a Current Score override in Mastery Outlook, so it's visible that
 * outcome saves and Update Current Score will leave that score alone.
 *
 * Cells are found by Canvas's `data-testid="student-outcome-score-{userId}-{outcomeId}"`
 * (never by name). Lock data is read once from the Mastery Outlook cache.
 * Canvas virtualizes and re-renders cells, so a MutationObserver re-applies the
 * marker; every pass is idempotent. Nothing here writes to Canvas.
 */

import { logger } from '../utils/logger.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { createPersistentObserver } from '../utils/observerHelpers.js';
import { readMasteryOutlookCache, lockedCurrentScoreStudentsFrom } from '../masteryOutlook/masteryOutlookCacheService.js';

const LOG = '[LMGB Locks]';
const LOCK_ATTR = 'data-cg-lmgb-lock';
const STYLE_ID = 'cg-lmgb-lock-styles';

let state = null;

/**
 * Read the Mastery Outlook locks and start marking the LMGB. Does nothing when
 * there's no cache, no Current Score setup, or no locked overrides.
 * Safe to call more than once.
 *
 * @returns {Promise<boolean>} True if the marker is running
 */
export async function initLmgbOverrideLocks() {
    if (state) return true;

    const courseId = getCourseId();
    if (!courseId) return false;

    let cache;
    try {
        cache = await readMasteryOutlookCache(courseId, new CanvasApiClient());
    } catch (err) {
        logger.warn(`${LOG} Could not read Mastery Outlook locks:`, err);
        return false;
    }

    const avgOutcomeId = cache?.avg_assignment?.avg_outcome_id;
    const locks = lockedCurrentScoreStudentsFrom(cache);
    if (!avgOutcomeId || locks.size === 0) {
        logger.debug(`${LOG} No locked Current Score overrides — not starting`);
        return false;
    }
    if (state) return true;   // another init finished while the cache was loading

    ensureLockStyles();
    const root = document.getElementById('learning_mastery_gradebook') || document.body;
    state = { locks, avgOutcomeId: String(avgOutcomeId), passScheduled: false, observer: null };
    state.observer = createPersistentObserver(onMutations, { target: root, name: `${LOG} observer` });

    logger.info(`${LOG} Marking ${locks.size} locked Current Score override(s)`);
    applyLmgbOverrideLocks(locks, avgOutcomeId);
    return true;
}

/**
 * Stop marking and remove every 🔒 this module added.
 */
export function stopLmgbOverrideLocks() {
    state?.observer?.disconnect();
    state = null;
    document.querySelectorAll(`[${LOCK_ATTR}]`).forEach(el => el.remove());
}

/**
 * Add the 🔒 to each locked student's Current Score cell currently on the page.
 * Idempotent; exported for tests and the debug console.
 *
 * @param {Map<string, { score: number, note: string, at: string|null }>} locks
 * @param {string|number} avgOutcomeId - the Current Score outcome
 * @param {ParentNode} [root]
 * @returns {number} badges added in this pass
 */
export function applyLmgbOverrideLocks(locks, avgOutcomeId, root = document) {
    let added = 0;
    for (const [userId, lock] of locks) {
        const cell = root.querySelector(`[data-testid="student-outcome-score-${userId}-${avgOutcomeId}"]`);
        if (!cell || cell.querySelector(`[${LOCK_ATTR}]`)) continue;
        const badge = document.createElement('span');
        badge.className = 'cg-lmgb-lock';
        badge.setAttribute(LOCK_ATTR, '');
        badge.title = lockTooltip(lock);
        badge.textContent = '🔒';
        // Outside [data-testid="score-cell-content"]: lmgbMasteryColors reads that text as the score.
        cell.appendChild(badge);
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
    return nodes.length > 0 && nodes.every(n => n instanceof Element && n.hasAttribute(LOCK_ATTR));
}

function ensureLockStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        [data-testid^="student-outcome-score-"]:has(> [${LOCK_ATTR}]) { position: relative; }
        .cg-lmgb-lock { position: absolute; top: 1px; right: 2px; font-size: 0.75em; line-height: 1; cursor: help; }`;
    document.head.appendChild(style);
}
