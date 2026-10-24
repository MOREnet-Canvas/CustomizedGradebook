// Course reset: only what Mastery Outlook created is listed (verified = recorded
// in the cache AND named by our pattern), Current Score is never included, and
// deletes run children-first with the cache file kept when anything fails.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../masteryOutlookCacheService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    readMasteryOutlookCache:     vi.fn(),
    findMasteryOutlookCacheFile: vi.fn(),
    findMasteryOutlookFolders:   vi.fn(),
}));

import {
    buildResetPlan, executeResetPlan, buildResetBackup, resetItemKey,
    isProjectedScoreAssignmentName, RESET_ITEM_TYPES,
} from '../courseResetService.js';
import {
    readMasteryOutlookCache, findMasteryOutlookCacheFile, findMasteryOutlookFolders,
} from '../masteryOutlookCacheService.js';

const COURSE = '566';

const cacheFixture = () => ({
    metadata: { schemaVersion: '1.0' },
    pl_assignments: {
        598: { assignment_id: '3617', rubric_id: '501' },
        602: { assignment_id: '3627', rubric_id: '505' },
    },
    avg_assignment: { assignment_id: '3573', rubric_id: '900', avg_outcome_id: '603' },
    sync_state: { 603: { 642: { cs_override_score: 3, cs_override_lock: 'locked' } } },
});

const assignment = (id, name, rubric) => ({
    id: Number(id), name,
    rubric_settings: rubric ? { id: Number(rubric.id), title: rubric.title } : undefined,
});

/** Fake CanvasApiClient routed by URL. `fail` = set of URL substrings whose DELETE throws. */
function makeApi({ assignments, page, pages, outcomes, folderContents = {}, fail = new Set() } = {}) {
    const pageList = pages ?? (page ? [page] : []);
    const deletes = [];
    return {
        deletes,
        getAllPages: vi.fn(async (url) => {
            if (url.includes('/assignments?search_term=')) return assignments;
            if (url.includes('/pages?search_term=')) return pageList;
            if (url.includes('/submissions')) {
                return url.includes('/3617/')
                    ? [{ user_id: 643, score: 2.5, grade: '2.5', submission_comments: [{ comment: 'PL', author_name: 'T' }] },
                       { user_id: 646, score: null, grade: null }]
                    : [];
            }
            return [];
        }),
        get: vi.fn(async (url) => {
            if (url.includes('/pages/mastery-outlook')) {
                if (!page) throw new Error('404');
                return page;
            }
            if (url.includes('/outcome_rollups')) return { linked: { outcomes } };
            const m = url.match(/\/folders\/(\d+)\/(folders|files)/);
            if (m) return folderContents[m[1]]?.[m[2]] ?? [];
            return {};
        }),
        delete: vi.fn(async (url) => {
            if ([...fail].some(f => url.includes(f))) throw new Error(`HTTP 500 for ${url}`);
            deletes.push(url);
            return {};
        }),
    };
}

const defaultAssignments = () => [
    assignment('3617', 'Outcome 1 — Projected Score', { id: '501', title: 'Outcome 1 — Projected Score Rubric' }),
    assignment('3627', 'Outcome 5 — Projected Score', { id: '505', title: 'Outcome 5 — Projected Score Rubric' }),
    assignment('9999', 'Outcome 9 — Projected Score', { id: '509', title: 'Outcome 9 — Projected Score Rubric' }),   // not in cache
    assignment('4000', 'Projected Score review worksheet'),                                                          // teacher's own
    assignment('3573', 'Current Score — Projected Score', { id: '900', title: 'Current Score Rubric' }),             // Current Score id
];

const defaultOutcomes = [
    { id: '598', title: 'Outcome 1', calculation_method: 'latest' },
    { id: '599', title: 'Outcome 2', calculation_method: 'decaying_average' },
    { id: '603', title: 'Current Score', calculation_method: 'latest' },
];

function setupDisk({ cache = cacheFixture(), withFile = true } = {}) {
    readMasteryOutlookCache.mockResolvedValue(cache);
    findMasteryOutlookFolders.mockResolvedValue({
        parent:    { id: 10, name: 'MOREnet_CustomizedGradebook' },
        subfolder: { id: 11, name: 'mastery_outlook_cache', parent_folder_id: 10 },
    });
    findMasteryOutlookCacheFile.mockResolvedValue(withFile
        ? { id: 77, display_name: 'mastery_outlook_cache.json', folder_id: 11 } : null);
}

