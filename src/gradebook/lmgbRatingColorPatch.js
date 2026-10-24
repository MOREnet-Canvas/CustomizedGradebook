// src/gradebook/lmgbRatingColorPatch.js
/**
 * LMGB workaround: give outcome ratings a color so Canvas shows the scores.
 *
 * Canvas's new Learning Mastery Gradebook keeps a student's score only when the
 * matching rating has a `color`. Canvas's server never assigns default colors
 * to scales with more than 6 ratings ("Anything larger than 6 ratings will use
 * numbers" — LearningOutcome#meets_color_criteria), so outcomes on a 7+ rating
 * scale (e.g. Sedalia's 9 ratings) show 0 for every student.
 *
 * This adds a color to each `linked.outcomes[].ratings[]` entry that has none in
 * `/api/v1/courses/:id/outcome_rollups` responses. Scores and every other field
 * are left as they are; nothing is written to Canvas. Colors come from the
 * configured mastery palette, so Canvas's own pills match the LMGB mastery colors.
 *
 * Timing: the loaders insert this bundle as an async script, so Canvas may
 * request rollups before it runs. Two safeguards:
 *   - XHR is patched on the prototype (by responseURL), so a request Canvas
 *     started before install but reads after it is still fixed.
 *   - If a rollups response was already read unpatched and its ratings lack
 *     colors, the page reloads once (guarded) — the bundle is cached by then.
 *
 * Remove once Instructure fixes the LMGB (ratings without color should still
 * show their score).
 */

import { logger } from '../utils/logger.js';
import { LMGB_MASTERY_SCHEME, CUSTOM_MASTERY_PALETTES } from '../config.js';
import { getOptInPalette, getBandIndex } from '../ui/masteryColors.js';

