// src/masteryOutlook/tests/pushBeforeVerify.test.js
// Post-push work (in-memory sync_state, canvasScore, Current Score update) must not
// wait for VERIFYING — the teacher may leave the page before verification finishes.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../masteryOutlookCacheService.js', () => ({
    readSyncState:            vi.fn(async () => ({})),
    writeSyncState:           vi.fn(async () => {}),
    readMasteryOutlookCache:  vi.fn(async () => null),
    writeMasteryOutlookCache: vi.fn(async () => {}),
}));
vi.mock('../plOutlookSync.js', () => ({ runPLSync: vi.fn() }));
vi.mock('../masteryOutlookAvgService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    updateAvgAssignmentForStudents: vi.fn(async () => true),
    postNoteToAvgAssignment:        vi.fn(async () => true),
}));

import { handleSyncStudents } from '../plOutlookActions.js';
import { runPLSync } from '../plOutlookSync.js';
import { updateAvgAssignmentForStudents, applyPushedScoresToRollups } from '../masteryOutlookAvgService.js';
import { writeMasteryOutlookCache } from '../masteryOutlookCacheService.js';
import { runExclusive, isSaveQueueBusy, rowSavePhase } from '../masteryOutlookState.js';
import { getOutcomeSaveSummary } from '../studentSyncTable.js';

function makeCache() {
    return {
        students: [{ id: '642', outcomes: [{ outcomeId: '599', plPrediction: 1.5, canvasScore: 1.5 }] }],
        sync_state: { '599': { '642': { will_post: 2, will_post_lock: 'unlocked', will_post_note: 'retest' } } },
        pl_assignments: { '599': { assignment_id: 'a1' } },
    };
}

describe('applyPushedScoresToRollups', () => {
    test('replaces the synced outcome score for pushed students only', () => {
        const rollups = { rollups: [
            { links: { user: '642' }, scores: [{ score: 1.5, links: { outcome: '599' } }, { score: 3, links: { outcome: '600' } }] },
            { links: { user: '643' }, scores: [{ score: 2.5, links: { outcome: '599' } }] },
        ] };
        applyPushedScoresToRollups(rollups, '599', { '642': 2 });
        expect(rollups.rollups[0].scores).toEqual([
            { score: 2, links: { outcome: '599' } }, { score: 3, links: { outcome: '600' } },
        ]);
        expect(rollups.rollups[1].scores[0].score).toBe(2.5);
    });

    test('adds the score when the student had no rollup entry for the outcome yet', () => {
        const rollups = { rollups: [{ links: { user: '642' }, scores: [] }] };
        applyPushedScoresToRollups(rollups, 599, { '642': 2 });
        expect(rollups.rollups[0].scores).toEqual([{ score: 2, links: { outcome: '599' } }]);
    });
});

