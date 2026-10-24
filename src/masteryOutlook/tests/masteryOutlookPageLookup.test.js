// The Mastery Outlook page is found by title, not by slug: after a reset Canvas
// keeps the deleted page's slug reserved and numbers the new one
// (mastery-outlook-3, …). The sidebar link must point at the real slug.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../utils/canvas.js', () => ({
    getCourseId: () => '566',
    getUserRoleGroup: () => 'teacher_like',
}));
vi.mock('../../utils/pageDetection.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isCoursePage: () => true,
}));

const pages = vi.hoisted(() => ({ list: [] }));
vi.mock('../../utils/canvasApiClient.js', () => ({
    CanvasApiClient: class {
        async getAllPages(url) { return url.includes('/pages?search_term=') ? pages.list : []; }
    },
}));

import { findMasteryOutlookPages, findMasteryOutlookPage } from '../../services/pageService.js';
import { checkAndInjectMasteryOutlookLink } from '../sidebarLinkInjection.js';
import { CanvasApiClient } from '../../utils/canvasApiClient.js';

const ROOT = '<div id="teacher-mastery-dashboard-root"></div>';
const p = (url, body = ROOT, extra = {}) => ({ url, title: 'Mastery Outlook', body, ...extra });

beforeEach(() => {
    document.body.innerHTML = '<ul id="section-tabs"><li class="section"><a>Home</a></li></ul>';
    pages.list = [];
});

describe('findMasteryOutlookPages', () => {
    test('page with the Mastery Outlook root first, then newest; ignores other titles and deleted pages', async () => {
        pages.list = [
            p('mastery-outlook-4', '', { created_at: '2026-10-24T01:28:05Z' }),
            p('mastery-outlook-3', ROOT, { created_at: '2026-10-24T01:27:38Z' }),
            p('mastery-outlook-5', ROOT, { created_at: '2026-10-24T01:28:25Z' }),
            p('mastery-outlook-6', ROOT, { workflow_state: 'deleted' }),
            { url: 'mastery-outlook-notes', title: 'Mastery Outlook notes', body: ROOT },
            { url: 'other', title: 'Mastery Outlook', body: ROOT },
        ];
        const found = await findMasteryOutlookPages('566', new CanvasApiClient());
        expect(found.map(x => x.url)).toEqual(['mastery-outlook-5', 'mastery-outlook-3', 'mastery-outlook-4']);
        expect((await findMasteryOutlookPage('566', new CanvasApiClient())).url).toBe('mastery-outlook-5');
    });

    test('none → null', async () => {
        expect(await findMasteryOutlookPage('566', new CanvasApiClient())).toBeNull();
    });
});

describe('sidebar link', () => {
    test('points at the page\'s real (numbered) slug', async () => {
        pages.list = [p('mastery-outlook-5')];
        await checkAndInjectMasteryOutlookLink();
        await vi.waitFor(() => expect(document.getElementById('cg-mastery-outlook-nav-link')).not.toBeNull());
        expect(document.querySelector('#cg-mastery-outlook-nav-link a').getAttribute('href'))
            .toBe('/courses/566/pages/mastery-outlook-5');
    });

    test('no page → no link', async () => {
        await checkAndInjectMasteryOutlookLink();
        await new Promise(r => setTimeout(r, 400));
        expect(document.getElementById('cg-mastery-outlook-nav-link')).toBeNull();
    });
});

describe('Create Mastery Outlook', () => {
    test('a numbered page already exists → no duplicate, link to that page', async () => {
        const { createMasteryOutlook } = await import('../masteryOutlookCreation.js');
        pages.list = [p('mastery-outlook-5')];
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        await createMasteryOutlook(document.createElement('button'));
        expect(alertSpy.mock.calls[0][0]).toMatch(/already exists/);
        await vi.waitFor(() => expect(document.querySelector('#cg-mastery-outlook-nav-link a')).not.toBeNull());
        expect(document.querySelector('#cg-mastery-outlook-nav-link a').getAttribute('href'))
            .toBe('/courses/566/pages/mastery-outlook-5');
    });
});
