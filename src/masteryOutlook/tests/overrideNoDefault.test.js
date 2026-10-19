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

import { renderOutcomeStudentTable, wireOutcomeStudentTable } from '../studentSyncTable.js';
import { handleMarzanoPillClick, handleClearWillPost } from '../plOutlookActions.js';
import { rowSavePhase } from '../masteryOutlookState.js';

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

    test('push not yet reflected in Canvas → ⏳ marker beside the Canvas pill, not ⚑', () => {
        const cache = makeCache({ last_synced_score: 2.0, last_synced_at: new Date().toISOString() });
        cache.pl_assignments = { '101': { assignment_id: 'a1' } };
        const row = rowFor(renderOutcomeStudentTable({ id: '101' }, cache));
        const marker = row.querySelector('.os-sync-marker');
        expect(marker.classList.contains('verifying')).toBe(true);
        expect(marker.textContent).toBe('⏳');
        expect(marker.getAttribute('title')).toMatch(/waiting for Canvas/);
    });

    test('Canvas changed after a verified push → ⚑ marker with explanation', () => {
        const pushedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const cache = makeCache({
            last_synced_score: 2.0, last_synced_at: pushedAt,
            last_verify_at: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
        });
        cache.pl_assignments = { '101': { assignment_id: 'a1' } };
        const row = rowFor(renderOutcomeStudentTable({ id: '101' }, cache));
        const marker = row.querySelector('.os-sync-marker');
        expect(marker.classList.contains('override')).toBe(true);
        expect(marker.getAttribute('title')).toMatch(/changed directly in Canvas/);
    });

    test('Last Override shows the last pushed score, date, and note tooltip', () => {
        const cache = makeCache({
            last_synced_score: 2, last_synced_at: '2026-09-25T16:10:53.086Z', last_synced_note: 'retest',
        });
        const row  = rowFor(renderOutcomeStudentTable({ id: '101' }, cache));
        const last = row.querySelector('[data-action="os-use-last"]');
        expect(last.querySelector('.os-last-score').textContent).toBe('2.00');
        expect(last.querySelector('.os-last-date').textContent).toBe('Sep 25');
        expect(last.getAttribute('title')).toMatch(/^Saved to Canvas Sep 25, .* · Note: retest\. Click to copy to Override\.$/);
    });

    test('Last Override shows — when nothing has been pushed', () => {
        const row = rowFor(renderOutcomeStudentTable({ id: '101' }, makeCache()));
        expect(row.querySelector('[data-action="os-use-last"]')).toBeNull();
        expect(row.querySelector('.os-last-none').textContent).toBe('—');
    });

    test('clicking Last Override copies it into the Override', async () => {
        const cache = makeCache({ last_synced_score: 2, last_synced_at: '2026-09-25T16:10:53.086Z' });
        const contentEl = document.createElement('div');
        contentEl.innerHTML = renderOutcomeStudentTable({ id: '101' }, cache);
        document.body.replaceChildren(contentEl);
        wireOutcomeStudentTable({ contentEl, outcome: { id: '101' }, cache, courseId: '1',
            apiClient: {}, renderTable: () => {} });

        contentEl.querySelector('[data-action="os-use-last"]').click();
        await vi.waitFor(() => expect(cache.sync_state['101']['s2'].will_post).toBe(2));
        expect(cache.sync_state['101']['s2'].will_post_lock).toBe('unlocked');
    });

    test('a row waiting in the save queue shows Queued… in the Save column', () => {
        rowSavePhase.set('101_s2', 'queued');
        try {
            const row = rowFor(renderOutcomeStudentTable({ id: '101' },
                makeCache({ will_post: 2.5, will_post_lock: 'unlocked' })));
            const queued = row.querySelector('.os-posting.queued');
            expect(queued.textContent.trim()).toBe('Queued…');
            expect(queued.getAttribute('title')).toMatch(/current save to finish/);
            expect(row.querySelector('[data-action="os-save"]')).toBeNull();
        } finally {
            rowSavePhase.delete('101_s2');
        }
    });

    test('no push history → no marker', () => {
        const cache = makeCache();
        cache.pl_assignments = { '101': { assignment_id: 'a1' } };
        const row = rowFor(renderOutcomeStudentTable({ id: '101' }, cache));
        expect(row.querySelector('.os-sync-marker')).toBeNull();
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

describe('Override box keyboard navigation', () => {
    /** Three students on outcome 101, rendered and wired like the live table. */
    function mountTable() {
        const stu = (id) => ({
            id, name: `Student ${id}`, sortableName: `Student ${id}`,
            outcomes: [{ outcomeId: '101', plPrediction: 2, canvasScore: 2, attempts: [] }],
        });
        const cache = {
            students: [stu('a'), stu('b'), stu('c')],
            sync_state: { '101': {} },
            ignored_alignments: [],
        };
        const contentEl = document.createElement('div');
        const renderTable = () => { contentEl.innerHTML = renderOutcomeStudentTable({ id: '101' }, cache); };
        renderTable();
        document.body.replaceChildren(contentEl);
        wireOutcomeStudentTable({ contentEl, outcome: { id: '101' }, cache, courseId: '1',
            apiClient: {}, renderTable });
        return { cache, contentEl };
    }

    const openBox = (contentEl, stu) =>
        contentEl.querySelector(`[data-action="os-wp-click"][data-stu="${stu}"]`).click();
    const openInput = (contentEl) => contentEl.querySelector('.os-wp-input');
    const press = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    test('↓ saves the value and opens the next student\'s Override box', async () => {
        const { cache, contentEl } = mountTable();
        openBox(contentEl, 'a');
        const input = openInput(contentEl);
        input.value = '2.5';
        press(input, 'ArrowDown');

        await vi.waitFor(() => expect(openInput(contentEl)?.closest('tr')?.dataset.stu).toBe('b'));
        expect(cache.sync_state['101'].a.will_post).toBe(2.5);
        expect(document.activeElement).toBe(openInput(contentEl));
    });

    test('↑ goes back to the previous student', async () => {
        const { cache, contentEl } = mountTable();
        openBox(contentEl, 'b');
        const input = openInput(contentEl);
        input.value = '3';
        press(input, 'ArrowUp');

        await vi.waitFor(() => expect(openInput(contentEl)?.closest('tr')?.dataset.stu).toBe('a'));
        expect(cache.sync_state['101'].b.will_post).toBe(3);
    });

    test('↓ on the last student saves and opens nothing else', async () => {
        const { cache, contentEl } = mountTable();
        openBox(contentEl, 'c');
        const input = openInput(contentEl);
        input.value = '1';
        press(input, 'ArrowDown');

        await vi.waitFor(() => expect(cache.sync_state['101'].c?.will_post).toBe(1));
        expect(openInput(contentEl)).toBeNull();
    });
});

describe('Publishing wording', () => {
    test('row in the pushing phase reads Publishing…; Save tooltip says Publish … to Canvas', () => {
        const cache = makeCache({ will_post: 2.5, will_post_lock: 'unlocked' });
        let row = rowFor(renderOutcomeStudentTable({ id: '101' }, cache));
        expect(row.querySelector('[data-action="os-save"]').getAttribute('title')).toBe('Publish 2.50 to Canvas');

        rowSavePhase.set('101_s2', 'pushing');
        try {
            row = rowFor(renderOutcomeStudentTable({ id: '101' }, cache));
            expect(row.querySelector('.os-posting').textContent.trim()).toBe('Publishing…');
        } finally {
            rowSavePhase.delete('101_s2');
        }
    });
});

describe('Override padlock is hidden', () => {
    test.each(['unlocked', 'locked'])('override with will_post_lock "%s" renders no padlock', (lock) => {
        const row = rowFor(renderOutcomeStudentTable({ id: '101' },
            makeCache({ will_post: 2.5, will_post_lock: lock })));
        expect(row.querySelector('.os-wp-lock')).toBeNull();
        // Highlight + note prompt still follow the override
        expect(row.querySelector('.os-wp-box-wrap').classList.contains('differs')).toBe(true);
        expect(row.querySelector('.os-comment-input').getAttribute('placeholder')).toBe('Reason for override…');
    });

    test('footer hint no longer mentions the padlock', () => {
        document.body.innerHTML = renderOutcomeStudentTable({ id: '101' }, makeCache());
        expect(document.body.textContent).not.toMatch(/Padlock/);
        expect(document.body.textContent).toMatch(/Click Override box to type/);
    });
});
