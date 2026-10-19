// src/masteryOutlook/currentScoreTable.js
/**
 * Current Score detail table — read-only.
 *
 * One row per student: a chip per averaged outcome (the student's Canvas score,
 * in page order) and the Current Score Canvas reports. No overrides — the
 * Current Score is computed from the other outcomes, never set directly here.
 *
 * ⏳ marks a chip while that outcome's save for the student is queued / running
 * or Canvas hasn't recalculated it yet, and marks the Current Score while any of
 * the student's chips is ⏳ or the new average hasn't been confirmed.
 */

import { escapeHtml } from '../utils/html.js';
import { scoreTone, scoreToneStyle } from '../ui/masteryColors.js';
import { getAveragedOutcomes } from './outcomeTypes.js';
import { rowSavePhase, rowsAwaitingOutcome } from './masteryOutlookState.js';

/** Default sort: student name, A→Z. */
export const DEFAULT_CURRENT_SCORE_SORT = Object.freeze({ key: 'name', dir: 'asc' });

/**
 * True while a row ("outcomeId_studentId") has a save queued / running or is
 * waiting for Canvas to recalculate its outcome score.
 * @param {string|number} outcomeId
 * @param {string|number} studentId
 * @returns {boolean}
 */
export function isScorePending(outcomeId, studentId) {
    const key = `${outcomeId}_${studentId}`;
    return rowSavePhase.has(key) || rowsAwaitingOutcome.has(key);
}

/**
 * @param {Object} student - cache.students entry
 * @param {string|number} outcomeId
 * @returns {number|null} the student's Canvas score for that outcome
 */
function canvasScoreOf(student, outcomeId) {
    const od = student.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
    const v = od?.canvasScore;
    return (v === null || v === undefined || isNaN(v)) ? null : Number(v);
}

/**
 * Build the Current Score table rows.
 *
 * @param {Object} outcome - the Current Score outcome
 * @param {Object} cache
 * @returns {{ outcomes: Object[], rows: Array<{ id: string, name: string, sortableName: string,
 *            current: number|null, currentPending: boolean,
 *            chips: Array<{ outcomeId: string, title: string, score: number|null, pending: boolean }> }> }}
 */
export function buildCurrentScoreRows(outcome, cache) {
    const outcomes = getAveragedOutcomes(cache);
    const rows = (cache.students || []).map(student => {
        const sid = String(student.id);
        const chips = outcomes.map(o => ({
            outcomeId: String(o.id),
            title:     o.title || String(o.id),
            score:     canvasScoreOf(student, o.id),
            pending:   isScorePending(o.id, sid),
        }));
        return {
            id:             sid,
            name:           student.name || sid,
            sortableName:   student.sortableName || student.name || sid,
            current:        canvasScoreOf(student, outcome.id),
            currentPending: chips.some(c => c.pending) || rowsAwaitingOutcome.has(`${outcome.id}_${sid}`),
            chips,
        };
    });
    return { outcomes, rows };
}

/**
 * Sort Current Score rows in place-safe fashion (returns a new array).
 * Students without a value for the sort key always go last.
 *
 * @param {Array} rows - from buildCurrentScoreRows
 * @param {{ key: string, dir: 'asc'|'desc' }} sortState - key is 'name', 'current', or an outcome ID
 * @returns {Array}
 */
export function sortCurrentScoreRows(rows, sortState = DEFAULT_CURRENT_SCORE_SORT) {
    const { key = 'name', dir = 'asc' } = sortState || {};
    const sign = dir === 'desc' ? -1 : 1;
    const byName = (a, b) => a.sortableName.toLowerCase().localeCompare(b.sortableName.toLowerCase());

    if (key === 'name') return [...rows].sort((a, b) => sign * byName(a, b));

    const valueOf = (row) => key === 'current'
        ? row.current
        : (row.chips.find(c => c.outcomeId === String(key))?.score ?? null);

    return [...rows].sort((a, b) => {
        const va = valueOf(a), vb = valueOf(b);
        if (va === null && vb === null) return byName(a, b);
        if (va === null) return 1;
        if (vb === null) return -1;
        return (sign * (va - vb)) || byName(a, b);
    });
}

function renderChip(chip) {
    const hasScore = chip.score !== null;
    const style = scoreToneStyle(hasScore ? scoreTone(chip.score) : 'ne');
    const text  = hasScore ? chip.score.toFixed(2) : '—';
    const tip   = chip.pending ? `${chip.title} — updating in Canvas` : chip.title;
    // ⏳ sits beside the pill; its slot is always present (hidden when idle) so
    // chips stay lined up across students.
    return `<span class="cs-chip-wrap" data-oid="${escapeHtml(chip.outcomeId)}"><span class="os-pill cs-chip${hasScore ? '' : ' cs-chip-empty'}"
        data-oid="${escapeHtml(chip.outcomeId)}"
        title="${escapeHtml(tip)}"
        style="${style}">${text}</span><span class="cs-pending${chip.pending ? '' : ' hidden'}"${chip.pending ? '' : ' aria-hidden="true"'}>⏳</span></span>`;
}

