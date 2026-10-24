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
    saveLmgbLockSnapshot:     vi.fn(),
}));
vi.mock('../../services/gradeCalculator.js', () => ({ calculateStudentAverages: vi.fn() }));
vi.mock('../../services/graphqlGradingService.js', () => ({
    submitRubricAssessmentBatch: vi.fn(async (students) => ({ successCount: students.length, errors: [] })),
}));
vi.mock('../../services/gradeOverride.js', () => ({
    getAllEnrollmentIds:    vi.fn(async () => new Map([['1', 'enr-1'], ['2', 'enr-2']])),
    getEnrollmentIdForUser: vi.fn(async (courseId, userId) => `enr-${userId}`),
}));
vi.mock('../../services/masteryRefreshService.js', () => ({ refreshMasteryForAssignment: vi.fn(async () => {}) }));
vi.mock('../masteryOutlookDataService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    clearCourseRollupReuse:      vi.fn(),
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
import {
    renderCurrentScoreTable, wireCurrentScoreTable, countLockedOverrides, overrideDrifted, buildCurrentScoreRows,
} from '../currentScoreTable.js';
import { submitRubricAssessmentBatch } from '../../services/graphqlGradingService.js';
import { calculateStudentAverages } from '../../services/gradeCalculator.js';
import { writeSyncState, saveLmgbLockSnapshot } from '../masteryOutlookCacheService.js';
import { refreshMasteryForAssignment } from '../../services/masteryRefreshService.js';
import { rowsAwaitingOutcome, rowSavePhase } from '../masteryOutlookState.js';

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

beforeEach(() => { vi.clearAllMocks(); rowsAwaitingOutcome.clear(); rowSavePhase.clear(); });

describe('setCurrentScoreOverride', () => {
    test('goes through the shared grading path: rubric score, course override and dated comment', async () => {
        const cache = makeCache();
        const client = apiClient();
        await setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 3, note: ' Retest ', cache, apiClient: client });

        expect(submitRubricAssessmentBatch).toHaveBeenCalledTimes(1);
        const [batch, passedClient] = submitRubricAssessmentBatch.mock.calls[0];
        expect(passedClient).toBe(client);
        expect(batch).toHaveLength(1);
        expect(batch[0]).toMatchObject({
            userId: '1', submissionId: 'sub-1', rubricAssociationId: 'assoc', rubricCriterionId: 'crit',
            points: 3, enrollmentId: 'enr-1', overrideScore: 75, overrideStatusId: null, customStatusId: null,
        });
        expect(batch[0].comment).toMatch(/^Current Score override: 3\.00 \(75%\) · [A-Z][a-z]{2} \d{1,2}, \d{4} · Note: Retest$/);
        expect(refreshMasteryForAssignment).toHaveBeenCalledWith('566', 'avg-a');
        expect(rowsAwaitingOutcome.has(`${CS}_1`)).toBe(true);           // ⏳ until Canvas confirms
        expect(cache.students[0].outcomes[1].canvasScore).toBe(2);       // not faked before Canvas confirms
        expect(getCurrentScoreOverride(cache, CS, '1')).toMatchObject({ score: 3, note: 'Retest', locked: false });
        expect(getCurrentScoreOverride(cache, CS, '1').at).toEqual(expect.any(String));
        expect(writeSyncState).toHaveBeenCalledWith('566', cache.sync_state, client);
        expect(saveLmgbLockSnapshot).toHaveBeenCalledWith('566', cache);
    });

    test('Canvas rejects the write → throws and records nothing', async () => {
        submitRubricAssessmentBatch.mockResolvedValueOnce({ successCount: 0, errors: [{ userId: '1', error: 'Rubric assessment errors' }] });
        const cache = makeCache();
        await expect(setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 3, cache, apiClient: apiClient() }))
            .rejects.toThrow(/Rubric assessment errors/);
        expect(getCurrentScoreOverride(cache, CS, '1')).toBeNull();
        expect(writeSyncState).not.toHaveBeenCalled();
    });

    test('keeps an existing lock when the override is changed', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 3, cs_override_lock: 'locked', cs_override_lock_at: '2026-10-01T00:00:00Z' } } };
        await setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 2.5, cache, apiClient: apiClient() });
        expect(getCurrentScoreOverride(cache, CS, '1')).toMatchObject({ score: 2.5, locked: true, lockAt: '2026-10-01T00:00:00Z' });
    });

    test('rejects scores outside 0–4 without calling Canvas', async () => {
        await expect(setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 5, cache: makeCache(), apiClient: apiClient() }))
            .rejects.toThrow(/0 to 4/);
        expect(submitRubricAssessmentBatch).not.toHaveBeenCalled();
    });

    test('missing Current Score setup → "run Refresh Data" and no Canvas call', async () => {
        const cache = makeCache();
        delete cache.avg_assignment;
        await expect(setCurrentScoreOverride({ courseId: '566', studentId: '1', score: 3, cache, apiClient: apiClient() }))
            .rejects.toThrow(/Refresh Data/);
        expect(submitRubricAssessmentBatch).not.toHaveBeenCalled();
    });
});

