// src/masteryOutlook/currentScoreTable.js
/**
 * Current Score detail table.
 *
 * One row per student: a column per averaged outcome (the student's Canvas
 * score, in the teacher's outcome order), the Current Score Canvas reports, and
 * a course-grade Override + Note.
 *
 * - Outcome column headers show the teacher's display names (✎ to rename) and
 *   can be dragged to reorder — the same order as the outcome-list drag-and-drop.
 * - Override sets the course grade override (0–4, same as "Update Current Score").
 *   🔓 unlocked (default): the next outcome save recalculates the Current Score and
 *   replaces it. 🔒 locked: outcome saves leave it alone.
 *
 * ⏳ marks a chip while that outcome's save for the student is queued / running
 * or Canvas hasn't recalculated it yet, and marks the Current Score while any of
 * the student's chips is ⏳ or the new average hasn't been confirmed.
 */

import { escapeHtml } from '../utils/html.js';
import { scoreTone, scoreToneStyle } from '../ui/masteryColors.js';
import { ENABLE_GRADE_OVERRIDE } from '../config.js';
import { getAveragedOutcomes, getOutcomeDisplayName } from './outcomeTypes.js';
import { rowSavePhase, rowsAwaitingOutcome } from './masteryOutlookState.js';

/** Default sort: student name, A→Z. */
export const DEFAULT_CURRENT_SCORE_SORT = Object.freeze({ key: 'name', dir: 'asc' });

/** dataTransfer type for dragging an outcome column header. */
const COLUMN_DRAG_TYPE = 'application/x-cg-outcome-column';

/**
 * Fresh per-panel view state for the editable parts of the table.
 * @returns {{ drafts: Object, saving: Set<string>, errors: Object, renamingId: string|null }}
 */
export function createCurrentScoreViewState() {
    return { drafts: {}, saving: new Set(), errors: {}, renamingId: null };
}

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

/** A just-saved override can differ from Canvas until Canvas recalculates. */
const DRIFT_GRACE_MS = 10 * 60 * 1000;

/**
 * The teacher's Current Score override for a student (sync_state on the Current
 * Score outcome), or null.
 * @returns {{ score: number, note: string, locked: boolean, at: string|null, by: string|null, lockAt: string|null }|null}
 */
function overrideOf(cache, outcomeId, studentId) {
    const entry = cache?.sync_state?.[String(outcomeId)]?.[String(studentId)];
    const score = entry?.cs_override_score;
    if (score === null || score === undefined || isNaN(score)) return null;
    return {
        score:  Number(score),
        note:   entry.cs_override_note ?? '',
        locked: entry.cs_override_lock === 'locked',
        at:     entry.cs_override_at ?? null,
        by:     entry.cs_override_by ?? null,
        lockAt: entry.cs_override_lock_at ?? null,
    };
}

/**
 * Number of students with a locked Current Score override.
 * @param {Object} cache
 * @param {string|number} outcomeId - the Current Score outcome
 * @returns {number}
 */
export function countLockedOverrides(cache, outcomeId) {
    const entries = cache?.sync_state?.[String(outcomeId)] ?? {};
    return Object.keys(entries).filter(sid => overrideOf(cache, outcomeId, sid)?.locked).length;
}

/**
 * True when Canvas's Current Score no longer matches the saved override — it was
 * changed outside Mastery Outlook (e.g. in SpeedGrader or the Gradebook).
 * @param {Object} row - from buildCurrentScoreRows
 * @param {number} [now]
 * @returns {boolean}
 */
export function overrideDrifted(row, now = Date.now()) {
    if (!row.override || row.current === null || row.currentPending) return false;
    const at = row.override.at ? Date.parse(row.override.at) : NaN;
    if (!Number.isNaN(at) && now - at < DRIFT_GRACE_MS) return false;
    return Math.abs(row.current - row.override.score) > 0.005;
}

function formatShortDate(iso) {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

function formatLongDate(iso) {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime())
        ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
}

/**
 * Build the Current Score table rows.
 *
 * @param {Object} outcome - the Current Score outcome
 * @param {Object} cache
 * @returns {{ outcomes: Object[], rows: Array<{ id: string, name: string, sortableName: string,
 *            current: number|null, currentPending: boolean,
 *            override: { score: number, note: string, locked: boolean }|null,
 *            chips: Array<{ outcomeId: string, title: string, score: number|null, pending: boolean }> }> }}
 */
