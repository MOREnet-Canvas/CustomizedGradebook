// src/masteryDashboard/pacingPanel.js
/**
 * Course Pacing Panel — student/observer view on the Mastery View page.
 *
 * Shared by the desktop bundle and the mobile bundle (via masteryDashboardViewer.js),
 * so it must not touch the Canvas `ENV` global.
 *
 * Renders only when the teacher has saved an enabled pacing configuration
 * (data-outcome-pacing on #mastery-dashboard-root) that includes at least one
 * outcome still present in the course. Otherwise the slot is cleared and hidden.
 */

import { DEFAULT_MASTERY_THRESHOLD, DEFAULT_MAX_POINTS } from '../config.js';
import { injectStyles } from '../ui/styles.js';
import {
    computePacingSummary,
    formatTargetDate,
    percentOf,
    PACING_STATUS,
    EVIDENCE_STATUS
} from '../services/pacingService.js';

export const PACING_PANEL_STYLE_ID = 'pm-pacing-styles';

const FONT = "LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif";

export const PACING_PANEL_CSS = `
.pm-pacing { font-family:${FONT}; color:#273540; background:#fff; border:1px solid #d7dce2; border-radius:8px; padding:14px; margin:0 0 12px; -webkit-font-smoothing:antialiased; }
.pm-pacing-head { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
.pm-pacing-title { font-size:1rem; font-weight:700; margin:0; }
.pm-pacing-sub { font-size:0.78rem; color:#555; margin:2px 0 0; }
.pm-pacing-status { border-radius:999px; padding:4px 10px; font-size:0.78rem; font-weight:700; white-space:nowrap; }
.pm-pacing-status--onpace { background:#dff2e7; color:#12643a; }
.pm-pacing-status--today { background:#fff0d5; color:#7a4a00; }
.pm-pacing-status--behind { background:#fce5e5; color:#a22b2b; }
.pm-pacing-bar { margin:12px 0; }
.pm-pacing-bar-head { display:flex; justify-content:space-between; gap:10px; font-size:0.85rem; font-weight:700; margin-bottom:6px; }
.pm-pacing-track { width:100%; height:12px; background:#e8edf1; border-radius:999px; overflow:hidden; }
.pm-pacing-fill { height:100%; border-radius:999px; }
.pm-pacing-note { font-size:0.75rem; color:#555; margin:6px 0 0; line-height:1.4; }
.pm-pacing-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:8px; margin:12px 0; }
.pm-pacing-tile { background:#f5f6f7; border-radius:8px; padding:8px; text-align:center; }
.pm-pacing-tile-num { display:block; font-size:1.4rem; font-weight:700; line-height:1.2; }
.pm-pacing-tile-label { display:block; font-size:0.72rem; color:#555; margin-top:2px; }
.pm-pacing-tile--mastered .pm-pacing-tile-num { color:#1d7a4a; }
.pm-pacing-tile--behind .pm-pacing-tile-num { color:#a22b2b; }
.pm-pacing details { border-top:1px solid #e3e7eb; padding-top:8px; margin-top:8px; }
.pm-pacing summary { cursor:pointer; font-weight:700; font-size:0.85rem; padding:4px 0; }
.pm-pacing-item { padding:10px 0; border-bottom:1px solid #edf0f2; }
.pm-pacing-item-top, .pm-pacing-item-bottom { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
.pm-pacing-item-name { font-size:0.85rem; font-weight:600; }
.pm-pacing-item-status { font-size:0.75rem; white-space:nowrap; font-weight:600; color:#555; }
.pm-pacing-item-status--mastered { color:#1d7a4a; }
.pm-pacing-item-status--behind { color:#a22b2b; }
.pm-pacing-item-status--today { color:#7a4a00; }
.pm-pacing-item-bottom { font-size:0.72rem; color:#555; margin-top:4px; }
.pm-pacing-score { display:flex; align-items:center; gap:10px; margin-top:6px; }
.pm-pacing-score .pm-pacing-track { flex:1; height:8px; }
.pm-pacing-score-val { width:36px; text-align:right; font-size:0.8rem; font-weight:700; }
@media (max-width:600px) {
  .pm-pacing { padding:10px; }
  .pm-pacing-tiles { grid-template-columns:repeat(2, 1fr); }
}
`;

const OVERALL_CLASS = {
    [PACING_STATUS.ON_PACE]: 'onpace',
    [PACING_STATUS.TARGET_TODAY]: 'today',
    [PACING_STATUS.BEHIND]: 'behind'
};

const ITEM_CLASS = {
    [PACING_STATUS.MASTERED]: 'mastered',
    [PACING_STATUS.BEHIND]: 'behind',
    [PACING_STATUS.TARGET_TODAY]: 'today'
};

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
}

function barHtml(label, part, total, color, note) {
    const pct = percentOf(part, total);
    return `
      <div class="pm-pacing-bar">
        <div class="pm-pacing-bar-head"><span>${escapeHtml(label)}</span><span>${pct}%</span></div>
        <div class="pm-pacing-track" role="progressbar" aria-label="${escapeHtml(label)}"
             aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
          <div class="pm-pacing-fill" style="width:${pct}%; background:${color};"></div>
        </div>
        <p class="pm-pacing-note">${escapeHtml(note)}</p>
      </div>`;
}

function tileHtml(num, label, modifier) {
    return `
      <div class="pm-pacing-tile${modifier ? ` pm-pacing-tile--${modifier}` : ''}">
        <span class="pm-pacing-tile-num">${num}</span>
        <span class="pm-pacing-tile-label">${escapeHtml(label)}</span>
      </div>`;
}