describe('handleSyncStudents — work that must not wait for verification', () => {
    let addSpy, removeSpy;
    beforeEach(() => {
        vi.clearAllMocks();
        addSpy    = vi.spyOn(window, 'addEventListener');
        removeSpy = vi.spyOn(window, 'removeEventListener');
    });
    afterEach(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    const DONE = { success: true, successCount: 1, errors: [], verifyMismatchIds: [], stateHistory: ['SYNCING', 'VERIFYING', 'COMPLETE'] };

    test('push done, verify still running → Current Score update + in-memory mirror already happened', async () => {
        let finishVerify;
        runPLSync.mockImplementation(async ({ onPushed }) => {
            onPushed({ successCount: 1, errors: [], pushedUserIds: ['642'] });
            await new Promise(r => { finishVerify = r; });   // verification "hangs"
            return DONE;
        });
        const cache = makeCache();

        const run = handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache, onRerender: () => {} });

        // Current Score update started with the pushed score — only for the pushed student
        await vi.waitFor(() => expect(updateAvgAssignmentForStudents).toHaveBeenCalledWith(expect.objectContaining({
            outcomeId: '599', studentIds: ['642'], pushedScores: { '642': 2 }, notes: { '642': 'retest' },
        })));
        // In-memory sync_state mirrors the push (so later whole-cache writes don't undo it)
        const entry = cache.sync_state['599']['642'];
        expect(entry.last_synced_score).toBe(2);
        expect(entry.last_synced_at).toBeTruthy();
        expect(entry.last_synced_note).toBe('retest');
        expect(entry.will_post).toBeNull();
        expect(entry.will_post_note).toBeNull();
        expect(cache.students[0].outcomes[0].canvasScore).toBe(2);
        // Leave-page warning is active while in flight
        expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        expect(removeSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

        const writesBeforeVerify = writeMasteryOutlookCache.mock.calls.length;
        finishVerify();
        await run;

        expect(entry.last_verify_at).toBeTruthy();
        expect(entry.verify_mismatch).toBe(false);
        expect(writeMasteryOutlookCache.mock.calls.length).toBe(writesBeforeVerify + 1);
        expect(updateAvgAssignmentForStudents).toHaveBeenCalledTimes(1);   // not repeated after verify
        await vi.waitFor(() => expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function)));
    });

    test('pending typed edits are written to the cache file before the save reads it', async () => {
        runPLSync.mockResolvedValue(DONE);
        const cache = makeCache();
        cache.sync_state['599']['642'].will_post = 3;   // typed just now, debounced write not yet run

        await handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache, onRerender: () => {} });

        expect(writeMasteryOutlookCache).toHaveBeenCalled();
        expect(writeMasteryOutlookCache.mock.invocationCallOrder[0])
            .toBeLessThan(runPLSync.mock.invocationCallOrder[0]);
    });

    test('verify mismatch is mirrored into memory', async () => {
        runPLSync.mockImplementation(async ({ onPushed }) => {
            onPushed({ successCount: 1, errors: [], pushedUserIds: ['642'] });
            return { ...DONE, verifyMismatchIds: ['642'] };
        });
        const cache = makeCache();

        await handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache, onRerender: () => {} });

        expect(cache.sync_state['599']['642'].verify_mismatch).toBe(true);
    });

    test('runPLSync throws → promise rejects and leave-page warning is removed', async () => {
        runPLSync.mockRejectedValueOnce(new Error('network'));
        await expect(handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache: makeCache(), onRerender: () => {} })).rejects.toThrow('network');
        await vi.waitFor(() => expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function)));
    });
});

describe('handleSyncStudents — course-wide save queue', () => {
    beforeEach(() => vi.clearAllMocks());

    test('a second save waits for the first save and its Current Score update, showing Queued meanwhile', async () => {
        let finishFirstVerify, finishFirstAvg;
        updateAvgAssignmentForStudents.mockImplementationOnce(() => new Promise(r => { finishFirstAvg = () => r(true); }));
        runPLSync
            .mockImplementationOnce(async ({ onPushed }) => {
                onPushed({ successCount: 1, errors: [], pushedUserIds: ['642'] });
                await new Promise(r => { finishFirstVerify = r; });
                return { success: true, successCount: 1, errors: [], verifyMismatchIds: [], stateHistory: ['VERIFYING'] };
            })
            .mockResolvedValueOnce({ success: true, successCount: 0, errors: [], stateHistory: [] });

        const cache = makeCache();
        cache.students.push({ id: '643', outcomes: [{ outcomeId: '600', plPrediction: 2, canvasScore: 2 }] });
        cache.sync_state['600'] = { '643': { will_post: 3, will_post_lock: 'unlocked' } };

        const first  = handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache, onRerender: () => {} });
        await vi.waitFor(() => expect(runPLSync).toHaveBeenCalledTimes(1));

        const second = handleSyncStudents({ courseId: '566', outcomeId: '600', outcomeName: 'Outcome 3',
            studentIds: ['643'], apiClient: {}, cache, onRerender: () => {} });
        expect(rowSavePhase.get('600_643')).toBe('queued');

        finishFirstVerify();
        await first;                                   // first save's result is available…
        expect(runPLSync).toHaveBeenCalledTimes(1);    // …but the queue waits for its Current Score update
        expect(rowSavePhase.get('600_643')).toBe('queued');

        finishFirstAvg();
        await second;
        expect(runPLSync).toHaveBeenCalledTimes(2);
        expect(runPLSync.mock.calls[1][0].outcomeId).toBe('600');
        expect(rowSavePhase.has('600_643')).toBe(false);
    });
});

