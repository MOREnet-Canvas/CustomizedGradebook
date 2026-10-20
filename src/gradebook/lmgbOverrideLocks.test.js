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

const CS = '603';

function cell(userId, outcomeId, score) {
    return `<td data-col-key="outcome-${outcomeId}"><div data-testid="student-outcome-score-${userId}-${outcomeId}">`
        + `<div data-testid="score-cell-content"><span><span>${score}</span></span></div></div></td>`;
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

describe('lmgbOverrideLocks', () => {
    beforeEach(() => {
        mountGrid();
        mockReadCache.mockReset();
    });
    afterEach(() => stopLmgbOverrideLocks());

    it('marks only the locked student\'s Current Score cell', () => {
        expect(applyLmgbOverrideLocks(locks(), CS)).toBe(1);
        expect(badge('642', CS)).not.toBeNull();
        expect(badge('642', '598')).toBeNull();
        expect(badge('643', CS)).toBeNull();
    });

    it('keeps the badge out of the score text the mastery colors read', () => {
        applyLmgbOverrideLocks(locks(), CS);
        const scoreText = document.querySelector(`[data-testid="student-outcome-score-642-${CS}"] [data-testid="score-cell-content"]`).textContent;
        expect(scoreText.trim()).toBe('3');
    });

    it('is idempotent', () => {
        applyLmgbOverrideLocks(locks(), CS);
        expect(applyLmgbOverrideLocks(locks(), CS)).toBe(0);
        expect(document.querySelectorAll('[data-cg-lmgb-lock]')).toHaveLength(1);
    });

    it('tooltip shows the score, date and note', () => {
        expect(lockTooltip(locks().get('642')))
            .toBe('Current Score override locked in Mastery Outlook · 3.00 · set Oct 20 · Note: IEP');
    });

    it('init reads the cache, marks the grid, and re-marks re-rendered cells; stop removes badges', async () => {
        mockReadCache.mockResolvedValue({
            avg_assignment: { avg_outcome_id: 603 },
            sync_state: { [CS]: { '642': { cs_override_score: 3, cs_override_lock: 'locked' } } },
        });
        expect(await initLmgbOverrideLocks()).toBe(true);
        expect(badge('642', CS)).not.toBeNull();

        // Canvas re-renders the row
        document.querySelector('tr').innerHTML = cell('642', CS, 3);
        await new Promise(r => setTimeout(r, 50));
        expect(badge('642', CS)).not.toBeNull();

        stopLmgbOverrideLocks();
        expect(document.querySelectorAll('[data-cg-lmgb-lock]')).toHaveLength(0);
    });

    it('init does nothing when nothing is locked or there is no cache', async () => {
        mockReadCache.mockResolvedValue({
            avg_assignment: { avg_outcome_id: 603 },
            sync_state: { [CS]: { '642': { cs_override_score: 3, cs_override_lock: 'unlocked' } } },
        });
        expect(await initLmgbOverrideLocks()).toBe(false);
        mockReadCache.mockResolvedValue(null);
        expect(await initLmgbOverrideLocks()).toBe(false);
        expect(document.querySelectorAll('[data-cg-lmgb-lock]')).toHaveLength(0);
    });
});
