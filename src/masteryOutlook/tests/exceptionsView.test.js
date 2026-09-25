// src/masteryOutlook/tests/exceptionsView.test.js
// View exceptions must list teacher overrides — pending and already saved — not
// only locked / manual ones.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../masteryOutlookCacheService.js', () => ({
    readSyncState:            vi.fn(async () => ({})),
    writeSyncState:           vi.fn(async () => {}),
    readMasteryOutlookCache:  vi.fn(async () => null),
    writeMasteryOutlookCache: vi.fn(async () => {}),
}));

import { buildCrossOutcomeExceptionsView } from '../outcomeSyncView.js';

function makeCache(syncState) {
    return {
        outcomes: [{ id: 599, title: 'Outcome 2' }],
        students: [
            { id: '642', name: 'Test Student001', outcomes: [{ outcomeId: '599', plPrediction: 1.5, canvasScore: 2 }] },
            { id: '643', name: 'Test Student002', outcomes: [{ outcomeId: '599', plPrediction: 2.6, canvasScore: 3 }] },
        ],
        sync_state: { '599': syncState },
        ignored_alignments: [],
    };
}

function rowsOf(html) {
    document.body.innerHTML = html;
    return [...document.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
}

describe('buildCrossOutcomeExceptionsView — overrides', () => {
    test('saved override appears with the saved score, note, and date', () => {
        const rows = rowsOf(buildCrossOutcomeExceptionsView(makeCache({
            '642': { will_post: null, will_post_lock: 'none', last_synced_score: 2,
                     last_synced_at: '2026-09-25T16:10:53Z', last_synced_note: 'retest' },
        })));
        expect(rows).toHaveLength(1);
        const [outcome, student, type, , , override, note, date] = rows[0];
        expect(outcome).toBe('Outcome 2');
        expect(student).toBe('Test Student001');
        expect(type).toBe('Saved Override');
        expect(override).toBe('2.00');
        expect(note).toBe('retest');
        expect(date).toBe(new Date('2026-09-25T16:10:53Z').toLocaleDateString());
    });

    test('unsaved (pending) unlocked override appears', () => {
        const rows = rowsOf(buildCrossOutcomeExceptionsView(makeCache({
            '643': { will_post: 2.5, will_post_lock: 'unlocked', will_post_note: 'why' },
        })));
        expect(rows).toHaveLength(1);
        expect(rows[0][2]).toBe('Pending Override');
        expect(rows[0][5]).toBe('2.50');
    });

    test('students with no override history are not listed', () => {
        const html = buildCrossOutcomeExceptionsView(makeCache({ '642': { will_post: null, will_post_lock: 'none' } }));
        expect(html).toContain('No overrides or ignored alignments recorded');
    });
});