function scoreColor(score, threshold) {
    if (score == null || score === 0) return '#A9B3BE';
    return score >= threshold ? '#1d7a4a' : '#C98A1E';
}

function itemHtml(item, threshold, maxPoints) {
    const width = item.score == null ? 0 : Math.min(100, Math.max(0, (item.score / maxPoints) * 100));
    const scoreLabel = item.score == null || item.score === 0 ? 'N/E' : String(Number(item.score.toFixed(2)));
    const statusClass = ITEM_CLASS[item.pacing] ? ` pm-pacing-item-status--${ITEM_CLASS[item.pacing]}` : '';
    return `
      <div class="pm-pacing-item" data-outcome-id="${escapeHtml(item.id)}">
        <div class="pm-pacing-item-top">
          <span class="pm-pacing-item-name">${escapeHtml(item.name)}</span>
          <span class="pm-pacing-item-status${statusClass}">${escapeHtml(item.pacing)}</span>
        </div>
        <div class="pm-pacing-score">
          <div class="pm-pacing-track"><div class="pm-pacing-fill" style="width:${width}%; background:${scoreColor(item.score, threshold)};"></div></div>
          <span class="pm-pacing-score-val">${scoreLabel}</span>
        </div>
        <div class="pm-pacing-item-bottom">
          <span>${escapeHtml(item.evidence)}</span>
          <span>Target: ${escapeHtml(formatTargetDate(item.date))}</span>
        </div>
      </div>`;
}

/**
 * Build the panel's inner HTML from a pacing summary.
 * @param {ReturnType<typeof computePacingSummary>} summary
 * @param {{threshold?: number, maxPoints?: number}} [opts]
 * @returns {string}
 */
export function buildPacingPanelHtml(summary, { threshold = DEFAULT_MASTERY_THRESHOLD, maxPoints = DEFAULT_MAX_POINTS } = {}) {
    const { total, mastered, dated, dueByToday, behind, noEvidence, datesComplete, overall, items } = summary;

    const statusHtml = overall
        ? `<span class="pm-pacing-status pm-pacing-status--${OVERALL_CLASS[overall]}">${escapeHtml(overall)}</span>`
        : '';

    const parts = [`
      <div class="pm-pacing-head">
        <div>
          <h3 class="pm-pacing-title">Course Progress &amp; Pacing</h3>
          <p class="pm-pacing-sub">Progress toward this course's required outcomes</p>
        </div>
        ${statusHtml}
      </div>`];

    parts.push(barHtml('Learning Progress', mastered, total, '#1d7a4a',
        `${mastered} of ${total} outcomes mastered at ${threshold} or higher`));

    if (dated) {
        parts.push(barHtml('Expected Progress by Today', dueByToday, total, '#3F6EB5',
            `${dueByToday} of ${total} outcomes targeted by today`));
    }

    if (!datesComplete) {
        const missing = total - dated;
        parts.push(`<p class="pm-pacing-note">${missing} target date${missing === 1 ? ' has' : 's have'} not been set, so an overall pacing status isn't shown yet.</p>`);
    }

    parts.push(`
      <div class="pm-pacing-tiles">
        ${tileHtml(mastered, EVIDENCE_STATUS.MASTERED, 'mastered')}
        ${dated ? tileHtml(behind, 'Behind Target', 'behind') : ''}
        ${tileHtml(noEvidence, EVIDENCE_STATUS.NO_EVIDENCE, '')}
      </div>`);

    parts.push(`
      <details>
        <summary>View progress by outcome</summary>
        ${items.map(i => itemHtml(i, threshold, maxPoints)).join('')}
      </details>
      <p class="pm-pacing-note">Pacing is separate from scores. Target dates never change grades.</p>`);

    return parts.join('');
}

/**
 * Clear and hide the pacing slot.
 * @param {HTMLElement|null} slotEl
 */
export function clearPacingPanel(slotEl) {
    if (!slotEl) return;
    slotEl.innerHTML = '';
    slotEl.style.display = 'none';
}

/**
 * Render the pacing panel into `slotEl`, or clear it when there is nothing to show.
 *
 * @param {HTMLElement|null} slotEl - #pm-pacing
 * @param {Object} params
 * @param {{enabled: boolean, scales: Array}|null} params.pacing - parsePacing() result
 * @param {Map<string, number|null>} params.scoresByOutcomeId
 * @param {Map<string, string>} params.outcomeNames - regular outcomes only (no Current Score / excluded)
 * @param {string} params.today - YYYY-MM-DD in the course time zone
 * @returns {boolean} true when the panel was rendered
 */
export function renderPacingPanel(slotEl, { pacing, scoresByOutcomeId, outcomeNames, today }) {
    if (!slotEl) return false;
    if (!pacing?.enabled) {
        clearPacingPanel(slotEl);
        return false;
    }

    const summary = computePacingSummary({
        scales: pacing.scales,
        scoresByOutcomeId,
        outcomeNames,
        today,
        threshold: DEFAULT_MASTERY_THRESHOLD
    });
    if (!summary.total) {
        clearPacingPanel(slotEl);
        return false;
    }

    injectStyles(PACING_PANEL_CSS, PACING_PANEL_STYLE_ID);
    slotEl.innerHTML = `<section class="pm-pacing" aria-label="Course progress and pacing">${buildPacingPanelHtml(summary)}</section>`;
    slotEl.style.display = 'block';
    return true;
}
