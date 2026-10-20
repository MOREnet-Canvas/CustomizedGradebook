// src/gradebook/lmgbOverrideLocks.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockReadCache } = vi.hoisted(() => ({ mockReadCache: vi.fn() }));

vi.mock('../utils/canvasApiClient.js', () => ({ CanvasApiClient: class {} }));
vi.mock('../utils/canvas.js', () => ({ getCourseId: () => '566' }));
vi.mock('../masteryOutlook/masteryOutlookCacheService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    readMasteryOutlookCache: mockReadCache,
}));

import {
    initLmgbOverrideLocks, stopLmgbOverrideLocks, applyLmgbOverrideLocks, lockTooltip,
} from './lmgbOverrideLocks.js';
import { saveLmgbLockSnapshot, loadLmgbLockSnapshot } from '../masteryOutlook/masteryOutlookCacheService.js';

const CS = '603';

// Canvas's LMGB cell: score-cell-content > span(flex) > span(pill) > span(flex row) > span(text)
function cell(userId, outcomeId, score) {
    return `<td data-col-key="outcome-${outcomeId}"><div data-testid="student-outcome-score-${userId}-${outcomeId}">`
        + `<div data-testid="score-cell-content"><span><span class="pill"><span class="row"><span class="txt">${score}</span></span></span></span></div>`
        + `</div></td>`;
}

function mountGrid() {
    document.body.innerHTML = `<div id="learning_mastery_gradebook"><table>
        <tr>${cell('642', CS, 3)}${cell('642', '598', 2)}</tr>
        <tr>${cell('643', CS, 2)}</tr>
    </table></div>`;
}

const badge = (userId, outcomeId) =>
    document.querySelector(`[data-testid="student-outcome-score-${userId}-${outcomeId}"] [data-cg-lmgb-lock]`);

const locks = () => new Map([['642', { score: 3, note: 'IEP', at: '2026-10-20T15:00:00Z' }]]);

const lockedCache = (lock = 'locked') => ({
    avg_assignment: { avg_outcome_id: 603 },
    sync_state: { [CS]: { '642': { cs_override_score: 3, cs_override_lock: lock } } },
});

function deferred() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
}

describe('lmgbOverrideLocks', () => {
    beforeEach(() => {
        mountGrid();
        localStorage.clear();
        mockReadCache.mockReset();
    });
    afterEach(() => stopLmgbOverrideLocks());

    it('marks only the locked student\'s Current Score cell', () => {
        expect(applyLmgbOverrideLocks(locks(), CS)).toBe(1);
        expect(badge('642', CS)).not.toBeNull();
        expect(badge('642', '598')).toBeNull();
        expect(badge('643', CS)).toBeNull();
    });

    it('puts the 🔒 right after the number inside the pill', () => {
        applyLmgbOverrideLocks(locks(), CS);
        const b = badge('642', CS);
        expect(b.previousElementSibling.className).toBe('txt');
        expect(b.parentElement.className).toBe('row');
    });

    it('is idempotent and removes badges that are no longer locked', () => {
        applyLmgbOverrideLocks(locks(), CS);
        expect(applyLmgbOverrideLocks(locks(), CS)).toBe(0);
        expect(document.querySelectorAll('[data-cg-lmgb-lock]')).toHaveLength(1);
        applyLmgbOverrideLocks(new Map(), CS);
        expect(document.querySelectorAll('[data-cg-lmgb-lock]')).toHaveLength(0);
    });

    it('tooltip shows the score, date and note', () => {
        expect(lockTooltip(locks().get('642')))
            .toBe('Current Score override locked in Mastery Outlook · 3.00 · set Oct 20 · Note: IEP');
    });

    it('shows the localStorage snapshot before the cache file arrives', async () => {
        saveLmgbLockSnapshot('566', lockedCache());
        const read = deferred();
        mockReadCache.mockReturnValue(read.promise);

        const running = initLmgbOverrideLocks();
        expect(badge('642', CS)).not.toBeNull();          // before the cache resolves

        read.resolve(lockedCache('unlocked'));            // unlocked since the snapshot
        expect(await running).toBe(false);
        expect(badge('642', CS)).toBeNull();
        expect(loadLmgbLockSnapshot('566')).toBeNull();
    });

    it('init reads the cache, saves the snapshot, re-marks re-rendered cells; stop removes badges', async () => {
        mockReadCache.mockResolvedValue(lockedCache());
        expect(await initLmgbOverrideLocks()).toBe(true);
        expect(badge('642', CS)).not.toBeNull();
        expect([...loadLmgbLockSnapshot('566').locks.keys()]).toEqual(['642']);

        // Canvas re-renders the row
        document.querySelector('tr').innerHTML = cell('642', CS, 3);
        await new Promise(r => setTimeout(r, 50));
        expect(badge('642', CS)).not.toBeNull();

        stopLmgbOverrideLocks();
        expect(document.querySelectorAll('[data-cg-lmgb-lock]')).toHaveLength(0);
    });

    it('a failed cache read keeps the snapshot markers', async () => {
        saveLmgbLockSnapshot('566', lockedCache());
        mockReadCache.mockResolvedValue(null);
        expect(await initLmgbOverrideLocks()).toBe(true);
        expect(badge('642', CS)).not.toBeNull();
    });

    it('init does nothing when nothing is locked', async () => {
        mockReadCache.mockResolvedValue(lockedCache('unlocked'));
        expect(await initLmgbOverrideLocks()).toBe(false);
        expect(document.querySelectorAll('[data-cg-lmgb-lock]')).toHaveLength(0);
    });
});
