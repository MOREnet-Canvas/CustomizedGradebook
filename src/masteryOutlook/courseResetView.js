// src/masteryOutlook/courseResetView.js
/**
 * "Reset Mastery Outlook" — sidebar card + confirmation dialog.
 *
 * Flow: build the plan (read-only) → preview with checkboxes and warnings →
 * type the confirmation phrase → download backup → delete → report.
 * All Canvas work lives in courseResetService.js.
 */

import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/html.js';
import { injectStyles } from '../ui/styles.js';
import {
    buildResetPlan,
    downloadResetBackup,
    executeResetPlan,
    resetItemKey,
    RESET_ITEM_TYPES,
} from './courseResetService.js';

const DIALOG_ID = 'cg-course-reset-dialog';
const STYLE_ID = 'cg-course-reset-styles';
export const RESET_CONFIRM_WORD = 'RESET';

// The dialog lives on <body>, outside .mo-shell, so it carries its own button styles.
const DIALOG_CSS = `
.cg-reset-btn { padding:6px 14px; border-radius:4px; border:1px solid #c7cdd1; background:#f5f5f5;
                color:#2d3b45; font-size:14px; cursor:pointer; }
.cg-reset-btn:hover { background:#e8eaec; }
.cg-reset-btn[disabled] { opacity:.5; cursor:not-allowed; }
.cg-reset-btn-danger { background:#c0392b; border-color:#c0392b; color:#fff; }
.cg-reset-btn-danger:hover { background:#a93226; }
.cg-reset-btn-primary { background:#0374b5; border-color:#0374b5; color:#fff; }
.cg-reset-btn-primary:hover { background:#02609a; }`;

/**
 * Append the "Start over" card to the Mastery Outlook sidebar.
 *
 * @param {HTMLElement} sidebarEl
 * @param {string|number} courseId
 * @param {CanvasApiClient} apiClient
 */
export function mountCourseResetCard(sidebarEl, courseId, apiClient) {
    if (!sidebarEl) return;
    const card = document.createElement('div');
    card.className = 'od-tweaks-card';
    card.innerHTML = `
        <div class="od-tweaks-title">Start over</div>
        <div class="od-tweaks-help">
            Remove the Projected Score assignments, data file, and this page so Mastery Outlook can be set up fresh.
            Current Score is not changed.
        </div>
        <button type="button" class="btn btn-sm" data-action="cg-open-reset" style="margin-top:8px;">
            Reset Mastery Outlook…
        </button>`;
    card.querySelector('[data-action="cg-open-reset"]')
        .addEventListener('click', () => openCourseResetDialog({ courseId, apiClient }));
    sidebarEl.appendChild(card);
}

/**
 * Open the reset dialog for a course.
 *
 * @param {Object} opts
 * @param {string|number} opts.courseId
 * @param {CanvasApiClient} opts.apiClient
 * @param {Function} [opts.onFinished] - (result) => void, after a reset ran
 * @returns {HTMLElement} the dialog overlay
 */
