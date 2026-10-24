// Reset dialog: verified items start checked, unverified unchecked, and the
// reset button stays disabled until RESET is typed and something is selected.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../courseResetService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildResetPlan:      vi.fn(),
        downloadResetBackup: vi.fn(() => 'backup.json'),
        executeResetPlan:    vi.fn(async () => ({ deleted: [], failed: [], kept: [] })),
    };
});

import { openCourseResetDialog } from '../courseResetView.js';
import { buildResetPlan, downloadResetBackup, executeResetPlan } from '../courseResetService.js';

const plan = {
    courseId: '566',
    items: [
        { type: 'assignment', id: '3617', name: 'Outcome 1 — Projected Score', verified: true, gradeCount: 4, rubric: null },
        { type: 'assignment', id: '9999', name: 'Outcome 9 — Projected Score', verified: false, gradeCount: 0, rubric: null, note: 'Not recorded' },
    ],
    warnings: ['Every outcome below is set to the "Most Recent Score" calculation.'],
    latestOutcomeTitles: ['Outcome 1'],
};

const flush = () => new Promise(r => setTimeout(r, 0));

describe('reset dialog', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
        buildResetPlan.mockResolvedValue(plan);
    });

    test('preview, confirm gate, then backup before delete', async () => {
        const overlay = openCourseResetDialog({ courseId: '566', apiClient: {} });
        await flush();

        const boxes = [...overlay.querySelectorAll('[data-key]')];
        expect(boxes.map(b => b.checked)).toEqual([true, false]);
        expect(overlay.textContent).toMatch(/Most Recent Score/);

        const btn = overlay.querySelector('[data-action="reset"]');
        const input = overlay.querySelector('[data-role="confirm"]');
        expect(btn.disabled).toBe(true);

        input.value = 'reset';                       // wrong case
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(btn.disabled).toBe(true);

        input.value = 'RESET';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(btn.disabled).toBe(false);

        boxes[0].checked = false;                    // nothing selected
        boxes[0].dispatchEvent(new Event('change', { bubbles: true }));
        expect(btn.disabled).toBe(true);
        boxes[0].checked = true;
        boxes[0].dispatchEvent(new Event('change', { bubbles: true }));

        btn.click();
        await flush();
        expect(downloadResetBackup).toHaveBeenCalledWith(plan);
        expect(executeResetPlan).toHaveBeenCalledWith(plan, ['assignment:3617'], {}, expect.any(Function));
        expect(downloadResetBackup.mock.invocationCallOrder[0]).toBeLessThan(executeResetPlan.mock.invocationCallOrder[0]);
        expect(overlay.textContent).toMatch(/Mastery Outlook was reset/);
    });
});
