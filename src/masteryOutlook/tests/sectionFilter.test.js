// src/masteryOutlook/tests/sectionFilter.test.js
// Section filter: remembered per course, narrows what's drawn (rows, class
// stats, counts, Save grades to Canvas) and never the cache itself.
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

import {
    initSectionFilter, setSelectedSectionId, getSelectedSectionId, getSelectedSectionName,
    hasSectionChoice, visibleStudents, isStudentVisible, displayClassStats, resetSectionFilter,
} from '../sectionFilter.js';
import { buildCurrentScoreRows, countLockedOverrides } from '../currentScoreTable.js';
import { getOutcomeSaveSummary, renderOutcomeStudentTable } from '../studentSyncTable.js';
import { buildOutcomeStudentRows } from '../outcomeRow.js';
import { computeCurrentScoreClassStats, buildCrossOutcomeExceptionsView } from '../outcomeSyncView.js';
import { fetchCourseStudents } from '../../services/enrollmentService.js';

const COURSE = '566';
const O1 = '598';
const CS = '603';
const SECTIONS = [{ id: '10', name: '1st Hour' }, { id: '20', name: '3rd Hour' }];

const stu = (id, name, sectionIds, canvas, extra = {}) => ({
    id, name, sortableName: name, sectionIds, sectionId: sectionIds[0],
    outcomes: [
        { outcomeId: O1, canvasScore: canvas, plPrediction: canvas, slope: extra.slope ?? null, attempts: [] },
        { outcomeId: CS, canvasScore: canvas, attempts: [] },
    ],
});

function makeCache() {
    return {
        meta: { courseId: COURSE },
        outcomes: [
            { id: Number(O1), title: 'Outcome 1', classStats: { plAvg: 2.5, computedThreshold: 2.2, distribution: { 1: 0, 2: 2, 3: 2, 4: 0 }, belowThresholdCount: 1, avgSlope: 0.2 } },
            { id: Number(CS), title: 'Current Score' },
        ],
        students: [
            stu('1', 'Alpha',   ['10'],       1.5, { slope: -0.3 }),
            stu('2', 'Bravo',   ['10', '20'], 3.0, { slope: 0.1 }),
            stu('3', 'Charlie', ['20'],       2.0, { slope: 0.4 }),
            stu('4', 'Delta',   ['20'],       3.5, { slope: 0.2 }),
        ],
        pl_assignments: { [O1]: { assignment_id: '900' } },
        sync_state: {
            [O1]: {
                '1': { will_post: 2.5 },   // 1st Hour, needs saving
                '3': { will_post: 3.0 },   // 3rd Hour, needs saving
            },
            [CS]: {
                '1': { cs_override_score: 2, cs_override_lock: 'locked' },
                '4': { cs_override_score: 3, cs_override_lock: 'locked' },
            },
        },
        ignored_alignments: [],
    };
}

const ids = (list) => list.map(s => String(s.id));

beforeEach(() => {
    localStorage.clear();
    resetSectionFilter();
    initSectionFilter(COURSE, SECTIONS);
});

describe('selection', () => {
    test('defaults to All sections; remembered per course in localStorage', () => {
        expect(getSelectedSectionId()).toBeNull();
        setSelectedSectionId('20');
        expect(getSelectedSectionName()).toBe('3rd Hour');
        expect(localStorage.getItem(`cg_mo_section_${COURSE}`)).toBe('20');

        resetSectionFilter();
        expect(initSectionFilter(COURSE, SECTIONS)).toBe('20');
        expect(initSectionFilter('999', SECTIONS)).toBeNull();   // other course
    });

    test('a saved section that no longer exists falls back to All sections', () => {
        localStorage.setItem(`cg_mo_section_${COURSE}`, '77');
        expect(initSectionFilter(COURSE, SECTIONS)).toBeNull();
    });

    test('All sections clears the saved choice; unknown IDs are ignored', () => {
        setSelectedSectionId('10');
        setSelectedSectionId('');
        expect(localStorage.getItem(`cg_mo_section_${COURSE}`)).toBeNull();
        setSelectedSectionId('nope');
        expect(getSelectedSectionId()).toBeNull();
    });

    test('the dropdown is only worth showing with 2+ sections', () => {
        expect(hasSectionChoice()).toBe(true);
        initSectionFilter(COURSE, [SECTIONS[0]]);
        expect(hasSectionChoice()).toBe(false);
    });
});

