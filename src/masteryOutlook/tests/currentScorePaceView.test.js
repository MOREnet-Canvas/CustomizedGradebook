// src/masteryOutlook/tests/currentScorePaceView.test.js
// Course Overview Pace view: class target dates on a timeline per student,
// statuses from pacingService, the shared toolbar, and the Scores | Pace toggle.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    window.CG_CONFIG = { ...(window.CG_CONFIG || {}), EXCLUDED_OUTCOME_KEYWORDS: ['Homework'] };
});

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import {
    buildPaceRows, sortPaceRows, renderPaceView, getPaceTimeline, DEFAULT_PACE_SORT,
} from '../currentScorePaceView.js';
import {
    renderCurrentScoreTable, wireCurrentScoreTable, CS_MODES, DEFAULT_CURRENT_SCORE_SORT,
} from '../currentScoreTable.js';
import { rowSavePhase, rowsAwaitingOutcome } from '../masteryOutlookState.js';

const CS = '603';
const HW = '700';
const O1 = '598';
const O2 = '599';
const O3 = '601';   // in the course, not required

const NOW = new Date('2026-11-17T18:00:00Z');
const TODAY = '2026-11-17';
const COURSE_DATES = { startAt: '2026-08-15T05:00:00Z', endAt: '2027-05-20T05:00:00Z', timeZone: 'America/Chicago' };

const stu = (id, name, scores) => ({
    id, name, sortableName: name,
    outcomes: Object.entries(scores).map(([outcomeId, canvasScore]) => ({ outcomeId, canvasScore })),
});

function makeCache(pacing) {
    return {
        meta: {
            courseId: '566',
            customOutcomeOrder: [O2, O1, O3],
            customOutcomePacing: pacing === undefined ? {
                enabled: true,
                scales: [
                    { id: O1, date: '2026-11-01', included: true },
                    { id: O2, date: '2026-12-01', included: true },
                    { id: O3, date: '2026-11-17', included: false },
                ],
            } : pacing,
        },
        outcomes: [
            { id: Number(O1), title: 'Outcome 1' },
            { id: Number(CS), title: 'Current Score' },
            { id: Number(O2), title: 'Outcome 2' },
            { id: Number(O3), title: 'Outcome 3' },
            { id: Number(HW), title: 'Homework Completion' },
        ],
        students: [
            stu('2', 'Bravo',   { [O1]: 3,   [O2]: 2,   [O3]: 1 }),
            stu('1', 'Alpha',   { [O1]: 1.5, [O2]: null }),
            stu('3', 'Charlie', { [O1]: 4,   [O2]: 3.5 }),
        ],
        sync_state: {},
        ignored_alignments: [],
    };
}

const csOutcome = (cache) => cache.outcomes.find(o => String(o.id) === CS);

beforeEach(() => {
    rowSavePhase.clear();
    rowsAwaitingOutcome.clear();
});

describe('getPaceTimeline', () => {
    test('course dates in the course time zone; today in the course time zone', () => {
        expect(getPaceTimeline(makeCache(), COURSE_DATES, NOW))
            .toEqual({ today: TODAY, start: '2026-08-15', end: '2027-05-20' });
    });

    test('without course dates, pads the required target dates', () => {
        const t = getPaceTimeline(makeCache(), null, NOW);
        expect(t.start).toBe('2026-10-18');
        expect(t.end).toBe('2026-12-15');
    });
});

describe('buildPaceRows', () => {
    test('only required outcomes with a date, in teacher order', () => {
        const { outcomes } = buildPaceRows(csOutcome(makeCache()), makeCache(), { today: TODAY });
        expect(outcomes.map(o => o.id)).toEqual([O2, O1]);
    });

    test('statuses from Canvas scores vs class target dates', () => {
        const { rows } = buildPaceRows(csOutcome(makeCache()), makeCache(), { today: TODAY });
        const by = Object.fromEntries(rows.map(r => [r.name, r]));
        expect(by.Alpha.behind).toBe(1);
        expect(by.Alpha.next.id).toBe(O2);
        expect(by.Bravo.behind).toBe(0);
        expect(by.Bravo.next.id).toBe(O2);
        expect(by.Charlie.next).toBeNull();
        expect(by.Bravo.items.map(i => i.id)).toEqual([O1, O2]);   // date order
    });
});

