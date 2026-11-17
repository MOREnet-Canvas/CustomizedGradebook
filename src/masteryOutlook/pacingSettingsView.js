// src/masteryOutlook/pacingSettingsView.js
/**
 * Mastery Outlook "Pacing" tab — teacher editor for course pacing.
 *
 * Teachers choose which regular outcomes the course requires and set a target
 * date for each. Settings are saved to the Mastery View page as
 * data-outcome-pacing (outcomeLayoutService.saveOutcomeLayout), where the
 * student/observer panel (masteryDashboard/pacingPanel.js) reads them on
 * desktop and mobile.
 *
 * Registered in viewRegistry.js only when ENABLE_COURSE_PACING is on
 * (dev and pilot builds by default).
 */

import { logger } from '../utils/logger.js';
import { injectStyles } from '../ui/styles.js';
import { getAveragedOutcomes, getOutcomeDisplayName } from './outcomeTypes.js';
import { saveOutcomeLayout } from './outcomeLayoutService.js';
import { isValidDate } from '../services/pacingService.js';

const STYLE_ID = 'mo-pacing-styles';

const PACING_CSS = `
.mo-shell .mo-pacing { font-family:var(--mo-legacy-font); color:#273540; padding:0.5em 0; }
.mo-shell .mo-pacing-intro { font-size:0.85rem; color:#555; margin:0 0 0.75em; line-height:1.4; }
.mo-shell .mo-pacing-toggle { display:flex; align-items:center; gap:0.5em; font-size:0.9rem; font-weight:600; margin:0 0 0.75em; }
.mo-shell .mo-pacing-summary { font-size:0.8rem; color:#555; margin:0 0 0.5em; }
.mo-shell .mo-pacing-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
.mo-shell .mo-pacing-table th, .mo-shell .mo-pacing-table td { text-align:left; padding:0.5em; border-bottom:1px solid #e3e7eb; vertical-align:middle; }
.mo-shell .mo-pacing-table th { font-weight:600; color:#555; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.03em; }
.mo-shell .mo-pacing-table input[type="checkbox"] { width:1.1em; height:1.1em; }
.mo-shell .mo-pacing-table input[type="date"] { border:1px solid #a3afba; border-radius:4px; padding:0.35em; font:inherit; max-width:12em; }
.mo-shell .mo-pacing-table tr.mo-pacing-row--off td.mo-pacing-name { color:#888; }
.mo-shell .mo-pacing-actions { display:flex; align-items:center; gap:0.75em; flex-wrap:wrap; margin-top:0.75em; }
.mo-shell .mo-pacing-feedback { font-size:0.85rem; color:#555; }
.mo-shell .mo-pacing-feedback--error, .mo-shell .mo-pacing-warning { color:#a22b2b; }
.mo-shell .mo-pacing-warning { font-size:0.8rem; font-weight:600; margin:0.5em 0; }
.mo-shell .mo-pacing-empty { font-size:0.9rem; color:#555; padding:1em 0; line-height:1.5; }
`;

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
}

/**
 * Merge the course's regular outcomes (teacher order) with saved pacing.
 * New outcomes default to included with no date.
 *
 * @param {Object} cache - enriched Mastery Outlook cache
 * @returns {{ enabled: boolean, rows: Array<{id: string, name: string, date: string, included: boolean}>, orphaned: string[] }}
 */
export function buildPacingRows(cache) {
    const saved = cache?.meta?.customOutcomePacing ?? null;
    const savedById = new Map((saved?.scales ?? []).map(s => [String(s.id), s]));
    const outcomes = getAveragedOutcomes(cache ?? {});

    const rows = outcomes.map(o => {
        const id = String(o.id);
        const prev = savedById.get(id);
        return {
            id,
            name: getOutcomeDisplayName(o, cache),
            date: prev && isValidDate(prev.date) ? prev.date : '',
            included: prev ? prev.included !== false : true
        };
    });

    const currentIds = new Set(rows.map(r => r.id));
    const orphaned = [...savedById.keys()].filter(id => !currentIds.has(id));

    return { enabled: saved ? saved.enabled !== false : true, rows, orphaned };
}

/**
 * Mount the Pacing tab.
 *
 * @param {Object} shell - Mastery Outlook shell (shell.viewContainers.pacing)
 * @param {Object} cache - enriched cache (meta.customOutcomePacing, meta.hasMasteryViewPage)
 * @param {import('./viewRegistry.js').ViewContext} ctx
 * @returns {import('./viewRegistry.js').ViewController}
 */
