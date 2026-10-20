// src/masteryOutlook/tests/currentScoreTable.test.js
// Current Score has its own read-only table: a Canvas-score chip per averaged
// outcome (page order), the Current Score, sorting instead of tabs, and ⏳ while
// a save that feeds the average is in progress.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    window.CG_CONFIG = { ...(window.CG_CONFIG || {}), EXCLUDED_OUTCOME_KEYWORDS: ['Homework'] };
});

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../masteryOutlookCacheService.js', () => ({
    readSyncState:            vi.fn(async () => ({})),
    writeSyncState:           vi.fn(async () => {}),
    readMasteryOutlookCache:  vi.fn(async () => null),
    writeMasteryOutlookCache: vi.fn(async () => {}),
    readPLAssignments:        vi.fn(async () => ({})),
}));

vi.mock('../outcomeLayoutService.js', () => ({ saveOutcomeLayout: vi.fn(async () => true) }));

import {
    renderCurrentScoreTable, sortCurrentScoreRows, buildCurrentScoreRows, createCurrentScoreViewState,
    parseOverrideInput, isOverrideDirty, moveOutcomeInOrder,
} from '../currentScoreTable.js';
import { saveOutcomeLayout } from '../outcomeLayoutService.js';
import { orderOutcomesForPage, getAveragedOutcomes } from '../outcomeTypes.js';
import {
    rowSavePhase, rowsAwaitingOutcome, setRowPhase, clearRowPhase, subscribeSaveStatus,
} from '../masteryOutlookState.js';
import { mountOutcomeRow } from '../outcomeRow.js';
import { clearCourseRollupReuse, applyCanvasClassStats } from '../masteryOutlookDataService.js';

const CS = '603';   // Current Score
const HW = '700';   // Homework Completion (excluded)
const O1 = '598';
const O2 = '599';

const stu = (id, name, scores) => ({
    id, name, sortableName: name,
    outcomes: Object.entries(scores).map(([outcomeId, canvasScore]) => ({ outcomeId, canvasScore })),
});

function makeCache() {
    return {
        meta: { courseId: '566', customOutcomeOrder: [O2, O1] },
        outcomes: [
            { id: Number(O1), title: 'Outcome 1 — Reading closely' },
            { id: Number(CS), title: 'Current Score' },
            { id: Number(O2), title: 'Outcome 2 — Writing' },
            { id: Number(HW), title: 'Homework Completion' },
        ],
        students: [
            stu('2', 'Bravo',   { [O1]: 3,   [O2]: 2,   [HW]: 4, [CS]: 2.5 }),
            stu('1', 'Alpha',   { [O1]: 1.5, [O2]: null,          [CS]: 1.5 }),
            stu('3', 'Charlie', { [O1]: 4,   [O2]: 3.5,           [CS]: null }),
        ],
        sync_state: {},
        ignored_alignments: [],
    };
}

const currentScoreOutcome = (cache) => cache.outcomes.find(o => String(o.id) === CS);

function mountTable(cache, sort) {
    document.body.innerHTML = renderCurrentScoreTable(currentScoreOutcome(cache), cache, sort);
    return document.body;
}

const rowOf = (root, sid) => root.querySelector(`tr[data-stu="${sid}"]`);

beforeEach(() => {
    rowSavePhase.clear();
    rowsAwaitingOutcome.clear();
});

describe('outcome order helpers', () => {
    test('page order: Current Score → excluded → regular in teacher order', () => {
        expect(orderOutcomesForPage(makeCache()).map(o => String(o.id))).toEqual([CS, HW, O2, O1]);
    });

    test('averaged outcomes skip Current Score and excluded-keyword outcomes', () => {
        expect(getAveragedOutcomes(makeCache()).map(o => String(o.id))).toEqual([O2, O1]);
    });
});

