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
import { scoresMatch } from './plOutlookSyncStatus.js';
import { scoreTone, scoreToneStyle } from '../ui/masteryColors.js';
import {
    handleSyncOneStudent,
    handleMarzanoPillClick, handleCanvasPillClick, handleCustomValueTyped,
    handleLockWillPost, handleUnlockWillPost, handleNoteChanged,
    handleIgnoreAlignment, handleUnignoreAlignment,
} from './plOutlookActions.js';

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
 * @returns {{id, name, sortableName, canvas, marzano, willPost, lock, note, dots, status, pushing}}
 */
function buildOutcomeStudentRow(student, outcomeData, syncEntry, ignoredAlignments, outcomeId) {
    const canvas  = outcomeData?.canvasScore  ?? null;
    const marzano = outcomeData?.plPrediction ?? null;

    const storedWP = syncEntry?.will_post ?? null;
    const willPost = storedWP ?? marzano;

    let lock;
    if (syncEntry?.will_post_lock === 'locked') {
        lock = 'locked';
    } else if (
        storedWP !== null &&
        !scoresMatch(storedWP, canvas) &&
        !scoresMatch(storedWP, marzano)
    ) {
        lock = 'unlocked';
    } else {
        lock = 'none';
    }

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
            String(ig.studentId)  === sidStr &&
            String(ig.outcomeId)  === oidStr &&
            ig.assignmentId       === attempt.assignmentId
        )
    }));

    let status;
    if (marzano === null) {
        status = 'ne';
    } else if (willPost !== null && canvas !== null && scoresMatch(willPost, canvas)) {
        status = 'synced';
    } else {
        status = 'needs';
    }

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
        pushing: false
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
    const label      = dot.v != null ? dot.v.toFixed(1) : '?';
    const asgn       = escapeHtml(dot.a || `Alignment ${i + 1}`);
    const dateStr    = escapeHtml(dot.d || '—');
    const asgnId     = escapeHtml(dot.assignmentId || '');
    const ignoredCls = dot.ignored ? 'ignored' : '';
    const statusStr  = dot.ignored ? 'Ignored' : 'In Marzano';
    const statusCol  = dot.ignored ? 'var(--amber)' : 'var(--green)';

    return `<div class="dot ${ignoredCls}" style="${bgStyle}"
        data-action="dot-toggle" data-dot-idx="${i}"
        data-stu="${sidStr}" data-oid="${oidStr}"
        data-asgn-id="${asgnId}" tabindex="0" role="button" aria-label="${asgn}: ${valStr}">
      ${label}
      <div class="dot-preview">${asgn} · ${valStr}</div>
      <div class="dot-popover">
        <div class="dp-hd">
          <span class="dp-title">${asgn}</span>
          <span class="dp-score" style="${bgStyle}">${valStr}</span>
        </div>
        <div class="dp-rows">
          <div class="dp-row"><span class="lbl">Date</span><span class="val">${dateStr}</span></div>
          <div class="dp-row"><span class="lbl">Score</span><span class="val">${valStr}</span></div>
          <div class="dp-row"><span class="lbl">Status</span>
            <span class="val" style="color:${statusCol};">${statusStr}</span></div>
        </div>
        <div class="dp-divider"></div>
        <div class="dp-toggle">
          <span>Ignore this alignment</span>
          <div class="toggle-sw ${dot.ignored ? 'on' : ''}"
               data-action="dot-ignore-toggle" data-dot-idx="${i}"
               data-stu="${sidStr}" data-oid="${oidStr}" data-asgn-id="${asgnId}"></div>
        </div>
        <div class="dp-footnote">Ignored alignments are excluded from the Marzano calculation but remain visible in Canvas.</div>
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
    const needsCls   = s.status === 'needs' ? 'os-needs-row' : '';
    const differsCls = s.lock !== 'none'    ? 'differs'     : '';

    const canvasDisp  = s.canvas  != null ? s.canvas.toFixed(2)  : '—';
    const marzDisp    = s.marzano != null ? s.marzano.toFixed(2) : 'NE';
    const wpDisp      = s.willPost != null ? s.willPost.toFixed(2) : marzDisp;
    const canvasFaded = scoresMatch(s.canvas,  s.willPost) ? '' : 'faded';
    const marzFaded   = scoresMatch(s.marzano, s.willPost) ? '' : 'faded';

    const dotsHtml = s.dots.length
        ? s.dots.map((dot, i) => renderDot(dot, oidStr, s.id, i)).join('')
        : `<span style="font-size:10px;color:var(--text-tertiary);">—</span>`;

    const lockHtml = s.lock !== 'none' ? `
        <button class="os-wp-lock ${s.lock}"
                data-action="${s.lock === 'locked' ? 'os-unlock' : 'os-lock'}"
                data-stu="${s.id}" data-oid="${oidStr}"
                aria-label="${s.lock === 'locked' ? 'Unlock Post' : 'Lock Post'}">
          ${s.lock === 'locked' ? '🔒' : '🔓'}
          <span class="os-lock-tip">${
              s.lock === 'locked'
                  ? 'Post is locked. Click to revert to Marzano.'
                  : 'Score differs from Marzano. Click to lock this value.'
          }</span>
        </button>` : '';

    const saveMod   = s.status === 'needs' ? 'needs' : 'synced';
    const saveTitle = s.status === 'needs' ? `Push ${wpDisp} to Canvas` : 'Synced with Canvas';
    const saveTip   = s.status === 'needs' ? 'Push to Canvas' : 'Up to date';
    const saveHtml = s.pushing
        ? `<span class="os-posting"><span class="spinner"></span> Pushing…</span>`
        : `<button class="os-save-row-btn ${saveMod}" data-action="os-save" data-stu="${s.id}" data-oid="${oidStr}"
               ${s.status !== 'needs' ? 'disabled' : ''} title="${saveTitle}">
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
          <span class="os-pill-tip">Set Post = ${canvasDisp}</span>
        </button>
      </td>
      <td class="c">
        <button class="os-pill-btn ${marzFaded}" data-action="os-use-marzano"
                data-stu="${s.id}" data-oid="${oidStr}">
          <span class="os-pill" style="${scoreToneStyle(scoreTone(s.marzano))}">${marzDisp}</span>
          <span class="os-pill-tip">Set Post = ${marzDisp} (Marzano)</span>
        </button>
      </td>
      <td class="c">
        <div class="os-wp-outer">
          <div class="os-wp-box-wrap ${differsCls}" data-action="os-wp-click"
               data-stu="${s.id}" data-oid="${oidStr}" tabindex="0" role="button"
               aria-label="Post: ${wpDisp}">
            <div class="os-wp-box">${wpDisp}</div>
            ${lockHtml}
          </div>
        </div>
      </td>
      <td class="os-td-comment">
        <input class="os-comment-input${s.lock !== 'none' ? ' override-prompted' : ''}${s.note ? ' has-note' : ''}"
               type="text" value="${escapeHtml(s.note)}"
               placeholder="${s.lock !== 'none' ? 'Reason for override…' : 'Note…'}"
               data-action="os-note" data-stu="${s.id}" data-oid="${oidStr}"
               aria-label="Note for ${escapeHtml(s.name)}">
      </td>
      <td class="c">${saveHtml}</td>
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

    const studentStates = cache.students
        .map(student => {
            const sId         = String(student.id);
            const outcomeData = student.outcomes.find(o => String(o.outcomeId) === oidStr);
            const entry       = outcomeSync[sId] ?? {};
            return buildOutcomeStudentRow(student, outcomeData, entry, ignored, outcome.id);
        })
        .sort((a, b) => a.sortableName.localeCompare(b.sortableName));

    const needsRows  = studentStates.filter(s => s.status === 'needs');
    const syncedRows = studentStates.filter(s => s.status === 'synced');
    const neRows     = studentStates.filter(s => s.status === 'ne');
    const needsCount = needsRows.length;

    const toolbarHtml = needsCount > 0
        ? `<div class="os-status-banner warn">
             <div class="os-status-banner-left">
               ⬆ <b>${needsCount}</b> student${needsCount !== 1 ? 's' : ''} need${needsCount === 1 ? 's' : ''} updating
             </div>
             <button class="btn btn-sm btn-primary" data-action="os-post-all">
               Save grades to Canvas
             </button>
           </div>`
        : `<div class="os-status-banner ok">
             <div class="os-status-banner-left">
               ✓ Canvas gradebook is up to date
             </div>
           </div>`;

    const tones = [['hi','≥ 3.25'],['good','≥ 2.5'],['dev','≥ 1.75'],['low','< 1.75']];
    const legendHtml = `
        <div class="os-legend">
          <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0;">Score</span>
          ${tones.map(([t, lbl]) =>
              `<span class="os-leg"><span class="os-leg-sw" style="${scoreToneStyle(t)}"></span><span>${lbl}</span></span>`
          ).join('')}
          <span class="os-leg" style="margin-left:auto;color:var(--text-tertiary);">
            <span style="text-decoration:line-through;">2.5</span><span>Ignored alignment</span>
          </span>
        </div>`;

    const bodyHtml = [
        needsRows.map(s => renderOutcomeStudentRow(s, oidStr)).join(''),
        syncedRows.map(s => renderOutcomeStudentRow(s, oidStr)).join(''),
        neRows.map(s => renderOutcomeStudentRow(s, oidStr)).join(''),
    ].join('');

    return `
        ${toolbarHtml}
        ${legendHtml}
        <div class="os-block">
          <table>
            <thead><tr>
              <th style="min-width:130px;">Student</th>
              <th>Alignments</th>
              <th class="c">Canvas</th>
              <th class="c">Marzano</th>
              <th class="c">Post</th>
              <th>Note</th>
              <th class="c">Save</th>
            </tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </div>
        <div class="os-table-hint">
          Click Canvas / Marzano pills to copy to Post · Click Post box to type · Padlock locks an override
        </div>`;
}

