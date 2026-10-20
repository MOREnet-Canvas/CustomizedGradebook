// src/masteryOutlook/tests/currentScoreOverride.test.js
// Course-grade override from the Current Score table: set / clear / lock, the
// table wiring, and how outcome saves treat locked vs unlocked overrides.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    window.CG_CONFIG = { ...(window.CG_CONFIG || {}), ENABLE_GRADE_OVERRIDE: true };
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
vi.mock('../../services/gradeCalculator.js', () => ({ calculateStudentAverages: vi.fn() }));
vi.mock('../../services/graphqlGradingService.js', () => ({
    submitRubricAssessmentBatch: vi.fn(async (students) => ({ successCount: students.length, errors: [] })),
}));
vi.mock('../../services/gradeOverride.js', () => ({
    getAllEnrollmentIds:    vi.fn(async () => new Map([['1', 'enr-1'], ['2', 'enr-2']])),
    getEnrollmentIdForUser: vi.fn(async (courseId, userId) => `enr-${userId}`),
    setOverrideScoreGQL:    vi.fn(async (enrollmentId, score) => score),
}));
vi.mock('../../services/masteryRefreshService.js', () => ({ refreshMasteryForAssignment: vi.fn(async () => {}) }));
vi.mock('../masteryOutlookDataService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    fetchCourseRollupsForVerify: vi.fn(async () => ({
        rollups: [
            { links: { user: '1' }, scores: [{ score: 2, links: { outcome: '599' } }, { score: 2, links: { outcome: '603' } }] },
            { links: { user: '2' }, scores: [{ score: 3, links: { outcome: '599' } }, { score: 3, links: { outcome: '603' } }] },
        ],
        linked: { outcomes: [{ id: 599, title: 'Outcome 2' }, { id: 603, title: 'Current Score' }] },
    })),
}));

import {
    setCurrentScoreOverride, clearCurrentScoreOverride, setCurrentScoreOverrideLock,
    getCurrentScoreOverride, updateAvgAssignmentForStudents,
} from '../masteryOutlookAvgService.js';
import { renderCurrentScoreTable, wireCurrentScoreTable } from '../currentScoreTable.js';
import { setOverrideScoreGQL } from '../../services/gradeOverride.js';
import { submitRubricAssessmentBatch } from '../../services/graphqlGradingService.js';
import { calculateStudentAverages } from '../../services/gradeCalculator.js';
import { writeSyncState } from '../masteryOutlookCacheService.js';

const CS = '603';

function makeCache() {
    return {
        meta: {},
        outcomes: [{ id: 599, title: 'Outcome 2' }, { id: 603, title: 'Current Score' }],
        students: [
            { id: '1', name: 'Alpha', sortableName: 'Alpha', outcomes: [{ outcomeId: '599', canvasScore: 2 }, { outcomeId: CS, canvasScore: 2 }] },
            { id: '2', name: 'Bravo', sortableName: 'Bravo', outcomes: [{ outcomeId: '599', canvasScore: 3 }, { outcomeId: CS, canvasScore: 3 }] },
        ],
        sync_state: {},
        avg_assignment: {
            assignment_id: 'avg-a', criterion_id: 'crit', rubric_association_id: 'assoc',
            avg_outcome_id: CS, submission_ids: { '1': 'sub-1', '2': 'sub-2' },
        },
    };
}

const apiClient = () => ({ put: vi.fn(async () => ({})) });

beforeEach(() => vi.clearAllMocks());

describe('setCurrentScoreOverride', () => {
    test('sets the course override (0–4 → percent), comments the note, and records it unlocked', async () => {
        const cache = makeCache();
        const client = apiClient();
        await setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 3, note: ' Retest ', cache, apiClient: client });

        expect(setOverrideScoreGQL).toHaveBeenCalledWith('enr-1', 75, client);
        expect(client.put).toHaveBeenCalledWith(
            '/api/v1/courses/566/assignments/avg-a/submissions/1',
            { comment: { text_comment: 'Current Score override: 3.00 (75%) · Note: Retest' } },
            {}, expect.any(String));
        expect(getCurrentScoreOverride(cache, CS, '1')).toMatchObject({ score: 3, note: 'Retest', locked: false });
        expect(writeSyncState).toHaveBeenCalledWith('566', cache.sync_state, client);
    });

    test('keeps an existing lock when the override is changed', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 3, cs_override_lock: 'locked' } } };
        await setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 2.5, cache, apiClient: apiClient() });
        expect(getCurrentScoreOverride(cache, CS, '1')).toMatchObject({ score: 2.5, locked: true });
    });

    test('rejects scores outside 0–4 without calling Canvas', async () => {
        await expect(setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 5, cache: makeCache(), apiClient: apiClient() }))
            .rejects.toThrow(/0 to 4/);
        expect(setOverrideScoreGQL).not.toHaveBeenCalled();
    });
});

