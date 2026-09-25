// src/masteryOutlook/studentSyncTable.js
/**
 * Student-level sync table (the "All Students" tab on an expanded outcome).
 *
 * Carved out of masteryOutlookView.js so the os-* slice — pill clicks,
 * Will Post inline edit, lock/unlock, per-row save, save-all, dot popovers
 * with ignore toggle, and note input — can evolve independently of the
 * outcome dashboard.
 *
 * Public surface:
 *   - renderOutcomeStudentTable(outcome, cache) → HTML string
 *   - wireOutcomeStudentTable({ contentEl, outcome, cache, courseId,
 *                               apiClient, renderTable }) → teardown fn
 *
 * The teardown removes the document-level "click outside dot" listener so
 * tab switches and panel rebuilds do not leak handlers.
 */

import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/html.js';
import { scoresMatch, getSyncStatus, VERIFYING_TIP, POSSIBLE_OVERRIDE_TIP } from './plOutlookSyncStatus.js';
import { roundToHalf } from './powerLaw.js';
import { scoreTone, scoreToneStyle } from '../ui/masteryColors.js';
import {
    handleSyncStudents,
    handleMarzanoPillClick, handleCanvasPillClick, handleCustomValueTyped, handleClearWillPost,
    handleLockWillPost, handleUnlockWillPost, handleNoteChanged,
    handleIgnoreAlignment, handleUnignoreAlignment,
    initWriteScheduler,
} from './plOutlookActions.js';
import { refreshStudentOutcomeData } from './masteryOutlookDataService.js';
import { fetchingStudentIds, syncingStudentIds, syncStudentPhase, syncingOutcomeIds, queuedSyncKeys, queuedOutcomeIds } from './masteryOutlookState.js';

/**
 * Build plAssignmentIds Set from in-memory cache for PL result filtering.
 * Mirrors the same helper in outcomeRow.js — defined locally to avoid
 * a cross-module dependency between view files.
 * @param {Object} cache
 * @returns {Set<string>}
 */
function buildPlAssignmentIds(cache) {
    return new Set(
        Object.values(cache.pl_assignments ?? {})
            .map(a => `assignment_${a.assignment_id}`)
            .filter(Boolean)
    );
}

/**
 * Format an ISO date string to a short month-day string, e.g. "Apr 9".
 *
 * @param {string|null} iso
 * @returns {string}
 */
function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Row state builder ───────────────────────────────────────────────────────

/**
 * Build the per-student row state object used by renderOutcomeStudentRow.
 *
 * @param {Object}   student             - entry from cache.students
 * @param {Object}   outcomeData         - student.outcomes entry matching this outcome
 * @param {Object}   syncEntry           - sync_state[outcomeId][studentId] (may be {})
 * @param {Object[]} ignoredAlignments   - cache.ignored_alignments array
 * @param {string|number} outcomeId
 * @param {Object}   [plConfig]          - { pl_assignments, sync_state } for the Canvas-sync marker
 * @returns {{id, name, sortableName, canvas, marzano, willPost, lock, note, dots, status, marker, lastOverride, syncPhase}}
 *   status: 'ne' | 'none' | 'synced' | 'verify_failed' | 'needs'
 *   'none' = no teacher-set override; nothing will be pushed for this row.
 *   marker: 'verifying' | 'possible_override' | null — from getSyncStatus(), shown beside the Canvas pill
 */