describe('clearCurrentScoreOverride / lock', () => {
    test('clearing recomputes the real average, writes it back, and nulls the fields', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '2': { cs_override_score: 1, cs_override_note: 'x', cs_override_lock: 'locked' } } };
        calculateStudentAverages.mockResolvedValue([{ userId: '2', average: 3 }]);
        const client = apiClient();

        expect(await clearCurrentScoreOverride({ courseId: '566', studentId: '2', cache, apiClient: client })).toBe(3);

        const [rollups, outcomeId] = calculateStudentAverages.mock.calls[0];
        expect(outcomeId).toBe(CS);
        expect(rollups.rollups.map(r => r.links.user)).toEqual(['2']);   // only this student
        const [cleared] = submitRubricAssessmentBatch.mock.calls[0][0];
        expect(cleared).toMatchObject({ userId: '2', submissionId: 'sub-2', rubricCriterionId: 'crit', points: 3, overrideScore: 75 });
        expect(cleared.comment).toMatch(/override removed .* back to 3\.00$/);
        expect(getCurrentScoreOverride(cache, CS, '2')).toBeNull();
        expect(cache.sync_state[CS]['2']).toMatchObject({ cs_override_score: null, cs_override_lock: null, cs_override_at: null });
        expect(saveLmgbLockSnapshot).toHaveBeenCalledWith('566', cache);
    });

    test('the padlock persists the lock with a date; no override → nothing to lock', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 3, cs_override_lock: 'unlocked', cs_override_at: '2026-10-01T00:00:00Z' } } };
        expect(await setCurrentScoreOverrideLock({ courseId: '566', studentId: '1', locked: true, cache, apiClient: apiClient() })).toBe(true);
        expect(cache.sync_state[CS]['1'].cs_override_lock).toBe('locked');
        expect(cache.sync_state[CS]['1'].cs_override_lock_at).toEqual(expect.any(String));
        expect(cache.sync_state[CS]['1'].cs_override_at).toBe('2026-10-01T00:00:00Z');   // override date unchanged
        expect(writeSyncState).toHaveBeenCalledTimes(1);
        expect(saveLmgbLockSnapshot).toHaveBeenCalledWith('566', cache);
        expect(await setCurrentScoreOverrideLock({ courseId: '566', studentId: '2', locked: true, cache, apiClient: apiClient() })).toBe(false);
        expect(submitRubricAssessmentBatch).not.toHaveBeenCalled();
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

    test('locked: the student is skipped entirely, even when the average changed', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 4, cs_override_lock: 'locked' } } };
        calculateStudentAverages.mockResolvedValue([{ userId: '1', average: 2.5 }]);
        expect(await save(cache)).toBe(true);
        expect(sent().find(s => String(s.userId) === '1')).toBeUndefined();
        expect(getCurrentScoreOverride(cache, CS, '1')).toMatchObject({ score: 4, locked: true });
    });

    test('locked students are skipped while others in the same save still update', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '1': { cs_override_score: 4, cs_override_lock: 'locked' } } };
        calculateStudentAverages.mockResolvedValue([{ userId: '1', average: 2.5 }, { userId: '2', average: 3.5 }]);
        await save(cache, ['1', '2']);
        expect(sent().map(s => String(s.userId))).toEqual(['2']);
    });
});

