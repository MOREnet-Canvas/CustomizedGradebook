// Mastery View setup: "the" page is the newest one titled Mastery View (or the
// legacy Mastery Dashboard). Create repairs or re-links it instead of refusing
// or duplicating; Delete removes every copy plus the front page button.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../utils/canvas.js', () => ({ getCourseId: () => '566' }));
vi.mock('../../ui/brandColors.js', () => ({ brandButtonPrimaryBg: () => '#123', brandButtonPrimaryText: () => '#fff' }));

const canvas = vi.hoisted(() => ({ pages: [], frontPage: null, puts: [], posts: [], deletes: [] }));
vi.mock('../../utils/canvasApiClient.js', () => ({
    CanvasApiClient: class {
        async getAllPages(url) {
            const term = decodeURIComponent(url.match(/search_term=([^&]+)/)?.[1] ?? '');
            return canvas.pages.filter(p => p.title.includes(term));
        }
        async get(url) {
            if (url.endsWith('/front_page')) {
                if (!canvas.frontPage) throw new Error('404');
                return canvas.frontPage;
            }
            return {};
        }
        async put(url, data) { canvas.puts.push({ url, data }); return {}; }
        async post(url, data) { canvas.posts.push({ url, data }); return { url: 'mastery-dashboard-4' }; }
        async delete(url) { canvas.deletes.push(url); return {}; }
    },
}));

import { findMasteryViewPages, findMasteryDashboardPageUrl } from '../../services/pageService.js';
import { createMasteryDashboard, deleteMasteryDashboard } from '../buttonInjection.js';
import { CanvasApiClient } from '../../utils/canvasApiClient.js';

const ROOT = '<div id="mastery-dashboard-root" data-outcome-order="598,599"></div>';
const page = (url, body = ROOT, extra = {}) => ({ url, title: 'Mastery View', body, ...extra });
const BUTTON = (url) => `<div data-cg-mastery-button="true" data-page-url="${url}" style="margin: 16px 0;">\n    <a href="x">View Mastery View</a>\n    \n</div>`;

const pagePuts = () => canvas.puts.filter(p => p.url.includes('/pages/') && !p.url.endsWith('/home'));
const frontPut = () => canvas.puts.find(p => p.url.endsWith('/pages/home'));

beforeEach(() => {
    canvas.pages = [];
    canvas.frontPage = { url: 'home', body: '<p>Welcome</p>', published: true };
    canvas.puts = [];
    canvas.posts = [];
    canvas.deletes = [];
    vi.restoreAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
});

describe('findMasteryViewPages', () => {
    test('newest first across both titles; ignores deleted, other slugs, other titles', async () => {
        canvas.pages = [
            page('mastery-dashboard-2', ROOT, { created_at: '2026-10-01T00:00:00Z' }),
            { ...page('mastery-dashboard', ROOT, { created_at: '2026-09-01T00:00:00Z' }), title: 'Mastery Dashboard' },
            page('mastery-dashboard-3', '', { created_at: '2026-10-20T00:00:00Z' }),
            page('mastery-dashboard-5', ROOT, { workflow_state: 'deleted' }),
            page('my-mastery-view', ROOT),
            { url: 'mastery-dashboard-notes', title: 'Mastery View notes', body: ROOT },
        ];
        const found = await findMasteryViewPages('566', new CanvasApiClient());
        expect(found.map(p => p.url)).toEqual(['mastery-dashboard-3', 'mastery-dashboard-2', 'mastery-dashboard']);
        expect(await findMasteryDashboardPageUrl('566', new CanvasApiClient())).toBe('mastery-dashboard-3');
    });
});