function buildOutcomeStudentRow(student, outcomeData, syncEntry, ignoredAlignments, outcomeId, plConfig = null) {
    const canvas  = outcomeData?.canvasScore  ?? null;
    const marzano = outcomeData?.plPrediction ?? null;

    // Override is blank until a teacher sets it — no Marzano fallback.
    const willPost = syncEntry?.will_post ?? null;

    const wpLock = syncEntry?.will_post_lock;
    const lock = wpLock === 'locked' ? 'locked'
              : wpLock === 'unlocked' ? 'unlocked'
              : 'none';

    const note = syncEntry?.will_post_note ?? '';

    const oidStr   = String(outcomeId);
    const sidStr   = String(student.id);
    const ignored  = ignoredAlignments ?? [];
    const dots = (outcomeData?.attempts ?? []).map((attempt, i) => ({
        assignmentId: attempt.assignmentId ?? null,
        a: attempt.assignmentName ?? (attempt.assignmentId ? `Alignment ${i + 1}` : '—'),
        d: formatDateShort(attempt.timestamp),
        v: attempt.score != null ? Math.max(0, Math.min(4, attempt.score)) : null,
        ignored: ignored.some(ig =>
            String(ig.student_id) === sidStr &&
            String(ig.outcome_id) === oidStr &&
            ig.alignment_id       === attempt.assignmentId
        )
    }));

    const pendingNote       = syncEntry?.will_post_note              ?? null;
    const lastSubmittedNote = syncEntry?.will_post_note_last_submitted ?? null;
    const noteIsPending     = pendingNote !== null && pendingNote !== lastSubmittedNote;

    let status;
    if (willPost === null) {
        status = marzano === null ? 'ne' : 'none';
    } else if (canvas !== null && scoresMatch(willPost, canvas)
            && !noteIsPending) {
        // synced when the override matches Canvas AND no unsubmitted note exists.
        status = 'synced';
    } else if (syncEntry?.verify_mismatch === true) {
        // Score was pushed but Canvas rollup didn't confirm after all retries.
        // Persisted so the "partial update" state is visible after navigation/reload.
        status = 'verify_failed';
    } else {
        status = 'needs';
    }

    const syncStatus = plConfig
        ? getSyncStatus(student.id, outcomeId, marzano, canvas, plConfig).status
        : null;
    const marker = (syncStatus === 'verifying' || syncStatus === 'possible_override') ? syncStatus : null;

    return {
        id:           sidStr,
        name:         student.name ?? student.sortableName ?? sidStr,
        sortableName: student.sortableName ?? student.name ?? sidStr,
        canvas,
        marzano,
        willPost,
        lock,
        note,
        dots,
        status,
        marker,
        // Last score pushed to Canvas (only teacher overrides are pushed) — survives
        // the Override box being cleared after a successful save.
        lastOverride: syncEntry?.last_synced_score != null
            ? {
                score: Number(syncEntry.last_synced_score),
                at:    syncEntry.last_synced_at   ?? null,
                note:  syncEntry.last_synced_note ?? null,
            }
            : null,
        // Live sync phase for this row ('queued' | 'pushing' | 'verifying' | null) —
        // driven by syncingStudentIds/syncStudentPhase while a push is in flight, and
        // by the save queue while this row (or its outcome's "save all") is waiting.
        syncPhase: syncingStudentIds.has(`${oidStr}_${sidStr}`)
            ? (syncStudentPhase.get(`${oidStr}_${sidStr}`) ?? 'pushing')
            : (queuedSyncKeys.has(`${oidStr}_${sidStr}`) || (queuedOutcomeIds.has(oidStr) && willPost !== null))
                ? 'queued'
                : null
    };
}


// ─── Renderers ───────────────────────────────────────────────────────────────

/**
 * Render one alignment dot with hover preview + click-to-open popover.
 *
 * @param {Object} dot    - { a, d, v, ignored, assignmentId }
 * @param {string} oidStr - outcome ID string
 * @param {string} sidStr - student ID string
 * @param {number} i      - dot index within student's attempts
 * @returns {string} HTML
 */
function renderDot(dot, oidStr, sidStr, i) {
    const tone       = scoreTone(dot.v);
    const bgStyle    = scoreToneStyle(tone);
    const valStr     = dot.v != null ? dot.v.toFixed(2) : '—';
    const label      = dot.v != null
        ? (dot.v % 1 === 0 ? String(dot.v) : dot.v.toFixed(1))
        : '?';
    const asgn       = escapeHtml(dot.a || `Alignment ${i + 1}`);
    const dateStr    = escapeHtml(dot.d || '—');
    const asgnId     = escapeHtml(dot.assignmentId || '');
    const ignoredCls = dot.ignored ? 'ignored' : '';
    const statusStr  = dot.ignored ? 'true' : 'false';
    const statusCol  = dot.ignored ? 'var(--amber)' : 'var(--text-primary)';

    return `<div class="dot-wrap">
      <div class="dot ${ignoredCls}" style="${bgStyle}"
          data-action="dot-ignore-toggle" data-dot-idx="${i}"
          data-stu="${sidStr}" data-oid="${oidStr}"
          data-asgn-id="${asgnId}" tabindex="0" role="button" aria-label="${asgn}: ${valStr}">
        ${label}
        <div class="dot-preview">${asgn} · ${valStr}</div>
      </div>
      <div class="dot-popover">
        <div class="dp-hd">
          <span class="dp-title">${asgn}</span>
          <span class="dp-score" style="${bgStyle}">${valStr}</span>
        </div>
        <div class="dp-rows">
          <div class="dp-row"><span class="lbl">Date</span><span class="val">${dateStr}</span></div>
          <div class="dp-row"><span class="lbl">Score</span><span class="val">${valStr}</span></div>
          <div class="dp-row"><span class="lbl">Ignored</span>
            <span class="val" style="color:${statusCol};">${statusStr}</span></div>
        </div>
      </div>
    </div>`;
}