describe('renderCurrentScoreTable', () => {
    test('one chip per averaged outcome, in page order, with the full name on hover', () => {
        const root = mountTable(makeCache());
        const chips = [...rowOf(root, '2').querySelectorAll('.cs-chip')];
        expect(chips.map(c => c.dataset.oid)).toEqual([O2, O1]);
        expect(chips.map(c => c.getAttribute('title'))).toEqual(['Outcome 2 — Writing', 'Outcome 1 — Reading closely']);
        expect(chips.map(c => c.textContent.trim())).toEqual(['2.00', '3.00']);
        expect(root.querySelector(`.cs-chip[data-oid="${HW}"]`)).toBeNull();
    });

    test('missing score is a grey "—" chip', () => {
        const root = mountTable(makeCache());
        const chip = rowOf(root, '1').querySelector(`.cs-chip[data-oid="${O2}"]`);
        expect(chip.textContent.trim()).toBe('—');
        expect(chip.classList.contains('cs-chip-empty')).toBe(true);
        expect(chip.getAttribute('style')).toContain('--bg-secondary');
    });

    test('one column per averaged outcome, headed by its name in page order; Canvas Current Score; no tabs', () => {
        const root = mountTable(makeCache());
        const heads = [...root.querySelectorAll('th.cs-col-head')];
        expect(heads.map(th => th.dataset.colOid)).toEqual([O2, O1]);
        expect(heads.map(th => th.querySelector('.cs-col-name').textContent)).toEqual(['Outcome 2 — Writing', 'Outcome 1 — Reading closely']);
        expect(heads.every(th => th.getAttribute('draggable') === 'true')).toBe(true);
        expect(heads.every(th => th.querySelector('[data-action="cs-rename"]'))).toBe(true);
        expect(rowOf(root, '2').querySelector('.cs-current').textContent.trim()).toBe('2.50');
        expect(rowOf(root, '3').querySelector('.cs-current').textContent.trim()).toBe('—');
        expect(root.querySelector('[data-action^="os-use"], [data-action="os-save"], [data-action="os-note"]')).toBeNull();
        expect(root.querySelector('.od-detail-tab')).toBeNull();
    });

    test('teacher display names replace the Canvas title in headers, chip tooltips, and Sort by', () => {
        const cache = makeCache();
        cache.meta.customOutcomeNames = { [O1]: 'Reading' };
        const root = mountTable(cache);
        const head = root.querySelector(`th[data-col-oid="${O1}"]`);
        expect(head.querySelector('.cs-col-name').textContent).toBe('Reading');
        expect(head.getAttribute('title')).toContain('Outcome 1 — Reading closely');
        expect(rowOf(root, '2').querySelector(`.cs-chip[data-oid="${O1}"]`).getAttribute('title')).toBe('Reading');
        const option = [...root.querySelector('[data-action="cs-sort-key"]').options].find(o => o.value === O1);
        expect(option.textContent).toBe('Reading');
    });

    test('renaming shows an input in that header', () => {
        const cache = makeCache();
        document.body.innerHTML = renderCurrentScoreTable(currentScoreOutcome(cache), cache, undefined,
            { ...createCurrentScoreViewState(), renamingId: O2 });
        const input = document.querySelector(`th[data-col-oid="${O2}"] [data-action="cs-rename-input"]`);
        expect(input.value).toBe('Outcome 2 — Writing');
        expect(document.querySelector(`th[data-col-oid="${O2}"]`).getAttribute('draggable')).toBeNull();
    });

    test('Override / Note / Save columns only when course overrides are enabled', () => {
        const cache = makeCache();
        const outcome = currentScoreOutcome(cache);
        document.body.innerHTML = renderCurrentScoreTable(outcome, cache, undefined, undefined, { overrideEnabled: false });
        expect(document.querySelector('[data-action="cs-ov-score"]')).toBeNull();
        expect(document.querySelector('.os-table-hint').textContent).toMatch(/overrides are turned off/);

        cache.sync_state = { [CS]: { '2': { cs_override_score: 3, cs_override_note: 'Retest', cs_override_lock: 'locked' } } };
        document.body.innerHTML = renderCurrentScoreTable(outcome, cache, undefined, undefined, { overrideEnabled: true });
        const heads = [...document.querySelectorAll('th')].map(th => th.textContent.trim()).slice(-4);
        expect(heads).toEqual(['Canvas', 'Override', 'Note', 'Save']);
        const row2 = rowOf(document.body, '2');
        expect(row2.querySelector('[data-action="cs-ov-score"]').value).toBe('3');
        expect(row2.querySelector('[data-action="cs-ov-note"]').value).toBe('Retest');
        expect(row2.querySelector('[data-action="cs-ov-lock"]').textContent).toBe('🔒');
        expect(row2.querySelector('[data-action="cs-ov-save"]').disabled).toBe(true);
        // No override → no padlock
        expect(rowOf(document.body, '1').querySelector('[data-action="cs-ov-lock"]')).toBeNull();
    });

    test('Sort by lists Student name, Current Score, then each averaged outcome', () => {
        const root = mountTable(makeCache(), { key: O1, dir: 'desc' });
        const select = root.querySelector('[data-action="cs-sort-key"]');
        expect([...select.options].map(o => o.value)).toEqual(['name', 'current', O2, O1]);
        expect(select.value).toBe(O1);
        expect(root.querySelector('[data-action="cs-sort-dir"]').textContent).toBe('↓');
    });
});