const page = { url: 'mastery-outlook', title: 'Mastery Outlook', body: '<div id="teacher-mastery-dashboard-root"></div>' };

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe('isProjectedScoreAssignmentName', () => {
    test('matches "<Outcome> — Projected Score" only', () => {
        expect(isProjectedScoreAssignmentName('Outcome 1 — Projected Score')).toBe(true);
        expect(isProjectedScoreAssignmentName('Projected Score review')).toBe(false);
        expect(isProjectedScoreAssignmentName('Outcome 1 - Projected Score')).toBe(false);   // hyphen, not em dash
        expect(isProjectedScoreAssignmentName('Current Score Assignment')).toBe(false);
    });
});

describe('buildResetPlan', () => {
    test('cache + name → verified; name only → unverified; look-alikes and Current Score excluded', async () => {
        setupDisk();
        const api = makeApi({ assignments: defaultAssignments(), page, outcomes: defaultOutcomes });
        const plan = await buildResetPlan(COURSE, api);

        const asg = plan.items.filter(i => i.type === RESET_ITEM_TYPES.ASSIGNMENT);
        expect(asg.map(i => [i.id, i.verified])).toEqual([['3617', true], ['3627', true], ['9999', false]]);
        expect(plan.items.some(i => i.id === '3573' || i.id === '4000')).toBe(false);
        expect(asg[0].rubric).toEqual({ id: '501', title: 'Outcome 1 — Projected Score Rubric' });
        expect(asg[0].gradeCount).toBe(1);
        expect(api.delete).not.toHaveBeenCalled();
    });

    test('lists the page, data file, and both folders', async () => {
        setupDisk();
        const plan = await buildResetPlan(COURSE, makeApi({ assignments: [], page, outcomes: [] }));
        expect(plan.items.map(i => [i.type, i.verified])).toEqual([
            [RESET_ITEM_TYPES.PAGE, true],
            [RESET_ITEM_TYPES.CACHE_FILE, true],
            [RESET_ITEM_TYPES.SUBFOLDER, true],
            [RESET_ITEM_TYPES.PARENT, true],
        ]);
    });

    test('lists every Mastery Outlook page (numbered copies); an empty copy is unverified', async () => {
        setupDisk();
        const plan = await buildResetPlan(COURSE, makeApi({ assignments: [], outcomes: [], pages: [
            { url: 'mastery-outlook-4', title: 'Mastery Outlook', body: '', created_at: '2026-10-24T01:28:05Z' },
            { url: 'mastery-outlook-5', title: 'Mastery Outlook', body: page.body, created_at: '2026-10-24T01:28:25Z' },
            { url: 'mastery-outlook-notes', title: 'Mastery Outlook notes', body: page.body },
        ] }));
        const pages = plan.items.filter(i => i.type === RESET_ITEM_TYPES.PAGE);
        expect(pages.map(p => [p.id, p.verified])).toEqual([['mastery-outlook-5', true], ['mastery-outlook-4', false]]);
    });

    test('a page whose content was replaced is unverified', async () => {
        setupDisk();
        const plan = await buildResetPlan(COURSE, makeApi({
            assignments: [], outcomes: [], page: { ...page, body: '<p>teacher notes</p>' },
        }));
        expect(plan.items.find(i => i.type === RESET_ITEM_TYPES.PAGE).verified).toBe(false);
    });

    test('warns about "latest" outcomes (not Current Score) and locked overrides', async () => {
        setupDisk();
        const plan = await buildResetPlan(COURSE, makeApi({ assignments: [], page: null, outcomes: defaultOutcomes }));
        expect(plan.latestOutcomeTitles).toEqual(['Outcome 1']);
        expect(plan.lockedOverrideCount).toBe(1);
        expect(plan.warnings.join(' ')).toMatch(/Most Recent Score/);
        expect(plan.warnings.join(' ')).toMatch(/1 locked Current Score override will become unlocked/);
    });

    test('no cache → nothing verified, with a warning', async () => {
        setupDisk({ cache: null, withFile: false });
        const plan = await buildResetPlan(COURSE, makeApi({ assignments: defaultAssignments(), page, outcomes: [] }));
        expect(plan.items.filter(i => i.type === RESET_ITEM_TYPES.ASSIGNMENT).every(i => !i.verified)).toBe(true);
        expect(plan.warnings[0]).toMatch(/No Mastery Outlook data file/);
    });
});