/**
 * Render one student row in the outcome student table.
 *
 * @param {Object} s      - row state from buildOutcomeStudentRow()
 * @param {string} oidStr - outcome ID string (for data attributes)
 * @returns {string} HTML <tr>
 */
function renderOutcomeStudentRow(s, oidStr) {
    const needsSync  = s.status === 'needs' || s.status === 'verify_failed';
    const needsCls   = needsSync          ? 'os-needs-row' : '';
    const differsCls = s.lock !== 'none' ? 'differs'      : '';

    const canvasDisp  = s.canvas  != null ? s.canvas.toFixed(2)  : '—';
    const marzDisp    = s.marzano != null ? roundToHalf(s.marzano).toFixed(2) : 'NE';
    const hasWP       = s.willPost != null;
    const wpDisp      = hasWP ? s.willPost.toFixed(2) : '';
    // With no override set, neither pill is faded — neither is "chosen".
    const canvasFaded = !hasWP || scoresMatch(s.canvas,  s.willPost) ? '' : 'faded';
    const marzFaded   = !hasWP || scoresMatch(s.marzano != null ? roundToHalf(s.marzano) : null, s.willPost) ? '' : 'faded';

    const dotsHtml = s.dots.length
        ? s.dots.map((dot, i) => renderDot(dot, oidStr, s.id, i)).join('')
        : `<span style="font-size:10px;color:var(--text-tertiary);">—</span>`;

    const lockHtml = s.lock !== 'none' ? `
        <button class="os-wp-lock ${s.lock}"
                data-action="${s.lock === 'locked' ? 'os-unlock' : 'os-lock'}"
                data-stu="${s.id}" data-oid="${oidStr}"
                aria-label="${s.lock === 'locked' ? 'Unlock Override' : 'Lock Override'}">
          ${s.lock === 'locked' ? '🔒' : '🔓'}
          <span class="os-lock-tip">${
              s.lock === 'locked'
                  ? 'Override is locked. Click to unlock.'
                  : 'Score differs from Marzano. Click to lock this value.'
          }</span>
        </button>` : '';

    const markerHtml = s.marker === 'verifying'
        ? `<span class="os-sync-marker verifying" title="${VERIFYING_TIP}" aria-label="${VERIFYING_TIP}">⏳</span>`
        : s.marker === 'possible_override'
            ? `<span class="os-sync-marker override" title="${POSSIBLE_OVERRIDE_TIP}" aria-label="${POSSIBLE_OVERRIDE_TIP}">⚑</span>`
            : '';

    const last     = s.lastOverride;
    const lastHtml = last
        ? (() => {
            const scoreStr = last.score.toFixed(2);
            const when     = last.at ? new Date(last.at) : null;
            const whenStr  = when && !isNaN(when.getTime())
                ? when.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : 'unknown date';
            const tip = `Saved to Canvas ${whenStr}${last.note ? ` · Note: ${last.note}` : ''}. Click to copy to Override.`;
            return `<button class="os-last-btn" data-action="os-use-last" data-stu="${s.id}" data-oid="${oidStr}"
                     data-last="${last.score}" title="${escapeHtml(tip)}" aria-label="${escapeHtml(`Last override ${scoreStr}. ${tip}`)}">
                  <span class="os-last-score">${scoreStr}</span>
                  <span class="os-last-date">${escapeHtml(formatDateShort(last.at))}</span>
                </button>`;
        })()
        : `<span class="os-last-none">—</span>`;

    const saveMod   = needsSync ? 'needs' : 'synced';
    const saveTitle = s.status === 'verify_failed' ? `Verify failed — re-sync ${wpDisp}`
                    : needsSync                    ? `Push ${wpDisp} to Canvas`
                    : !hasWP                       ? 'No override set'
                    :                               'Synced with Canvas';
    const saveTip   = s.status === 'verify_failed' ? 'Verify failed — re-sync'
                    : needsSync                    ? 'Push to Canvas'
                    : !hasWP                       ? 'No override set'
                    :                               'Up to date';
    const saveHtml = s.syncPhase === 'queued'
        ? `<span class="os-posting queued" title="Waiting for the current save to finish verifying">Queued…</span>`
        : s.syncPhase
        ? `<span class="os-posting"><span class="spinner"></span> ${s.syncPhase === 'verifying' ? 'Verifying…' : 'Pushing…'}</span>`
        : `<button class="os-save-row-btn ${saveMod}" data-action="os-save" data-stu="${s.id}" data-oid="${oidStr}"
               ${!needsSync ? 'disabled' : ''} title="${saveTitle}">
             <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8">
               ${saveMod === 'synced'
                  ? '<polyline points="2.5,6.5 5,9 9.5,3.5"/>'
                  : '<polyline points="2,7 6,3 10,7"/><line x1="6" y1="3" x2="6" y2="11"/>'}
             </svg>
             <span class="sr-tip">${saveTip}</span>
           </button>`;

    return `<tr class="${needsCls}" data-stu="${s.id}" data-oid="${oidStr}">
      <td><span class="os-stu-name">${escapeHtml(s.name)}</span></td>
      <td><div class="dot-row">${dotsHtml}</div></td>
      <td class="c">
        <button class="os-pill-btn ${canvasFaded}" data-action="os-use-canvas"
                data-stu="${s.id}" data-oid="${oidStr}" data-canvas="${s.canvas ?? ''}">
          <span class="os-pill" style="${scoreToneStyle(scoreTone(s.canvas))}">${canvasDisp}</span>
          <span class="os-pill-tip">Set Override = ${canvasDisp}</span>
        </button>${markerHtml}
      </td>
      <td class="c">
        <button class="os-pill-btn ${marzFaded}" data-action="os-use-marzano"
                data-stu="${s.id}" data-oid="${oidStr}" data-marzano="${s.marzano ?? ''}">
          <span class="os-pill" style="${scoreToneStyle(scoreTone(s.marzano !== null ? roundToHalf(s.marzano) : null))}">${marzDisp}</span>
          <span class="os-pill-tip">Set Override = ${marzDisp} (Marzano)</span>
        </button>
      </td>
      <td class="c">
        <div class="os-wp-outer">
          <div class="os-wp-box-wrap ${differsCls}" data-action="os-wp-click"
               data-stu="${s.id}" data-oid="${oidStr}" tabindex="0" role="button"
               aria-label="Override: ${hasWP ? wpDisp : 'not set'}">
            <div class="os-wp-box">${wpDisp}</div>
            ${lockHtml}
          </div>
        </div>
      </td>
      <td class="c">${lastHtml}</td>
      <td class="os-td-comment">
        <div class="os-note-wrap" style="position:relative; display:flex; align-items:center;">
          <input class="os-comment-input${s.lock !== 'none' ? ' override-prompted' : ''}${s.note ? ' has-note' : ''}"
                 type="text" value="${escapeHtml(s.note)}"
                 placeholder="${s.lock !== 'none' ? 'Reason for override…' : 'Note…'}"
                 data-action="os-note" data-stu="${s.id}" data-oid="${oidStr}"
                 aria-label="Note for ${escapeHtml(s.name)}"
                 style="${s.note ? 'padding-right:18px;' : ''}"
                 draggable="false"
                 type="text">
          ${s.note ? `<button class="os-note-clear"
              data-action="os-note-clear"
              data-stu="${s.id}" data-oid="${oidStr}"
              title="Clear note"
              aria-label="Clear note for ${escapeHtml(s.name)}"
              >×</button>` : ''}
        </div>
      </td>
      <td class="c">
        ${saveHtml}
        <button class="os-refresh-student-btn"
            data-action="os-refresh-student"
            data-stu="${s.id}" data-oid="${oidStr}"
            title="Refresh scores from Canvas"
            aria-label="Refresh scores for ${escapeHtml(s.name)}">↻</button>
      </td>
    </tr>`;
}

