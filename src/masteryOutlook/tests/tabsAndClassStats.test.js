// src/masteryOutlook/tests/tabsAndClassStats.test.js
// Struggling / Declining / Growing are All Students rows with a filter; their
// tab counts come from the same rows. Row averages and class stats use Canvas.
import { describe, test, expect, vi } from 'vitest';

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

import { buildOutcomeStudentRows, countTabStudents, TAB_FILTERS, TREND_SLOPE_THRESHOLD, mountOutcomeRow } from '../outcomeRow.js';
import { applyCanvasClassStats } from '../masteryOutlookDataService.js';
import { computeCurrentScoreClassStats } from '../outcomeSyncView.js';

const OID = '599';
const stu = (id, od) => ({ id, name: `Student ${id}`, sortableName: `Student ${id}`, outcomes: [{ outcomeId: OID, ...od }] });

function makeCache() {
    return {
        outcomes: [{ id: OID, title: 'Outcome 2', classStats: { computedThreshold: 3 } }],
        students: [
            stu('1', { plPrediction: 1.57, slope: -0.3,  canvasScore: 3 }),
            stu('2', { plPrediction: 2.50, slope: -0.07, canvasScore: 2.5 }),
            stu('3', { plPrediction: 3.60, slope:  0.07, canvasScore: 3.5 }),
            stu('4', { plPrediction: 0.11, slope:  0.01, canvasScore: null }),
        ],
    };
}

describe('tabs share the All Students rows', () => {
    test('tab counts equal the filtered All Students rows', () => {
        const cache = makeCache();
        const rows = buildOutcomeStudentRows({ id: OID }, cache);
        expect(rows).toHaveLength(4);
        for (const tab of ['struggling', 'declining', 'growing', 'all']) {
            const expected = rows.filter(r => TAB_FILTERS[tab](r, 3)).length;
            expect(countTabStudents({ id: OID }, tab, cache, 3)).toBe(expected);
        }
        expect(countTabStudents({ id: OID }, 'struggling', cache, 3)).toBe(1);   // Canvas 2.5 < 3 (Canvas 3 / 3.5 / none are not)
        expect(countTabStudents({ id: OID }, 'declining',  cache, 3)).toBe(2);
        expect(countTabStudents({ id: OID }, 'growing',    cache, 3)).toBe(1);
    });

    test('counts follow the data when it changes (no stale snapshot)', () => {
        const cache = makeCache();
        expect(countTabStudents({ id: OID }, 'struggling', cache, 3)).toBe(1);
        cache.students[1].outcomes[0].canvasScore = 3.2;
        expect(countTabStudents({ id: OID }, 'struggling', cache, 3)).toBe(0);
    });

    test("Struggling uses the Canvas score and equals the row's Below threshold", () => {
        // Test Student001 case: Marzano 1.50 but Canvas 3.00 → not struggling at threshold 3
        const cache = makeCache();
        const rows = buildOutcomeStudentRows({ id: OID }, cache);
        expect(TAB_FILTERS.struggling(rows[0], 3)).toBe(false);
        const cs = applyCanvasClassStats(cache.outcomes[0], cache, 3);
        expect(countTabStudents({ id: OID }, 'struggling', cache, 3)).toBe(cs.belowThresholdCount);
    });

    test('trend threshold is shared: slope 0.07 is growing and would show ▲', () => {
        expect(TREND_SLOPE_THRESHOLD).toBe(0.05);
        expect(TAB_FILTERS.growing({ slope: 0.07 })).toBe(true);
        expect(TAB_FILTERS.declining({ slope: -0.07 })).toBe(true);
        expect(TAB_FILTERS.growing({ slope: 0.01 })).toBe(false);
    });

    test('Current Score rows use the Canvas Current Score', () => {
        const cache = { students: [
            { id: 'a', outcomes: [{ outcomeId: '603', canvasScore: 2.3, plPrediction: 3.9 }] },
        ] };
        expect(buildOutcomeStudentRows({ id: '603' }, cache, { isCurrentScoreRow: true })[0].plPrediction).toBe(2.3);
    });
});

