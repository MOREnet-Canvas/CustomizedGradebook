// src/services/masteryRefreshService.test.js
// The points toggle keeps the caller's grading scheme — Projected Score
// assignments pass their own (PL) scheme; gradebook callers keep the default.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    window.CG_CONFIG = { ...(window.CG_CONFIG || {}), DEFAULT_GRADING_SCHEME_ID: 11, DEFAULT_GRADING_TYPE: 'points' };
});

vi.mock('../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const put = vi.fn(async () => ({}));
vi.mock('../utils/canvasApiClient.js', () => ({
    CanvasApiClient: class {
        get() { return Promise.resolve({ rubric: [{ ratings: [{ points: 4 }, { points: 1 }] }] }); }
        put(...args) { return put(...args); }
    },
}));

import { refreshMasteryForAssignment } from './masteryRefreshService.js';

const bodies = () => put.mock.calls.map(c => c[1].assignment);

describe('refreshMasteryForAssignment grading options', () => {
    beforeEach(() => put.mockClear());

    test('defaults: gradebook scheme and type', async () => {
        await refreshMasteryForAssignment('566', '1', { delay: 0 });
        expect(bodies()).toEqual([
            { points_possible: 4, grading_standard_id: 11, grading_type: 'points' },
            { points_possible: 0, grading_standard_id: 11, grading_type: 'points' },
        ]);
    });

    test('overrides reach both PUTs', async () => {
        await refreshMasteryForAssignment('566', '2', { delay: 0, gradingStandardId: 22, gradingType: 'gpa_scale' });
        expect(bodies()).toEqual([
            { points_possible: 4, grading_standard_id: 22, grading_type: 'gpa_scale' },
            { points_possible: 0, grading_standard_id: 22, grading_type: 'gpa_scale' },
        ]);
    });

    test('gradingStandardId null → scheme left untouched', async () => {
        await refreshMasteryForAssignment('566', '3', { delay: 0, gradingStandardId: null, gradingType: 'gpa_scale' });
        expect(bodies()).toEqual([{ points_possible: 4 }, { points_possible: 0 }]);
    });
});
