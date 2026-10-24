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

const pages = vi.hoisted(() => ({ list: [], puts: [], posts: [] }));
vi.mock('../../utils/canvasApiClient.js', () => ({
    CanvasApiClient: class {
        async getAllPages(url) { return url.includes('/pages?search_term=') ? pages.list : []; }
        async put(url, data) { pages.puts.push({ url, data }); return {}; }
        async post(url, data) { pages.posts.push({ url, data }); return { url: 'mastery-outlook-8' }; }
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
    pages.puts = [];
    pages.posts = [];
    vi.restoreAllMocks();
});

describe('findMasteryOutlookPages', () => {
    test('newest first; ignores other titles and deleted pages', async () => {
        pages.list = [
            p('mastery-outlook-4', '', { created_at: '2026-10-24T01:28:05Z' }),
            p('mastery-outlook-3', ROOT, { created_at: '2026-10-24T01:27:38Z' }),
            p('mastery-outlook-5', ROOT, { created_at: '2026-10-24T01:28:25Z' }),
            p('mastery-outlook-6', ROOT, { workflow_state: 'deleted' }),
            { url: 'mastery-outlook-notes', title: 'Mastery Outlook notes', body: ROOT },
            { url: 'other', title: 'Mastery Outlook', body: ROOT },
        ];
        const found = await findMasteryOutlookPages('566', new CanvasApiClient());
        expect(found.map(x => x.url)).toEqual(['mastery-outlook-5', 'mastery-outlook-4', 'mastery-outlook-3']);
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

describe('sidebar link for a broken page', () => {
    test('newest page has no Mastery Outlook container → no link', async () => {
        pages.list = [p('mastery-outlook-7', '', { created_at: '2026-10-24T01:32:08Z' })];
        await checkAndInjectMasteryOutlookLink();
        await new Promise(r => setTimeout(r, 400));
        expect(document.getElementById('cg-mastery-outlook-nav-link')).toBeNull();
    });
});

describe('Create Mastery Outlook checks before creating', () => {
    async function runCreate() {
        const { createMasteryOutlook } = await import('../masteryOutlookCreation.js');
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        await createMasteryOutlook(document.createElement('button'));
        return alertSpy.mock.calls[0]?.[0] ?? '';
    }
    const linkHref = async () => {
        await vi.waitFor(() => expect(document.querySelector('#cg-mastery-outlook-nav-link a')).not.toBeNull());
        return document.querySelector('#cg-mastery-outlook-nav-link a').getAttribute('href');
    };

    test('empty existing page → repaired (container prepended, content kept), no new page', async () => {
        pages.list = [p('mastery-outlook-7', '<p>notes</p>')];
        expect(await runCreate()).toMatch(/repaired/);
        expect(pages.posts).toHaveLength(0);
        expect(pages.puts).toHaveLength(1);
        expect(pages.puts[0].url).toBe('/api/v1/courses/566/pages/mastery-outlook-7');
        expect(pages.puts[0].data.wiki_page.body).toBe(ROOT + '<p>notes</p>');
        expect(await linkHref()).toBe('/courses/566/pages/mastery-outlook-7');
    });

    test('working page → no write, "ready"', async () => {
        pages.list = [p('mastery-outlook-5')];
        expect(await runCreate()).toMatch(/ready/);
        expect(pages.puts).toHaveLength(0);
        expect(pages.posts).toHaveLength(0);
        expect(await linkHref()).toBe('/courses/566/pages/mastery-outlook-5');
    });

    test('no page → created; Canvas picks the slug', async () => {
        expect(await runCreate()).toMatch(/created/);
        expect(pages.posts).toHaveLength(1);
        expect(pages.posts[0].data.wiki_page.url).toBeUndefined();
        expect(pages.posts[0].data.wiki_page.body).toBe(ROOT);
        expect(await linkHref()).toBe('/courses/566/pages/mastery-outlook-8');
    });
});

describe('isMasteryOutlookPage', () => {
    test('page view only', async () => {
        const { isMasteryOutlookPage } = await vi.importActual('../../utils/pageDetection.js');
        expect(isMasteryOutlookPage('/courses/566/pages/mastery-outlook')).toBe(true);
        expect(isMasteryOutlookPage('/courses/566/pages/mastery-outlook-7')).toBe(true);
        expect(isMasteryOutlookPage('/courses/566/pages/mastery-outlook-7/')).toBe(true);
        expect(isMasteryOutlookPage('/courses/566/pages/mastery-outlook-7/edit')).toBe(false);
        expect(isMasteryOutlookPage('/courses/566/pages/mastery-outlook-7/revisions')).toBe(false);
        expect(isMasteryOutlookPage('/courses/566/pages/mastery-outlook-notes')).toBe(false);
    });
});