// ─── Public: table renderer ──────────────────────────────────────────────────

/**
 * Build the full outcome student table HTML for the "All Students" tab.
 *
 * @param {Object} outcome
 * @param {Object} cache
 * @returns {string} HTML string
 */
export function renderOutcomeStudentTable(outcome, cache) {
    const syncState   = cache.sync_state ?? {};
    const outcomeSync = syncState[String(outcome.id)] ?? {};
    const ignored     = cache.ignored_alignments ?? [];
    const oidStr      = String(outcome.id);
    const plConfig    = { pl_assignments: cache.pl_assignments ?? {}, sync_state: syncState };

    const studentStates = cache.students
        .map(student => {
            const sId         = String(student.id);
            const outcomeData = student.outcomes.find(o => String(o.outcomeId) === oidStr);
            const entry       = outcomeSync[sId] ?? {};
            return buildOutcomeStudentRow(student, outcomeData, entry, ignored, outcome.id, plConfig);
        })
        .sort((a, b) => a.sortableName.localeCompare(b.sortableName));

    const needsCount = studentStates.filter(s => s.status === 'needs').length;

    const refreshOutcomeBtn =
        `<button class="os-refresh-outcome-btn" data-action="os-refresh-outcome"
            title="Refresh scores from Canvas"
            aria-label="Refresh scores from Canvas">↻</button>`;

    const isSyncing = syncingOutcomeIds.has(oidStr);
    const toolbarHtml = needsCount > 0
        ? isSyncing
            ? `<div class="os-status-banner syncing">
                 <div class="os-status-banner-left">
                   <span class="spinner"></span> <b>${needsCount}</b> student${needsCount !== 1 ? 's' : ''} need${needsCount === 1 ? 's' : ''} updating
                 </div>
                 <div class="os-status-banner-actions">
                   ${refreshOutcomeBtn}
                   <button class="btn btn-sm btn-primary" data-action="os-post-all" disabled>
                     Save grades to Canvas
                   </button>
                 </div>
               </div>`
            : `<div class="os-status-banner warn">
                 <div class="os-status-banner-left">
                   ⬆ <b>${needsCount}</b> student${needsCount !== 1 ? 's' : ''} need${needsCount === 1 ? 's' : ''} updating
                 </div>
                 <div class="os-status-banner-actions">
                   ${refreshOutcomeBtn}
                   <button class="btn btn-sm btn-primary" data-action="os-post-all">
                     Save grades to Canvas
                   </button>
                 </div>
               </div>`
        : `<div class="os-status-banner ok">
             <div class="os-status-banner-left">
               ✓ Canvas gradebook is up to date
             </div>
             ${refreshOutcomeBtn}
           </div>`;

    // Legend commented out — color coding is self-evident from the dot colors
    // const tones = [['hi','≥ 3.25'],['good','≥ 2.5'],['dev','≥ 1.75'],['low','< 1.75']];
    // const legendHtml = `
    //     <div class="os-legend">
    //       <span style="...">Score</span>
    //       ${tones.map(([t, lbl]) => `...`).join('')}
    //       <span class="os-leg" style="..."><span style="text-decoration:line-through;">2.5</span><span>Ignored alignment</span></span>
    //     </div>`;

    const bodyHtml = studentStates
        .map(s => renderOutcomeStudentRow(s, oidStr))
        .join('');

    return `
        ${toolbarHtml}
        ${''/* legend removed */}
        <div class="os-block">
          <table>
            <thead><tr>
              <th style="width:1%;min-width:130px;white-space:nowrap;">Student</th>
              <th>Alignments</th>
              <th class="c">Canvas</th>
              <th class="c">Marzano</th>
              <th class="c">Override</th>
              <th class="c">Last Override</th>
              <th>Note</th>
              <th class="c">Save</th>
            </tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </div>
        <div class="os-table-hint">
          Click Canvas / Marzano / Last Override to copy to Override · Click Override box to type · Padlock locks an override
        </div>`;
}

