// src/services/pacingService.js
/**
 * Course Pacing Service — pure logic, no DOM, no network.
 *
 * Teachers choose which outcomes a course requires and set a target date for
 * each. That configuration is stored as JSON in the `data-outcome-pacing`
 * attribute on the Mastery View page's #mastery-dashboard-root element (next
 * to data-outcome-order / data-outcome-names). Viewers read it with
 * parsePacing() and summarize a student's progress with computePacingSummary().
 *
 * Stored format (v1):
 *   {"v":1,"enabled":true,"scales":[{"id":"123","date":"2026-12-04","included":true}]}
 *
 * Pacing never changes grades. It only compares outcome rollup scores against
 * the mastery threshold and the teacher's target dates.
 *
 * District-agnostic: thresholds come from config; dates are evaluated in the
 * course time zone supplied by the caller.
 */

import { DEFAULT_MASTERY_THRESHOLD } from '../config.js';

export const PACING_ATTRIBUTE = 'data-outcome-pacing';
export const PACING_FORMAT_VERSION = 1;

/** Per-outcome evidence labels */
export const EVIDENCE_STATUS = Object.freeze({
    NO_EVIDENCE: 'No Evidence',
    NOT_YET_MASTERED: 'Not yet mastered',
    MASTERED: 'Mastered'
});

/** Per-outcome and overall pacing labels */
export const PACING_STATUS = Object.freeze({
    MASTERED: 'Mastered',
    NO_TARGET_DATE: 'No target date',
    BEHIND: 'Behind pace',
    TARGET_TODAY: 'Due today',
    UPCOMING: 'Upcoming',
    ON_PACE: 'On pace'
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

// ─── Storage format ──────────────────────────────────────────────────────────

/**
 * Parse a pacing configuration.
 * @param {Element|string|null|undefined} source - Element carrying the
 *   data-outcome-pacing attribute, or the (already HTML-decoded) JSON string
 * @returns {{enabled: boolean, scales: Array<{id: string, date: string, included: boolean}>}|null}
 *   null when absent or invalid
 */
export function parsePacing(source) {
    const raw = typeof source === 'string'
        ? source
        : source?.getAttribute?.(PACING_ATTRIBUTE);
    if (!raw) return null;

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.scales)) return null;

    const scales = data.scales
        .filter(s => s && s.id != null && String(s.id) !== '')
        .map(s => ({
            id: String(s.id),
            date: isValidDate(String(s.date ?? '')) ? String(s.date) : '',
            included: s.included !== false
        }));

    return { enabled: data.enabled !== false, scales };
}

/**
 * Serialize a pacing configuration to the stored JSON string.
 * Callers must HTML-attribute-encode the result before writing it into page HTML.
 * @param {{enabled?: boolean, scales: Array<{id: string|number, date?: string, included?: boolean}>}} pacing
 * @returns {string}
 */
