// src/masteryOutlook/tests/plOutlookStateHandlers.test.js
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PLOutlookStateMachine, PL_STATES } from '../plOutlookStateMachine.js';
import {
    handleCheckingSetup,
    handleCheckingStudents,
    handleCalculatingChanges,
    handleCreatingAssignment,
    handleSyncing,
    handleVerifying,
    handleComplete,
    handleError,
    VERIFY_NO_PROGRESS_LIMIT_MS
} from '../plOutlookStateHandlers.js';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../masteryOutlookCacheService.js', () => ({
    readMasteryOutlookCache: vi.fn(),
    readPLAssignments:       vi.fn(),
    writePLAssignments:      vi.fn(),
    readSyncState:           vi.fn(async () => ({})),
    writeSyncState:          vi.fn()
}));

vi.mock('../../services/enrollmentService.js', () => ({
    fetchCourseStudents: vi.fn()
}));

vi.mock('../../services/graphqlGradingService.js', () => ({
    submitRubricAssessmentBatch: vi.fn()
}));

vi.mock('../../config.js', () => ({
    PL_ASSIGNMENT_SUFFIX:        'Projected Score',
    PL_RUBRIC_SUFFIX:            'Projected Score Rubric',
    PL_GRADING_TYPE:             'gpa_scale',
    PL_GRADING_SCHEME_ID:        null,
    DEFAULT_MAX_POINTS:          4,
    OUTCOME_AND_RUBRIC_RATINGS: [
        { description: 'Exemplary',  points: 4 },
        { description: 'Proficient', points: 3 },
        { description: 'Developing', points: 2 },
        { description: 'Beginning',  points: 1 }
    ]
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { readMasteryOutlookCache, readPLAssignments, writePLAssignments, readSyncState } from '../masteryOutlookCacheService.js';
import { fetchCourseStudents } from '../../services/enrollmentService.js';
import { submitRubricAssessmentBatch } from '../../services/graphqlGradingService.js';

/**
 * Add a getWithResponse() to a mock client that wraps its get() mock — rollup
 * fetches use getWithResponse for Link-header pagination (single page here).
 */
function withResponse(client) {
    client.getWithResponse = vi.fn(async (...args) => {
        const data = await client.get(...args);
        return { json: async () => data, headers: { get: () => null } };
    });
    return client;
}

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
    beforeEach(() => {
        vi.clearAllMocks();
        readSyncState.mockResolvedValue({});
    });

    /** Teacher-set Override (will_post) for u1 on outcome 598 */
    function setOverride(willPost) {
        readSyncState.mockResolvedValue({ '598': { u1: { will_post: willPost, will_post_lock: 'unlocked' } } });
    }

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
        setOverride(3.5);
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeRollup('u1', 1.0)) });

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
        setOverride(3.5);
        // 3.5 rounds to 350 at hundredths — exact match, no sync needed
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeRollup('u1', 3.5)) });

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

    test('student with status NE and no override is skipped', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5, 'NE'));
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue({ rollups: [] }) });

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
        setOverride(3.5);
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue({ rollups: [] }) });

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
        const apiClient = withResponse({ get: vi.fn() });

        const sm = buildSM({ apiClient, effectiveTargetIds: new Set() });
        await expect(handleCalculatingChanges(sm)).rejects.toThrow(/run Refresh Data/);
    });

    test('scores differ at hundredths → student IS included in sync (old threshold would have skipped this)', async () => {
        // PL=3.50, Canvas=3.30 — rounds to 350 vs 330, different → needs sync
        // Under old SYNC_THRESHOLD=0.25, diff=0.2 would have been skipped
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        setOverride(3.5);
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeRollup('u1', 3.3)) });

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
        setOverride(3.5);
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeRollup('u1', 3.504)) });

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
        setOverride(3.0);
        // Rollup has no score for this outcome
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue({ rollups: [] }) });

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

    test('no override → PL prediction is NOT pushed even when it differs from Canvas', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeRollup('u1', 1.0)) });

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

    test('teacher override is pushed as-is, not the PL prediction', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        setOverride(2.0);
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeRollup('u1', 1.0)) });

        const sm = buildSM({
            apiClient,
            submissionIdByUserId: new Map([['u1', 'sub-1']]),
            effectiveTargetIds:   new Set(['u1']),
            rubricAssociationId:  'assoc-1',
            rubricCriterionId:    'crit-1'
        });
        const next = await handleCalculatingChanges(sm);

        expect(next).toBe(PL_STATES.SYNCING);
        expect(sm.getContext().studentsToSync[0].plScore).toBe(2.0);
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
        const getAllPagesCallOrder  = apiClient.getAllPages.mock.invocationCallOrder.at(-1);  // submissions fetch (after outcome-link read)
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

    /**
     * Happy-path client whose calculation_method reads are controlled per test.
     * @param {Object} opts
     * @param {string|null} [opts.linkMethod]    - method on the course outcome link (null = outcome not linked)
     * @param {string|null} [opts.outcomeMethod] - method from /api/v1/outcomes/598 (null = read fails)
     */
    function makeCalcClient({ linkMethod = null, outcomeMethod = null } = {}) {
        const apiClient = makeApiClient();
        apiClient.getAllPages.mockImplementation(async (url) => url.includes('outcome_group_links')
            ? (linkMethod ? [{ outcome: { id: 598, calculation_method: linkMethod } }] : [])
            : [{ id: 'sub-1', user_id: 'u1' }]);
        apiClient.get.mockImplementation(async (url) => {
            if (url === '/api/v1/outcomes/598') {
                if (outcomeMethod === null) throw Object.assign(new Error('HTTP 403'), { statusCode: 403 });
                return { calculation_method: outcomeMethod };
            }
            return { rubric: [{ id: 'crit-1' }] };
        });
        return apiClient;
    }

    const outcomePutCalls = (apiClient) => apiClient.put.mock.calls.filter(([url]) => url === '/api/v1/outcomes/598');

    async function runCreating(apiClient) {
        const sm = buildSMAtCreating({ apiClient });
        const promise = handleCreatingAssignment(sm);
        await vi.runAllTimersAsync();
        const next = await promise;
        return { sm, next };
    }

    test('course outcome link reads latest → skips calculation_method PUT', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeCalcClient({ linkMethod: 'latest' });

        await runCreating(apiClient);

        expect(outcomePutCalls(apiClient)).toHaveLength(0);
        expect(apiClient.get).not.toHaveBeenCalledWith('/api/v1/outcomes/598', expect.anything(), expect.anything());
        expect(writePLAssignments).toHaveBeenCalled();
    });

    test('outcome not in course links, /outcomes/:id reads latest → skips PUT', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeCalcClient({ linkMethod: null, outcomeMethod: 'latest' });

        await runCreating(apiClient);

        expect(outcomePutCalls(apiClient)).toHaveLength(0);
        expect(writePLAssignments).toHaveBeenCalled();
    });

    test('outcome not latest → PUTs calculation_method before creating the assignment', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeCalcClient({ linkMethod: 'decaying_average' });

        const { sm } = await runCreating(apiClient);

        const putIdx = apiClient.put.mock.calls.findIndex(([url]) => url === '/api/v1/outcomes/598');
        expect(putIdx).toBeGreaterThanOrEqual(0);
        expect(apiClient.put.mock.calls[putIdx][1]).toEqual({ calculation_method: 'latest' });
        expect(apiClient.put.mock.invocationCallOrder[putIdx]).toBeLessThan(apiClient.post.mock.invocationCallOrder[0]);
        expect(sm.getContext().calcMethodWarning).toBeUndefined();
    });

    test('PUT forbidden (district outcome) → continues setup and records calcMethodWarning', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeCalcClient({ linkMethod: null, outcomeMethod: null });
        apiClient.put.mockRejectedValueOnce(Object.assign(new Error('HTTP 403'), { name: 'CanvasApiError', statusCode: 403 }));

        const { sm, next } = await runCreating(apiClient);

        expect(next).toBe(PL_STATES.CHECKING_STUDENTS);
        expect(apiClient.post).toHaveBeenCalledTimes(2);   // assignment + rubric created
        expect(writePLAssignments).toHaveBeenCalled();
        expect(sm.getContext().calcMethodWarning).toMatch(/Couldn't confirm "Algebra" uses Most Recent Score/);
    });

    test('PUT fails with a non-403 error → throws before anything is created', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeCalcClient({ linkMethod: 'decaying_average' });
        apiClient.put.mockRejectedValueOnce(Object.assign(new Error('HTTP 500'), { name: 'CanvasApiError', statusCode: 500 }));
        const sm = buildSMAtCreating({ apiClient });

        await expect(handleCreatingAssignment(sm)).rejects.toThrow(/HTTP 500/);
        expect(apiClient.post).not.toHaveBeenCalled();
        expect(writePLAssignments).not.toHaveBeenCalled();
    });

    test('setupOnly=true → writes cache and returns COMPLETE instead of CHECKING_STUDENTS', async () => {
        readPLAssignments.mockResolvedValue({});
        const apiClient = makeApiClient();
        const sm = buildSMAtCreating({ apiClient, setupOnly: true });

        const promise = handleCreatingAssignment(sm);
        await vi.runAllTimersAsync();
        const next = await promise;

        expect(next).toBe(PL_STATES.COMPLETE);
        // Setup is still fully written to cache even in setupOnly mode
        expect(writePLAssignments).toHaveBeenCalledWith(
            '100',
            expect.objectContaining({
                598: expect.objectContaining({ assignment_id: 'asgn-99' })
            }),
            apiClient
        );
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
            // handleSyncing adds a per-student comment field to each batch param
            sm.getContext().studentsToSync.map(s => expect.objectContaining(s)),
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

    test('calls onPushed with pushed (non-failed) students before verification', async () => {
        submitRubricAssessmentBatch.mockResolvedValue({ successCount: 1, errors: [], retryCounts: [] });
        const onPushed = vi.fn();
        const sm = buildSMAtSyncing({ onPushed });

        const next = await handleSyncing(sm);

        expect(next).toBe(PL_STATES.VERIFYING);
        expect(onPushed).toHaveBeenCalledTimes(1);
        expect(onPushed).toHaveBeenCalledWith(expect.objectContaining({ successCount: 1, pushedUserIds: ['u1'] }));
    });

    test('does not call onPushed when nothing was pushed', async () => {
        submitRubricAssessmentBatch.mockResolvedValue({
            successCount: 0, errors: [{ userId: 'u1', error: 'timeout' }], retryCounts: []
        });
        const onPushed = vi.fn();
        const sm = buildSMAtSyncing({ onPushed });

        await handleSyncing(sm);
        expect(onPushed).not.toHaveBeenCalled();
    });

    test('a throwing onPushed does not break the sync', async () => {
        submitRubricAssessmentBatch.mockResolvedValue({ successCount: 1, errors: [], retryCounts: [] });
        const sm = buildSMAtSyncing({ onPushed: () => { throw new Error('boom'); } });

        await expect(handleSyncing(sm)).resolves.toBe(PL_STATES.VERIFYING);
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
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 3.5)) });
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
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 3.504)) });
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
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 1.0)) });
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

    test('persistent mismatch gives up after ~4 minutes without progress', async () => {
        const students = [{ userId: 'u1', plScore: 3.5 }];
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue(makeVerifyRollup('u1', 1.0)) });
        const sm = buildSMAtVerifying(students, { apiClient });
        const start = Date.now();

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        await promise;

        // Poll 1 counts as progress (lastMismatchCount starts at Infinity). Delays are
        // 1,1,1,2,2,3 s (poll 7 at 10 s) then 5 s, so the first poll at ≥ 240 s is poll 53.
        expect(Date.now() - start).toBeGreaterThanOrEqual(VERIFY_NO_PROGRESS_LIMIT_MS);
        expect(apiClient.get.mock.calls.length).toBe(53);
    });

    test('first polls are 1 s apart and filtered to the outcome', async () => {
        const students = [{ userId: 'u1', plScore: 3.5 }];
        const get = vi.fn()
            .mockResolvedValueOnce(makeVerifyRollup('u1', 1.0))
            .mockResolvedValueOnce(makeVerifyRollup('u1', 1.0))
            .mockResolvedValue(makeVerifyRollup('u1', 3.5));
        const apiClient = withResponse({ get });
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.advanceTimersByTimeAsync(0);
        expect(get).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(get).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1000);
        expect(get).toHaveBeenCalledTimes(3);
        await vi.runAllTimersAsync();
        const next = await promise;

        expect(next).toBe(PL_STATES.COMPLETE);
        expect(sm.getContext().verifyMismatches).toHaveLength(0);
        expect(get.mock.calls[0][0]).toContain('outcome_ids[]=598');
    });

    test('decreasing mismatch count resets retry counter (more than 3 calls made)', async () => {
        const students = [
            { userId: 'u1', plScore: 3.5 },
            { userId: 'u2', plScore: 3.5 }
        ];
        // Call 1: both mismatch (2 mismatches)
        // Call 2: only u1 mismatches (1 mismatch — count decreased → reset attempt to 1)
        // Calls 3-5: u1 keeps mismatching (3 more attempts before giving up)
        const apiClient = withResponse({
            get: vi.fn()
                    .mockResolvedValueOnce({ rollups: [
                        { links: { user: 'u1' }, scores: [{ links: { outcome: '598' }, score: 1.0 }] },
                        { links: { user: 'u2' }, scores: [{ links: { outcome: '598' }, score: 1.0 }] }
                    ]})
                    .mockResolvedValue(makeVerifyRollup('u1', 1.0))   // u2 now matches (missing from rollup = no entry)
        });
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
        const apiClient = withResponse({ get: vi.fn().mockResolvedValue({ rollups: [] }) });
        const sm = buildSMAtVerifying(students, { apiClient });

        const promise = handleVerifying(sm);
        await vi.runAllTimersAsync();
        await promise;

        expect(sm.getContext().verifyMismatches).toHaveLength(1);
    });
});