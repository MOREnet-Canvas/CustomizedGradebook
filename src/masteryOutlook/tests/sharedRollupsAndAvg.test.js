// src/masteryOutlook/tests/sharedRollupsAndAvg.test.js
// Course-wide rollup fetch shared by the verify polls, and the Current Score
// update limited to the students that were just saved.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

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
vi.mock('../../services/gradeOverride.js', () => ({ getAllEnrollmentIds: vi.fn(async () => new Map()) }));
vi.mock('../../services/masteryRefreshService.js', () => ({ refreshMasteryForAssignment: vi.fn(async () => {}) }));

import { fetchCourseRollupsForVerify, clearCourseRollupReuse, COURSE_ROLLUP_REUSE_MS } from '../masteryOutlookDataService.js';
import { updateAvgAssignmentForStudents } from '../masteryOutlookAvgService.js';
import { calculateStudentAverages } from '../../services/gradeCalculator.js';
import { submitRubricAssessmentBatch } from '../../services/graphqlGradingService.js';
import { writeSyncState } from '../masteryOutlookCacheService.js';
import { rowsAwaitingOutcome, subscribeSaveStatus, notifySaveStatus } from '../masteryOutlookState.js';

/** apiClient whose getWithResponse serves the given pages in order, following Link: rel="next". */
function makePagedClient(pages) {
    const getWithResponse = vi.fn(async (url) => {
        const m    = url.match(/[?&]page=(\d+)/);   // not per_page=
        const idx  = m ? Number(m[1]) - 1 : 0;
        const next = idx + 1 < pages.length ? `<https://x/api?page=${idx + 2}>; rel="next"` : null;
        return { json: async () => pages[idx], headers: { get: (h) => (h === 'Link' ? next : null) } };
    });
    return { getWithResponse };
}

describe('fetchCourseRollupsForVerify', () => {
    beforeEach(() => { vi.useFakeTimers(); clearCourseRollupReuse(); });
    afterEach(() => vi.useRealTimers());

    test('follows Link pagination and merges rollups and linked outcomes', async () => {
        const client = makePagedClient([
            { rollups: [{ links: { user: '1' } }], linked: { outcomes: [{ id: 599, title: 'O2' }], users: [{ id: 1 }] } },
            { rollups: [{ links: { user: '2' } }], linked: { outcomes: [{ id: 599, title: 'O2' }, { id: 603, title: 'Current Score' }], users: [{ id: 2 }] } },
        ]);

        const result = await fetchCourseRollupsForVerify('566', client);

        expect(client.getWithResponse).toHaveBeenCalledTimes(2);
        expect(client.getWithResponse.mock.calls[0][0]).toBe('/api/v1/courses/566/outcome_rollups?include[]=outcomes&include[]=users&per_page=100');
        expect(result.rollups.map(r => r.links.user)).toEqual(['1', '2']);
        expect(result.linked.outcomes.map(o => o.id)).toEqual([599, 603]);
    });

    test('concurrent calls share one request; a later call makes a new one', async () => {
        const client = makePagedClient([{ rollups: [], linked: {} }]);

        const [a, b] = await Promise.all([
            fetchCourseRollupsForVerify('566', client),
            fetchCourseRollupsForVerify('566', client),
        ]);
        expect(a).toBe(b);
        expect(client.getWithResponse).toHaveBeenCalledTimes(1);

        await fetchCourseRollupsForVerify('566', client);          // still inside the reuse window
        expect(client.getWithResponse).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(COURSE_ROLLUP_REUSE_MS);
        await fetchCourseRollupsForVerify('566', client);
        expect(client.getWithResponse).toHaveBeenCalledTimes(2);
    });

    test('a failed fetch is not reused', async () => {
        const client = { getWithResponse: vi.fn().mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValue({ json: async () => ({ rollups: [] }), headers: { get: () => null } }) };

        await expect(fetchCourseRollupsForVerify('566', client)).rejects.toThrow('boom');
        await expect(fetchCourseRollupsForVerify('566', client)).resolves.toEqual(
            expect.objectContaining({ rollups: [] }));
        expect(client.getWithResponse).toHaveBeenCalledTimes(2);
    });
});

