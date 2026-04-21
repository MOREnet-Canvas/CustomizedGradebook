// src/masteryOutlook/plOutlookStateHandlers.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PLOutlookStateMachine, PL_STATES } from './plOutlookStateMachine.js';
import {
    handleCheckingSetup,
    handleCheckingStudents,
    handleCalculatingChanges,
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

    test('score within threshold → returns COMPLETE with zero studentsToSync', async () => {
        readMasteryOutlookCache.mockResolvedValue(makeCache(3.5));
        // Canvas score 3.5 matches exactly — difference = 0, within SYNC_THRESHOLD (0.25)
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