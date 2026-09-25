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

    test('push done, verify still running → Current Score update + in-memory mirror already happened', async () => {
        let finishVerify;
        runPLSync.mockImplementation(async ({ onPushed }) => {
            onPushed({ successCount: 1, errors: [], pushedUserIds: ['642'] });
            await new Promise(r => { finishVerify = r; });   // verification "hangs"
            return { success: true, successCount: 1, errors: [], verifyMismatchIds: [], stateHistory: ['SYNCING', 'VERIFYING', 'COMPLETE'] };
        });
        const cache = makeCache();

        const run = handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache, onRerender: () => {} });
        await Promise.resolve();

        // Current Score update started with the pushed score, not waiting on Canvas
        expect(updateAvgAssignmentForStudents).toHaveBeenCalledWith(expect.objectContaining({
            outcomeId: '599', pushedScores: { '642': 2 }, notes: { '642': 'retest' },
        }));
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

        finishVerify();
        await run;

        expect(entry.last_verify_at).toBeTruthy();
        expect(entry.verify_mismatch).toBe(false);
        expect(writeMasteryOutlookCache).toHaveBeenCalledTimes(1);
        expect(updateAvgAssignmentForStudents).toHaveBeenCalledTimes(1);   // not repeated after verify
        expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    test('verify mismatch is mirrored into memory', async () => {
        runPLSync.mockImplementation(async ({ onPushed }) => {
            onPushed({ successCount: 1, errors: [], pushedUserIds: ['642'] });
            return { success: true, successCount: 1, errors: [], verifyMismatchIds: ['642'], stateHistory: ['SYNCING', 'VERIFYING', 'COMPLETE'] };
        });
        const cache = makeCache();

        await handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache, onRerender: () => {} });

        expect(cache.sync_state['599']['642'].verify_mismatch).toBe(true);
    });

    test('runPLSync throws → leave-page warning removed', async () => {
        runPLSync.mockRejectedValue(new Error('network'));
        await expect(handleSyncStudents({ courseId: '566', outcomeId: '599', outcomeName: 'Outcome 2',
            studentIds: ['642'], apiClient: {}, cache: makeCache(), onRerender: () => {} })).rejects.toThrow('network');
        expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });
});
