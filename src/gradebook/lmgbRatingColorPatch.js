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
 * This wraps the page's XHR and fetch for `/api/v1/courses/:id/outcome_rollups`
 * responses and adds a color to each `linked.outcomes[].ratings[]` entry that
 * has none. Scores and every other field are left as they are; nothing is
 * written to Canvas. Colors come from the configured mastery palette, so Canvas's
 * own pills match the LMGB mastery colors.
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

let installed = false;

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

function colorForPoints(points, bands) {
    if (!bands?.length || !Number.isFinite(points)) return FALLBACK_RATING_COLOR;
    const band = bands[getBandIndex(points, bands)];
    return String(band?.bg ?? FALLBACK_RATING_COLOR).replace(/^#/, '');
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
    const prefixed = text.startsWith(JSON_PREFIX);
    try {
        const json = JSON.parse(prefixed ? text.slice(JSON_PREFIX.length) : text);
        const { changed } = addMissingRatingColors(json, bands);
        if (!changed) return text;
        logger.debug(`${LOG} Added ${changed} rating color(s)`);
        return (prefixed ? JSON_PREFIX : '') + JSON.stringify(json);
    } catch {
        return text;
    }
}

/**
 * Install the XHR + fetch wrappers. Call on the LMGB page as early as possible
 * (before Canvas requests rollups). Safe to call more than once.
 *
 * @param {Object} [options]
 * @param {string} [options.schemeKey] - palette key (default LMGB_MASTERY_SCHEME)
 * @returns {boolean} true if installed by this call
 */
export function installLmgbRatingColorPatch(options = {}) {
    if (installed) return false;
    installed = true;

    const palette = getOptInPalette(options.schemeKey ?? LMGB_MASTERY_SCHEME, CUSTOM_MASTERY_PALETTES);
    const bands = palette?.bands ?? null;

    patchXhr(bands);
    patchFetch(bands);
    logger.info(`${LOG} Installed (${palette ? palette.label : 'neutral color'})`);
    return true;
}

function patchXhr(bands) {
    const proto = window.XMLHttpRequest?.prototype;
    if (!proto) return;
    const textDesc = Object.getOwnPropertyDescriptor(proto, 'responseText');
    const respDesc = Object.getOwnPropertyDescriptor(proto, 'response');
    const originalOpen = proto.open;

    proto.open = function (method, url, ...rest) {
        if (isRollupsUrl(url) && textDesc?.get) {
            let cached = null;
            const patched = () => {
                if (this.readyState !== 4) return textDesc.get.call(this);
                if (cached === null) cached = patchRollupsText(textDesc.get.call(this), bands);
                return cached;
            };
            Object.defineProperty(this, 'responseText', { configurable: true, get: patched });
            if (respDesc?.get) {
                Object.defineProperty(this, 'response', {
                    configurable: true,
                    get: () => {
                        const type = this.responseType;
                        if (type === '' || type === 'text') return patched();
                        if (type === 'json' && this.readyState === 4) {
                            try { return JSON.parse(patched().replace(JSON_PREFIX, '')); } catch { /* fall through */ }
                        }
                        return respDesc.get.call(this);
                    },
                });
            }
        }
        return originalOpen.call(this, method, url, ...rest);
    };
}

function patchFetch(bands) {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;

    window.fetch = async function (input, init) {
        const res = await originalFetch.call(this, input, init);
        const url = typeof input === 'string' ? input : input?.url;
        if (!res.ok || !isRollupsUrl(url)) return res;
        try {
            const text = await res.clone().text();
            const patched = patchRollupsText(text, bands);
            if (patched === text) return res;
            return new Response(patched, { status: res.status, statusText: res.statusText, headers: res.headers });
        } catch (err) {
            logger.debug(`${LOG} Could not patch fetch response:`, err?.message);
            return res;
        }
    };
}

/** Test helper: allow a fresh install. */
export function _resetLmgbRatingColorPatchForTests() {
    installed = false;
}