describe('sortPaceRows', () => {
    const rows = () => buildPaceRows(csOutcome(makeCache()), makeCache(), { today: TODAY }).rows;

    test('default: most behind first, ties by name', () => {
        expect(sortPaceRows(rows(), DEFAULT_PACE_SORT, TODAY).map(r => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
        expect(sortPaceRows(rows(), { key: 'behind', dir: 'asc' }, TODAY).map(r => r.name)).toEqual(['Bravo', 'Charlie', 'Alpha']);
    });

    test('next due: soonest first, nothing due last', () => {
        expect(sortPaceRows(rows(), { key: 'next', dir: 'asc' }, TODAY).map(r => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    test('name', () => {
        expect(sortPaceRows(rows(), { key: 'name', dir: 'desc' }, TODAY).map(r => r.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    });
});

describe('renderPaceView', () => {
    const render = (cache = makeCache(), sort) => {
        document.body.innerHTML = renderPaceView(csOutcome(cache), cache, sort, { courseDates: COURSE_DATES, now: NOW });
        return document.body;
    };

    test('toolbar shows Pace pressed and the pace sort options', () => {
        const root = render();
        expect(root.querySelector('[data-mode="pace"]').getAttribute('aria-pressed')).toBe('true');
        expect(root.querySelector('[data-mode="scores"]').getAttribute('aria-pressed')).toBe('false');
        expect([...root.querySelectorAll('[data-action="cs-sort-key"] option')].map(o => o.value))
            .toEqual(['behind', 'next', 'name']);
    });

    test('one marker per required, dated outcome with the right symbol', () => {
        const root = render();
        const alpha = root.querySelector('.cs-pace-row[data-stu="1"]');
        const marks = Object.fromEntries([...alpha.querySelectorAll('.cs-pace-mk')].map(m => [m.dataset.oid, m.dataset.mark]));
        expect(marks).toEqual({ [O1]: 'behind', [O2]: 'notdue' });
        const charlie = root.querySelector('.cs-pace-row[data-stu="3"]');
        expect([...charlie.querySelectorAll('.cs-pace-mk')].map(m => m.dataset.mark)).toEqual(['met', 'met']);
        expect(root.querySelector(`.cs-pace-mk[data-oid="${O3}"]`)).toBeNull();
    });

    test('status column and screen-reader list', () => {
        const root = render();
        expect(root.querySelector('.cs-pace-row[data-stu="1"] .cs-pace-pill').textContent).toContain('Behind 1');
        expect(root.querySelector('.cs-pace-row[data-stu="3"] .cs-pace-next').textContent).toBe('Nothing else due');
        expect(root.querySelector('.cs-pace-row[data-stu="2"] .cs-pace-next').textContent).toBe('Next: Outcome 2 · Dec 1 (in 14d)');
        expect(root.querySelectorAll('.cs-pace-sr li')).toHaveLength(3);
    });

    test('a due-today, unmastered outcome is amber, not behind', () => {
        const cache = makeCache({ enabled: true, scales: [{ id: O1, date: TODAY, included: true }] });
        const root = render(cache);
        expect(root.querySelector('.cs-pace-row[data-stu="1"] .cs-pace-mk').dataset.mark).toBe('today');
        expect(root.querySelector('.cs-pace-row[data-stu="1"] .cs-pace-pill').textContent).toBe('Due today');
    });

    test('no target dates → message pointing at the Pacing tab, toggle still shown', () => {
        for (const pacing of [null, { enabled: true, scales: [{ id: O1, date: '', included: true }] }]) {
            const root = render(makeCache(pacing));
            expect(root.querySelector('.cs-pace-empty').textContent).toContain('Pacing');
            expect(root.querySelector('[data-mode="pace"]')).not.toBeNull();
            expect(root.querySelector('.cs-pace-row')).toBeNull();
        }
    });

    test('notes when pacing is hidden from students', () => {
        const cache = makeCache();
        cache.meta.customOutcomePacing.enabled = false;
        expect(render(cache).querySelector('.os-table-hint').textContent).toContain('hidden from students');
    });

    test('escapes outcome and student names', () => {
        const cache = makeCache();
        cache.students[0].name = '<img src=x>';
        cache.meta.customOutcomeNames = { [O1]: '<b>x</b>' };
        const root = render(cache);
        expect(root.querySelector('img')).toBeNull();
        expect(root.querySelector('.cs-pace b')).toBeNull();
    });
});

describe('Scores | Pace toggle', () => {
    test('scores table shows the toggle only when asked', () => {
        const cache = makeCache();
        document.body.innerHTML = renderCurrentScoreTable(csOutcome(cache), cache);
        expect(document.querySelector('.cs-mode-toggle')).toBeNull();
        document.body.innerHTML = renderCurrentScoreTable(csOutcome(cache), cache, undefined, undefined, { showModeToggle: true });
        expect(document.querySelector('[data-mode="scores"]').getAttribute('aria-pressed')).toBe('true');
    });

    test('switching modes keeps a separate sort for each', () => {
        const cache = makeCache();
        const outcome = csOutcome(cache);
        const contentEl = document.createElement('div');
        document.body.replaceChildren(contentEl);
        const state = {
            csMode: CS_MODES.SCORES,
            currentScoreSort: { ...DEFAULT_CURRENT_SCORE_SORT },
            paceSort: { ...DEFAULT_PACE_SORT },
        };
        const renderTable = () => {
            contentEl.innerHTML = state.csMode === CS_MODES.PACE
                ? renderPaceView(outcome, cache, state.paceSort, { courseDates: COURSE_DATES, now: NOW })
                : renderCurrentScoreTable(outcome, cache, state.currentScoreSort, state.csView, { showModeToggle: true });
        };
        const teardown = wireCurrentScoreTable({ contentEl, state, outcome, cache, renderTable });
        renderTable();

        contentEl.querySelector('[data-mode="pace"]').click();
        expect(state.csMode).toBe(CS_MODES.PACE);
        expect(contentEl.querySelector('.cs-pace')).not.toBeNull();

        contentEl.querySelector('[data-action="cs-sort-dir"]').click();
        expect(state.paceSort.dir).toBe('asc');
        const select = contentEl.querySelector('[data-action="cs-sort-key"]');
        select.value = 'name';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.paceSort.key).toBe('name');
        expect(state.currentScoreSort).toEqual(DEFAULT_CURRENT_SCORE_SORT);

        contentEl.querySelector('[data-mode="scores"]').click();
        expect(state.csMode).toBe(CS_MODES.SCORES);
        expect(contentEl.querySelector('table')).not.toBeNull();
        teardown();
    });
});
