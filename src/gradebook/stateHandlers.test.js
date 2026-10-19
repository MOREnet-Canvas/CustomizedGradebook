// src/gradebook/stateHandlers.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/gradeOverride.js', () => ({
    getAllEnrollmentIds: vi.fn(),
    getEnrollmentIdForUser: vi.fn(),
    setOverrideScoreGQL: vi.fn()
}));

import { getAllEnrollmentIds } from '../services/gradeOverride.js';
import { filterRollupsToActiveStudents } from './stateHandlers.js';

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