describe('updateAvgAssignmentForStudents — only the saved students', () => {
    beforeEach(() => { vi.clearAllMocks(); clearCourseRollupReuse(); });

    test('other students whose Current Score also differs are not updated', async () => {
        // Rollup already shows the expected Current Score for 642, so Step 8 verifies on the first poll.
        const client = makePagedClient([{
            rollups: [
                { links: { user: '642' }, scores: [{ score: 1.5, links: { outcome: '599' } }, { score: 2.5, links: { outcome: '603' } }] },
                { links: { user: '643' }, scores: [{ score: 3,   links: { outcome: '599' } }, { score: 1,   links: { outcome: '603' } }] },
            ],
            linked: { outcomes: [{ id: 599, title: 'Outcome 2' }, { id: 603, title: 'Current Score' }] },
        }]);
        calculateStudentAverages.mockResolvedValue([
            { userId: '642', average: 2.5 },
            { userId: '643', average: 3 },   // differs too, but 643 was not saved
        ]);
        const cache = {
            students: [],
            sync_state: {},
            avg_assignment: {
                assignment_id: 'avg-a', criterion_id: 'crit', rubric_association_id: 'assoc',
                avg_outcome_id: '603', submission_ids: { '642': 'sub-642', '643': 'sub-643' },
            },
        };

        await updateAvgAssignmentForStudents({
            courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], pushedScores: { '642': 2 }, cache, apiClient: client,
        });

        expect(submitRubricAssessmentBatch).toHaveBeenCalledTimes(1);
        const batch = submitRubricAssessmentBatch.mock.calls[0][0];
        expect(batch.map(s => s.userId)).toEqual(['642']);
    });

    test('the pushed score is used even though the rollup still has the old value', async () => {
        const client = makePagedClient([{
            rollups: [{ links: { user: '642' }, scores: [{ score: 1.5, links: { outcome: '599' } }] }],
            linked: { outcomes: [{ id: 599, title: 'Outcome 2' }] },
        }]);
        calculateStudentAverages.mockResolvedValue([]);
        const cache = { students: [], sync_state: {}, avg_assignment: {
            assignment_id: 'a', criterion_id: 'c', rubric_association_id: 'r', avg_outcome_id: '603', submission_ids: {},
        } };

        await updateAvgAssignmentForStudents({
            courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], pushedScores: { '642': 2 }, cache, apiClient: client,
        });

        const rollupsSeen = calculateStudentAverages.mock.calls[0][0].rollups;
        expect(rollupsSeen[0].scores.find(s => s.links.outcome === '599').score).toBe(2);
        // The shared result itself was not mutated
        const shared = await fetchCourseRollupsForVerify('566', client);
        expect(shared.rollups[0].scores[0].score).toBe(1.5);
    });
});

