// src/masteryDashboard/pacingPanel.js
/**
 * Course Pacing — student/observer view on the Mastery View page.
 *
 * Pacing folds into the existing dashboard instead of adding a separate card:
 *   - a "Pace" stat box next to Score and Mastered (status pill, one bar where
 *     the fill is mastered % and a tick marks expected-by-today %, one detail line)
 *   - one line on each required outcome card: "Target Sep 1, 2026 · 77 days past"
 *
 * Also exports buildOutcomeProgressBarHtml(), the score bar shown on every outcome
 * card (all courses, pacing or not). It uses inline styles so it needs no stylesheet.
 *
 * Shared by the desktop bundle and the mobile bundle (via masteryDashboardViewer.js),
 * so it must not touch the Canvas `ENV` global.
 *
 * Nothing renders unless the teacher saved an enabled pacing configuration
 * (data-outcome-pacing on #mastery-dashboard-root) that includes at least one
 * outcome still present in the course.
 */

import { DEFAULT_MASTERY_THRESHOLD, DEFAULT_MAX_POINTS } from '../config.js';
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
.pm-pace-fill--onpace { background:#03893D; }
.pm-pace-fill--soon { background:#b45f06; }
.pm-pace-fill--behind { background:#c5221f; }
.pm-pace-fill--none { background:#6b7780; }
.pm-pace-tick { position:absolute; top:-4px; width:2px; height:18px; background:#273540; border-radius:1px; transform:translateX(-1px); }
.pm-pace-detail { font-family:${FONT}; font-size:0.78rem; color:#555; line-height:1.4; -webkit-font-smoothing:antialiased; }
.pm-pace-line { font-family:${FONT}; font-size:0.8rem; color:#555; margin-top:2px; line-height:1.4; -webkit-font-smoothing:antialiased; }
.pm-pace-line--mastered .pm-pace-status { color:#03793a; font-weight:600; }
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
 * Bar tone for the Pace box: behind (any required outcome past target and not
 * mastered) → soon (one due within DUE_SOON_DAYS) → onpace → none (no dates set).
 * Independent of the pill, so the bar still warns when some dates are missing.
 * @param {ReturnType<typeof computePacingSummary>} summary
 * @returns {'behind'|'soon'|'onpace'|'none'}
 */
export function paceTone(summary) {
    if (summary.behind > 0) return 'behind';
    if (summary.dueSoon > 0) return 'soon';
    if (summary.dated > 0) return 'onpace';
    return 'none';
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
        <div class="pm-pace-fill pm-pace-fill--${paceTone(summary)}" style="width:${masteredPct}%;"></div>
        ${tick}
      </div>
      <div class="pm-pace-detail">${escapeHtml(detail)}</div>`;
}

/**
 * Relative due text for a not-yet-mastered outcome: "77 days past", "Due today", "in 12 days".
 * @param {number} days - daysUntil(target, today)
 * @returns {string}
 */
function relativeDueText(days) {
    if (days === 0) return 'Due today';
    if (days < 0) return `${-days} day${days === -1 ? '' : 's'} past`;
    return `in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * One-line pacing note for a required outcome card.
 *   mastered:      "Expected by Oct 1, 2026 · Mastered"
 *   behind:        "Target Sep 1, 2026 · 77 days past"   (red)
 *   due today:     "Target Nov 17, 2026 · Due today"     (amber)
 *   upcoming:      "Target Dec 4, 2026 · in 17 days"
 *   no date:       "No target date"
 * @param {{date: string, days: number|null, pacing: string}} item - summary item
 * @returns {string} HTML
 */
export function buildOutcomePaceLineHtml(item) {
    if (!item.date) {
        const status = item.pacing === PACING_STATUS.MASTERED ? ' · <span class="pm-pace-status">Mastered</span>' : '';
        const mod = item.pacing === PACING_STATUS.MASTERED ? ' pm-pace-line--mastered' : '';
        return `<div class="pm-pace-line${mod}">No target date${status}</div>`;
    }

    const date = escapeHtml(formatTargetDate(item.date));
    if (item.pacing === PACING_STATUS.MASTERED) {
        return `<div class="pm-pace-line pm-pace-line--mastered">Expected by ${date} · <span class="pm-pace-status">Mastered</span></div>`;
    }

    const mod = LINE_CLASS[item.pacing] ? ` pm-pace-line--${LINE_CLASS[item.pacing]}` : '';
    const due = item.days == null ? '' : ` · <span class="pm-pace-status">${relativeDueText(item.days)}</span>`;
    return `<div class="pm-pace-line${mod}">Target ${date}${due}</div>`;
}

/**
 * Score bar for an outcome card: fill = score / max points in the card's mastery
 * color, with a tick at the mastery threshold. Inline-styled (works without the
 * pacing stylesheet), so it can render on every course.
 *
 * @param {number|null} score - rollup score (null = no evidence yet)
 * @param {string} color - fill color (the card's mastery color)
 * @param {{maxPoints?: number, threshold?: number}} [opts]
 * @returns {string} HTML
 */
export function buildOutcomeProgressBarHtml(score, color, { maxPoints = DEFAULT_MAX_POINTS, threshold = DEFAULT_MASTERY_THRESHOLD } = {}) {
    const max = maxPoints > 0 ? maxPoints : 4;
    const value = score == null || !Number.isFinite(Number(score)) ? null : Number(score);
    const fillPct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
    const tickPct = Math.max(0, Math.min(100, (threshold / max) * 100));
    const label = value == null
        ? `No score yet. Mastery is ${threshold} out of ${max}.`
        : `Score ${value} out of ${max}. Mastery is ${threshold}.`;
    return `<div class="pm-outcome-progress" role="img" aria-label="${escapeHtml(label)}" style="position:relative; height:8px; background:#e8ebee; border-radius:999px; margin:6px 0 2px; max-width:420px;">` +
        `<div style="width:${fillPct}%; height:100%; background:${escapeHtml(color)}; border-radius:999px;"></div>` +
        `<div style="position:absolute; top:-3px; bottom:-3px; left:${tickPct}%; width:2px; background:#2d3b45; transform:translateX(-1px);"></div>` +
        `</div>`;
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