export function serializePacing(pacing) {
    return JSON.stringify({
        v: PACING_FORMAT_VERSION,
        enabled: pacing?.enabled !== false,
        scales: (pacing?.scales ?? []).map(s => ({
            id: String(s.id),
            date: isValidDate(String(s.date ?? '')) ? String(s.date) : '',
            included: s.included !== false
        }))
    });
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * True for a real calendar date in YYYY-MM-DD form.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidDate(value) {
    if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Today's date (YYYY-MM-DD) in the given IANA time zone.
 * Falls back to the browser's time zone when the zone is missing or unknown.
 * @param {string} [timeZone] - e.g. a Canvas course `time_zone`
 * @param {Date} [now]
 * @returns {string}
 */
export function todayInTimeZone(timeZone, now = new Date()) {
    let parts;
    try {
        parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone || undefined,
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(now);
    } catch {
        parts = new Intl.DateTimeFormat('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(now);
    }
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Whole days from `today` to `date` (negative = past). Null if either is invalid.
 * @param {string} date - YYYY-MM-DD
 * @param {string} today - YYYY-MM-DD
 * @returns {number|null}
 */
export function daysUntil(date, today) {
    if (!isValidDate(date) || !isValidDate(today)) return null;
    return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/**
 * Format a YYYY-MM-DD date for display ("Dec 4, 2026"); "Not set" when invalid.
 * @param {string} value
 * @returns {string}
 */
export function formatTargetDate(value) {
    if (!isValidDate(value)) return 'Not set';
    const [y, m, d] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(Date.UTC(y, m - 1, d)));
}

// ─── Classification ──────────────────────────────────────────────────────────

/**
 * @param {number|null|undefined} score
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function isMastered(score, threshold = DEFAULT_MASTERY_THRESHOLD) {
    return score != null && Number.isFinite(Number(score)) && Number(score) >= threshold;
}

/**
 * Evidence status for one outcome score. Missing or 0 = No Evidence.
 * @param {number|null|undefined} score
 * @param {number} [threshold]
 * @returns {string} one of EVIDENCE_STATUS
 */
export function evidenceStatus(score, threshold = DEFAULT_MASTERY_THRESHOLD) {
    if (score == null || !Number.isFinite(Number(score)) || Number(score) === 0) {
        return EVIDENCE_STATUS.NO_EVIDENCE;
    }
    return isMastered(score, threshold) ? EVIDENCE_STATUS.MASTERED : EVIDENCE_STATUS.NOT_YET_MASTERED;
}

/**
 * Pacing status for one outcome.
 * @param {{date: string}} scale
 * @param {number|null|undefined} score
 * @param {string} today - YYYY-MM-DD
 * @param {number} [threshold]
 * @returns {string} one of PACING_STATUS (except ON_PACE)
 */
export function pacingStatus(scale, score, today, threshold = DEFAULT_MASTERY_THRESHOLD) {
    if (isMastered(score, threshold)) return PACING_STATUS.MASTERED;
    const days = daysUntil(scale?.date, today);
    if (days == null) return PACING_STATUS.NO_TARGET_DATE;
    if (days < 0) return PACING_STATUS.BEHIND;
    if (days === 0) return PACING_STATUS.TARGET_TODAY;
    return PACING_STATUS.UPCOMING;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * Summarize one student's pacing.
 *
 * Only included scales whose outcome is still known (present in outcomeNames)
 * are counted, so outcomes removed from the course drop out silently.
 *
 * @param {Object} params
 * @param {Array<{id: string, date: string, included: boolean}>} params.scales
 * @param {Map<string, number|null>} params.scoresByOutcomeId - rollup score per outcome ID
 * @param {Map<string, string>} params.outcomeNames - display name per outcome ID
 * @param {string} params.today - YYYY-MM-DD
 * @param {number} [params.threshold]
 * @returns {{
 *   total: number, mastered: number, dated: number, dueByToday: number,
 *   behind: number, dueToday: number, noEvidence: number, datesComplete: boolean,
 *   overall: string|null,
 *   items: Array<{id: string, name: string, score: number|null, date: string, evidence: string, pacing: string}>
 * }}
 */
export function computePacingSummary({ scales, scoresByOutcomeId, outcomeNames, today, threshold = DEFAULT_MASTERY_THRESHOLD }) {
    const selected = (scales ?? []).filter(s => s.included && outcomeNames.has(String(s.id)));

    const items = selected.map(s => {
        const id = String(s.id);
        const raw = scoresByOutcomeId.get(id);
        const score = raw == null || !Number.isFinite(Number(raw)) ? null : Number(raw);
        return {
            id,
            name: outcomeNames.get(id),
            score,
            date: isValidDate(s.date) ? s.date : '',
            evidence: evidenceStatus(score, threshold),
            pacing: pacingStatus(s, score, today, threshold)
        };
    });

    items.sort((a, b) => {
        if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    const total = items.length;
    const dated = items.filter(i => i.date);
    const mastered = items.filter(i => i.evidence === EVIDENCE_STATUS.MASTERED).length;
    const dueByToday = dated.filter(i => daysUntil(i.date, today) <= 0).length;
    const behind = items.filter(i => i.pacing === PACING_STATUS.BEHIND).length;
    const dueToday = items.filter(i => i.pacing === PACING_STATUS.TARGET_TODAY).length;
    const noEvidence = items.filter(i => i.evidence === EVIDENCE_STATUS.NO_EVIDENCE).length;
    const datesComplete = total > 0 && dated.length === total;

    let overall = null;
    if (datesComplete) {
        overall = behind ? PACING_STATUS.BEHIND
            : dueToday ? PACING_STATUS.TARGET_TODAY
            : PACING_STATUS.ON_PACE;
    }

    return { total, mastered, dated: dated.length, dueByToday, behind, dueToday, noEvidence, datesComplete, overall, items };
}

/**
 * Integer percentage clamped to 0–100 (0 when total is 0).
 * @param {number} part
 * @param {number} total
 * @returns {number}
 */
export function percentOf(part, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
