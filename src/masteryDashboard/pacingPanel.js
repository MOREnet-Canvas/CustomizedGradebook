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
    DUE_SOON_DAYS,
    computePacingSummary,
    formatTargetDate,
    percentOf,
    PACING_STATUS
} from '../services/pacingService.js';

export const PACING_STYLE_ID = 'pm-pace-styles';

/**
 * Pace colors — single source for the Pace stat bar and the per-outcome score bars.
 *
 * KEEP THIS RATIONALE when consolidating CSS/colors (see documents/TODOs/Mastery_colors.md):
 *
 * - These encode PACE (where a student is relative to the teacher's target dates),
 *   not a rating level. Rating-level colors stay score-based (card border, LMGB).
 * - ontrack (#4A7FB8, light muted blue) = required outcome not mastered yet but more than
 *   DUE_SOON_DAYS before its target ("in progress, nothing wrong"). Chosen because:
 *     · gray already means "no score yet" / disabled (empty bar, `none`)
 *     · purple means Exemplary / Beyond Target in Sedalia's scale (reads as "excellent")
 *     · teal blurs with green ("nearly" vs "mastered")
 *     · a second amber/yellow reads as a warning
 *     · blue stays distinct from red/amber/green under red-green color blindness
 *     · the muted shade avoids Sedalia's own rating blues (Developing #485BB0,
 *       Beginning #1979AE, Needs Partial Support #1199DA) so it isn't read as a rating
 *     · lighter than red/amber on purpose: "in 14 days" must look calmer than "16 days past".
 *       #3B6EA5 was tried first and looked as heavy as red. Do not go lighter than
 *       #4B84C0 (3.27:1); #4F8AC9 is 3.02:1 and #5B93CF fails 3:1.
 * - Contrast (WCAG 1.4.11, non-text ≥ 3:1), measured against the #e8ebee track:
 *   blue #4A7FB8 3.50, green 3.77, amber 3.83, red 4.84.
 * - Color is never the only signal: the line under each bar states the status in words
 *   ("Target Dec 4, 2026 · in 17 days"), and the Pace box has a text detail line.
 */
export const PACE_COLORS = Object.freeze({
    mastered: '#03893D', // mastered / on pace
    behind: '#c5221f',   // past target date, not mastered
    soon: '#b45f06',     // not mastered, due within DUE_SOON_DAYS (today included)
    ontrack: '#4A7FB8',  // not mastered, target more than DUE_SOON_DAYS away
    none: '#6b7780'      // no target dates set (Pace box only)
});

const FONT = "LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif";

export const PACING_CSS = `
.pm-pace-head { display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:8px; }
.pm-pace-caption { font-family:${FONT}; font-size:0.72rem; color:#666; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; -webkit-font-smoothing:antialiased; }
.pm-pace-pill { font-family:${FONT}; border-radius:999px; padding:2px 8px; font-size:0.72rem; font-weight:700; white-space:nowrap; }
.pm-pace-pill--onpace { background:#dff2e7; color:#12643a; }
.pm-pace-pill--today { background:#fff0d5; color:#7a4a00; }
.pm-pace-pill--behind { background:#fce5e5; color:#a22b2b; }
.pm-pace-bar { position:relative; height:10px; background:#dfe4e8; border-radius:999px; margin:14px 0 8px; }
.pm-pace-fill { height:100%; background:${PACE_COLORS.mastered}; border-radius:999px; }
.pm-pace-fill--onpace { background:${PACE_COLORS.mastered}; }
.pm-pace-fill--soon { background:${PACE_COLORS.soon}; }
.pm-pace-fill--behind { background:${PACE_COLORS.behind}; }
.pm-pace-fill--none { background:${PACE_COLORS.none}; }
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
 * Score-bar color for a required outcome in a pacing course (see PACE_COLORS).
 * Returns null when the caller should keep the card's score-based mastery color
 * (outcome has no target date).
 * @param {{pacing: string, days: number|null}} item - summary item
 * @returns {string|null}
 */
export function paceBarColor(item) {
    if (!item) return null;
    if (item.pacing === PACING_STATUS.MASTERED) return PACE_COLORS.mastered;
    if (item.pacing === PACING_STATUS.NO_TARGET_DATE || item.days == null) return null;
    if (item.days < 0) return PACE_COLORS.behind;
    if (item.days <= DUE_SOON_DAYS) return PACE_COLORS.soon;
    return PACE_COLORS.ontrack;
}

/**
 * Score bar for an outcome card: fill = score / max points, with a tick at the
 * mastery threshold. Color: paceBarColor() for required outcomes in a pacing course,
 * otherwise the card's score-based mastery color. Inline-styled (works without the
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
    return `<div class="pm-outcome-progress" role="img" aria-label="${escapeHtml(label)}" style="position:relative; height:8px; background:#e8ebee; border-radius:999px; margin:8px 0 2px;">` +
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