describe('Current Score table: lock and date markers', () => {
    const outcome = { id: 603, title: 'Current Score' };
    const lockedCache = () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: {
            '1': { cs_override_score: 3, cs_override_lock: 'locked', cs_override_at: '2026-10-01T15:00:00Z', cs_override_by: 'Ms. T' },
            '2': { cs_override_score: 2, cs_override_lock: 'unlocked', cs_override_at: '2026-10-02T15:00:00Z' },
        } };
        return cache;
    };
    const mount = (cache) => {
        const el = document.createElement('div');
        el.innerHTML = renderCurrentScoreTable(outcome, cache, undefined, undefined, { overrideEnabled: true });
        return el;
    };

    test('counts locked overrides', () => {
        expect(countLockedOverrides(lockedCache(), CS)).toBe(1);
        expect(countLockedOverrides(makeCache(), CS)).toBe(0);
    });

    test('lock banner and amber row only for locked students', () => {
        const el = mount(lockedCache());
        expect(el.querySelector('.cs-lock-banner').textContent).toMatch(/1\s*student has a locked/);
        expect(el.querySelector('tr[data-stu="1"]').classList.contains('cs-row-locked')).toBe(true);
        expect(el.querySelector('tr[data-stu="2"]').classList.contains('cs-row-locked')).toBe(false);
        expect(mount(makeCache()).querySelector('.cs-lock-banner')).toBeNull();
    });

    test('override date shows under the box with who set it in the tooltip', () => {
        const date = mount(lockedCache()).querySelector('tr[data-stu="1"] .cs-ov-date');
        expect(date.textContent).toBe('Oct 1');
        expect(date.title).toMatch(/^Set Oct 1, 2026.* by Ms\. T$/);
        expect(date.closest('.cs-ov-wrap')).not.toBeNull();   // inline after the padlock
    });

    test('rows without an override keep empty padlock/date slots so inputs line up', () => {
        const wrap = mount(makeCache()).querySelector('tr[data-stu="1"] .cs-ov-wrap');
        expect(wrap.querySelector('.cs-ov-lock-slot').textContent).toBe('');
        expect(wrap.querySelector('.cs-ov-date').textContent).toBe('');
    });

    test('the note cell carries the full note as a tooltip', () => {
        const cache = lockedCache();
        cache.sync_state[CS]['1'].cs_override_note = 'A long explanation of the override';
        const note = mount(cache).querySelector('tr[data-stu="1"] .cs-ov-note');
        expect(note.title).toBe('A long explanation of the override');
    });

    test('⚑ when Canvas differs from the saved override (after the grace period)', () => {
        const cache = lockedCache();               // student 1: override 3, Canvas 2
        const el = mount(cache);
        expect(el.querySelector('tr[data-stu="1"] .os-sync-marker.override')).not.toBeNull();
        const { rows } = buildCurrentScoreRows(outcome, cache);
        const row1 = rows.find(r => r.id === '1');
        expect(overrideDrifted(row1, Date.parse('2026-10-01T15:05:00Z'))).toBe(false);   // within 10 min
        expect(overrideDrifted({ ...row1, current: 3 })).toBe(false);
        expect(overrideDrifted({ ...row1, currentPending: true })).toBe(false);
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

    test('while the lock saves, the padlock spins, keeps its old icon, and ignores clicks', async () => {
        const cache = makeCache();
        cache.sync_state = { [CS]: { '2': { cs_override_score: 3, cs_override_lock: 'unlocked' } } };
        const { contentEl, state, handlers, teardown } = mountWired(cache);
        state.csView.locking.add('2');
        contentEl.innerHTML = renderCurrentScoreTable(cache.outcomes[1], cache, state.currentScoreSort, state.csView);

        const lock = contentEl.querySelector('tr[data-stu="2"] [data-action="cs-ov-lock"]');
        expect(lock.classList.contains('saving')).toBe(true);
        expect(lock.disabled).toBe(true);
        expect(lock.textContent).toBe('🔓');
        expect(lock.title).toBe('Saving lock…');

        lock.disabled = false;   // a click that slips through still does nothing
        lock.click();
        await Promise.resolve();
        expect(handlers.onToggleLock).not.toHaveBeenCalled();
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
