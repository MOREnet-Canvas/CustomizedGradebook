// src/masteryOutlook/tests/searchFilters.test.js
// Canvas search filters must be in the request URL — CanvasApiClient's second
// argument is fetch options, so filters passed there are silently dropped.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../../config.js', () => ({ PL_ASSIGNMENT_SUFFIX: 'Projected Score' }));

import { findExistingPLAssignment } from '../plOutlookSetup.js';
import { findMasteryDashboardPageUrl } from '../../services/pageService.js';

describe('search filters are sent in the URL', () => {
    test('findExistingPLAssignment searches assignments by the PL suffix', async () => {
        const apiClient = {
            getAllPages: vi.fn(async () => [{ id: 7, name: 'Outcome 1 — Projected Score' }]),
        };
        const found = await findExistingPLAssignment('566', 'Outcome 1', apiClient);

        const [url, options] = apiClient.getAllPages.mock.calls[0];
        expect(url).toBe('/api/v1/courses/566/assignments?search_term=Projected%20Score&per_page=50');
        expect(options).toEqual({});
        expect(found).toMatchObject({ id: 7 });
    });

    test('findMasteryDashboardPageUrl searches pages by title', async () => {
        const apiClient = {
            getAllPages: vi.fn(async () => [{ title: 'Mastery View', url: 'mastery-dashboard', workflow_state: 'active' }]),
        };
        expect(await findMasteryDashboardPageUrl('566', apiClient)).toBe('mastery-dashboard');

        const [url, options] = apiClient.getAllPages.mock.calls[0];
        expect(url).toBe('/api/v1/courses/566/pages?search_term=Mastery%20View&include[]=body&per_page=50');
        expect(options).toEqual({});
        expect(apiClient.getAllPages.mock.calls[1][0]).toContain('search_term=Mastery%20Dashboard');
    });
});