describe('runExclusive', () => {
    test('runs jobs one at a time in order; a failed job does not block the next', async () => {
        const order = [];
        let release;
        const a = runExclusive(async () => { order.push('a-start'); await new Promise(r => { release = r; }); order.push('a-end'); });
        const b = runExclusive(async () => { order.push('b'); throw new Error('b failed'); });
        const c = runExclusive(async () => { order.push('c'); return 'c-result'; });

        await vi.waitFor(() => expect(order).toEqual(['a-start']));
        expect(isSaveQueueBusy()).toBe(true);
        release();
        await a;
        await expect(b).rejects.toThrow('b failed');
        await expect(c).resolves.toBe('c-result');
        expect(order).toEqual(['a-start', 'a-end', 'b', 'c']);
        expect(isSaveQueueBusy()).toBe(false);
    });
});

describe('handleSyncStudents — one row phase from click to done', () => {
    beforeEach(() => { vi.clearAllMocks(); rowSavePhase.clear(); });

    test('requested rows go checking → pushing → verifying → cleared; rows with nothing to push clear at resolve', async () => {
        const seen = [];
        let finishVerify;
        runPLSync.mockImplementationOnce(async ({ onStudentsResolved, onProgress, onPushed }) => {
            seen.push(['start', rowSavePhase.get('599_642'), rowSavePhase.get('599_643')]);
            onStudentsResolved(['642']);                          // 643 has nothing to push
            seen.push(['resolved', rowSavePhase.get('599_642'), rowSavePhase.get('599_643')]);
            onPushed({ successCount: 1, errors: [], pushedUserIds: ['642'] });
            onProgress('VERIFYING', 'Outcome 2', 'Verifying…');
            seen.push(['verifying', rowSavePhase.get('599_642'), rowSavePhase.get('599_643')]);
            await new Promise(r => { finishVerify = r; });
            return { success: true, successCount: 1, errors: [], verifyMismatchIds: [], stateHistory: ['VERIFYING'] };
        });
        const cache = makeCache();
        cache.students.push({ id: '643', outcomes: [{ outcomeId: '599', plPrediction: 2, canvasScore: 2 }] });

        const run = handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642', '643'], apiClient: {}, cache, onRerender: () => {} });
        // Marked the moment the save is requested — never idle between click and push
        expect(rowSavePhase.get('599_642')).toBe('checking');
        expect(rowSavePhase.get('599_643')).toBe('checking');

        await vi.waitFor(() => expect(finishVerify).toBeTypeOf('function'));
        expect(seen).toEqual([
            ['start',     'checking',  'checking'],
            ['resolved',  'pushing',   undefined],
            ['verifying', 'verifying', undefined],
        ]);

        finishVerify();
        await run;
        expect(rowSavePhase.size).toBe(0);
    });

    test('a second Save-all while rows are checking has nothing left to send', async () => {
        let release;
        runPLSync.mockImplementationOnce(() => new Promise(r => { release = () => r({ success: true, successCount: 0, errors: [], stateHistory: [] }); }));
        const cache = makeCache();
        const outcome = { id: '599' };

        const run = handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache, onRerender: () => {} });
        expect(getOutcomeSaveSummary(outcome, cache).remainingIds).toEqual([]);

        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        release();
        await run;
    });
});
