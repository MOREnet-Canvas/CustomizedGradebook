// Mastery Outlook waits for its root container: the bundle can run before
// Canvas renders the wiki page body, so a one-shot lookup sometimes missed it.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../masteryOutlookView.js', () => ({ renderMasteryOutlook: vi.fn() }));
vi.mock('../../utils/canvas.js', () => ({
    getUserRoleGroup: () => 'teacher_like',
    getCourseId: () => '566',
}));
vi.mock('../../utils/pageDetection.js', () => ({ isMasteryOutlookPage: () => true }));
vi.mock('../masteryOutlookCreation.js', () => ({
    injectMasteryOutlookButton: vi.fn(),
    OUTLOOK_ROOT_ID: 'teacher-mastery-dashboard-root',
}));
vi.mock('../sidebarLinkInjection.js', () => ({ checkAndInjectMasteryOutlookLink: vi.fn() }));
vi.mock('../../utils/canvasApiClient.js', () => ({ CanvasApiClient: class {} }));

import { renderMasteryOutlook } from '../masteryOutlookView.js';
import { initMasteryOutlookView } from '../masteryOutlookInit.js';
import { logger } from '../../utils/logger.js';

const addRoot = () => {
    const el = document.createElement('div');
    el.id = 'teacher-mastery-dashboard-root';
    document.body.appendChild(el);
    return el;
};

describe('initMasteryOutlookView waits for the root container', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.mocked(renderMasteryOutlook).mockClear();
    });
    afterEach(() => vi.useRealTimers());

    test('container already present → renders', async () => {
        const el = addRoot();
        await initMasteryOutlookView();
        expect(renderMasteryOutlook).toHaveBeenCalledTimes(1);
        expect(vi.mocked(renderMasteryOutlook).mock.calls[0][0].containerEl).toBe(el);
    });

    test('container added after init → renders once it appears', async () => {
        const pending = initMasteryOutlookView();
        expect(renderMasteryOutlook).not.toHaveBeenCalled();
        const el = addRoot();
        await pending;
        expect(renderMasteryOutlook).toHaveBeenCalledTimes(1);
        expect(vi.mocked(renderMasteryOutlook).mock.calls[0][0].containerEl).toBe(el);
    });

    test('container never appears → warns, no render', async () => {
        vi.useFakeTimers();
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const pending = initMasteryOutlookView();
        await vi.advanceTimersByTimeAsync(16000);
        await pending;
        expect(renderMasteryOutlook).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith('[MasteryOutlookInit] Root container not found');
        warn.mockRestore();
    });
});
