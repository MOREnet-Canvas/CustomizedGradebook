// src/masteryDashboard/pacingPanel.js
/**
 * Course Pacing — student/observer view on the Mastery View page.
 *
 * Pacing folds into the existing dashboard instead of adding a separate card:
 *   - a "Pace" stat box next to Score and Mastered (status pill, one bar where
 *     the fill is mastered % and a tick marks expected-by-today %, one detail line)
 *   - one line on each required outcome card: "Target Sep 1 · Behind pace"
 *
 * Shared by the desktop bundle and the mobile bundle (via masteryDashboardViewer.js),
 * so it must not touch the Canvas `ENV` global.
 *
 * Nothing renders unless the teacher saved an enabled pacing configuration
 * (data-outcome-pacing on #mastery-dashboard-root) that includes at least one
 * outcome still present in the course.
 */

import { DEFAULT_MASTERY_THRESHOLD } from '../config.js';
import { injectStyles } from '../ui/styles.js';
import {
    computePacingSummary,
    formatTargetDate,
    percentOf,
    PACING_STATUS
} from '../services/pacingService.js';

export const PACING_STYLE_ID = 'pm-pace-styles';

const FONT = "LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif";

export const PACING_CSS = `
.pm-pace-head { display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:8px; }
.pm-pace-caption { font-family:${FONT}; font-size:0.72rem; color:#666; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; -webkit-font-smoothing:antialiased; }
.pm-pace-pill { font-family:${FONT}; border-radius:999px; padding:2px 8px; font-size:0.72rem; font-weight:700; white-space:nowrap; }
.pm-pace-pill--onpace { background:#dff2e7; color:#12643a; }
.pm-pace-pill--today { background:#fff0d5; color:#7a4a00; }
.pm-pace-pill--behind { background:#fce5e5; color:#a22b2b; }
.pm-pace-bar { position:relative; height:10px; background:#dfe4e8; border-radius:999px; margin:14px 0 8px; }
.pm-pace-fill { height:100%; background:#03893D; border-radius:999px; }
.pm-pace-tick { position:absolute; top:-4px; width:2px; height:18px; background:#273540; border-radius:1px; transform:translateX(-1px); }
.pm-pace-detail { font-family:${FONT}; font-size:0.78rem; color:#555; line-height:1.4; -webkit-font-smoothing:antialiased; }
.pm-pace-line { font-family:${FONT}; font-size:0.8rem; color:#555; margin-top:2px; line-height:1.4; -webkit-font-smoothing:antialiased; }
.pm-pace-line--mastered .pm-pace-status { color:#03893D; font-weight:600; }
.pm-pace-line--behind .pm-pace-status { color:#a22b2b; font-weight:700; }
.pm-pace-line--today .pm-pace-status { color:#7a4a00; font-weight:700; }
`;

const OVERALL_CLASS = {
    [PACING_STATUS.ON_PACE]: 'onpace',
    [PACING_STATUS.TARGET_TODAY]: 'today',
    [PACING_STATUS.BEHIND]: 'behind'
};

const LINE_CLASS = {
    [PACING_STATUS.MASTERED]: 'mastered',
    [PACING_STATUS.BEHIND]: 'behind',
    [PACING_STATUS.TARGET_TODAY]: 'today'
};

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
}

/**
 * Summarize pacing for one student, or null when nothing should be shown.
 *
 * @param {Object} params
 * @param {{enabled: boolean, scales: Array}|null} params.pacing - parsePacing() result
 * @param {Map<string, number|null>} params.scoresByOutcomeId
 * @param {Map<string, string>} params.outcomeNames - regular outcomes only
 * @param {string} params.today - YYYY-MM-DD in the course time zone
 * @returns {ReturnType<typeof computePacingSummary>|null}
 */
export function buildPacingModel({ pacing, scoresByOutcomeId, outcomeNames, today }) {
    if (!pacing?.enabled) return null;
    const summary = computePacingSummary({
        scales: pacing.scales,
        scoresByOutcomeId,
        outcomeNames,
        today,
        threshold: DEFAULT_MASTERY_THRESHOLD
    });
    return summary.total ? summary : null;
}

/**
 * Inner HTML for the "Pace" stat box.
 * @param {ReturnType<typeof computePacingSummary>} summary
 * @returns {string}
 */
export function buildPaceStatHtml(summary) {
    const { total, mastered, dated, dueByToday, behind, datesComplete, overall } = summary;
    const masteredPct = percentOf(mastered, total);
    const expectedPct = percentOf(dueByToday, total);

    const pill = overall
        ? `<span class="pm-pace-pill pm-pace-pill--${OVERALL_CLASS[overall]}">${escapeHtml(overall)}</span>`
        : '';

    const tick = dated
        ? `<div class="pm-pace-tick" style="left:${expectedPct}%;" title="Expected by today"></div>`
        : '';

    let detail;
    if (!datesComplete) {
        detail = 'Some target dates not set';
    } else {
        detail = `${dueByToday} of ${total} expected by today`;
        if (behind) detail += ` · ${behind} past target date`;
    }

    const label = `${mastered} of ${total} required outcomes mastered` +
        (dated ? `; ${dueByToday} expected by today` : '');

    return `
      <div class="pm-pace-head">
        <span class="pm-pace-caption">Pace</span>
        ${pill}
      </div>
      <div class="pm-pace-bar" role="img" aria-label="${escapeHtml(label)}">
        <div class="pm-pace-fill" style="width:${masteredPct}%;"></div>
        ${tick}
      </div>
      <div class="pm-pace-detail">${escapeHtml(detail)}</div>`;
}

/**
 * One-line pacing note for an outcome card, e.g. "Target Sep 1, 2026 · Behind pace".
 * @param {{date: string, pacing: string}} item - summary item
 * @returns {string} HTML
 */
export function buildOutcomePaceLineHtml(item) {
    const target = item.date ? `Target ${formatTargetDate(item.date)}` : 'No target date';
    const status = item.pacing === PACING_STATUS.UPCOMING || item.pacing === PACING_STATUS.NO_TARGET_DATE
        ? ''
        : ` · <span class="pm-pace-status">${escapeHtml(item.pacing)}</span>`;
    const mod = LINE_CLASS[item.pacing] ? ` pm-pace-line--${LINE_CLASS[item.pacing]}` : '';
    return `<div class="pm-pace-line${mod}">${escapeHtml(target)}${status}</div>`;
}

/**
 * Show the Pace stat box for `summary`, or hide it when summary is null.
 * @param {HTMLElement|null} boxEl - #pm-stat-pace
 * @param {ReturnType<typeof computePacingSummary>|null} summary
 * @returns {boolean} true when shown
 */
export function renderPaceStat(boxEl, summary) {
    if (!boxEl) return false;
    if (!summary) {
        clearPaceStat(boxEl);
        return false;
    }
    injectStyles(PACING_CSS, PACING_STYLE_ID);
    boxEl.innerHTML = buildPaceStatHtml(summary);
    boxEl.style.display = '';
    return true;
}

/**
 * Hide and empty the Pace stat box.
 * @param {HTMLElement|null} boxEl
 */
export function clearPaceStat(boxEl) {
    if (!boxEl) return;
    boxEl.innerHTML = '';
    boxEl.style.display = 'none';
}