describe('clearCurrentScoreOverride / lock', () => {
    test('clearing puts the course override back to the Current Score and nulls the fields', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '2': { cs_override_score: 1, cs_override_note: 'x', cs_override_lock: 'locked' } } };
        const client = apiClient();
        await clearCurrentScoreOverride({ courseId: '566', studentId: '2', cache, apiClient: client });
        expect(setOverrideScoreGQL).toHaveBeenCalledWith('enr-2', 75, client);   // Current Score 3 → 75%
        expect(getCurrentScoreOverride(cache, CS, '2')).toBeNull();
        expect(cache.sync_state[CS]['2']).toMatchObject({ cs_override_score: null, cs_override_lock: null });
    });

    test('the padlock persists the lock; no override → nothing to lock', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 3, cs_override_lock: 'unlocked' } } };
        expect(await setCurrentScoreOverrideLock({ courseId: '566', studentId: '1', locked: true, cache, apiClient: apiClient() })).toBe(true);
        expect(cache.sync_state[CS]['1'].cs_override_lock).toBe('locked');
        expect(writeSyncState).toHaveBeenCalledTimes(1);
        expect(await setCurrentScoreOverrideLock({ courseId: '566', studentId: '2', locked: true, cache, apiClient: apiClient() })).toBe(false);
        expect(setOverrideScoreGQL).not.toHaveBeenCalled();
    });
});

describe('outcome saves and the Current Score override', () => {
    const save = (cache, ids = ['1']) => updateAvgAssignmentForStudents({
        courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2', studentIds: ids,
        pushedScores: {}, cache, apiClient: apiClient(),
    });
    const sent = () => submitRubricAssessmentBatch.mock.calls[0]?.[0] ?? [];

    test('unlocked: the next outcome save replaces the override with the average and clears it', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 4, cs_override_lock: 'unlocked' } } };
        calculateStudentAverages.mockResolvedValue([{ userId: '1', average: 2 }]);
        await save(cache);
        expect(sent()[0]).toMatchObject({ userId: '1', enrollmentId: 'enr-1', overrideScore: 50 });
        expect(getCurrentScoreOverride(cache, CS, '1')).toBeNull();
    });

    test('locked: the average changed → rubric updates but the course override is left alone', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 4, cs_override_lock: 'locked' } } };
        calculateStudentAverages.mockResolvedValue([{ userId: '1', average: 2.5 }]);   // Current Score was 2
        await save(cache);
        expect(sent()[0]).toMatchObject({ userId: '1', points: 2.5 });
        expect(sent()[0]).not.toHaveProperty('overrideScore');
        expect(sent()[0]).not.toHaveProperty('enrollmentId');
        expect(getCurrentScoreOverride(cache, CS, '1')).toMatchObject({ score: 4, locked: true });
    });

    test('locked with an unchanged average → the student is skipped entirely', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 4, cs_override_lock: 'locked' } } };
        calculateStudentAverages.mockResolvedValue([{ userId: '1', average: 2 }]);    // same as Current Score
        expect(await save(cache)).toBe(true);
        expect(submitRubricAssessmentBatch).not.toHaveBeenCalled();
        expect(getCurrentScoreOverride(cache, CS, '1')).toMatchObject({ score: 4, locked: true });
    });
});

describe('Current Score table wiring', () => {
    function mountWired(cache) {
        const contentEl = document.createElement('div');
        document.body.replaceChildren(contentEl);
        const outcome = cache.outcomes.find(o => String(o.id) === CS);
        const state = {};
        const handlers = { onSaveOverride: vi.fn(async () => {}), onToggleLock: vi.fn(async () => {}) };
        const renderTable = () => { contentEl.innerHTML = renderCurrentScoreTable(outcome, cache, state.currentScoreSort, state.csView); };
        const teardown = wireCurrentScoreTable({ contentEl, state, outcome, cache, renderTable, ...handlers });
        renderTable();
        return { contentEl, state, handlers, teardown };
    }

    test('typing an override enables Save; Save sends the score and note', async () => {
        const { contentEl, handlers, teardown } = mountWired(makeCache());
        const row = contentEl.querySelector('tr[data-stu="1"]');
        const score = row.querySelector('[data-action="cs-ov-score"]');
        const note  = row.querySelector('[data-action="cs-ov-note"]');
        const btn   = row.querySelector('[data-action="cs-ov-save"]');
        expect(btn.disabled).toBe(true);

        score.value = '3.5';
        score.dispatchEvent(new Event('input', { bubbles: true }));
        note.value = 'Make-up work';
        note.dispatchEvent(new Event('input', { bubbles: true }));
        expect(btn.disabled).toBe(false);

        btn.click();
        await Promise.resolve();
        expect(handlers.onSaveOverride).toHaveBeenCalledWith('1', { score: 3.5, note: 'Make-up work' });
        teardown();
    });

    test('an invalid score shows an error instead of saving', async () => {
        const { contentEl, handlers, teardown } = mountWired(makeCache());
        const score = contentEl.querySelector('tr[data-stu="1"] [data-action="cs-ov-score"]');
        score.value = '9';
        score.dispatchEvent(new Event('input', { bubbles: true }));
        contentEl.querySelector('tr[data-stu="1"] [data-action="cs-ov-save"]').click();
        await Promise.resolve();
        expect(handlers.onSaveOverride).not.toHaveBeenCalled();
        expect(contentEl.querySelector('tr[data-stu="1"] .cs-ov-error').textContent).toMatch(/0 to 4/);
        teardown();
    });

    test('the padlock toggles the lock', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '2': { cs_override_score: 3, cs_override_lock: 'unlocked' } } };
        const { contentEl, handlers, teardown } = mountWired(cache);
        const lock = contentEl.querySelector('tr[data-stu="2"] [data-action="cs-ov-lock"]');
        expect(lock.textContent).toBe('🔓');
        lock.click();
        await Promise.resolve();
        expect(handlers.onToggleLock).toHaveBeenCalledWith('2', true);
        teardown();
    });
});
