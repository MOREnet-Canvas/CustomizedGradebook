// src/masteryOutlook/plOutlookStateHandlers.test.js
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PLOutlookStateMachine, PL_STATES } from './plOutlookStateMachine.js';
import {
    handleCheckingSetup,
    handleCheckingStudents,
    handleCalculatingChanges,
    handleCreatingAssignment,
    handleSyncing,
    handleVerifying,
    handleComplete,
    handleError
} from './plOutlookStateHandlers.js';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('./masteryOutlookCacheService.js', () => ({
    readMasteryOutlookCache: vi.fn(),
    readPLAssignments:       vi.fn(),
    writePLAssignments:      vi.fn()
}));

vi.mock('../services/enrollmentService.js', () => ({
    fetchCourseStudents: vi.fn()
}));

vi.mock('../services/graphqlGradingService.js', () => ({
    submitRubricAssessmentBatch: vi.fn()
}));

vi.mock('../config.js', () => ({
    DEFAULT_MAX_POINTS:          4,
    OUTCOME_AND_RUBRIC_RATINGS: [
        { description: 'Exemplary',  points: 4 },
        { description: 'Proficient', points: 3 },
        { description: 'Developing', points: 2 },
        { description: 'Beginning',  points: 1 }
    ]
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { readMasteryOutlookCache, readPLAssignments, writePLAssignments } from './masteryOutlookCacheService.js';
import { fetchCourseStudents } from '../services/enrollmentService.js';
import { submitRubricAssessmentBatch } from '../services/graphqlGradingService.js';

/** Build a state machine pre-populated with the given context */
function buildSM(extraContext = {}) {
    const sm = new PLOutlookStateMachine({
        courseId:    '100',
        outcomeId:   '598',
        outcomeName: 'Algebra',
        apiClient:   {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            getAllPages: vi.fn()
        },
        ...extraContext
    });
    sm.transition(PL_STATES.CHECKING_SETUP);
    return sm;
}

// ── handleCheckingSetup ───────────────────────────────────────────────────────

describe('handleCheckingSetup', () => {
    beforeEach(() => vi.clearAllMocks());

    test('cache hit → returns CHECKING_STUDENTS and sets context', async () => {
        readPLAssignments.mockResolvedValue({
            598: {
                assignment_id:         'asgn-1',
                rubric_id:             'rub-1',
                rubric_association_id: 'assoc-1',
                criterion_id:          'crit-1',
                submission_ids:        { 'user-1': 'sub-1' }
            }
        });

        const sm   = buildSM();
        const next = await handleCheckingSetup(sm);

        expect(next).toBe(PL_STATES.CHECKING_STUDENTS);
        const ctx = sm.getContext();
        expect(ctx.assignmentId).toBe('asgn-1');
        expect(ctx.rubricCriterionId).toBe('crit-1');
        expect(ctx.submissionIdByUserId.get('user-1')).toBe('sub-1');
    });

    test('cache miss → returns CREATING_ASSIGNMENT', async () => {
        readPLAssignments.mockResolvedValue({});  // no entry for outcome 598

        const sm   = buildSM();
        const next = await handleCheckingSetup(sm);

        expect(next).toBe(PL_STATES.CREATING_ASSIGNMENT);
    });

    test('partial cache entry (missing criterion_id) → returns CREATING_ASSIGNMENT', async () => {
        readPLAssignments.mockResolvedValue({
            598: { assignment_id: 'asgn-1', rubric_association_id: 'assoc-1' }
            // criterion_id missing
        });

        const sm   = buildSM();
        const next = await handleCheckingSetup(sm);

        expect(next).toBe(PL_STATES.CREATING_ASSIGNMENT);
    });
});

// ── handleCheckingStudents ────────────────────────────────────────────────────

describe('handleCheckingStudents', () => {
    beforeEach(() => vi.clearAllMocks());

    test('roster matches cached IDs → returns CALCULATING_CHANGES', async () => {
        fetchCourseStudents.mockResolvedValue([
            { userId: 'u1' }, { userId: 'u2' }
        ]);

        const sm = buildSM({
            submissionIdByUserId: new Map([['u1', 's1'], ['u2', 's2']])
        });
        const next = await handleCheckingStudents(sm);

        expect(next).toBe(PL_STATES.CALCULATING_CHANGES);
    });

    test('new student not in cached map → returns FETCHING_SUBMISSIONS', async () => {
        fetchCourseStudents.mockResolvedValue([
            { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3-new' }
        ]);

        const sm = buildSM({
            submissionIdByUserId: new Map([['u1', 's1'], ['u2', 's2']])
        });
        const next = await handleCheckingStudents(sm);

        expect(next).toBe(PL_STATES.FETCHING_SUBMISSIONS);
    });

    test('null submissionIdByUserId → treats all students as new → FETCHING_SUBMISSIONS', async () => {
        fetchCourseStudents.mockResolvedValue([{ userId: 'u1' }]);

        const sm   = buildSM({ submissionIdByUserId: null });
        const next = await handleCheckingStudents(sm);

        expect(next).toBe(PL_STATES.FETCHING_SUBMISSIONS);
    });

    test('applies targetUserIds filter: effectiveTargetIds only includes active users', async () => {
        fetchCourseStudents.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

        const sm = buildSM({
            submissionIdByUserId: new Map([['u1', 's1'], ['u2', 's2']]),
            targetUserIds: ['u1', 'u-gone']   // 'u-gone' is not active
        });
        await handleCheckingStudents(sm);

        const { effectiveTargetIds } = sm.getContext();
        expect([...effectiveTargetIds]).toEqual(['u1']);
    });
});

// ── handleCalculatingChanges ──────────────────────────────────────────────────

describe('handleCalculatingChanges', () => {
    beforeEach(() => vi.clearAllMocks());

    /** Minimal cache with one student who has a PL prediction */
    function makeCache(plPrediction, status = 'active') {
        return {
            students: [{
                id: 'u1',
                outcomes: [{ outcomeId: '598', plPrediction, status }]
            }]
        };
    }

    /** Minimal rollup response: Canvas returns { rollups: [...] } */
    function makeRollup(userId, score) {
        return {
            rollups: [{
                links:  { user: userId },
                scores: [{ links: { outcome: '598' }, score }]
            }]
        };
    }

    test('student needs sync → returns SYNCING and sets studentsToSync', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        const apiClient = { get: vi.fn().mockResolvedValue(makeRollup('u1', 1.0)) };

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map([['u1', 'sub-1']]),
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.SYNCING);
        const { studentsToSync } = sm.getContext();
        expect(studentsToSync).toHaveLength(1);
        expect(studentsToSync[0].userId).toBe('u1');
        expect(studentsToSync[0].plScore).toBe(3.5);
    });

    test('scores match at hundredths → returns COMPLETE with zero studentsToSync', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        // 3.5 rounds to 350 at hundredths — exact match, no sync needed
        const apiClient = { get: vi.fn().mockResolvedValue(makeRollup('u1', 3.5)) };

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map([['u1', 'sub-1']]),
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().studentsToSync).toHaveLength(0);
    });

    test('student with status NE is skipped', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5, 'NE'));
        const apiClient = { get: vi.fn().mockResolvedValue({ rollups: [] }) };

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map([['u1', 'sub-1']]),
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().studentsToSync).toHaveLength(0);
    });

    test('student with no submission ID is skipped', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        const apiClient = { get: vi.fn().mockResolvedValue({ rollups: [] }) };

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map(),   // no entry for u1
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().studentsToSync).toHaveLength(0);
    });

    test('throws when cache is missing', async () => {
        readMasteryOutlookCache.mockResolvedValue(null);
        const apiClient = { get: vi.fn() };

        const sm = buildSM({ apiClient, effectiveTargetIds: new Set() });
        await expect(handleCalculatingChanges(sm)).rejects.toThrow(/run Refresh Data/);
    });

    test('scores differ at hundredths → student IS included in sync (old threshold would have skipped this)', async () => {
        // PL=3.50, Canvas=3.30 — rounds to 350 vs 330, different → needs sync
        // Under old SYNC_THRESHOLD=0.25, diff=0.2 would have been skipped
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        const apiClient = { get: vi.fn().mockResolvedValue(makeRollup('u1', 3.3)) };

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map([['u1', 'sub-1']]),
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.SYNCING);
        expect(sm.getContext().studentsToSync).toHaveLength(1);
    });

    test('floating-point scores equal at hundredths are treated as matching', async () => {
        // 3.500 and 3.504 both round to 350 at hundredths → no sync needed
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.500));
        const apiClient = { get: vi.fn().mockResolvedValue(makeRollup('u1', 3.504)) };

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map([['u1', 'sub-1']]),
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().studentsToSync).toHaveLength(0);
    });

    test('student with no canvas rollup score is included in sync', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.0));
        // Rollup has no score for this outcome
        const apiClient = { get: vi.fn().mockResolvedValue({ rollups: [] }) };

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map([['u1', 'sub-1']]),
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.SYNCING);
        expect(sm.getContext().studentsToSync[0].canvasScore).toBeNull();
    });
});