// ─── Public: wiring + teardown ───────────────────────────────────────────────

/**
 * Attach all event listeners for the student sync table.
 *
 * Owns: os-use-canvas, os-use-marzano, os-use-last, os-wp-click (inline edit), os-lock,
 * os-unlock, os-save, os-post-all, os-refresh-outcome, dot-toggle,
 * dot-ignore-toggle, os-note input, and a document-level "click outside dot to
 * close popover" listener.
 *
 * @param {Object} options
 * @param {HTMLElement} options.contentEl     - the .od-detail-content node
 * @param {Object} options.outcome
 * @param {Object} options.cache
 * @param {string|number} options.courseId
 * @param {Object} options.apiClient
 * @param {Function} options.renderTable      - re-render callback
 * @param {Function} [options.onRefreshOutcome] - re-pull live rollups for this outcome
 * @param {Function} [options.onChipUpdate]   - refresh the outcome-level chip/strip
 * @returns {Function} teardown — remove the document-level listener
 */
export function wireOutcomeStudentTable({ contentEl, outcome, cache, courseId, apiClient, renderTable, onRefreshOutcome, onChipUpdate }) {
    const outcomeName = outcome.title || String(outcome.id);

    // Seed the write scheduler's dedupe baseline with the on-disk state so the first
    // toggle that returns the cache to its loaded form skips the network entirely.
    initWriteScheduler(cache);

    contentEl.addEventListener('click', async (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;
        const stuId  = el.dataset.stu || el.dataset.studentId;
        const oId    = el.dataset.oid || el.dataset.outcomeId;

        // ── Ignore/unignore alignment ─────────────────────────────────────
        if (action === 'dot-ignore-toggle') {
            e.stopPropagation();
            const asgnId  = el.dataset.asgnId;
            const ignored = (cache.ignored_alignments ?? []).some(
                ia => String(ia.student_id) === stuId && String(ia.outcome_id) === oId && ia.alignment_id === asgnId
            );
            try {
                if (ignored) {
                    handleUnignoreAlignment({ outcomeId: oId, studentId: stuId, alignmentId: asgnId, cache, onRerender: renderTable });
                } else {
                    handleIgnoreAlignment({ outcomeId: oId, studentId: stuId, alignmentId: asgnId, cache, onRerender: renderTable });
                }
            } catch (err) {
                logger.error('[MasteryOutlook] ignore toggle failed', err);
                renderTable();
            }
            return;
        }

        // ── Canvas pill → set Will Post = canvas score ────────────────────
        if (action === 'os-use-canvas') {
            const cv = parseFloat(el.dataset.canvas);
            if (isNaN(cv)) return;
            await handleCanvasPillClick({ courseId, outcomeId: oId, studentId: stuId, canvasScore: cv, cache, apiClient, onRerender: renderTable });
            return;
        }

        // ── Marzano pill → set Will Post = rounded Marzano score ──────────
        if (action === 'os-use-marzano') {
            const mz = parseFloat(el.dataset.marzano);
            if (isNaN(mz)) return;
            await handleMarzanoPillClick({ courseId, outcomeId: oId, studentId: stuId, plPrediction: mz, cache, apiClient, onRerender: renderTable });
            return;
        }

        // ── Last Override → set Will Post = last score pushed to Canvas ───
        if (action === 'os-use-last') {
            const last = parseFloat(el.dataset.last);
            if (isNaN(last)) return;
            await handleCustomValueTyped({ courseId, outcomeId: oId, studentId: stuId, value: last, cache, apiClient, onRerender: renderTable });
            return;
        }

        // ── Will Post box click → inline edit ─────────────────────────────
        if (action === 'os-wp-click') {
            const wrap = el.closest('.os-wp-box-wrap');
            if (!wrap || wrap.querySelector('.os-wp-input')) return;
            const boxEl  = wrap.querySelector('.os-wp-box');
            const curVal = boxEl?.textContent?.trim() ?? '';
            const input  = document.createElement('input');
            input.className = 'os-wp-input';
            input.type = 'text'; input.inputMode = 'decimal';
            input.value = (curVal !== 'NE' && curVal !== '—') ? curVal : '';

            boxEl?.replaceWith(input);
            input.select();

            const commitEdit = async () => {
                const raw = parseFloat(input.value);
                if (input.value.trim() === '') {
                    // Blank input → remove the override (nothing will be pushed)
                    await handleClearWillPost({ courseId, outcomeId: oId, studentId: stuId, cache, apiClient, onRerender: renderTable });
                } else if (!isNaN(raw)) {
                    const clamped = Math.max(0, Math.min(4, raw));
                    await handleCustomValueTyped({ courseId, outcomeId: oId, studentId: stuId, value: clamped, cache, apiClient, onRerender: renderTable });
                } else {
                    renderTable();
                }
            };
            input.addEventListener('blur',   commitEdit);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter')  { ev.preventDefault(); input.blur(); }
                if (ev.key === 'Escape') { input.removeEventListener('blur', commitEdit); renderTable(); }
            });
            return;
        }

        // ── Padlock → lock ────────────────────────────────────────────────
        if (action === 'os-lock') {
            await handleLockWillPost({ courseId, outcomeId: oId, studentId: stuId, cache, apiClient, onRerender: renderTable });
            return;
        }
        // ── Padlock → unlock ──────────────────────────────────────────────
        if (action === 'os-unlock') {
            await handleUnlockWillPost({ courseId, outcomeId: oId, studentId: stuId, cache, apiClient, onRerender: renderTable });
            return;
        }

        // ── Save row → push to Canvas ─────────────────────────────────────
        if (action === 'os-save') {
            if (el.disabled) return;
            el.disabled = true;
            try {
                await handleSyncStudents({ courseId, outcomeId: oId, outcomeName,
                    studentIds: [stuId], apiClient, cache, onRerender: renderTable });
                onChipUpdate?.();
            } catch (err) {
                logger.error('[MasteryOutlook] os-save failed', err);
                el.disabled = false;
            }
            return;
        }

        // ── Per-student refresh — fetch fresh attempts + canvas score ─────
        if (action === 'os-refresh-student') {
            const key = `${oId}_${stuId}`;
            if (fetchingStudentIds.has(key)) return;   // already in flight
            fetchingStudentIds.add(key);
            el.disabled = true;
            el.textContent = '…';
            try {
                const plAssignmentIds = buildPlAssignmentIds(cache);
                const changed = await refreshStudentOutcomeData(
                    courseId, oId, stuId, cache, apiClient, plAssignmentIds
                );
                if (changed) renderTable();
            } catch (err) {
                logger.error('[MasteryOutlook] os-refresh-student failed', err);
            } finally {
                fetchingStudentIds.delete(key);
                el.disabled = false;
                el.textContent = '↻';
            }
            return;
        }

        // ── Refresh outcome — re-pull live rollups for this outcome ───────
        if (action === 'os-refresh-outcome') {
            if (el.disabled) return;
            el.disabled = true;
            el.classList.add('spinning');
            try {
                await onRefreshOutcome?.();
            } catch (err) {
                logger.error('[MasteryOutlook] os-refresh-outcome failed', err);
            } finally {
                el.disabled = false;
                el.classList.remove('spinning');
            }
            return;
        }

        // ── Save all ──────────────────────────────────────────────────────
        if (action === 'os-post-all') {
            if (el.disabled) return;
            el.disabled = true;
            try {
                await handleSyncStudents({ courseId, outcomeId: String(outcome.id), outcomeName,
                    studentIds: null, apiClient, cache, onRerender: renderTable });
                onChipUpdate?.();
            } catch (err) {
                logger.error('[MasteryOutlook] os-post-all failed', err);
            }
            renderTable();
            return;
        }
    });

    // Note clear button — × clears the input and triggers a note update
    contentEl.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action="os-note-clear"]');
        if (!el) return;
        const wrap  = el.closest('.os-note-wrap');
        const input = wrap?.querySelector('[data-action="os-note"]');
        if (!input) return;
        input.value = '';
        input.classList.remove('has-note');
        handleNoteChanged({
            courseId,
            outcomeId:  el.dataset.oid,
            studentId:  el.dataset.stu,
            noteValue:  '',
            cache,
            apiClient,
            onRerender: renderTable,
        });
    });

    // Note input — debounced (separate listener since it's an input event)
    contentEl.addEventListener('input', (e) => {
        const el = e.target.closest('[data-action="os-note"]');
        if (!el) return;
        el.classList.toggle('has-note', el.value.trim().length > 0);
        handleNoteChanged({
            courseId,
            outcomeId:  el.dataset.oid,
            studentId:  el.dataset.stu,
            noteValue:  el.value,
            cache,
            apiClient,
            onRerender: renderTable,
        });
    });

    // Prevent note input mousedown from propagating to the draggable outcome row,
    // which would trigger row reordering instead of text selection.
    contentEl.addEventListener('mousedown', (e) => {
        const el = e.target.closest('[data-action="os-note"]');
        if (!el) return;
        e.stopPropagation();
    });

    return () => {};
}