export function mountPacingSettingsView(shell, cache, ctx) {
    const container = shell.viewContainers?.pacing;
    if (!container) return { teardown() {}, refresh() {} };

    injectStyles(PACING_CSS, STYLE_ID);

    let state = buildPacingRows(cache);

    const render = () => {
        if (!cache || !Array.isArray(cache.outcomes)) {
            container.innerHTML = `<div class="mo-pacing-empty">Hit <strong>Refresh Data</strong> to load this course's outcomes, then set pacing here.</div>`;
            return;
        }
        if (cache.meta?.hasMasteryViewPage === false) {
            container.innerHTML = `<div class="mo-pacing-empty">Pacing is saved on the course's <strong>Mastery View</strong> page, which students open on the web and in the mobile app. Create the Mastery View page first (Create Mastery View button on the course home page), then return here.</div>`;
            return;
        }
        if (!state.rows.length) {
            container.innerHTML = `<div class="mo-pacing-empty">This course has no outcomes to pace yet.</div>`;
            return;
        }

        container.innerHTML = `
          <div class="mo-pacing">
            <p class="mo-pacing-intro">Choose the outcomes students must master in this course and set a target date for each.
              Students and parents see their progress against these dates on the Mastery View page (web and mobile app).
              Pacing never changes grades.</p>
            <label class="mo-pacing-toggle">
              <input type="checkbox" data-pacing-enabled ${state.enabled ? 'checked' : ''}>
              Show pacing to students
            </label>
            <p class="mo-pacing-summary" data-pacing-summary></p>
            <table class="mo-pacing-table">
              <thead><tr><th scope="col">Required</th><th scope="col">Outcome</th><th scope="col">Target date</th></tr></thead>
              <tbody>
                ${state.rows.map((r, i) => `
                  <tr class="${r.included ? '' : 'mo-pacing-row--off'}" data-row="${i}">
                    <td><input type="checkbox" data-include="${i}" ${r.included ? 'checked' : ''} aria-label="Require ${escapeHtml(r.name)}"></td>
                    <td class="mo-pacing-name">${escapeHtml(r.name)}</td>
                    <td><input type="date" data-date="${i}" value="${escapeHtml(r.date)}" aria-label="Target date for ${escapeHtml(r.name)}"></td>
                  </tr>`).join('')}
              </tbody>
            </table>
            ${state.orphaned.length ? `<p class="mo-pacing-warning">${state.orphaned.length} previously saved outcome${state.orphaned.length === 1 ? ' is' : 's are'} no longer in this course and will be removed on save.</p>` : ''}
            <div class="mo-pacing-actions">
              <button type="button" class="od-btn-refresh" data-pacing-save>Save pacing</button>
              <span class="mo-pacing-feedback" data-pacing-feedback role="status"></span>
            </div>
          </div>`;

        updateSummary();
    };

    const updateSummary = () => {
        const el = container.querySelector('[data-pacing-summary]');
        if (!el) return;
        const included = state.rows.filter(r => r.included);
        const dated = included.filter(r => isValidDate(r.date));
        el.textContent = `${included.length} required outcome${included.length === 1 ? '' : 's'} · ${dated.length} with target dates · ${state.rows.length} in course`;
    };

    const setFeedback = (text, isError = false) => {
        const el = container.querySelector('[data-pacing-feedback]');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('mo-pacing-feedback--error', isError);
    };

    const onChange = (e) => {
        const t = e.target;
        if (t.matches('[data-pacing-enabled]')) {
            state.enabled = t.checked;
        } else if (t.matches('[data-include]')) {
            const row = state.rows[Number(t.dataset.include)];
            row.included = t.checked;
            t.closest('tr')?.classList.toggle('mo-pacing-row--off', !t.checked);
        } else if (t.matches('[data-date]')) {
            state.rows[Number(t.dataset.date)].date = isValidDate(t.value) ? t.value : '';
        } else {
            return;
        }
        setFeedback('Unsaved changes');
        updateSummary();
    };

    const onClick = async (e) => {
        const btn = e.target.closest('[data-pacing-save]');
        if (!btn) return;
        if (!state.rows.some(r => r.included)) {
            setFeedback('Select at least one required outcome.', true);
            return;
        }

        const pacing = {
            enabled: state.enabled,
            scales: state.rows.map(r => ({ id: r.id, date: r.date, included: r.included }))
        };

        btn.disabled = true;
        setFeedback('Saving…');
        const ok = await saveOutcomeLayout(ctx.courseId, ctx.apiClient, { pacing });
        btn.disabled = false;

        if (ok) {
            cache.meta = cache.meta || {};
            cache.meta.customOutcomePacing = pacing;
            state = buildPacingRows(cache);
            render();
            setFeedback('Pacing saved.');
            logger.info('[MasteryOutlook] Course pacing saved');
        } else {
            setFeedback('Save failed. Check that the Mastery View page exists, then try again.', true);
        }
    };

    container.addEventListener('change', onChange);
    container.addEventListener('click', onClick);
    render();

    return {
        teardown() {
            container.removeEventListener('change', onChange);
            container.removeEventListener('click', onClick);
            container.innerHTML = '';
        },
        // Re-render keeps unsaved edits (color/threshold changes don't affect this view)
        refresh: render
    };
}