describe('visibleStudents', () => {
    test('everyone when unfiltered; a multi-section student shows in each section', () => {
        const cache = makeCache();
        expect(ids(visibleStudents(cache))).toEqual(['1', '2', '3', '4']);
        setSelectedSectionId('10');
        expect(ids(visibleStudents(cache))).toEqual(['1', '2']);
        setSelectedSectionId('20');
        expect(ids(visibleStudents(cache))).toEqual(['2', '3', '4']);
    });

    test('never changes cache.students', () => {
        const cache = makeCache();
        setSelectedSectionId('10');
        visibleStudents(cache);
        expect(cache.students).toHaveLength(4);
    });

    test('older cache entries with only sectionId still filter', () => {
        setSelectedSectionId('20');
        expect(isStudentVisible({ id: 'x', sectionId: '20' })).toBe(true);
        expect(isStudentVisible({ id: 'y', sectionId: '10' })).toBe(false);
    });
});

describe('class stats for a section', () => {
    test('unfiltered returns the stored classStats object', () => {
        const cache = makeCache();
        expect(displayClassStats(cache.outcomes[0], cache)).toBe(cache.outcomes[0].classStats);
    });

    test('filtered: Canvas avg, spread, below threshold, trend from the section only', () => {
        const cache = makeCache();
        setSelectedSectionId('20');   // Bravo 3.0, Charlie 2.0, Delta 3.5
        const stats = displayClassStats(cache.outcomes[0], cache);
        expect(stats.plAvg).toBeCloseTo(2.8333, 3);
        expect(stats.belowThresholdCount).toBe(1);   // Charlie 2.0 < 2.2
        expect(stats.avgSlope).toBeCloseTo(0.2333, 3);
        expect(stats.totalStudents).toBe(3);
        expect(cache.outcomes[0].classStats.plAvg).toBe(2.5);   // stored stats untouched
    });

    test('Current Score row stats use the section', () => {
        const cache = makeCache();
        setSelectedSectionId('10');   // Alpha 1.5, Bravo 3.0
        expect(computeCurrentScoreClassStats(cache, 2.2, CS).plAvg).toBeCloseTo(2.25, 4);
    });
});

describe('views follow the filter', () => {
    test('Course Overview rows and locked-override count', () => {
        const cache = makeCache();
        setSelectedSectionId('20');
        const outcome = cache.outcomes[1];
        expect(buildCurrentScoreRows(outcome, cache).rows.map(r => r.id)).toEqual(['2', '3', '4']);
        expect(countLockedOverrides(cache, CS)).toBe(2);
        expect(countLockedOverrides(cache, CS, visibleStudents(cache))).toBe(1);
    });

    test('outcome tab rows', () => {
        const cache = makeCache();
        setSelectedSectionId('10');
        expect(buildOutcomeStudentRows(cache.outcomes[0], cache).map(r => String(r.id))).toEqual(['1', '2']);
    });

    test('Save grades to Canvas only sends the section, and says so', () => {
        const cache = makeCache();
        expect(getOutcomeSaveSummary(cache.outcomes[0], cache).remainingIds.sort()).toEqual(['1', '3']);

        setSelectedSectionId('20');
        expect(getOutcomeSaveSummary(cache.outcomes[0], cache).remainingIds).toEqual(['3']);

        document.body.innerHTML = renderOutcomeStudentTable(cache.outcomes[0], cache);
        expect(document.querySelector('.os-status-banner').textContent).toContain('1 student in 3rd Hour needs updating');
        expect(document.querySelector('[data-action="os-post-all"]').textContent).toContain('Save grades to Canvas (3rd Hour)');
    });

    test('cross-outcome exceptions only list the section', () => {
        const cache = makeCache();
        cache.sync_state[O1]['1'].will_post_lock = 'locked';
        cache.sync_state[O1]['3'].will_post_lock = 'locked';
        setSelectedSectionId('10');
        document.body.innerHTML = buildCrossOutcomeExceptionsView(cache);
        const names = [...document.querySelectorAll('td.od-name')].map(td => td.textContent);
        expect(names).toContain('Alpha');
        expect(names).not.toContain('Charlie');
    });
});

describe('fetchCourseStudents', () => {
    test('one entry per student with every section', async () => {
        const apiClient = {
            getAllPages: vi.fn(async () => [
                { user_id: 1, course_section_id: 10, user: { name: 'Alpha', sortable_name: 'Alpha' } },
                { user_id: 2, course_section_id: 10, user: { name: 'Bravo', sortable_name: 'Bravo' } },
                { user_id: 2, course_section_id: 20, user: { name: 'Bravo', sortable_name: 'Bravo' } },
            ]),
        };
        const students = await fetchCourseStudents(COURSE, apiClient);
        expect(students).toHaveLength(2);
        expect(students[1]).toMatchObject({ userId: '2', sectionId: '10', sectionIds: ['10', '20'] });
    });
});