describe('override input helpers', () => {
    test('parseOverrideInput: blank = remove, 0–4 accepted, anything else is an error', () => {
        expect(parseOverrideInput('')).toEqual({ value: null, error: null });
        expect(parseOverrideInput(' 3.5 ')).toEqual({ value: 3.5, error: null });
        expect(parseOverrideInput('0')).toEqual({ value: 0, error: null });
        expect(parseOverrideInput('5').error).toMatch(/0 to 4/);
        expect(parseOverrideInput('abc').error).toMatch(/0 to 4/);
    });

    test('isOverrideDirty compares the draft with the saved override', () => {
        const row = { id: '1', override: { score: 3, note: 'x', locked: false } };
        const view = createCurrentScoreViewState();
        expect(isOverrideDirty(row, view)).toBe(false);
        view.drafts['1'] = { score: '3.0', note: 'x' };
        expect(isOverrideDirty(row, view)).toBe(false);
        view.drafts['1'] = { score: '2.5', note: 'x' };
        expect(isOverrideDirty(row, view)).toBe(true);
        view.drafts['1'] = { score: '', note: 'x' };              // remove
        expect(isOverrideDirty(row, view)).toBe(true);
        view.drafts['1'] = { score: '3', note: 'changed' };
        expect(isOverrideDirty(row, view)).toBe(true);
        expect(isOverrideDirty({ id: '2', override: null }, { ...view, drafts: { '2': { score: '', note: 'only a note' } } })).toBe(false);
    });

    test('moveOutcomeInOrder moves before / after the target', () => {
        expect(moveOutcomeInOrder(['a', 'b', 'c'], 'c', 'a', false)).toEqual(['c', 'a', 'b']);
        expect(moveOutcomeInOrder(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a']);
        expect(moveOutcomeInOrder(['a', 'b', 'c'], 'a', 'zz', true)).toEqual(['a', 'b', 'c']);
    });
});

describe('sortCurrentScoreRows', () => {
    const order = (sort) => {
        const cache = makeCache();
        const { rows } = buildCurrentScoreRows(currentScoreOutcome(cache), cache);
        return sortCurrentScoreRows(rows, sort).map(r => r.name);
    };

    test('by name', () => {
        expect(order({ key: 'name', dir: 'asc' })).toEqual(['Alpha', 'Bravo', 'Charlie']);
        expect(order({ key: 'name', dir: 'desc' })).toEqual(['Charlie', 'Bravo', 'Alpha']);
    });

    test('by Current Score — missing last in both directions', () => {
        expect(order({ key: 'current', dir: 'asc' })).toEqual(['Alpha', 'Bravo', 'Charlie']);
        expect(order({ key: 'current', dir: 'desc' })).toEqual(['Bravo', 'Alpha', 'Charlie']);
    });

    test('by an outcome — missing last in both directions', () => {
        expect(order({ key: O2, dir: 'asc' })).toEqual(['Bravo', 'Charlie', 'Alpha']);
        expect(order({ key: O2, dir: 'desc' })).toEqual(['Charlie', 'Bravo', 'Alpha']);
    });
});

describe('⏳ on the Current Score table', () => {
    // A visible ⏳ slot (chip slots are always rendered, hidden when idle)
    const hasHourglass = (el) => !!el.querySelector('.cs-pending:not(.hidden)');

    test('⏳ sits outside the chip, not inside it', () => {
        rowSavePhase.set(`${O2}_2`, 'queued');
        const wrap = rowOf(mountTable(makeCache()), '2').querySelector(`.cs-chip-wrap[data-oid="${O2}"]`);
        expect(wrap.querySelector('.cs-chip').textContent.trim()).toBe('2.00');
        expect(wrap.querySelector('.cs-chip .cs-pending')).toBeNull();
        expect(wrap.querySelector(':scope > .cs-pending:not(.hidden)').textContent).toBe('⏳');
    });

    test('none when nothing is saving', () => {
        const root = mountTable(makeCache());
        expect(hasHourglass(root.querySelector('tbody'))).toBe(false);
    });

    test.each(['queued', 'checking', 'pushing', 'verifying'])('save phase %s → ⏳ on that chip and the Current Score', (phase) => {
        rowSavePhase.set(`${O2}_2`, phase);
        const root = mountTable(makeCache());
        const row = rowOf(root, '2');
        expect(hasHourglass(row.querySelector(`.cs-chip-wrap[data-oid="${O2}"]`))).toBe(true);
        expect(hasHourglass(row.querySelector(`.cs-chip-wrap[data-oid="${O1}"]`))).toBe(false);
        expect(hasHourglass(row.querySelector('.cs-current'))).toBe(true);
        expect(hasHourglass(rowOf(root, '1'))).toBe(false);
    });

    test('waiting for the outcome score → ⏳ on the chip and the Current Score', () => {
        rowsAwaitingOutcome.add(`${O1}_3`);
        const row = rowOf(mountTable(makeCache()), '3');
        expect(hasHourglass(row.querySelector(`.cs-chip-wrap[data-oid="${O1}"]`))).toBe(true);
        expect(hasHourglass(row.querySelector('.cs-current'))).toBe(true);
    });

    test('only the Current Score waiting → ⏳ on the Current Score, not the chips', () => {
        rowsAwaitingOutcome.add(`${CS}_1`);
        const row = rowOf(mountTable(makeCache()), '1');
        expect([...row.querySelectorAll('.cs-chip-wrap')].some(hasHourglass)).toBe(false);
        expect(hasHourglass(row.querySelector('.cs-current'))).toBe(true);
    });
});

describe('row-phase changes notify listeners', () => {
    test('setRowPhase / clearRowPhase notify once per changed outcome', () => {
        const seen = [];
        const unsubscribe = subscribeSaveStatus(id => seen.push(id));
        setRowPhase([`${O2}_1`, `${O2}_2`, `${O1}_1`], 'queued');
        expect(seen.sort()).toEqual([O1, O2]);

        seen.length = 0;
        setRowPhase([`${O2}_1`], 'queued');   // unchanged
        expect(seen).toEqual([]);

        clearRowPhase([`${O2}_1`, `${O2}_2`]);
        expect(seen).toEqual([O2]);

        seen.length = 0;
        clearRowPhase([`${O2}_1`]);           // already idle
        expect(seen).toEqual([]);
        unsubscribe();
    });
});

describe('mounted detail panel', () => {
    function mount(outcomeId, isCurrentScoreRow, { cache = makeCache(), rerender = () => {} } = {}) {
        clearCourseRollupReuse();
        cache.pl_assignments = { [O2]: { assignment_id: 'x' } };
        const outcome = cache.outcomes.find(o => String(o.id) === outcomeId);
        const ctx = {
            courseId: '566',
            apiClient: {
                get: vi.fn(async () => ({ rollups: [] })),
                getAllPages: vi.fn(async () => []),
                getWithResponse: vi.fn(async () => ({ json: async () => ({ rollups: [] }), headers: { get: () => null } })),
            },
            getThreshold: () => 3,
            getColorScheme: () => 'soft',
        };
        const state = { expandedOutcomeIds: new Set([outcome.id]), activeTabs: {} };
        const { rootEl, teardown } = mountOutcomeRow({
            outcome, cache, ctx, state,
            displayStats: { plAvg: null, distribution: { '1': 0, '2': 0, '3': 0, '4': 0 }, belowThresholdCount: 0, neCount: 0 },
            displayNumber: isCurrentScoreRow ? '' : 1, isSpecial: isCurrentScoreRow, isCurrentScoreRow,
            isRegularOutcome: () => !isCurrentScoreRow, rerender,
        });
        document.body.replaceChildren(rootEl);
        return { rootEl, teardown, state, cache };
    }

    test('✎ rename → Enter saves the name to the dashboard page and redraws the outcome list', () => {
        saveOutcomeLayout.mockClear();
        const rerender = vi.fn();
        const { rootEl, teardown, cache } = mount(CS, true, { rerender });
        rootEl.querySelector(`[data-action="cs-rename"][data-oid="${O1}"]`).click();
        const input = rootEl.querySelector('[data-action="cs-rename-input"]');
        input.value = '  Reading  ';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(cache.meta.customOutcomeNames).toEqual({ [O1]: 'Reading' });
        expect(saveOutcomeLayout).toHaveBeenCalledWith('566', expect.anything(), { names: { [O1]: 'Reading' } });
        expect(rerender).toHaveBeenCalledTimes(1);
        teardown();
    });

    test('renaming back to the Canvas title (or blank) removes the custom name', () => {
        saveOutcomeLayout.mockClear();
        const cache = makeCache();
        cache.meta.customOutcomeNames = { [O1]: 'Reading' };
        const { rootEl, teardown } = mount(CS, true, { cache });
        rootEl.querySelector(`[data-action="cs-rename"][data-oid="${O1}"]`).click();
        const input = rootEl.querySelector('[data-action="cs-rename-input"]');
        input.value = '';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(cache.meta.customOutcomeNames).toEqual({});
        expect(saveOutcomeLayout).toHaveBeenCalledWith('566', expect.anything(), { names: {} });
        teardown();
    });

    test('Escape cancels a rename', () => {
        saveOutcomeLayout.mockClear();
        const { rootEl, teardown, cache } = mount(CS, true);
        rootEl.querySelector(`[data-action="cs-rename"][data-oid="${O2}"]`).click();
        rootEl.querySelector('[data-action="cs-rename-input"]')
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(rootEl.querySelector('[data-action="cs-rename-input"]')).toBeNull();
        expect(cache.meta.customOutcomeNames).toBeUndefined();
        expect(saveOutcomeLayout).not.toHaveBeenCalled();
        teardown();
    });

    test('dragging a column header onto another saves the same outcome order the list uses', () => {
        saveOutcomeLayout.mockClear();
        const rerender = vi.fn();
        const { rootEl, teardown, cache } = mount(CS, true, { rerender });
        const head = (oid) => rootEl.querySelector(`th[data-col-oid="${oid}"]`);
        const dt = { data: {}, setData(t, v) { this.data[t] = v; }, getData(t) { return this.data[t]; } };
        const fire = (el, type) => {
            const ev = new Event(type, { bubbles: true, cancelable: true });
            ev.dataTransfer = dt;
            el.dispatchEvent(ev);
        };
        fire(head(O1), 'dragstart');
        expect(dt.data['text/plain']).toBeUndefined();   // the outcome list's drop handler ignores it
        fire(head(O2), 'dragover');
        fire(head(O2), 'drop');                           // left half → before O2
        fire(head(O1), 'dragend');
        expect(cache.meta.customOutcomeOrder).toEqual([O1, O2]);
        expect(saveOutcomeLayout).toHaveBeenCalledWith('566', expect.anything(), { order: [O1, O2] });
        expect(rerender).toHaveBeenCalledTimes(1);
        teardown();
    });

    test('Current Score panel has no tabs and renders the chip table', () => {
        const { rootEl, teardown } = mount(CS, true);
        expect(rootEl.querySelector('.od-detail-tab')).toBeNull();
        expect(rootEl.querySelector('.cs-chip')).not.toBeNull();
        teardown();
    });

    test('sort controls re-render the table', () => {
        const { rootEl, teardown, state } = mount(CS, true);
        const select = rootEl.querySelector('[data-action="cs-sort-key"]');
        select.value = 'current';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.currentScoreSort).toEqual({ key: 'current', dir: 'asc' });
        rootEl.querySelector('[data-action="cs-sort-dir"]').click();
        expect(state.currentScoreSort).toEqual({ key: 'current', dir: 'desc' });
        const names = [...rootEl.querySelectorAll('tbody tr .os-stu-name')].map(n => n.textContent);
        expect(names).toEqual(['Bravo', 'Alpha', 'Charlie']);
        teardown();
    });

    test('a save on another outcome puts ⏳ on the Current Score panel', async () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        try {
            const { rootEl, teardown } = mount(CS, true);
            setRowPhase([`${O2}_2`], 'queued');
            vi.advanceTimersToNextFrame();
            const row = rootEl.querySelector('tr[data-stu="2"]');
            expect(row.querySelector('.cs-current').textContent).toContain('⏳');
            clearRowPhase([`${O2}_2`]);
            teardown();
        } finally {
            vi.useRealTimers();
        }
    });

    test('regular outcome panel keeps its tabs', () => {
        const { rootEl, teardown } = mount(O2, false);
        expect(rootEl.querySelectorAll('.od-detail-tab').length).toBeGreaterThan(0);
        expect(rootEl.querySelector('.cs-chip')).toBeNull();
        teardown();
    });
});