describe('updateAvgAssignmentForStudents — Current Score check runs in the background', () => {
    beforeEach(() => { vi.clearAllMocks(); clearCourseRollupReuse(); });

    test('resolves after the push without waiting for Step 8; Step 8 still records avg_verify_*', async () => {
        vi.useFakeTimers();
        try {
            // The rollup keeps the old Current Score, so Step 8 keeps polling.
            const client = makePagedClient([{
                rollups: [{ links: { user: '642' }, scores: [
                    { score: 1.5, links: { outcome: '599' } }, { score: 1, links: { outcome: '603' } },
                ] }],
                linked: { outcomes: [{ id: 599, title: 'Outcome 2' }, { id: 603, title: 'Current Score' }] },
            }]);
            calculateStudentAverages.mockResolvedValue([{ userId: '642', average: 2.5 }]);
            const cache = { students: [], sync_state: {}, avg_assignment: {
                assignment_id: 'a', criterion_id: 'c', rubric_association_id: 'r',
                avg_outcome_id: '603', submission_ids: { '642': 'sub-642' },
            } };

            const done = await updateAvgAssignmentForStudents({
                courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
                studentIds: ['642'], pushedScores: { '642': 2 }, cache, apiClient: client,
            });
            expect(done).toBe(true);                         // resolved while Step 8 is still polling
            expect(writeSyncState).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(5 * 60 * 1000); // Step 8 gives up after 4 min without progress
            expect(writeSyncState).toHaveBeenCalledTimes(1);
            const written = writeSyncState.mock.calls[0][1];
            expect(written['603']['642']).toEqual(expect.objectContaining({ avg_verify_mismatch: true }));
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('Current Score rows show ⏳ while Canvas updates them', () => {
    beforeEach(() => { vi.clearAllMocks(); clearCourseRollupReuse(); rowsAwaitingOutcome.clear(); });

    function csCache() {
        return {
            students: [{ id: '642', outcomes: [{ outcomeId: '603', canvasScore: 1 }] }],
            sync_state: {},
            avg_assignment: {
                assignment_id: 'a', criterion_id: 'c', rubric_association_id: 'r',
                avg_outcome_id: '603', submission_ids: { '642': 'sub-642' },
            },
        };
    }

    test('rows are marked after the push; a confirmed student clears and shows the new Current Score', async () => {
        vi.useFakeTimers();
        try {
            const pages = [{
                rollups: [{ links: { user: '642' }, scores: [{ score: 1, links: { outcome: '603' } }] }],
                linked: { outcomes: [{ id: 603, title: 'Current Score' }] },
            }];
            const client = makePagedClient(pages);
            calculateStudentAverages.mockResolvedValue([{ userId: '642', average: 2.5 }]);
            const cache = csCache();
            const notified = [];
            const unsubscribe = subscribeSaveStatus(id => notified.push(id));

            await updateAvgAssignmentForStudents({
                courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
                studentIds: ['642'], pushedScores: { '642': 2 }, cache, apiClient: client,
            });
            expect(rowsAwaitingOutcome.has('603_642')).toBe(true);
            expect(notified).toContain('603');

            // Canvas's Current Score catches up on a later poll
            pages[0].rollups[0].scores[0].score = 2.5;
            await vi.advanceTimersByTimeAsync(2000);

            expect(rowsAwaitingOutcome.has('603_642')).toBe(false);
            expect(cache.students[0].outcomes[0].canvasScore).toBe(2.5);
            unsubscribe();
        } finally {
            vi.useRealTimers();
        }
    });

    test('Step 8 gives up → keys cleared anyway; failed pushes are never marked', async () => {
        vi.useFakeTimers();
        try {
            const client = makePagedClient([{
                rollups: [
                    { links: { user: '642' }, scores: [{ score: 1, links: { outcome: '603' } }] },
                    { links: { user: '643' }, scores: [{ score: 1, links: { outcome: '603' } }] },
                ],
                linked: { outcomes: [{ id: 603, title: 'Current Score' }] },
            }]);
            calculateStudentAverages.mockResolvedValue([
                { userId: '642', average: 2.5 }, { userId: '643', average: 3 },
            ]);
            submitRubricAssessmentBatch.mockResolvedValueOnce({ successCount: 1, errors: [{ userId: '643', error: 'x' }] });
            const cache = csCache();
            cache.avg_assignment.submission_ids['643'] = 'sub-643';

            await updateAvgAssignmentForStudents({
                courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
                studentIds: ['642', '643'], pushedScores: { '642': 2, '643': 3 }, cache, apiClient: client,
            });
            expect(rowsAwaitingOutcome.has('603_642')).toBe(true);
            expect(rowsAwaitingOutcome.has('603_643')).toBe(false);   // its push failed

            await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
            expect(rowsAwaitingOutcome.size).toBe(0);
            expect(cache.students[0].outcomes[0].canvasScore).toBe(1);  // never confirmed → unchanged
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('subscribeSaveStatus / notifySaveStatus', () => {
    test('delivers the outcome ID to listeners until unsubscribed; a throwing listener does not stop others', () => {
        const a = vi.fn(() => { throw new Error('broken row'); });
        const b = vi.fn();
        const unA = subscribeSaveStatus(a);
        const unB = subscribeSaveStatus(b);

        notifySaveStatus(603);
        expect(a).toHaveBeenCalledWith('603');
        expect(b).toHaveBeenCalledWith('603');

        unB();
        notifySaveStatus('599');
        expect(b).toHaveBeenCalledTimes(1);
        unA();
    });
});