// LEGACY — "Mastery Dashboard" title, see #108. Remove with the legacy match.
describe('legacy "Mastery Dashboard" title guard', () => {
    const teacherPage = { url: 'mastery-dashboard', title: 'Mastery Dashboard', body: '<p>My own notes</p>', created_at: '2026-10-22T00:00:00Z' };

    test('a teacher\'s own "Mastery Dashboard" page is not Mastery View', async () => {
        canvas.pages = [teacherPage];
        expect(await findMasteryViewPages('566', new CanvasApiClient())).toEqual([]);
    });

    test('a legacy Mastery View page (has the root) is still found', async () => {
        canvas.pages = [{ ...teacherPage, body: ROOT }];
        expect((await findMasteryViewPages('566', new CanvasApiClient())).map(p => p.url)).toEqual(['mastery-dashboard']);
    });

    test('Create leaves the teacher\'s page alone and makes a new Mastery View page', async () => {
        canvas.pages = [teacherPage];
        await createMasteryDashboard(document.createElement('button'));
        expect(canvas.puts.some(p => p.url.endsWith('/pages/mastery-dashboard'))).toBe(false);
        expect(canvas.posts.find(p => p.url === '/api/v1/courses/566/pages').data.wiki_page.title).toBe('Mastery View');
    });

    test('Delete leaves the teacher\'s page alone', async () => {
        canvas.pages = [teacherPage, page('mastery-dashboard-2')];
        await deleteMasteryDashboard(document.createElement('a'));
        expect(canvas.deletes).toEqual(['/api/v1/courses/566/pages/mastery-dashboard-2']);
    });
});

describe('Create Mastery View checks before creating', () => {
    test('empty existing page → repaired (container prepended, content kept), button points to it, no new page', async () => {
        canvas.pages = [page('mastery-dashboard-3', '<p>hello</p>')];
        await createMasteryDashboard(document.createElement('button'));

        expect(canvas.posts).toHaveLength(0);
        const repair = canvas.puts.find(p => p.url === '/api/v1/courses/566/pages/mastery-dashboard-3');
        expect(repair.data.wiki_page.body).toBe('<div id="mastery-dashboard-root"></div><p>hello</p>');
        expect(frontPut().data.wiki_page.body).toContain('data-page-url="mastery-dashboard-3"');
        expect(frontPut().data.wiki_page.body).toContain('<p>Welcome</p>');
        expect(window.alert.mock.calls[0][0]).toMatch(/repaired/);
    });

    test('working page → no page write; old button re-pointed; "ready"', async () => {
        canvas.pages = [page('mastery-dashboard-2')];
        canvas.frontPage.body = BUTTON('mastery-dashboard') + '\n<p>Welcome</p>';
        await createMasteryDashboard(document.createElement('button'));

        expect(canvas.posts).toHaveLength(0);
        expect(canvas.puts.some(p => p.url === '/api/v1/courses/566/pages/mastery-dashboard-2')).toBe(false);
        const body = frontPut().data.wiki_page.body;
        expect(body).toContain('data-page-url="mastery-dashboard-2"');
        expect(body).not.toContain('data-page-url="mastery-dashboard"');
        expect(body.match(/data-cg-mastery-button/g)).toHaveLength(1);
        expect(window.alert.mock.calls[0][0]).toMatch(/ready/);
    });

    test('no page → created without a forced slug; button uses the slug Canvas picked', async () => {
        await createMasteryDashboard(document.createElement('button'));
        const created = canvas.posts.find(p => p.url === '/api/v1/courses/566/pages');
        expect(created.data.wiki_page.url).toBeUndefined();
        expect(created.data.wiki_page.body).toBe('<div id="mastery-dashboard-root"></div>');
        expect(frontPut().data.wiki_page.body).toContain('data-page-url="mastery-dashboard-4"');
        expect(window.alert.mock.calls[0][0]).toMatch(/setup complete/);
    });

    test('no front page → a Home front page is created with the button', async () => {
        canvas.frontPage = null;
        canvas.pages = [page('mastery-dashboard-2')];
        await createMasteryDashboard(document.createElement('button'));
        const home = canvas.posts.find(p => p.data.wiki_page.front_page);
        expect(home.data.wiki_page.body).toContain('data-page-url="mastery-dashboard-2"');
    });
});

describe('Delete Mastery View setup', () => {
    test('deletes every Mastery View page plus a different button page, and removes the button', async () => {
        canvas.pages = [page('mastery-dashboard-2'), page('mastery-dashboard-3', '')];
        canvas.frontPage.body = BUTTON('mastery-dashboard') + '\n<p>Welcome</p>';
        const link = document.createElement('a');
        await deleteMasteryDashboard(link);

        expect(canvas.deletes.sort()).toEqual([
            '/api/v1/courses/566/pages/mastery-dashboard',
            '/api/v1/courses/566/pages/mastery-dashboard-2',
            '/api/v1/courses/566/pages/mastery-dashboard-3',
        ]);
        expect(frontPut().data.wiki_page.body).toBe('<p>Welcome</p>');
    });
});
