// src/gradebook/lmgbMasteryColors.js
/**
 * Learning Mastery Gradebook (LMGB) mastery colors
 *
 * For mastery scales with more than 5 ratings, Canvas's LMGB loses its
 * colors. This module restores them:
 *   1. Colors each outcome score cell as a pill.
 *   2. Replaces the mastery-distribution chart with a colored bar.
 *   3. Adds a mouse + keyboard tooltip (rating, score, count, percent).
 *
 * Colors come from an opt-in palette (see getOptInPalette) and are applied
 * with the shared classes in src/ui/masteryColorStyles.js.
 *
 * Canvas virtualizes and re-renders cells, so a MutationObserver re-applies
 * the enhancement. Every pass is idempotent.
 *
 * Ported from the loader's "Section D: SCHS Learning Mastery Enhancements".
 */

import { logger } from '../utils/logger.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { createPersistentObserver } from '../utils/observerHelpers.js';
import { LMGB_MASTERY_SCHEME, CUSTOM_MASTERY_PALETTES } from '../config.js';
import { getOptInPalette, getBandIndex } from '../ui/masteryColors.js';
import {
    ensureMasteryColorStyles,
    getBandClassName,
    getMasteryBandClass,
    isBandClassName,
    MASTERY_HIDDEN_ATTR,
} from '../ui/masteryColorStyles.js';
import { LMGB_LOCK_ATTR } from './lmgbOverrideLocks.js';
import { isLegacyLoaderLmgbActive } from './legacyLmgbLoaderGuard.js'; // TEMPORARY — legacy loader guard, see legacyLmgbLoaderGuard.js

const LOG = '[LMGB Colors]';

/** Marks nodes this module created, so the observer can ignore our own writes. */
const OWNED_ATTR = 'data-cg-lmgb-owned';
const TOOLTIP_ID = 'cg-lmgb-mastery-tooltip';
const SCORE_CELL_SELECTOR = 'td[data-col-key^="outcome-"] [data-testid="score-cell-content"]';
const CHART_CELL_SELECTOR = 'td[id^="bar-chart-outcome-"]';
const SCORE_PATTERN = /^-?\d+(\.\d+)?$/;

/** Max outcome IDs per distribution request (keeps the URL a sane length). */
const DISTRIBUTION_BATCH_SIZE = 50;

/** TEMPORARY — legacy loader guard, see legacyLmgbLoaderGuard.js. Re-check for loader Section D shortly after start (it may mark the grid after us). */
const LEGACY_RECHECK_MS = 1500;

let state = null;

function createState(courseId, apiClient, palette, root) {
    return {
        courseId,
        apiClient,
        schemeKey: palette.key,
        bands: palette.bands,
        root,
        observer: null,
        passScheduled: false,
        legacyTimer: null, // TEMPORARY — legacy loader guard, see legacyLmgbLoaderGuard.js
        /** outcomeId → distribution */
        distributions: new Map(),
        /** outcomeIds that failed or returned nothing; not retried until reload */
        unavailable: new Set(),
        /** outcomeIds currently being fetched */
        inFlight: new Set(),
        onScrollOrResize: () => hideTooltip(),
        onKeydown: (e) => { if (e.key === 'Escape') hideTooltip(); },
    };
}

// ════════════════════════════════════════════════════════════════════
// Lifecycle
// ════════════════════════════════════════════════════════════════════

/**
 * Start the LMGB mastery-color enhancement. Caller is responsible for page
 * detection (isGradebookPage() && isLMGBPage()) and the feature flag.
 * Safe to call more than once.
 *
 * @param {Object} [options]
 * @param {string} [options.schemeKey] - Palette key (default: LMGB_MASTERY_SCHEME)
 * @param {Object} [options.customPalettes] - Extra palettes (default: CUSTOM_MASTERY_PALETTES)
 * @returns {boolean} True if the enhancement is running
 */