const LOG = '[LMGB RatingColors]';
const ROLLUPS_URL = /\/api\/v1\/courses\/\d+\/outcome_rollups(?:[?#]|$)/;
const JSON_PREFIX = 'while(1);';
/** Used when no mastery palette is configured. Canvas colors are hex without '#'. */
export const FALLBACK_RATING_COLOR = '6B7780';
/** Wait this long after install before deciding a response was missed. */
export const MISSED_CHECK_DELAY_MS = 1500;
/** No second recovery reload of the same page within this window. */
export const RELOAD_GUARD_MS = 60000;
const RELOAD_KEY_PREFIX = 'cg_lmgb_color_reload:';

let state = null;

/**
 * @param {string} url
 * @returns {boolean} true for an outcome_rollups request (not the course aggregate)
 */
export function isRollupsUrl(url) {
    const s = String(url ?? '');
    return ROLLUPS_URL.test(s) && !/[?&]aggregate=/.test(s);
}

/**
 * Add a color to every rating that has none. Mutates and returns `json`.
 *
 * @param {Object} json - outcome_rollups response
 * @param {Array<{min:number, bg:string}>|null} bands - palette bands (high → low), or null
 * @returns {{ json: Object, changed: number }}
 */
export function addMissingRatingColors(json, bands) {
    let changed = 0;
    for (const outcome of json?.linked?.outcomes ?? []) {
        for (const rating of outcome?.ratings ?? []) {
            if (!rating || rating.color) continue;
            rating.color = colorForPoints(Number(rating.points), bands);
            changed++;
        }
    }
    return { json, changed };
}

/**
 * @param {Object} json - outcome_rollups response
 * @returns {boolean} true when some rating has no color (Canvas would show 0s)
 */
export function hasUncoloredRatings(json) {
    return (json?.linked?.outcomes ?? []).some(o => (o?.ratings ?? []).some(r => r && !r.color));
}

function colorForPoints(points, bands) {
    if (!bands?.length || !Number.isFinite(points)) return FALLBACK_RATING_COLOR;
    const band = bands[getBandIndex(points, bands)];
    return String(band?.bg ?? FALLBACK_RATING_COLOR).replace(/^#/, '');
}

function parseJson(text) {
    return JSON.parse(text.startsWith(JSON_PREFIX) ? text.slice(JSON_PREFIX.length) : text);
}

/**
 * Patch a raw response body. Returns the original text when nothing changes or
 * the body isn't JSON.
 *
 * @param {string} text
 * @param {Array|null} bands
 * @returns {string}
 */
export function patchRollupsText(text, bands) {
    if (typeof text !== 'string' || !text) return text;
    try {
        const json = parseJson(text);
        const { changed } = addMissingRatingColors(json, bands);
        if (!changed) return text;
        logger.debug(`${LOG} Added ${changed} rating color(s)`);
        return (text.startsWith(JSON_PREFIX) ? JSON_PREFIX : '') + JSON.stringify(json);
    } catch {
        return text;
    }
}

/**
 * Install the XHR + fetch patches and schedule the missed-response check. Call
 * on the LMGB page as early as possible. Safe to call more than once.
 *
 * @param {Object} [options]
 * @param {string} [options.schemeKey] - palette key (default LMGB_MASTERY_SCHEME)
 * @param {Function} [options.reload] - page reload (default location.reload)
 * @returns {boolean} true if installed by this call
 */
export function installLmgbRatingColorPatch(options = {}) {
    if (state) return false;

    const palette = getOptInPalette(options.schemeKey ?? LMGB_MASTERY_SCHEME, CUSTOM_MASTERY_PALETTES);
    state = {
        bands: palette?.bands ?? null,
        installedAt: performance.now(),
        servedUrls: new Set(),
        restore: [],
        originalFetch: window.fetch,
        checkTimer: null,
    };

    patchXhr();
    patchFetch();
    state.checkTimer = setTimeout(
        () => recoverMissedRollups({ reload: options.reload }).catch(() => {}),
        MISSED_CHECK_DELAY_MS
    );

    logger.info(`${LOG} Installed (${palette ? palette.label : 'neutral color'})`);
    return true;
}

// ════════════════════════════════════════════════════════════════════
// XHR — patched on the prototype so in-flight requests are covered too
// ════════════════════════════════════════════════════════════════════

function patchXhr() {
    const proto = window.XMLHttpRequest?.prototype;
    const textDesc = proto && Object.getOwnPropertyDescriptor(proto, 'responseText');
    const respDesc = proto && Object.getOwnPropertyDescriptor(proto, 'response');
    if (!textDesc?.get) return;

    const cache = new WeakMap();   // xhr → { raw, out }
    const isDoneRollups = xhr => xhr.readyState === 4 && isRollupsUrl(xhr.responseURL);
    const patchedText = (xhr) => {
        const raw = textDesc.get.call(xhr);
        if (!isDoneRollups(xhr)) return raw;
        state?.servedUrls.add(xhr.responseURL);
        const hit = cache.get(xhr);
        if (hit && hit.raw === raw) return hit.out;
        const out = patchRollupsText(raw, state?.bands ?? null);
        cache.set(xhr, { raw, out });
        return out;
    };

    Object.defineProperty(proto, 'responseText', {
        configurable: true, enumerable: textDesc.enumerable,
        get() { return patchedText(this); },
    });
    state.restore.push(() => Object.defineProperty(proto, 'responseText', textDesc));

    if (respDesc?.get) {
        Object.defineProperty(proto, 'response', {
            configurable: true, enumerable: respDesc.enumerable,
            get() {
                const type = this.responseType;
                if (type === '' || type === 'text') return patchedText(this);
                const value = respDesc.get.call(this);
                if (type === 'json' && value && isDoneRollups(this)) {
                    state?.servedUrls.add(this.responseURL);
                    addMissingRatingColors(value, state?.bands ?? null);
                }
                return value;
            },
        });
        state.restore.push(() => Object.defineProperty(proto, 'response', respDesc));
    }
}

// ════════════════════════════════════════════════════════════════════
// fetch
// ════════════════════════════════════════════════════════════════════

function patchFetch() {
    const originalFetch = state.originalFetch;
    if (typeof originalFetch !== 'function') return;

    window.fetch = async function (input, init) {
        const res = await originalFetch.call(this, input, init);
        const url = typeof input === 'string' ? input : input?.url;
        if (!res.ok || !isRollupsUrl(url)) return res;
        try {
            state?.servedUrls.add(res.url || url);
            const text = await res.clone().text();
            const patched = patchRollupsText(text, state?.bands ?? null);
            if (patched === text) return res;
            return new Response(patched, { status: res.status, statusText: res.statusText, headers: res.headers });
        } catch (err) {
            logger.debug(`${LOG} Could not patch fetch response:`, err?.message);
            return res;
        }
    };
    state.restore.push(() => { window.fetch = originalFetch; });
}

// ════════════════════════════════════════════════════════════════════
// Missed-response recovery
// ════════════════════════════════════════════════════════════════════

/**
 * If Canvas read a rollups response before the patch was installed (never
 * served by the patch) and that response has uncolored ratings, reload the page
 * once. Exported for tests.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.reload] - default location.reload
 * @param {Storage} [opts.storage] - default sessionStorage
 * @returns {Promise<boolean>} true if a reload was triggered
 */
export async function recoverMissedRollups({ reload, storage } = {}) {
    if (!state) return false;
    const doReload = reload ?? (() => window.location.reload());
    const store = storage ?? window.sessionStorage;

    const missed = performance.getEntriesByType('resource')
        .filter(e => isRollupsUrl(e.name) && e.responseEnd > 0 && e.responseEnd <= state.installedAt)
        .filter(e => !state.servedUrls.has(e.name));
    if (!missed.length) return false;

    let needsFix = false;
    try {
        const res = await state.originalFetch.call(window, missed[0].name, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        });
        needsFix = res.ok && hasUncoloredRatings(parseJson(await res.text()));
    } catch (err) {
        logger.debug(`${LOG} Could not re-check rollups:`, err?.message);
        return false;
    }
    if (!needsFix) return false;

    const key = RELOAD_KEY_PREFIX + window.location.pathname + window.location.search;
    const last = Number(store?.getItem(key) ?? 0);
    if (last && Date.now() - last < RELOAD_GUARD_MS) {
        logger.warn(`${LOG} Scores loaded before the fix and a reload already ran — refresh if the LMGB shows 0s`);
        return false;
    }

    logger.info(`${LOG} Scores loaded before the fix — reloading once`);
    try { store?.setItem(key, String(Date.now())); } catch { /* storage full/blocked */ }
    doReload();
    return true;
}

/** Test helper: undo the patches and allow a fresh install. */
export function _resetLmgbRatingColorPatchForTests() {
    if (!state) return;
    clearTimeout(state.checkTimer);
    state.restore.reverse().forEach(fn => fn());
    state = null;
}
