// src/admin/loaderGenerator.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { buildCGManagedBlock } from './loaderGenerator.js';
import { CG_LOADER_TEMPLATE } from './templates/cgLoaderTemplate.js';

describe('buildCGManagedBlock — pilotCourseIds', () => {
    test('emits pilotCourseIds inside CG_MANAGED.release when provided', () => {
        const block = buildCGManagedBlock({ accountId: '1', channel: 'prod', version: 'v1.3.8', pilotCourseIds: ['566', 777] });
        expect(block).toContain('pilotCourseIds: ["566","777"]');

        const sandbox = { window: {} };
        new Function('window', block)(sandbox.window);
        expect(sandbox.window.CG_MANAGED.release.pilotCourseIds).toEqual(['566', '777']);
        expect(sandbox.window.CG_MANAGED.release.channel).toBe('prod');
    });

    test('omits pilotCourseIds when empty', () => {
        const block = buildCGManagedBlock({ accountId: '1', channel: 'prod', version: 'v1.3.8' });
        expect(block).not.toContain('pilotCourseIds');
    });
});

describe('CG loader template — pilot course routing', () => {
    const PILOT = '566';

    /** Run the Section C loader and return the injected bundle <script> src */
    function runLoader({ path, roles, isAdmin = false, channel = 'prod' }) {
        document.head.innerHTML = '';
        window.history.pushState({}, '', path);
        window.CG_CONFIG = undefined;
        window.CG_MANAGED = {
            release: { channel, version: 'v1.3.8', source: 'github_release', pilotCourseIds: [PILOT] },
            config: {},
        };
        window.ENV = { current_user_roles: roles, current_user_is_admin: isAdmin };
        new Function(CG_LOADER_TEMPLATE)();
        return document.head.querySelector('script')?.src ?? null;
    }

    beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

    test('teacher in a pilot course → pilot build', () => {
        const src = runLoader({ path: `/courses/${PILOT}/pages/mastery-outlook`, roles: ['user', 'teacher'] });
        expect(src).toContain('/releases/download/pilot/customGradebookInit.js');
        expect(document.getElementById('cg_pilot_bundle')).not.toBeNull();
    });

    test('admin in a pilot course → pilot build', () => {
        const src = runLoader({ path: `/courses/${PILOT}`, roles: ['user'], isAdmin: true });
        expect(src).toContain('/download/pilot/');
    });

    test('student in a pilot course → prod', () => {
        const src = runLoader({ path: `/courses/${PILOT}/pages/mastery-view`, roles: ['user', 'student'] });
        expect(src).toContain('/download/v1.3.8/');
    });

    test('observer in a pilot course → prod', () => {
        const src = runLoader({ path: `/courses/${PILOT}/grades`, roles: ['user', 'observer'] });
        expect(src).toContain('/download/v1.3.8/');
    });

    test('teacher in a non-pilot course → prod', () => {
        const src = runLoader({ path: '/courses/999/pages/mastery-outlook', roles: ['user', 'teacher'] });
        expect(src).toContain('/download/v1.3.8/');
    });

    test('teacher on a non-course page → prod', () => {
        const src = runLoader({ path: '/', roles: ['user', 'teacher'] });
        expect(src).toContain('/download/v1.3.8/');
    });

    test('dev-channel loader ignores the pilot list', () => {
        const src = runLoader({ path: `/courses/${PILOT}`, roles: ['user', 'teacher'], channel: 'dev' });
        expect(src).toContain('/releases/download/dev/');
    });
});