/**
 * Render the Current Score table (toolbar + table).
 *
 * @param {Object} outcome - the Current Score outcome
 * @param {Object} cache
 * @param {{ key: string, dir: 'asc'|'desc' }} [sortState]
 * @returns {string} HTML
 */
export function renderCurrentScoreTable(outcome, cache, sortState = DEFAULT_CURRENT_SCORE_SORT) {
    const { outcomes, rows } = buildCurrentScoreRows(outcome, cache);
    const sorted = sortCurrentScoreRows(rows, sortState);
    const dir = sortState?.dir === 'desc' ? 'desc' : 'asc';
    const key = String(sortState?.key ?? 'name');

    const option = (value, label) =>
        `<option value="${escapeHtml(value)}"${value === key ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const options = [
        option('name', 'Student name'),
        option('current', 'Current Score'),
        ...outcomes.map(o => option(String(o.id), o.title || String(o.id))),
    ].join('');

    const toolbar = `
        <div class="os-status-banner syncing cs-toolbar">
          <div class="os-status-banner-left">
            <label>Sort by
              <select data-action="cs-sort-key" aria-label="Sort students by">${options}</select>
            </label>
            <button class="btn btn-sm" data-action="cs-sort-dir"
                title="${dir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}"
                aria-label="Toggle sort direction">${dir === 'asc' ? '↑' : '↓'}</button>
          </div>
          <div class="os-status-banner-actions">
            <button class="os-refresh-outcome-btn" data-action="os-refresh-outcome"
                title="Refresh scores from Canvas"
                aria-label="Refresh scores from Canvas">↻</button>
          </div>
        </div>`;

    const body = sorted.map(r => {
        const hasCurrent = r.current !== null;
        const currentStyle = scoreToneStyle(hasCurrent ? scoreTone(r.current) : 'ne');
        return `
            <tr data-stu="${escapeHtml(r.id)}">
              <td><span class="os-stu-name">${escapeHtml(r.name)}</span></td>
              <td class="cs-chips">${r.chips.map(renderChip).join(' ')}</td>
              <td class="c cs-current">
                <span class="os-pill" style="${currentStyle}"
                    ${r.currentPending ? 'title="Waiting for Canvas to update the Current Score"' : ''}>${hasCurrent ? r.current.toFixed(2) : '—'}</span>${r.currentPending ? '<span class="cs-pending"> ⏳</span>' : ''}
              </td>
            </tr>`;
    }).join('');

    return `
        ${toolbar}
        <div class="os-block">
          <table>
            <thead><tr>
              <th style="width:1%;min-width:130px;white-space:nowrap;">Student</th>
              <th>Outcomes</th>
              <th class="c">Canvas</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        <div class="os-table-hint">
          Each chip is the student's Canvas score for an outcome in the average · Hover a chip for the outcome name · ⏳ = Canvas is updating
        </div>`;
}

/**
 * Wire the Current Score table's sort controls and refresh button. Listeners are
 * delegated on contentEl, so they survive renderTable() replacing its HTML.
 *
 * @param {Object}   opts
 * @param {HTMLElement} opts.contentEl
 * @param {Object}   opts.state            - holds currentScoreSort
 * @param {Function} opts.renderTable
 * @param {Function} [opts.onRefreshOutcome] - re-pull Canvas scores
 * @returns {Function} teardown
 */
export function wireCurrentScoreTable({ contentEl, state, renderTable, onRefreshOutcome }) {
    if (!state.currentScoreSort) state.currentScoreSort = { ...DEFAULT_CURRENT_SCORE_SORT };

    const onChange = (e) => {
        const el = e.target.closest?.('[data-action="cs-sort-key"]');
        if (!el) return;
        state.currentScoreSort = { ...state.currentScoreSort, key: el.value };
        renderTable();
    };

    const onClick = async (e) => {
        const el = e.target.closest?.('[data-action]');
        if (!el || !contentEl.contains(el)) return;
        const action = el.dataset.action;
        if (action === 'cs-sort-dir') {
            e.stopPropagation();
            const dir = state.currentScoreSort.dir === 'desc' ? 'asc' : 'desc';
            state.currentScoreSort = { ...state.currentScoreSort, dir };
            renderTable();
            return;
        }
        if (action === 'os-refresh-outcome') {
            e.stopPropagation();
            if (el.disabled) return;
            el.disabled = true;
            el.classList.add('spinning');
            try {
                await onRefreshOutcome?.();
            } finally {
                el.disabled = false;
                el.classList.remove('spinning');
            }
        }
    };

    contentEl.addEventListener('change', onChange);
    contentEl.addEventListener('click', onClick);
    return () => {
        contentEl.removeEventListener('change', onChange);
        contentEl.removeEventListener('click', onClick);
    };
}