describe('outcome list', () => {
    test('every outcome row renders after Current Score, with the divider after the special rows', async () => {
        const { mountOutcomeSyncView } = await import('../outcomeSyncView.js');
        const cache = makeCache();
        cache.pl_assignments = {};
        cache.outcomes.forEach(o => applyCanvasClassStats(o, cache, 3));   // as Refresh Data does
        const outcomesEl = document.createElement('div');
        document.body.replaceChildren(outcomesEl);
        const ctx = {
            courseId: '566',
            apiClient: {
                get: vi.fn(async () => ({ rollups: [] })),
                getAllPages: vi.fn(async () => []),
                getWithResponse: vi.fn(async () => ({ json: async () => ({ rollups: [] }), headers: { get: () => null } })),
            },
            getThreshold: () => 3,
            getColorScheme: () => 'soft',
        };
        const view = mountOutcomeSyncView({ outcomesEl }, cache, ctx);

        const children   = [...outcomesEl.children];
        const containers = children.filter(el => el.classList.contains('od-outcome-container'));
        const titles     = ['Current Score', 'Homework Completion', 'Outcome 2 — Writing', 'Outcome 1 — Reading closely'];
        expect(containers).toHaveLength(4);
        containers.forEach((el, i) => expect(el.textContent).toContain(titles[i]));
        // Divider sits between the last special row (Homework) and the first regular row
        const divider = outcomesEl.querySelector('.od-outcome-divider');
        expect(children.indexOf(divider)).toBe(children.indexOf(containers[2]) - 1);
        view?.teardown?.();
    });
});