// ── handleComplete ────────────────────────────────────────────────────────────

/** Drive a state machine to COMPLETE via the shortest valid transition chain */
function buildSMAtComplete(extraContext = {}) {
    const sm = new PLOutlookStateMachine({
        courseId: '100', outcomeId: '598', outcomeName: 'Algebra', apiClient: {},
        ...extraContext
    });
    sm.transition(PL_STATES.CHECKING_SETUP);
    sm.transition(PL_STATES.CHECKING_STUDENTS);
    sm.transition(PL_STATES.CALCULATING_CHANGES);
    sm.transition(PL_STATES.COMPLETE);
    return sm;
}

describe('handleComplete', () => {
    test('zeroUpdates → returns IDLE and calls onProgress with "No changes needed"', async () => {
        const onProgress = vi.fn();
        const sm = buildSMAtComplete({ onProgress });
        sm.updateContext({ zeroUpdates: true, numberOfUpdates: 0 });

        const next = await handleComplete(sm);

        expect(next).toBe(PL_STATES.IDLE);
        expect(onProgress).toHaveBeenCalledWith(
            PL_STATES.COMPLETE, 'Algebra', 'No changes needed', null, null
        );
    });

    test('success → message contains synced count', async () => {
        const onProgress = vi.fn();
        const sm = buildSMAtComplete({ onProgress });
        sm.updateContext({ numberOfUpdates: 5, successCount: 5, errors: [], verifyMismatches: [] });

        await handleComplete(sm);

        const [,, msg] = onProgress.mock.calls[0];
        expect(msg).toContain('5');
    });

    test('with errors → message includes error count', async () => {
        const onProgress = vi.fn();
        const sm = buildSMAtComplete({ onProgress });
        sm.updateContext({
            numberOfUpdates: 3, successCount: 2,
            errors: [{ userId: 'u1' }], verifyMismatches: []
        });

        await handleComplete(sm);

        const [,, msg] = onProgress.mock.calls[0];
        expect(msg).toContain('1');   // 1 error
    });
});