export function buildCurrentScoreRows(outcome, cache) {
    const outcomes = getAveragedOutcomes(cache);
    const rows = (cache.students || []).map(student => {
        const sid = String(student.id);
        const chips = outcomes.map(o => ({
            outcomeId: String(o.id),
            title:     getOutcomeDisplayName(o, cache),
            score:     canvasScoreOf(student, o.id),
            pending:   isScorePending(o.id, sid),
        }));
        return {
            id:             sid,
            name:           student.name || sid,
            sortableName:   student.sortableName || student.name || sid,
            current:        canvasScoreOf(student, outcome.id),
            currentPending: chips.some(c => c.pending) || rowsAwaitingOutcome.has(`${outcome.id}_${sid}`),
            override:       overrideOf(cache, outcome.id, sid),
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

/**
 * Parse an Override box value. '' → null (no override / remove it).
 * @param {string} text
 * @returns {{ value: number|null, error: string|null }}
 */
export function parseOverrideInput(text) {
    const t = String(text ?? '').trim();
    if (t === '') return { value: null, error: null };
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 4) return { value: null, error: 'Enter a score from 0 to 4' };
    return { value: n, error: null };
}

/** Override / note text currently shown for a row (draft if the teacher is editing). */
function draftFor(row, view) {
    const d = view?.drafts?.[row.id];
    return {
        score: d?.score ?? (row.override ? String(row.override.score) : ''),
        note:  d?.note  ?? (row.override?.note ?? ''),
    };
}

/**
 * True when the row's Override / Note differ from what's saved.
 * @param {Object} row  - from buildCurrentScoreRows
 * @param {Object} view - from createCurrentScoreViewState
 * @returns {boolean}
 */
export function isOverrideDirty(row, view) {
    const draft = draftFor(row, view);
    const { value, error } = parseOverrideInput(draft.score);
    if (error) return true;   // let Save run so it can show the error
    const savedScore = row.override?.score ?? null;
    const scoreChanged = value === null ? savedScore !== null : (savedScore === null || Math.abs(value - savedScore) > 1e-9);
    const noteChanged = draft.note.trim() !== (row.override?.note ?? '').trim();
    return scoreChanged || (noteChanged && (value !== null || savedScore !== null));
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

function renderColumnHeader(o, cache, view) {
    const oid  = escapeHtml(String(o.id));
    const name = getOutcomeDisplayName(o, cache);
    if (view?.renamingId === String(o.id)) {
        return `<th class="c cs-col-head renaming" data-col-oid="${oid}">
              <input class="cs-col-rename-input" data-action="cs-rename-input" data-oid="${oid}"
                  value="${escapeHtml(name)}" aria-label="Name for ${escapeHtml(o.title || name)}"
                  placeholder="${escapeHtml(o.title || '')}">
            </th>`;
    }
    const tip = name !== o.title
        ? `${name} (${o.title}) — drag to reorder`
        : `${name} — drag to reorder`;
    return `<th class="c cs-col-head" draggable="true" data-col-oid="${oid}" title="${escapeHtml(tip)}">
          <span class="cs-col-name">${escapeHtml(name)}</span><button class="cs-col-rename" data-action="cs-rename"
              data-oid="${oid}" title="Rename" aria-label="Rename ${escapeHtml(name)}">✎</button>
        </th>`;
}

function renderOverrideCells(row, view) {
    const draft  = draftFor(row, view);
    const saving = view?.saving?.has(row.id);
    const error  = view?.errors?.[row.id];
    const dirty  = isOverrideDirty(row, view);
    const sid    = escapeHtml(row.id);

    const lockHtml = row.override
        ? `<button class="cs-ov-lock ${row.override.locked ? 'locked' : 'unlocked'}" data-action="cs-ov-lock" data-stu="${sid}"
              aria-pressed="${row.override.locked}"
              title="${row.override.locked
                  ? 'Locked — outcome saves keep this override. Click to unlock.'
                  : 'Unlocked — the next outcome save replaces this override with the Current Score. Click to lock.'}"
              aria-label="${row.override.locked ? 'Unlock override' : 'Lock override'}">${row.override.locked ? '🔒' : '🔓'}</button>`
        : '';

    const ov = row.override;
    const dateTip = ov?.at
        ? [`Set ${formatLongDate(ov.at)}${ov.by ? ` by ${ov.by}` : ''}`,
           ov.locked && ov.lockAt ? `Locked ${formatLongDate(ov.lockAt)}` : ''].filter(Boolean).join(' · ')
        : '';
    const dateHtml = ov?.at
        ? `<span class="cs-ov-date" title="${escapeHtml(dateTip)}">${escapeHtml(formatShortDate(ov.at))}</span>`
        : '';

    const removing = parseOverrideInput(draft.score).value === null && row.override;
    const saveHtml = saving
        ? `<span class="os-posting"><span class="spinner"></span> Saving…</span>`
        : `<button class="os-save-row-btn ${dirty ? 'needs' : 'synced'}" data-action="cs-ov-save" data-stu="${sid}"
              ${dirty ? '' : 'disabled'}
              title="${removing ? 'Remove the override' : dirty ? 'Save override to Canvas' : 'No changes'}">
             <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8">
               ${dirty ? '<polyline points="2,7 6,3 10,7"/><line x1="6" y1="3" x2="6" y2="11"/>' : '<polyline points="2.5,6.5 5,9 9.5,3.5"/>'}
             </svg>
           </button>`;

    return `
      <td class="c cs-ov-cell">
        <span class="cs-ov-wrap">
          <input class="cs-ov-input${row.override ? ' has-override' : ''}" type="text" inputmode="decimal"
              data-action="cs-ov-score" data-stu="${sid}" value="${escapeHtml(draft.score)}"
              placeholder="—" aria-label="Current Score override for ${escapeHtml(row.name)} (0–4)">${lockHtml}
        </span>${dateHtml}
      </td>
      <td class="c cs-note-cell">
        <input class="os-comment-input cs-ov-note" type="text" data-action="cs-ov-note" data-stu="${sid}"
            value="${escapeHtml(draft.note)}" placeholder="Note…" title="${escapeHtml(draft.note)}"
            aria-label="Override note for ${escapeHtml(row.name)}">
      </td>
      <td class="c">${saveHtml}${error ? `<div class="cs-ov-error" role="alert">${escapeHtml(error)}</div>` : ''}</td>`;
}

/**
 * Render the Current Score table (toolbar + table).
 *
 * @param {Object} outcome - the Current Score outcome
 * @param {Object} cache
 * @param {{ key: string, dir: 'asc'|'desc' }} [sortState]
 * @param {Object} [view] - from createCurrentScoreViewState (drafts, saving, errors, renamingId)
 * @param {{ overrideEnabled?: boolean }} [options]
 * @returns {string} HTML
 */
export function renderCurrentScoreTable(outcome, cache, sortState = DEFAULT_CURRENT_SCORE_SORT,
                                        view = createCurrentScoreViewState(),
                                        { overrideEnabled = ENABLE_GRADE_OVERRIDE } = {}) {
    const { outcomes, rows } = buildCurrentScoreRows(outcome, cache);
    const sorted = sortCurrentScoreRows(rows, sortState);
    const dir = sortState?.dir === 'desc' ? 'desc' : 'asc';
    const key = String(sortState?.key ?? 'name');

    const option = (value, label) =>
        `<option value="${escapeHtml(value)}"${value === key ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const options = [
        option('name', 'Student name'),
        option('current', 'Current Score'),
        ...outcomes.map(o => option(String(o.id), getOutcomeDisplayName(o, cache))),
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
        const drift = overrideEnabled && overrideDrifted(r)
            ? `<span class="os-sync-marker override" title="Canvas shows ${r.current.toFixed(2)}, but the override is ${r.override.score.toFixed(2)} — it was changed outside Mastery Outlook. Save the override again to restore it.">⚑</span>`
            : '';
        return `
            <tr data-stu="${escapeHtml(r.id)}"${overrideEnabled && r.override?.locked ? ' class="cs-row-locked"' : ''}>
              <td><span class="os-stu-name">${escapeHtml(r.name)}</span></td>
              ${r.chips.map(c => `<td class="c cs-chip-cell">${renderChip(c)}</td>`).join('')}
              <td class="c cs-current">
                <span class="os-pill" style="${currentStyle}"
                    ${r.currentPending ? 'title="Waiting for Canvas to update the Current Score"' : ''}>${hasCurrent ? r.current.toFixed(2) : '—'}</span>${r.currentPending ? '<span class="cs-pending"> ⏳</span>' : ''}${drift}
              </td>
              ${overrideEnabled ? renderOverrideCells(r, view) : ''}
            </tr>`;
    }).join('');

    const hint = overrideEnabled
        ? `Current Score = the average of the student's outcome scores in Canvas · ⏳ = Canvas is updating ·
           Override sets the Current Score and course grade (0–4) · 🔓 the next outcome save replaces it · 🔒 keeps it ·
           Drag outcome names to reorder · ✎ to rename`
        : `Current Score = the average of the student's outcome scores in Canvas · ⏳ = Canvas is updating ·
           Drag outcome names to reorder · ✎ to rename · Course grade overrides are turned off for this account`;

    const lockedCount = overrideEnabled ? rows.filter(r => r.override?.locked).length : 0;
    const lockBanner = lockedCount > 0
        ? `<div class="os-status-banner warn cs-lock-banner">
             <div class="os-status-banner-left">🔒 <b>${lockedCount}</b> student${lockedCount === 1 ? ' has a locked Current Score override' : 's have locked Current Score overrides'} — outcome saves and Update Current Score won't change ${lockedCount === 1 ? 'it' : 'them'}.</div>
           </div>`
        : '';

    return `
        ${toolbar}
        ${lockBanner}
        <div class="os-block cs-table-wrap">
          <table>
            <thead><tr>
              <th style="width:1%;min-width:130px;white-space:nowrap;">Student</th>
              ${outcomes.map(o => renderColumnHeader(o, cache, view)).join('')}
              <th class="c">Canvas</th>
              ${overrideEnabled ? '<th class="c">Override</th><th class="c">Note</th><th class="c">Save</th>' : ''}
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        <div class="os-table-hint">${hint}</div>`;
}

/**
 * Move `draggedId` before/after `targetId` in `order`.
 * @param {string[]} order
 * @param {string} draggedId
 * @param {string} targetId
 * @param {boolean} after
 * @returns {string[]}
 */
export function moveOutcomeInOrder(order, draggedId, targetId, after) {
    const ids = order.map(String).filter(id => id !== String(draggedId));
    const at  = ids.indexOf(String(targetId));
    if (at === -1) return order.map(String);
    ids.splice(after ? at + 1 : at, 0, String(draggedId));
    return ids;
}

/**
 * Wire the Current Score table. Listeners are delegated on contentEl, so they
 * survive renderTable() replacing its HTML.
 *
 * @param {Object}   opts
 * @param {HTMLElement} opts.contentEl
 * @param {Object}   opts.state            - holds currentScoreSort and csView
 * @param {Object}   opts.outcome          - the Current Score outcome
 * @param {Object}   opts.cache
 * @param {Function} opts.renderTable
 * @param {Function} [opts.onRefreshOutcome] - re-pull Canvas scores
 * @param {Function} [opts.onSaveOverride]   - (studentId, { score: number|null, note }) => Promise
 * @param {Function} [opts.onToggleLock]     - (studentId, locked: boolean) => Promise
 * @param {Function} [opts.onReorder]        - (newOrder: string[]) => void
 * @param {Function} [opts.onRename]         - (outcomeId, name) => void
 * @returns {Function} teardown
 */
export function wireCurrentScoreTable({
    contentEl, state, outcome, cache, renderTable, onRefreshOutcome,
    onSaveOverride, onToggleLock, onReorder, onRename,
}) {
    if (!state.currentScoreSort) state.currentScoreSort = { ...DEFAULT_CURRENT_SCORE_SORT };
    if (!state.csView) state.csView = createCurrentScoreViewState();
    const view = state.csView;

    const rowById = (sid) => buildCurrentScoreRows(outcome, cache).rows.find(r => r.id === String(sid));

    const saveRow = async (sid) => {
        const row = rowById(sid);
        if (!row || view.saving.has(row.id)) return;
        const draft = draftFor(row, view);
        const { value, error } = parseOverrideInput(draft.score);
        if (error) { view.errors[row.id] = error; renderTable(); return; }
        if (value === null && draft.note.trim() && !row.override) {
            view.errors[row.id] = 'Enter an override score first';
            renderTable();
            return;
        }
        if (!isOverrideDirty(row, view)) return;
        await onSaveOverride?.(row.id, { score: value, note: draft.note.trim() });
    };

    // Keep the row's Save button in step with typing without re-rendering (keeps focus).
    const refreshSaveButton = (sid) => {
        const row = rowById(sid);
        const btn = contentEl.querySelector(`[data-action="cs-ov-save"][data-stu="${String(sid).replace(/["\\]/g, '\\$&')}"]`);
        if (!row || !btn) return;
        const dirty = isOverrideDirty(row, view);
        btn.disabled = !dirty;
        btn.classList.toggle('needs', dirty);
        btn.classList.toggle('synced', !dirty);
    };

    let renameCommitted = false;
    const commitRename = (input) => {
        if (renameCommitted) return;
        renameCommitted = true;
        const oid = input.dataset.oid;
        view.renamingId = null;
        onRename?.(oid, input.value);
        renderTable();
    };
    const cancelRename = () => {
        renameCommitted = true;
        view.renamingId = null;
        renderTable();
    };

    const onChange = (e) => {
        const el = e.target.closest?.('[data-action="cs-sort-key"]');
        if (!el) return;
        state.currentScoreSort = { ...state.currentScoreSort, key: el.value };
        renderTable();
    };

    const onInput = (e) => {
        const el = e.target;
        const action = el?.dataset?.action;
        if (action !== 'cs-ov-score' && action !== 'cs-ov-note') return;
        const sid = el.dataset.stu;
        const row = rowById(sid);
        if (!row) return;
        view.drafts[sid] = { ...draftFor(row, view), [action === 'cs-ov-score' ? 'score' : 'note']: el.value };
        delete view.errors[sid];
        refreshSaveButton(sid);
    };

    const onKeydown = (e) => {
        const el = e.target;
        const action = el?.dataset?.action;
        if (action === 'cs-rename-input') {
            if (e.key === 'Enter')  { e.preventDefault(); commitRename(el); }
            if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
            return;
        }
        if ((action === 'cs-ov-score' || action === 'cs-ov-note') && e.key === 'Enter') {
            e.preventDefault();
            saveRow(el.dataset.stu);
        }
    };

    const onFocusOut = (e) => {
        if (e.target?.dataset?.action === 'cs-rename-input') commitRename(e.target);
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
        if (action === 'cs-rename') {
            e.stopPropagation();
            view.renamingId = el.dataset.oid;
            renameCommitted = false;
            renderTable();
            const input = contentEl.querySelector('[data-action="cs-rename-input"]');
            input?.focus();
            input?.select();
            return;
        }
        if (action === 'cs-ov-save') {
            e.stopPropagation();
            await saveRow(el.dataset.stu);
            return;
        }
        if (action === 'cs-ov-lock') {
            e.stopPropagation();
            const row = rowById(el.dataset.stu);
            if (row?.override) await onToggleLock?.(row.id, !row.override.locked);
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

    // ── Column drag-and-drop (same saved order as the outcome list) ──────────
    let draggedId = null;
    const headOf = (e) => e.target.closest?.('th[data-col-oid]');
    const clearMarks = () => contentEl.querySelectorAll('th.cs-drop-before, th.cs-drop-after')
        .forEach(th => th.classList.remove('cs-drop-before', 'cs-drop-after'));
    const dropAfter = (th, e) => {
        const r = th.getBoundingClientRect();
        return e.clientX > r.left + r.width / 2;
    };

    const onDragStart = (e) => {
        const th = headOf(e);
        if (!th || th.classList.contains('renaming')) return;
        e.stopPropagation();
        draggedId = th.dataset.colOid;
        // Custom type only — the outcome list's drop handler reads text/plain.
        e.dataTransfer?.setData(COLUMN_DRAG_TYPE, draggedId);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        th.classList.add('cs-dragging');
    };
    const onDragOver = (e) => {
        const th = headOf(e);
        if (!th || draggedId === null) return;
        e.preventDefault();
        e.stopPropagation();
        clearMarks();
        if (th.dataset.colOid !== draggedId) th.classList.add(dropAfter(th, e) ? 'cs-drop-after' : 'cs-drop-before');
    };
    const onDrop = (e) => {
        const th = headOf(e);
        if (!th || draggedId === null) return;
        e.preventDefault();
        e.stopPropagation();
        const targetId = th.dataset.colOid;
        const after = dropAfter(th, e);
        clearMarks();
        if (targetId === draggedId) return;
        const current = getAveragedOutcomes(cache).map(o => String(o.id));
        const next = moveOutcomeInOrder(current, draggedId, targetId, after);
        if (JSON.stringify(next) !== JSON.stringify(current)) onReorder?.(next);
    };
    const onDragEnd = () => {
        draggedId = null;
        clearMarks();
        contentEl.querySelectorAll('th.cs-dragging').forEach(th => th.classList.remove('cs-dragging'));
    };

    const listeners = [
        ['change', onChange], ['input', onInput], ['keydown', onKeydown], ['focusout', onFocusOut],
        ['click', onClick], ['dragstart', onDragStart], ['dragover', onDragOver],
        ['drop', onDrop], ['dragend', onDragEnd], ['dragleave', clearMarks],
    ];
    listeners.forEach(([type, fn]) => contentEl.addEventListener(type, fn));
    return () => listeners.forEach(([type, fn]) => contentEl.removeEventListener(type, fn));
}