export function initLmgbMasteryColors(options = {}) {
    if (state) return true;

    const schemeKey = options.schemeKey ?? LMGB_MASTERY_SCHEME;
    const palette = getOptInPalette(schemeKey, options.customPalettes ?? CUSTOM_MASTERY_PALETTES);
    if (!palette) {
        logger.warn(`${LOG} Unknown or empty mastery scheme "${schemeKey}" — not starting`);
        return false;
    }

    const courseId = getCourseId();
    if (!courseId) {
        logger.debug(`${LOG} No course ID — not starting`);
        return false;
    }

    let apiClient;
    try {
        apiClient = new CanvasApiClient();
    } catch (err) {
        logger.warn(`${LOG} Cannot create API client — not starting:`, err);
        return false;
    }

    ensureMasteryColorStyles(palette.key, palette.bands);

    const root = document.getElementById('learning_mastery_gradebook') || document.body;
    state = createState(courseId, apiClient, palette, root);

    state.observer = createPersistentObserver(onMutations, { target: root, name: `${LOG} observer` });
    window.addEventListener('scroll', state.onScrollOrResize, true);
    window.addEventListener('resize', state.onScrollOrResize);
    document.addEventListener('keydown', state.onKeydown);
    state.legacyTimer = setTimeout(schedulePass, LEGACY_RECHECK_MS); // TEMPORARY — legacy loader guard, see legacyLmgbLoaderGuard.js

    logger.info(`${LOG} Enabled (${palette.label})`);
    applyLmgbMasteryColors();
    return true;
}

/**
 * Stop the enhancement and remove everything it added to the page.
 */
export function stopLmgbMasteryColors() {
    if (!state) return;
    const s = state;
    state = null;

    s.observer?.disconnect();
    clearTimeout(s.legacyTimer); // TEMPORARY — legacy loader guard, see legacyLmgbLoaderGuard.js
    window.removeEventListener('scroll', s.onScrollOrResize, true);
    window.removeEventListener('resize', s.onScrollOrResize);
    document.removeEventListener('keydown', s.onKeydown);

    document.querySelectorAll('[data-cg-lmgb-score]').forEach(clearScoreElement);
    document.querySelectorAll(`[${OWNED_ATTR}]`).forEach(el => el.remove());
    document.querySelectorAll(`[${MASTERY_HIDDEN_ATTR}]`).forEach(el => el.removeAttribute(MASTERY_HIDDEN_ATTR));
    document.querySelectorAll('[data-cg-lmgb-chart]').forEach(el => {
        el.classList.remove('cg-mastery-chart-host');
        delete el.dataset.cgLmgbChart;
    });

    logger.debug(`${LOG} Stopped`);
}

/**
 * Run one enhancement pass now. Normally driven by the observer; exported
 * for tests and the debug console.
 *
 * @returns {Promise<void>} Resolves when any distribution fetch has settled
 */
export function applyLmgbMasteryColors() {
    if (!state) return Promise.resolve();

    // TEMPORARY — legacy loader guard, see legacyLmgbLoaderGuard.js. Defer to the loader's Section D if it is running; remove this block with the guard.
    if (isLegacyLoaderLmgbActive()) {
        logger.info(`${LOG} Loader Section D detected — deferring to it`);
        stopLmgbMasteryColors();
        return Promise.resolve();
    }

    applyScoreColors();
    return applyDistributionCharts().catch(err => {
        logger.warn(`${LOG} Distribution chart pass failed:`, err);
    });
}

function onMutations(mutations) {
    if (mutations.every(isOwnMutation)) return;
    schedulePass();
}

/** True when a mutation only involves nodes this module created. */
function isOwnMutation(m) {
    if (m.target instanceof Element && m.target.closest(`[${OWNED_ATTR}]`)) return true;
    const nodes = [...m.addedNodes, ...m.removedNodes];
    return nodes.length > 0 && nodes.every(n => n instanceof Element && n.hasAttribute(OWNED_ATTR));
}

/** Collapse bursts of mutations into one pass per animation frame. */
function schedulePass() {
    if (!state || state.passScheduled) return;
    state.passScheduled = true;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    raf(() => {
        if (!state) return;
        state.passScheduled = false;
        applyLmgbMasteryColors();
    });
}

// ════════════════════════════════════════════════════════════════════
// Score pills
// ════════════════════════════════════════════════════════════════════

