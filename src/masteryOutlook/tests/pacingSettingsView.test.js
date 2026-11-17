// src/masteryOutlook/tests/pacingSettingsView.test.js
// Course pacing: storage on the Mastery View page + the Mastery Outlook Pacing tab.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../../services/pageService.js', () => ({
    findMasteryDashboardPageUrl: vi.fn(async () => 'mastery-dashboard'),
    getPage: vi.fn(async () => ({
        body: '<div id="mastery-dashboard-root" data-outcome-order=\'["2","1"]\' data-outcome-names="{&quot;1&quot;:&quot;Reading&quot;}"></div>'
    })),
    updatePage: vi.fn(async () => ({})),
}));

import { parseOutcomeLayout, parsePacingLayout, applyOutcomeLayout, saveOutcomeLayout } from '../outcomeLayoutService.js';
import { buildPacingRows, mountPacingSettingsView } from '../pacingSettingsView.js';
import { parsePacing } from '../../services/pacingService.js';
import { updatePage } from '../../services/pageService.js';
import { AVG_OUTCOME_NAME } from '../../config.js';

const ROOT = '<div id="mastery-dashboard-root"></div>';

describe('pacing on the Mastery View page', () => {
    test('round-trips through applyOutcomeLayout / parsePacingLayout and the DOM dataset', () => {
        const pacing = { enabled: true, scales: [{ id: '1', date: '2026-12-04', included: true }] };
        const body = applyOutcomeLayout(ROOT, { pacing });
        expect(parsePacingLayout(body)).toEqual(pacing);
        expect(body).not.toMatch(/data-outcome-pacing="[^"]*'/); // no raw quotes inside

        document.body.innerHTML = body;
        expect(parsePacing(document.getElementById('mastery-dashboard-root'))).toEqual(pacing);
    });

    test('absent → null; order/names untouched by a pacing write', () => {
        expect(parsePacingLayout(ROOT)).toBeNull();
        const start = applyOutcomeLayout(ROOT, { order: ['2', '1'], names: { '1': 'Reading' } });
        const withPacing = applyOutcomeLayout(start, { pacing: { enabled: false, scales: [] } });
        expect(parseOutcomeLayout(withPacing)).toEqual({ order: ['2', '1'], names: { '1': 'Reading' } });
        expect(parsePacingLayout(withPacing)).toEqual({ enabled: false, scales: [] });
    });

    test('the old 1.3.x order regex still matches only the order attribute', () => {
        const body = applyOutcomeLayout(ROOT, {
            pacing: { enabled: true, scales: [{ id: '1', date: '', included: true }] }
        });
        const legacy = body.replace(/data-outcome-order=(?:"[^"]*"|'[^']*')/, 'X');
        expect(legacy).toBe(body); // no false match inside the pacing value
    });

    test('saveOutcomeLayout({ pacing }) keeps the saved order and names', async () => {
        updatePage.mockClear();
        const pacing = { enabled: true, scales: [{ id: '1', date: '2026-12-04', included: true }] };
        expect(await saveOutcomeLayout('566', {}, { pacing })).toBe(true);
        const written = updatePage.mock.calls[0][2].body;
        expect(parseOutcomeLayout(written)).toEqual({ order: ['2', '1'], names: { '1': 'Reading' } });
        expect(parsePacingLayout(written)).toEqual(pacing);
    });
});

function makeCache(pacing = null, extra = {}) {
    return {
        outcomes: [
            { id: 9, title: AVG_OUTCOME_NAME },
            { id: 1, title: 'Outcome One' },
            { id: 2, title: 'Outcome Two' },
        ],
        students: [],
        meta: { customOutcomeOrder: ['2', '1'], customOutcomeNames: { '1': 'Reading' }, customOutcomePacing: pacing, hasMasteryViewPage: true, ...extra },
    };
}

describe('buildPacingRows', () => {
    test('regular outcomes only, teacher order and names, defaults to included', () => {
        const { enabled, rows, orphaned } = buildPacingRows(makeCache());
        expect(enabled).toBe(true);
        expect(rows).toEqual([
            { id: '2', name: 'Outcome Two', date: '', included: true },
            { id: '1', name: 'Reading', date: '', included: true },
        ]);
        expect(orphaned).toEqual([]);
    });

    test('keeps saved values and reports outcomes no longer in the course', () => {
        const { enabled, rows, orphaned } = buildPacingRows(makeCache({
            enabled: false,
            scales: [
                { id: '1', date: '2026-12-04', included: false },
                { id: '77', date: '2026-12-01', included: true },
            ],
        }));
        expect(enabled).toBe(false);
        expect(rows.find(r => r.id === '1')).toEqual({ id: '1', name: 'Reading', date: '2026-12-04', included: false });
        expect(orphaned).toEqual(['77']);
    });
});

describe('mountPacingSettingsView', () => {
    let container;
    let shell;
    const ctx = { courseId: '566', apiClient: {} };

    beforeEach(() => {
        document.body.innerHTML = '<div class="mo-shell"><div id="od-pacing-view"></div></div>';
        container = document.getElementById('od-pacing-view');
        shell = { viewContainers: { pacing: container } };
        updatePage.mockClear();
    });

    test('asks for the Mastery View page when it is missing', () => {
        mountPacingSettingsView(shell, makeCache(null, { hasMasteryViewPage: false }), ctx);
        expect(container.textContent).toContain('Create the Mastery View page first');
        expect(container.querySelector('table')).toBeNull();
    });

    test('edits and saves pacing to the Mastery View page', async () => {
        const cache = makeCache();
        mountPacingSettingsView(shell, cache, ctx);
        expect(container.querySelectorAll('tbody tr')).toHaveLength(2);

        const date = container.querySelector('[data-date="1"]');
        date.value = '2026-12-04';
        date.dispatchEvent(new Event('change', { bubbles: true }));
        const include = container.querySelector('[data-include="0"]');
        include.checked = false;
        include.dispatchEvent(new Event('change', { bubbles: true }));
        expect(container.querySelector('[data-pacing-summary]').textContent).toContain('1 required outcome');

        container.querySelector('[data-pacing-save]').click();
        await vi.waitFor(() => expect(updatePage).toHaveBeenCalledTimes(1));
        const saved = parsePacingLayout(updatePage.mock.calls[0][2].body);
        expect(saved).toEqual({
            enabled: true,
            scales: [
                { id: '2', date: '', included: false },
                { id: '1', date: '2026-12-04', included: true },
            ],
        });
        await vi.waitFor(() => expect(container.textContent).toContain('Pacing saved.'));
        expect(cache.meta.customOutcomePacing).toEqual(saved);
    });

    test('refuses to save with no required outcomes', () => {
        mountPacingSettingsView(shell, makeCache(), ctx);
        container.querySelectorAll('[data-include]').forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
        container.querySelector('[data-pacing-save]').click();
        expect(container.textContent).toContain('Select at least one required outcome.');
        expect(updatePage).not.toHaveBeenCalled();
    });

    test('teardown clears the container', () => {
        const view = mountPacingSettingsView(shell, makeCache(), ctx);
        view.teardown();
        expect(container.innerHTML).toBe('');
    });
});