// ── handleError ───────────────────────────────────────────────────────────────

describe('handleError', () => {
    test('returns IDLE', async () => {
        const sm = buildSM();
        sm.transition(PL_STATES.ERROR, { error: new Error('API timeout') });

        const next = await handleError(sm);
        expect(next).toBe(PL_STATES.IDLE);
    });

    test('calls onProgress with error message', async () => {
        const onProgress = vi.fn();
        const sm = buildSM({ onProgress });
        sm.transition(PL_STATES.ERROR, { error: new Error('Something broke') });

        await handleError(sm);

        const [,, msg] = onProgress.mock.calls[0];
        expect(msg).toContain('Something broke');
    });

    test('does not throw when error field is null', async () => {
        const sm = buildSM();
        sm.transition(PL_STATES.ERROR, { error: null });

        await expect(handleError(sm)).resolves.toBe(PL_STATES.IDLE);
    });
});

// ── handleCreatingAssignment ──────────────────────────────────────────────────

/** Drive SM to CREATING_ASSIGNMENT (the valid path from IDLE) */
function buildSMAtCreating(extraContext = {}) {
    const sm = new PLOutlookStateMachine({
        courseId: '100', outcomeId: '598', outcomeName: 'Algebra', apiClient: {},
        ...extraContext
    });
    sm.transition(PL_STATES.CHECKING_SETUP);
    sm.transition(PL_STATES.CREATING_ASSIGNMENT);
    return sm;
}