function applyScoreColors() {
    const { root, schemeKey, bands } = state;

    root.querySelectorAll(SCORE_CELL_SELECTOR).forEach(cell => {
        const el = cell.querySelector('span span') || cell.querySelector('span') || cell;
        const text = scoreTextOf(cell);
        const score = SCORE_PATTERN.test(text) ? Number(text) : NaN;
        const bandClass = getMasteryBandClass(score, schemeKey, bands);

        if (!bandClass) {
            // Canvas recycled this cell for a blank/non-numeric value
            if (el.dataset.cgLmgbScore !== undefined) clearScoreElement(el);
            return;
        }

        if (el.dataset.cgLmgbScore === String(score) && el.classList.contains(bandClass)) return;

        removeBandClasses(el);
        el.classList.add('cg-mastery-pill', bandClass);
        el.dataset.cgLmgbScore = String(score);
        const band = bands[getBandIndex(score, bands)];
        el.title = band.label ? `${band.label} (${score})` : String(score);
    });
}

/** The cell's score text, ignoring the 🔒 that lmgbOverrideLocks puts after the number. */
function scoreTextOf(cell) {
    const lock = cell.querySelector(`[${LMGB_LOCK_ATTR}]`);
    const text = cell.textContent;
    return (lock ? text.replace(lock.textContent, '') : text).trim();
}

function clearScoreElement(el) {
    removeBandClasses(el);
    el.classList.remove('cg-mastery-pill');
    el.removeAttribute('title');
    delete el.dataset.cgLmgbScore;
}

function removeBandClasses(el) {
    [...el.classList].filter(isBandClassName).forEach(c => el.classList.remove(c));
}

// ════════════════════════════════════════════════════════════════════
// Distribution charts
// ════════════════════════════════════════════════════════════════════

/**
 * Fetch mastery distributions for several outcomes in one request.
 *
 * @param {string} courseId
 * @param {string[]} outcomeIds
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<Object<string, Object>>} outcomeId → distribution
 */
export async function fetchMasteryDistributions(courseId, outcomeIds, apiClient) {
    if (!outcomeIds.length) return {};
    const query = outcomeIds.map(id => `outcome_ids[]=${encodeURIComponent(id)}`).join('&');
    const data = await apiClient.get(
        `/api/v1/courses/${courseId}/outcome_mastery_distribution?${query}`,
        {},
        'fetchMasteryDistributions'
    );
    return data?.outcome_distributions || {};
}

async function applyDistributionCharts() {
    const s = state;
    const toFetch = [];

    for (const { outcomeId, container } of findChartContainers(s.root)) {
        if (container.dataset.cgLmgbChart === outcomeId) continue;
        if (s.unavailable.has(outcomeId)) continue;
        if (s.distributions.has(outcomeId)) {
            renderChart(container, outcomeId, s.distributions.get(outcomeId));
        } else if (!s.inFlight.has(outcomeId)) {
            toFetch.push(outcomeId);
        }
    }

    if (!toFetch.length) return;

    for (let i = 0; i < toFetch.length; i += DISTRIBUTION_BATCH_SIZE) {
        const batch = toFetch.slice(i, i + DISTRIBUTION_BATCH_SIZE);
        batch.forEach(id => s.inFlight.add(id));
        try {
            const result = await fetchMasteryDistributions(s.courseId, batch, s.apiClient);
            for (const id of batch) {
                if (result[id]) s.distributions.set(id, result[id]);
                else s.unavailable.add(id);
            }
        } catch (err) {
            // Don't retry on every DOM mutation — wait for a page reload
            batch.forEach(id => s.unavailable.add(id));
            logger.warn(`${LOG} Could not load mastery distribution for outcomes ${batch.join(', ')}:`, err);
        } finally {
            batch.forEach(id => s.inFlight.delete(id));
        }
    }

    // Render what just arrived (containers may have been re-created meanwhile)
    if (state === s) {
        for (const { outcomeId, container } of findChartContainers(s.root)) {
            if (container.dataset.cgLmgbChart === outcomeId) continue;
            if (s.distributions.has(outcomeId)) renderChart(container, outcomeId, s.distributions.get(outcomeId));
        }
    }
}

function findChartContainers(root) {
    const found = [];
    root.querySelectorAll(CHART_CELL_SELECTOR).forEach(td => {
        const outcomeId = td.id.match(/bar-chart-outcome-(\d+)/)?.[1];
        if (!outcomeId) return;
        const container = td.querySelector(`[data-testid="mastery-distribution-chart-cell-${outcomeId}"]`);
        if (container) found.push({ outcomeId, container });
    });
    return found;
}