describe('outcome detail panel', () => {
    function mountExpanded(activeTab, prepare = () => {}) {
        const cache = { ...makeCache(), sync_state: {}, ignored_alignments: [],
            pl_assignments: { [OID]: { assignment_id: 'x' } }, meta: { courseId: '566' } };
        prepare(cache);
        const outcome = cache.outcomes[0];
        applyCanvasClassStats(outcome, cache, 3);   // as Refresh Data does
        const ctx = {
            courseId: '566',
            apiClient: { get: vi.fn(async () => ({ rollups: [] })), getAllPages: vi.fn(async () => []) },
            getThreshold: () => 3,
            getColorScheme: () => 'soft',
        };
        const state = { expandedOutcomeIds: new Set([OID]), activeTabs: { [OID]: activeTab } };
        const { rootEl, teardown } = mountOutcomeRow({
            outcome, cache, ctx, state, displayStats: outcome.classStats,
            displayNumber: 1, isSpecial: false, isCurrentScoreRow: false,
            isRegularOutcome: () => true, rerender: () => {},
        });
        document.body.replaceChildren(rootEl);
        return { rootEl, teardown };
    }

    test('first tab reads "Manage Scores"; Struggling count equals the Canvas below-threshold count', () => {
        const { rootEl, teardown } = mountExpanded('students');
        const labels = [...rootEl.querySelectorAll('.od-detail-tab')].map(b => b.textContent);
        expect(labels[0]).toBe('Manage Scores (4)');
        expect(labels).toContain('Struggling (1)');
        teardown();
    });

    test('Exceptions tab shows a Most recent column with the latest alignment score', () => {
        const { rootEl, teardown } = mountExpanded('exceptions', (cache) => {
            cache.students[0].outcomes[0].mostRecent = 1.5;
            cache.sync_state = { [OID]: { '1': { last_synced_score: 2, last_synced_at: '2026-09-25T16:10:53Z' } } };
        });
        const headers = [...rootEl.querySelectorAll('.od-ex-table th')].map(th => th.textContent.trim());
        const i = headers.indexOf('Most recent');
        expect(i).toBeGreaterThan(-1);
        const cells = [...rootEl.querySelectorAll('.od-ex-table tbody tr:first-child td')].map(td => td.textContent.trim());
        expect(cells[i]).toBe('1.50');
        teardown();
    });
});

describe('class stats come from Canvas', () => {
    test('applyCanvasClassStats averages the Canvas scores', () => {
        const cache = makeCache();
        const cs = applyCanvasClassStats(cache.outcomes[0], cache);
        expect(cs.plAvg).toBe(3);                         // (3 + 2.5 + 3.5) / 3
        expect(cs.classMean).toBe(3);
        expect(cs.belowThresholdCount).toBe(1);           // 2.5 < 3
        expect(cs.distribution).toEqual({ '1': 0, '2': 0, '3': 2, '4': 1 });
    });

    test('no Canvas scores → average is null (shown as —), not a Marzano fallback', () => {
        const cache = makeCache();
        cache.students.forEach(s => { s.outcomes[0].canvasScore = null; });
        const cs = applyCanvasClassStats(cache.outcomes[0], cache);
        expect(cs.plAvg).toBeNull();
        expect(cs.belowThresholdCount).toBe(0);
    });

    test('Current Score row stats use each student\'s Canvas Current Score', () => {
        const cache = { students: [
            { id: 'a', outcomes: [{ outcomeId: '603', canvasScore: 2.3, plPrediction: 3.9 }] },
            { id: 'b', outcomes: [{ outcomeId: '603', canvasScore: 1.7, plPrediction: 3.9 }] },
        ] };
        const cs = computeCurrentScoreClassStats(cache, 2.2, '603');
        expect(cs.plAvg).toBe(2);
        expect(cs.belowThresholdCount).toBe(1);
    });
});
