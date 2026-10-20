// src/gradebook/stateHandlers.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/gradeOverride.js', () => ({
    getAllEnrollmentIds: vi.fn(),
    getEnrollmentIdForUser: vi.fn(),
    setOverrideScoreGQL: vi.fn()
}));

vi.mock('../masteryOutlook/masteryOutlookCacheService.js', () => ({
    getLockedCurrentScoreStudents: vi.fn()
}));

import { getAllEnrollmentIds } from '../services/gradeOverride.js';
import { getLockedCurrentScoreStudents } from '../masteryOutlook/masteryOutlookCacheService.js';
import { filterRollupsToActiveStudents, removeLockedStudents } from './stateHandlers.js';

const rollupData = {
    rollups: [
        { links: { user: '1' }, scores: [] },
        { links: { user: 2 }, scores: [] },
        { links: { user: '3' }, scores: [] }
    ],
    linked: { outcomes: [{ id: 10, title: 'Outcome' }] }
};

describe('filterRollupsToActiveStudents', () => {
    beforeEach(() => {
        vi.mocked(getAllEnrollmentIds).mockReset();
    });

    test('drops rollups for users without an active enrollment', async () => {
        vi.mocked(getAllEnrollmentIds).mockResolvedValue(new Map([['1', '101'], ['2', '102']]));

        const result = await filterRollupsToActiveStudents(rollupData, '99', {});

        expect(result.rollups.map(r => String(r.links.user))).toEqual(['1', '2']);
        expect(result.linked).toBe(rollupData.linked);
    });

    test('returns rollups unchanged when the enrollment fetch fails', async () => {
        vi.mocked(getAllEnrollmentIds).mockRejectedValue(new Error('network'));

        const result = await filterRollupsToActiveStudents(rollupData, '99', {});

        expect(result).toBe(rollupData);
    });

    test('returns rollups unchanged when no enrollments are returned', async () => {
        vi.mocked(getAllEnrollmentIds).mockResolvedValue(new Map());

        const result = await filterRollupsToActiveStudents(rollupData, '99', {});

        expect(result).toBe(rollupData);
    });
});

describe('removeLockedStudents', () => {
    const averages = [{ userId: 1, average: 2 }, { userId: '2', average: 3 }, { userId: '3', average: 4 }];

    test('drops students with a locked Current Score override', async () => {
        vi.mocked(getLockedCurrentScoreStudents).mockResolvedValue(new Map([['1', { score: 4 }], ['3', { score: 1 }]]));

        const result = await removeLockedStudents(averages, '99', {});

        expect(result.averages.map(a => String(a.userId))).toEqual(['2']);
        expect(result).toMatchObject({ lockedSkipped: 2, lockCheckFailed: false });
    });

    test('no locks → everyone stays', async () => {
        vi.mocked(getLockedCurrentScoreStudents).mockResolvedValue(new Map());

        const result = await removeLockedStudents(averages, '99', {});

        expect(result.averages).toEqual(averages);
        expect(result.lockedSkipped).toBe(0);
    });

    test('a cache read failure warns instead of blocking the update', async () => {
        vi.mocked(getLockedCurrentScoreStudents).mockRejectedValue(new Error('403'));

        const result = await removeLockedStudents(averages, '99', {});

        expect(result).toEqual({ averages, lockedSkipped: 0, lockCheckFailed: true });
    });
});