describe('handleCreatingAssignment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    /** Standard happy-path apiClient mock — all 8 steps succeed */
    function makeApiClient() {
        return {
            put:      vi.fn().mockResolvedValue({}),
            post:     vi.fn()
                         .mockResolvedValueOnce({ id: 'asgn-99' })                          // step 2: create assignment
                         .mockResolvedValueOnce({ rubric: { id: 'rub-1' }, rubric_association: { id: 'assoc-1' } }), // step 3: create rubric
            get:      vi.fn().mockResolvedValue({ rubric: [{ id: 'crit-1' }] }),            // step 4: fetch criterion
            getAllPages: vi.fn().mockResolvedValue([{ id: 'sub-1', user_id: 'u1' }])         // step 6: fetch submissions
        };
    }

    test('happy path → writes IDs to cache and returns CHECKING_STUDENTS', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeApiClient();
        const sm = buildSMAtCreating({ apiClient });

        const promise = handleCreatingAssignment(sm);
        await vi.runAllTimersAsync();
        const next = await promise;

        expect(next).toBe(PL_STATES.CHECKING_STUDENTS);
        expect(writePLAssignments).toHaveBeenCalledWith(
            '100',
            expect.objectContaining({
                598: expect.objectContaining({
                    assignment_id:         'asgn-99',
                    rubric_id:             'rub-1',
                    rubric_association_id: 'assoc-1',
                    criterion_id:          'crit-1'
                })
            }),
            apiClient
        );
    });

    test('happy path → context has assignmentId, rubricId, submissionIdByUserId', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeApiClient();
        const sm = buildSMAtCreating({ apiClient });

        const promise = handleCreatingAssignment(sm);
        await vi.runAllTimersAsync();
        await promise;

        const ctx = sm.getContext();
        expect(ctx.assignmentId).toBe('asgn-99');
        expect(ctx.rubricId).toBe('rub-1');
        expect(ctx.submissionIdByUserId.get('u1')).toBe('sub-1');
    });

    test('visibility flip sequence: created visible (post with false) then hidden (put with true)', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeApiClient();
        const sm = buildSMAtCreating({ apiClient });

        const promise = handleCreatingAssignment(sm);
        await vi.runAllTimersAsync();
        await promise;

        // Assignment is created via POST with only_visible_to_overrides: false
        const postCalls = apiClient.post.mock.calls;
        const createCall = postCalls.find(([, body]) => body?.assignment?.only_visible_to_overrides === false);
        expect(createCall).toBeDefined();

        // Assignment is hidden via PUT with only_visible_to_overrides: true
        const putCalls = apiClient.put.mock.calls;
        const hideCall = putCalls.find(([, body]) => body?.assignment?.only_visible_to_overrides === true);
        expect(hideCall).toBeDefined();

        // getAllPages (submission fetch) must be called between create and hide
        const getAllPagesCallOrder  = apiClient.getAllPages.mock.invocationCallOrder[0];
        const putHideCallOrder     = apiClient.put.mock.invocationCallOrder[putCalls.indexOf(hideCall)];
        expect(getAllPagesCallOrder).toBeLessThan(putHideCallOrder);
    });

    test('submission_ids map keys and values are strings (JSON round-trip safe)', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = {
            ...makeApiClient(),
            // user_id returned as number to simulate Canvas API numeric IDs
            getAllPages: vi.fn().mockResolvedValue([{ id: 26036, user_id: 642 }])
        };
        const sm = buildSMAtCreating({ apiClient });

        const promise = handleCreatingAssignment(sm);
        await vi.runAllTimersAsync();
        await promise;

        const { submissionIdByUserId } = sm.getContext();
        const keys   = [...submissionIdByUserId.keys()];
        const values = [...submissionIdByUserId.values()];
        expect(typeof keys[0]).toBe('string');
        expect(typeof values[0]).toBe('string');
        expect(submissionIdByUserId.get('642')).toBe('26036');
    });

    test('assignment creation returns no id → throws before writing cache', async () => {
        const apiClient = {
            put:  vi.fn().mockResolvedValue({}),
            post: vi.fn().mockResolvedValue({})   // no .id
        };
        const sm = buildSMAtCreating({ apiClient });

        // Attach rejection handler immediately so it doesn't go unhandled
        const promise = handleCreatingAssignment(sm).catch(() => {});
        await vi.runAllTimersAsync();
        await expect(handleCreatingAssignment(sm)).rejects.toThrow(/Failed to create assignment/);
        await promise;
        expect(writePLAssignments).not.toHaveBeenCalled();
    });

    test('rubric creation returns no id → throws before writing cache', async () => {
        const makeFailingClient = () => ({
            put:  vi.fn().mockResolvedValue({}),
            post: vi.fn()
                     .mockResolvedValueOnce({ id: 'asgn-99' })
                     .mockResolvedValueOnce({ rubric: {} })
        });
        const sm = buildSMAtCreating({ apiClient: makeFailingClient() });

        await expect(handleCreatingAssignment(sm)).rejects.toThrow(/Failed to create rubric/);
        expect(writePLAssignments).not.toHaveBeenCalled();
    });
});

