// src/masteryOutlook/tests/overrideNoDefault.test.js
// Override (will_post) must stay blank until a teacher sets it — no Marzano fallback.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../masteryOutlookCacheService.js', () => ({
    readSyncState:             vi.fn(async () => ({})),
    writeSyncState:            vi.fn(async () => {}),
    readMasteryOutlookCache:   vi.fn(async () => null),
    writeMasteryOutlookCache:  vi.fn(async () => {}),
}));

import { renderOutcomeStudentTable } from '../studentSyncTable.js';
import { handleMarzanoPillClick, handleClearWillPost } from '../plOutlookActions.js';

function makeCache(syncEntry = {}) {
    return {
        students: [{
            id: 's2', name: 'Student002', sortableName: 'Student002',
            outcomes: [{ outcomeId: '101', plPrediction: 2.6, canvasScore: 3.0, attempts: [] }],
        }],
        sync_state: { '101': { 's2': syncEntry } },
        ignored_alignments: [],
    };
}

function rowFor(html) {
    document.body.innerHTML = `<table><tbody>${html}</tbody></table>`;
    return document.querySelector('tr[data-stu="s2"]');
}

describe('Override does not default to Marzano', () => {
    test('no override → blank box, row not flagged, save disabled', () => {
        const row = rowFor(renderOutcomeStudentTable({ id: '101' }, makeCache()));
        expect(row.classList.contains('os-needs-row')).toBe(false);
        expect(row.querySelector('.os-wp-box').textContent.trim()).toBe('');
        expect(row.querySelector('.os-wp-box-wrap').getAttribute('aria-label')).toBe('Override: not set');
        const save = row.querySelector('[data-action="os-save"]');
        expect(save.disabled).toBe(true);
        expect(save.getAttribute('title')).toBe('No override set');
    });

    test('teacher override differing from Canvas → row flagged', () => {
        const row = rowFor(renderOutcomeStudentTable({ id: '101' },
            makeCache({ will_post: 2.5, will_post_lock: 'unlocked' })));
        expect(row.classList.contains('os-needs-row')).toBe(true);
        expect(row.querySelector('.os-wp-box').textContent.trim()).toBe('2.50');
    });

    test('Marzano pill sets an explicit rounded override', async () => {
        const cache = makeCache();
        await handleMarzanoPillClick({
            courseId: '1', outcomeId: '101', studentId: 's2', plPrediction: 2.6,
            cache, apiClient: {}, onRerender: () => {},
        });
        expect(cache.sync_state['101']['s2'].will_post).toBe(2.5);
        expect(cache.sync_state['101']['s2'].will_post_lock).toBe('unlocked');
    });

    test('clearing an override (blank input) returns the row to no-override', async () => {
        const cache = makeCache({ will_post: 3.0, will_post_lock: 'unlocked', will_post_note: 'why' });
        await handleClearWillPost({
            courseId: '1', outcomeId: '101', studentId: 's2',
            cache, apiClient: {}, onRerender: () => {},
        });
        const entry = cache.sync_state['101']['s2'];
        expect(entry.will_post).toBeNull();
        expect(entry.will_post_lock).toBe('none');

        const row = rowFor(renderOutcomeStudentTable({ id: '101' }, cache));
        expect(row.classList.contains('os-needs-row')).toBe(false);
        expect(row.querySelector('.os-wp-box').textContent.trim()).toBe('');
    });
});