function renderChart(container, outcomeId, distribution) {
    const bar = buildDistributionBar(distribution, state.schemeKey, state.bands);
    container.dataset.cgLmgbChart = outcomeId;
    if (!bar) return;

    // Hide Canvas's chart rather than deleting React-owned nodes
    [...container.children].forEach(child => {
        if (!child.hasAttribute(OWNED_ATTR)) child.setAttribute(MASTERY_HIDDEN_ATTR, '');
    });
    container.querySelectorAll(`:scope > [${OWNED_ATTR}]`).forEach(el => el.remove());
    container.classList.add('cg-mastery-chart-host');
    container.appendChild(bar);
}

/**
 * Build a colored distribution bar.
 *
 * @param {{ total_students:number, ratings:Array<{points:number, count:number, description?:string}> }} distribution
 * @param {string} schemeKey
 * @param {Array<{min:number, label:string}>} bands - sorted high → low
 * @returns {HTMLElement|null} null when there are no students to show
 */
export function buildDistributionBar(distribution, schemeKey, bands) {
    const total = Number(distribution?.total_students) || 0;
    if (!total) return null;

    const bar = document.createElement('div');
    bar.className = 'cg-mastery-bar';
    bar.setAttribute(OWNED_ATTR, '');

    const ratings = Array.isArray(distribution.ratings) ? distribution.ratings : [];
    for (const rating of ratings) {
        const count = Number(rating.count) || 0;
        if (!count) continue;

        const points = Number(rating.points);
        const percent = (count / total) * 100;
        const bandIndex = Number.isFinite(points) ? getBandIndex(points, bands) : bands.length - 1;
        const label = rating.description || bands[bandIndex].label;

        const seg = document.createElement('div');
        seg.className = `cg-mastery-seg ${getBandClassName(schemeKey, bandIndex)}`;
        seg.style.width = `${percent}%`;
        seg.tabIndex = 0;
        seg.setAttribute('role', 'img');
        seg.dataset.label = label;
        seg.dataset.points = Number.isFinite(points) ? String(points) : '';
        seg.dataset.count = String(count);
        seg.dataset.percent = percent.toFixed(1);
        seg.setAttribute('aria-label',
            `${label}, score ${seg.dataset.points}, ${studentCount(count)}, ${seg.dataset.percent} percent`);

        seg.addEventListener('mouseenter', e => showTooltip(seg, e.clientX, e.clientY));
        seg.addEventListener('mousemove', e => showTooltip(seg, e.clientX, e.clientY));
        seg.addEventListener('mouseleave', hideTooltip);
        seg.addEventListener('focus', () => {
            const r = seg.getBoundingClientRect();
            showTooltip(seg, r.left + r.width / 2, r.bottom);
        });
        seg.addEventListener('blur', hideTooltip);
        seg.addEventListener('click', e => {
            e.stopPropagation();
            showTooltip(seg, e.clientX, e.clientY);
        });

        bar.appendChild(seg);
    }

    return bar;
}

function studentCount(count) {
    return `${count} student${count === 1 ? '' : 's'}`;
}

// ════════════════════════════════════════════════════════════════════
// Tooltip
// ════════════════════════════════════════════════════════════════════

function getTooltip() {
    let tip = document.getElementById(TOOLTIP_ID);
    if (tip) return tip;
    tip = document.createElement('div');
    tip.id = TOOLTIP_ID;
    tip.className = 'cg-mastery-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute(OWNED_ATTR, '');
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
}

function showTooltip(seg, clientX, clientY) {
    const tip = getTooltip();
    const strong = document.createElement('strong');
    strong.textContent = seg.dataset.label || '';
    tip.replaceChildren(
        strong,
        document.createElement('br'),
        document.createTextNode(`Score: ${seg.dataset.points}`),
        document.createElement('br'),
        document.createTextNode(`${studentCount(Number(seg.dataset.count))} (${seg.dataset.percent}%)`)
    );
    tip.hidden = false;

    const x = Math.min(clientX + 12, window.innerWidth - tip.offsetWidth - 10);
    const y = Math.min(clientY + 12, window.innerHeight - tip.offsetHeight - 10);
    tip.style.left = `${Math.max(0, x)}px`;
    tip.style.top = `${Math.max(0, y)}px`;
}

function hideTooltip() {
    const tip = document.getElementById(TOOLTIP_ID);
    if (tip) tip.hidden = true;
}