// ── handleSyncing ─────────────────────────────────────────────────────────────

/** Drive SM to SYNCING state */
function buildSMAtSyncing(extraContext = {}) {
    const studentsToSync = [
        { userId: 'u1', submissionId: 'sub-1', rubricAssociationId: 'assoc-1', rubricCriterionId: 'crit-1', points: 3.5, score: 3.5, plScore: 3.5 }
    ];
    const sm = new PLOutlookStateMachine({
        courseId: '100', outcomeId: '598', outcomeName: 'Algebra',
        apiClient: { graphql: vi.fn() },
        studentsToSync, numberOfUpdates: studentsToSync.length,
        ...extraContext
    });
    sm.transition(PL_STATES.CHECKING_SETUP);
    sm.transition(PL_STATES.CHECKING_STUDENTS);
    sm.transition(PL_STATES.CALCULATING_CHANGES);
    sm.transition(PL_STATES.SYNCING);
    return sm;
}

describe('handleSyncing', () => {
    beforeEach(() => vi.clearAllMocks());

    test('calls submitRubricAssessmentBatch with studentsToSync and apiClient', async () => {
        submitRubricAssessmentBatch.mockResolvedValue({ successCount: 1, errors: [], retryCounts: [] });
        const apiClient = { graphql: vi.fn() };
        const sm = buildSMAtSyncing({ apiClient });

        await handleSyncing(sm);

        expect(submitRubricAssessmentBatch).toHaveBeenCalledWith(
            sm.getContext().studentsToSync,
            apiClient,
            expect.objectContaining({ concurrency: 5, maxAttempts: 3 })
        );
    });

    test('returns VERIFYING on success', async () => {
        submitRubricAssessmentBatch.mockResolvedValue({ successCount: 1, errors: [], retryCounts: [] });
        const sm = buildSMAtSyncing();

        const next = await handleSyncing(sm);
        expect(next).toBe(PL_STATES.VERIFYING);
    });

    test('batch errors are stored in context', async () => {
        const batchErrors = [{ userId: 'u1', submissionId: 'sub-1', error: 'timeout' }];
        submitRubricAssessmentBatch.mockResolvedValue({ successCount: 0, errors: batchErrors, retryCounts: [] });
        const sm = buildSMAtSyncing();

        await handleSyncing(sm);

        expect(sm.getContext().errors).toEqual(batchErrors);
        expect(sm.getContext().successCount).toBe(0);
    });

    test('onProgress callback is wired through to the batch function', async () => {
        // Mock the batch to immediately invoke its onProgress callback
        submitRubricAssessmentBatch.mockImplementation(async (students, client, opts) => {
            if (opts.onProgress) opts.onProgress(1, 1);
            return { successCount: 1, errors: [], retryCounts: [] };
        });
        const onProgress = vi.fn();
        const sm = buildSMAtSyncing({ onProgress });

        await handleSyncing(sm);

        // sm.progress('Syncing...', done, total) should have been called via the wired callback
        expect(onProgress).toHaveBeenCalledWith(
            PL_STATES.SYNCING, 'Algebra', 'Syncing...', 1, 1
        );
    });

    test('rubricCriterionId is passed raw (not pre-formatted with "criterion_" prefix)', async () => {
        submitRubricAssessmentBatch.mockResolvedValue({ successCount: 1, errors: [], retryCounts: [] });
        const sm = buildSMAtSyncing();

        await handleSyncing(sm);

        const [students] = submitRubricAssessmentBatch.mock.calls[0];
        expect(students[0].rubricCriterionId).toBe('crit-1');       // raw, no "criterion_" prefix
        expect(students[0].rubricCriterionId).not.toMatch(/^criterion_/);
    });
});