export function openCourseResetDialog({ courseId, apiClient, onFinished }) {
    injectStyles(DIALOG_CSS, STYLE_ID);
    document.getElementById(DIALOG_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Reset Mastery Outlook');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);' +
        'display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div class="cg-reset-box" style="background:#fff;border-radius:8px;max-width:640px;width:92%;
             max-height:85vh;overflow:auto;padding:20px 24px;box-shadow:0 8px 32px rgba(0,0,0,.3);font-size:14px;">
          <h2 style="margin:0 0 12px;font-size:20px;">Reset Mastery Outlook</h2>
          <div data-role="body"><p>Checking what Mastery Outlook created in this course…</p></div>
        </div>`;
    document.body.appendChild(overlay);

    const body = overlay.querySelector('[data-role="body"]');
    let running = false;

    const close = () => {
        if (running) return;
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    buildResetPlan(courseId, apiClient)
        .then(plan => renderPreview(plan))
        .catch(err => {
            logger.error('[CourseReset] Could not build the reset plan', err);
            body.innerHTML = `<p>Could not check this course: ${escapeHtml(err?.message ?? String(err))}</p>
                <div style="text-align:right;"><button type="button" class="cg-reset-btn" data-action="close">Close</button></div>`;
            body.querySelector('[data-action="close"]').addEventListener('click', close);
        });

    function renderPreview(plan) {
        if (!plan.items.length) {
            body.innerHTML = `<p>Nothing from Mastery Outlook setup was found in this course.</p>
                <div style="text-align:right;"><button type="button" class="cg-reset-btn" data-action="close">Close</button></div>`;
            body.querySelector('[data-action="close"]').addEventListener('click', close);
            return;
        }

        const rows = plan.items.map(item => {
            const key = resetItemKey(item);
            const grades = item.type === RESET_ITEM_TYPES.ASSIGNMENT
                ? ` · ${item.gradeCount} saved grade${item.gradeCount === 1 ? '' : 's'}${item.rubric ? ' · and its rubric' : ''}`
                : '';
            const note = item.note
                ? ` <span style="color:${item.verified ? '#555' : '#b45309'};">(${escapeHtml(item.note)})</span>`
                : '';
            return `<label style="display:block;margin:4px 0;">
                <input type="checkbox" data-key="${escapeHtml(key)}" ${item.verified ? 'checked' : ''}>
                ${escapeHtml(item.name)}${grades}${note}</label>`;
        }).join('');

        const warnings = plan.warnings.map(w =>
            `<div style="background:#fff7e6;border:1px solid #f0c36d;border-radius:4px;padding:8px 10px;margin:8px 0;">⚠ ${escapeHtml(w)}</div>`
        ).join('');

        body.innerHTML = `
            <p>These will be <b>deleted</b>. Deleting a Projected Score assignment removes its grades, and outcome
               scores go back to the student's real assignments.</p>
            <div data-role="items" style="margin:8px 0 12px;">${rows}</div>
            ${warnings}
            <p style="color:#555;">Not changed: the Current Score outcome, assignment, and grades; final grade overrides;
               teachers' own assignments and outcomes; the Mastery View page.</p>
            <p>A backup file downloads before anything is deleted.</p>
            <label>Type <b>${RESET_CONFIRM_WORD}</b> to confirm:
                <input type="text" data-role="confirm" autocomplete="off" style="margin-left:6px;width:120px;"></label>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
                <button type="button" class="cg-reset-btn" data-action="cancel">Cancel</button>
                <button type="button" class="cg-reset-btn cg-reset-btn-danger" data-action="reset" disabled>Download backup and reset</button>
            </div>`;

        const resetBtn = body.querySelector('[data-action="reset"]');
        const confirmInput = body.querySelector('[data-role="confirm"]');
        const selectedKeys = () => [...body.querySelectorAll('[data-key]')].filter(cb => cb.checked).map(cb => cb.dataset.key);
        const updateButton = () => {
            resetBtn.disabled = confirmInput.value.trim() !== RESET_CONFIRM_WORD || selectedKeys().length === 0;
        };
        body.addEventListener('input', updateButton);
        body.addEventListener('change', updateButton);
        body.querySelector('[data-action="cancel"]').addEventListener('click', close);
        resetBtn.addEventListener('click', () => runReset(plan, selectedKeys()));
    }

    async function runReset(plan, keys) {
        running = true;
        const warnBeforeLeave = e => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warnBeforeLeave);

        body.innerHTML = '<p data-role="progress">Downloading backup…</p>';
        const progress = body.querySelector('[data-role="progress"]');
        let backupName = null;
        let result;
        try {
            backupName = downloadResetBackup(plan);
            result = await executeResetPlan(plan, keys, apiClient, msg => { progress.textContent = msg; });
        } catch (err) {
            logger.error('[CourseReset] Reset stopped', err);
            result = { deleted: [], failed: [{ item: { name: 'Reset' }, error: err?.message ?? String(err) }], kept: [] };
        } finally {
            running = false;
            window.removeEventListener('beforeunload', warnBeforeLeave);
        }
        renderReport(plan, result, backupName);
        onFinished?.(result);
    }

    function renderReport(plan, result, backupName) {
        const list = (title, entries) => entries.length
            ? `<p style="margin:12px 0 4px;"><b>${title}</b></p><ul style="margin:0 0 0 20px;">${entries.join('')}</ul>`
            : '';
        const pageDeleted = result.deleted.some(i => i.type === RESET_ITEM_TYPES.PAGE);
        const latest = plan.latestOutcomeTitles.length
            ? `<div style="background:#fff7e6;border:1px solid #f0c36d;border-radius:4px;padding:8px 10px;margin:12px 0;">
                 ⚠ Outcomes are still set to "Most Recent Score". Change them in Outcomes if this course needs a different method.</div>`
            : '';

        body.innerHTML = `
            <p>${result.failed.length ? 'The reset finished with problems.' : 'Mastery Outlook was reset.'}</p>
            ${backupName ? `<p style="color:#555;">Backup saved as <code>${escapeHtml(backupName)}</code>.</p>` : ''}
            ${list('Deleted', result.deleted.map(i => `<li>${escapeHtml(i.name)}</li>`))}
            ${list('Not deleted', result.failed.map(f => `<li>${escapeHtml(f.item.name)} — ${escapeHtml(f.error)}</li>`))}
            ${list('Kept', result.kept.map(k => `<li>${escapeHtml(k.item.name)} — ${escapeHtml(k.reason)}</li>`))}
            ${result.failed.length ? '<p>You can run Reset again to finish.</p>' : ''}
            ${latest}
            <div style="text-align:right;margin-top:16px;">
                <button type="button" class="cg-reset-btn cg-reset-btn-primary" data-action="done">${pageDeleted ? 'Go to Course Settings' : 'Done'}</button>
            </div>`;

        body.querySelector('[data-action="done"]').addEventListener('click', () => {
            if (pageDeleted) window.location.assign(`/courses/${plan.courseId}/settings`);
            else window.location.reload();
        });
    }

    return overlay;
}