describe('executeResetPlan', () => {
    async function planWith(apiOpts) {
        setupDisk();
        const api = makeApi({ assignments: defaultAssignments(), page, outcomes: [], ...apiOpts });
        const plan = await buildResetPlan(COURSE, api);
        const verifiedKeys = plan.items.filter(i => i.verified).map(resetItemKey);
        return { api, plan, verifiedKeys };
    }

    test('deletes children first: assignment → its rubric → page → data file → folders', async () => {
        const { api, plan, verifiedKeys } = await planWith();
        localStorage.setItem(`cg_lmgb_locks_${COURSE}`, '{}');
        localStorage.setItem(`cg_rubric_assoc_${COURSE}_3617`, '42');

        const result = await executeResetPlan(plan, verifiedKeys, api);

        expect(api.deletes).toEqual([
            '/api/v1/courses/566/assignments/3617',
            '/api/v1/courses/566/rubrics/501',
            '/api/v1/courses/566/assignments/3627',
            '/api/v1/courses/566/rubrics/505',
            '/api/v1/courses/566/pages/mastery-outlook',
            '/api/v1/files/77',
            '/api/v1/folders/11',
            '/api/v1/folders/10',
        ]);
        expect(result.failed).toEqual([]);
        expect(localStorage.getItem(`cg_lmgb_locks_${COURSE}`)).toBeNull();
        expect(localStorage.getItem(`cg_rubric_assoc_${COURSE}_3617`)).toBeNull();
    });

    test('unselected items are left alone', async () => {
        const { api, plan } = await planWith();
        await executeResetPlan(plan, [`${RESET_ITEM_TYPES.ASSIGNMENT}:3617`], api);
        expect(api.deletes).toEqual(['/api/v1/courses/566/assignments/3617', '/api/v1/courses/566/rubrics/501']);
    });

    test('a failed delete keeps that rubric and the data file + folders so the reset can run again', async () => {
        const { api, plan, verifiedKeys } = await planWith({ fail: new Set(['/assignments/3627']) });
        const result = await executeResetPlan(plan, verifiedKeys, api);

        expect(api.deletes).not.toContain('/api/v1/courses/566/rubrics/505');
        expect(api.deletes).not.toContain('/api/v1/files/77');
        expect(api.deletes.some(u => u.includes('/folders/'))).toBe(false);
        expect(result.failed.map(f => f.item.id)).toEqual(['3627']);
        expect(result.kept.map(k => k.item.id)).toEqual(['505', '77', '11', '10']);
    });

    test('the shared parent folder is kept when something else is in it', async () => {
        const { api, plan, verifiedKeys } = await planWith({
            folderContents: { 10: { folders: [{ id: 12, name: 'district_config' }] } },
        });
        const result = await executeResetPlan(plan, verifiedKeys, api);

        expect(api.deletes).toContain('/api/v1/folders/11');
        expect(api.deletes).not.toContain('/api/v1/folders/10');
        expect(result.kept.map(k => k.item.id)).toEqual(['10']);
    });

    test('never deletes the Current Score assignment or rubric', async () => {
        const { api, plan } = await planWith();
        await executeResetPlan(plan, plan.items.map(resetItemKey), api);   // everything, unverified too
        expect(api.deletes.some(u => u.endsWith('/assignments/3573') || u.endsWith('/rubrics/900'))).toBe(false);
    });
});

describe('buildResetBackup', () => {
    test('includes the cache and every saved grade with comments', async () => {
        setupDisk();
        const plan = await buildResetPlan(COURSE, makeApi({ assignments: defaultAssignments(), page, outcomes: [] }));
        const backup = buildResetBackup(plan);
        expect(backup.cache.pl_assignments['598'].assignment_id).toBe('3617');
        expect(backup.submissions['3617'][0]).toMatchObject({ user_id: 643, score: 2.5, comments: [{ comment: 'PL', author: 'T' }] });
    });
});
