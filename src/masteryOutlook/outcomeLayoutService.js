// src/masteryOutlook/outcomeLayoutService.js
/**
 * Outcome layout — the teacher's outcome order and custom outcome names.
 *
 * Stored on the Mastery Dashboard wiki page's #mastery-dashboard-root element,
 * so Mastery Outlook (teachers) and the Mastery Dashboard (students) share it:
 *   data-outcome-order='["599","598"]'      regular outcome IDs, page order
 *   data-outcome-names="{&quot;598&quot;:&quot;Reading&quot;}"   { outcomeId: display name }
 *
 * Both the outcome-list drag-and-drop and the Current Score column headers save
 * through saveOutcomeLayout(), so the two views always agree.
 */

import { logger } from '../utils/logger.js';
import { findMasteryDashboardPageUrl, getPage, updatePage } from '../services/pageService.js';

const ROOT_TAG_RE = /<div\s+id=["']mastery-dashboard-root["']/;

/** HTML-escape a JSON string for a double-quoted attribute value. */
function encodeAttr(json) {
    return json
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function decodeAttr(value) {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function readAttrJson(body, name) {
    const match = body.match(new RegExp(`data-${name}=(["'])(.*?)\\1`));
    if (!match || !match[2]) return null;
    try {
        return JSON.parse(decodeAttr(match[2]));
    } catch (e) {
        logger.warn(`[OutcomeLayout] Failed to parse data-${name}`, e);
        return null;
    }
}

function writeAttrJson(body, name, value) {
    const attr = `data-${name}="${encodeAttr(JSON.stringify(value))}"`;
    const existing = new RegExp(`data-${name}=(?:"[^"]*"|'[^']*')`);
    if (existing.test(body)) return body.replace(existing, attr);
    if (ROOT_TAG_RE.test(body)) return body.replace(ROOT_TAG_RE, `<div id="mastery-dashboard-root" ${attr}`);
    return body;
}

/**
 * Read the outcome layout from a Mastery Dashboard page body.
 *
 * @param {string} body - wiki page HTML
 * @returns {{ order: string[]|null, names: Object<string,string> }}
 */
export function parseOutcomeLayout(body) {
    if (!body) return { order: null, names: {} };
    const order = readAttrJson(body, 'outcome-order');
    const names = readAttrJson(body, 'outcome-names');
    return {
        order: Array.isArray(order) ? order.map(String) : null,
        names: names && typeof names === 'object' && !Array.isArray(names) ? names : {},
    };
}

/**
 * Return `body` with the given layout parts written onto #mastery-dashboard-root.
 * Parts left undefined are untouched.
 *
 * @param {string} body
 * @param {{ order?: string[], names?: Object<string,string> }} layout
 * @returns {string}
 */
export function applyOutcomeLayout(body, { order, names } = {}) {
    let out = body;
    if (order !== undefined) out = writeAttrJson(out, 'outcome-order', order.map(String));
    if (names !== undefined) out = writeAttrJson(out, 'outcome-names', names);
    return out;
}

// Saves run one at a time — each is a read-modify-write of the same page.
let _saveChain = Promise.resolve();

/**
 * Save the outcome order and/or custom names to the Mastery Dashboard page.
 * Never throws; resolves false when the page is missing or the save failed.
 *
 * @param {string|number} courseId
 * @param {Object} apiClient
 * @param {{ order?: string[], names?: Object<string,string> }} layout
 * @returns {Promise<boolean>}
 */
export function saveOutcomeLayout(courseId, apiClient, layout) {
    const run = _saveChain.then(async () => {
        try {
            const pageUrl = await findMasteryDashboardPageUrl(courseId, apiClient);
            if (!pageUrl) {
                logger.warn('[OutcomeLayout] Cannot save outcome layout — Mastery Dashboard page not found');
                return false;
            }
            const page = await getPage(courseId, pageUrl, apiClient);
            if (!page?.body) return false;
            const newBody = applyOutcomeLayout(page.body, layout);
            if (newBody === page.body) return true;
            await updatePage(courseId, pageUrl, { body: newBody }, apiClient);
            logger.info('[OutcomeLayout] Saved outcome layout to the Mastery Dashboard page');
            return true;
        } catch (e) {
            logger.warn('[OutcomeLayout] Failed to save outcome layout', e);
            return false;
        }
    });
    _saveChain = run.catch(() => {});
    return run;
}