// ─── Public: wiring + teardown ───────────────────────────────────────────────

/**
 * Attach all event listeners for the student sync table.
 *
 * Owns: os-use-canvas, os-use-marzano, os-wp-click (inline edit), os-lock,
 * os-unlock, os-save, os-post-all, dot-toggle, dot-ignore-toggle, os-note input,
 * and a document-level "click outside dot to close popover" listener.
 *
 * @param {Object} options
 * @param {HTMLElement} options.contentEl     - the .od-detail-content node
 * @param {Object} options.outcome
 * @param {Object} options.cache
 * @param {string|number} options.courseId
 * @param {Object} options.apiClient
 * @param {Function} options.renderTable      - re-render callback
 * @returns {Function} teardown — remove the document-level listener
 */
export function wireOutcomeStudentTable({ contentEl, outcome, cache, courseId, apiClient, renderTable }) {
    const outcomeName = outcome.title || String(outcome.id);
    let activeDotKey = null;

    const onDocClick = (e) => {
        if (activeDotKey && !e.target.closest('.dot')) {
            activeDotKey = null;
            contentEl.querySelectorAll('.dot.active').forEach(d => d.classList.remove('active'));
        }
    };
    document.addEventListener('click', onDocClick);

    contentEl.addEventListener('click', async (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;
        const stuId  = el.dataset.stu || el.dataset.studentId;
        const oId    = el.dataset.oid || el.dataset.outcomeId;

        // ── Dot popover toggle ────────────────────────────────────────────
        if (action === 'dot-toggle') {
            e.stopPropagation();
            const dotEl = el.closest('.dot');
            if (!dotEl) return;
            const key = `${oId}:${stuId}:${el.dataset.dotIdx}`;
            if (activeDotKey === key) {
                activeDotKey = null;
                dotEl.classList.remove('active');
            } else {
                contentEl.querySelectorAll('.dot.active').forEach(d => d.classList.remove('active'));
                activeDotKey = key;
                dotEl.classList.add('active');
            }
            return;
        }

        // ── Ignore/unignore alignment ─────────────────────────────────────
        if (action === 'dot-ignore-toggle') {
            e.stopPropagation();
            const asgnId  = el.dataset.asgnId;
            const ignored = (cache.ignored_alignments ?? []).some(
                ia => String(ia.studentId) === stuId && String(ia.outcomeId) === oId && ia.assignmentId === asgnId
            );
            try {
                if (ignored) {
                    await handleUnignoreAlignment({ courseId, outcomeId: oId, outcomeName, studentId: stuId, alignmentId: asgnId, apiClient, onRerender: renderTable });
                } else {
                    await handleIgnoreAlignment({ courseId, outcomeId: oId, outcomeName, studentId: stuId, alignmentId: asgnId, apiClient, onRerender: renderTable });
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
            await handleCanvasPillClick({ courseId, outcomeId: oId, studentId: stuId, canvasScore: cv, apiClient, onRerender: renderTable });
            return;
        }

        // ── Marzano pill → revert Will Post to auto-track ─────────────────
        if (action === 'os-use-marzano') {
            await handleMarzanoPillClick({ courseId, outcomeId: oId, studentId: stuId, apiClient, onRerender: renderTable });
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
            input.style.cssText =
                'width:3.5em;max-width:3.5em;min-width:0;box-sizing:border-box;' +
                'font-size:0.923em;text-align:center;';
            boxEl?.replaceWith(input);
            input.select();

            const commitEdit = async () => {
                const raw = parseFloat(input.value);
                if (!isNaN(raw)) {
                    const clamped = Math.max(0, Math.min(4, raw));
                    await handleCustomValueTyped({ courseId, outcomeId: oId, studentId: stuId, value: clamped, apiClient, onRerender: renderTable });
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
            await handleLockWillPost({ courseId, outcomeId: oId, studentId: stuId, apiClient, onRerender: renderTable });
            return;
        }
        // ── Padlock → unlock ──────────────────────────────────────────────
        if (action === 'os-unlock') {
            await handleUnlockWillPost({ courseId, outcomeId: oId, studentId: stuId, apiClient, onRerender: renderTable });
            return;
        }

        // ── Save row → push to Canvas ─────────────────────────────────────
        if (action === 'os-save') {
            if (el.disabled) return;
            el.disabled = true;
            try {
                await handleSyncOneStudent({ courseId, outcomeId: oId, outcomeName, studentId: stuId, apiClient, onRerender: renderTable });
            } catch (err) {
                logger.error('[MasteryOutlook] os-save failed', err);
                el.disabled = false;
            }
            return;
        }

        // ── Save all ──────────────────────────────────────────────────────
        if (action === 'os-post-all') {
            if (el.disabled) return;
            el.disabled = true;
            const syncState   = cache.sync_state ?? {};
            const outcomeSync = syncState[String(outcome.id)] ?? {};
            const ignored     = cache.ignored_alignments ?? [];
            const oidStr      = String(outcome.id);
            const pending = cache.students
                .map(student => {
                    const sId = String(student.id);
                    const od  = student.outcomes.find(o => String(o.outcomeId) === oidStr);
                    return buildOutcomeStudentRow(student, od, outcomeSync[sId] ?? {}, ignored, outcome.id);
                })
                .filter(s => s.status === 'needs');
            for (const s of pending) {
                try {
                    await handleSyncOneStudent({ courseId, outcomeId: oidStr, outcomeName, studentId: s.id, apiClient, onRerender: renderTable });
                } catch (err) { logger.error(`[MasteryOutlook] os-post-all failed for ${s.id}`, err); }
            }
            renderTable();
            return;
        }
    });

    // Note input — debounced (separate listener since it's an input event)
    contentEl.addEventListener('input', (e) => {
        const el = e.target.closest('[data-action="os-note"]');
        if (!el) return;
        el.classList.toggle('has-note', el.value.trim().length > 0);
        handleNoteChanged({
            courseId,
            outcomeId: el.dataset.oid,
            studentId: el.dataset.stu,
            noteValue: el.value,
            apiClient,
        });
    });

    return () => {
        document.removeEventListener('click', onDocClick);
    };
}