// ── handleVerifying ───────────────────────────────────────────────────────────

/** Drive SM to VERIFYING state with a pre-built studentsToSync list */
function buildSMAtVerifying(studentsToSync, extraContext = {}) {
    const sm = new PLOutlookStateMachine({
        courseId: '100', outcomeId: '598', outcomeName: 'Algebra',
        apiClient: {},
        studentsToSync,
        ...extraContext
    });
    sm.transition(PL_STATES.CHECKING_SETUP);
    sm.transition(PL_STATES.CHECKING_STUDENTS);
    sm.transition(PL_STATES.CALCULATING_CHANGES);
    sm.transition(PL_STATES.SYNCING);
    sm.transition(PL_STATES.VERIFYING);
    return sm;
}

/** Build a rollup response where the given userId has the given score for outcome 598 */
function makeVerifyRollup(userId, score) {
    return {
        rollups: [{
            links: { user: userId },
            scores: [{ links: { outcome: '598' }, score }]
        }]
    };
}

describe('handleVerifying', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    test('all scores match → returns COMPLETE with empty verifyMismatches', async () => {
        const students = [{ userId: 'u1', plScore: 3.5 }];
        const apiClient = { get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 3.5)) };
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        const next = await promise;

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().verifyMismatches).toHaveLength(0);
    });

    test('scores match at hundredths (not exact float) → no mismatch', async () => {
        const students = [{ userId: 'u1', plScore: 3.5 }];
        // 3.504 rounds to 350 at hundredths, same as 3.5 → should match
        const apiClient = { get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 3.504)) };
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        const next = await promise;

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().verifyMismatches).toHaveLength(0);
    });

    test('persistent mismatches → still returns COMPLETE after maxRetries (does not throw)', async () => {
        const students = [{ userId: 'u1', plScore: 3.5 }];
        // Canvas always returns a mismatching score
        const apiClient = { get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 1.0)) };
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        const next = await promise;

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().verifyMismatches).toHaveLength(1);
        expect(sm.getContext().verifyMismatches[0].userId).toBe('u1');
        // Should have retried — get called more than once
        expect(apiClient.get.mock.calls.length).toBeGreaterThan(1);
    });

    test('mismatches capped: 4 total API calls (1 initial Infinity-reset + 3 retry attempts)', async () => {
        const students = [{ userId: 'u1', plScore: 3.5 }];
        const apiClient = { get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 1.0)) };
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        await promise;

        // previousMismatchCount starts at Infinity, so call 1 (1 mismatch < Infinity) always
        // resets attempt to 1. Then calls 2, 3, 4 are the 3 real retry attempts.
        expect(apiClient.get.mock.calls.length).toBe(4);
    });

    test('decreasing mismatch count resets retry counter (more than 3 calls made)', async () => {
        const students = [
            { userId: 'u1', plScore: 3.5 },
            { userId: 'u2', plScore: 3.5 }
        ];
        // Call 1: both mismatch (2 mismatches)
        // Call 2: only u1 mismatches (1 mismatch — count decreased → reset attempt to 1)
        // Calls 3-5: u1 keeps mismatching (3 more attempts before giving up)
        const apiClient = {
            get: vi.fn()
                    .mockResolvedValueOnce({ rollups: [
                        { links: { user: 'u1' }, scores: [{ links: { outcome: '598' }, score: 1.0 }] },
                        { links: { user: 'u2' }, scores: [{ links: { outcome: '598' }, score: 1.0 }] }
                    ]})
                    .mockResolvedValue(makeVerifyRollup('u1', 1.0))   // u2 now matches (missing from rollup = no entry)
        };
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        await promise;

        // Without reset: would be 3 calls. With reset after call 2: at least 4 calls.
        expect(apiClient.get.mock.calls.length).toBeGreaterThan(3);
    });

    test('missing rollup score for a student counts as mismatch', async () => {
        const students = [{ userId: 'u1', plScore: 3.5 }];
        // Canvas returns no rollup at all for u1
        const apiClient = { get: vi.fn().mockResolvedValue({ rollups: [] }) };
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        await promise;

        expect(sm.getContext().verifyMismatches).toHaveLength(1);
    });
});