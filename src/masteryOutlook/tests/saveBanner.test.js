// src/masteryOutlook/tests/saveBanner.test.js
// The "Save grades to Canvas" banner mirrors the rows' save state, and the
// banner button only sends rows that aren't already queued or in flight.
import { describe, test, expect, vi, afterEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../masteryOutlookCacheService.js', () => ({
    readSyncState:            vi.fn(async () => ({})),
    writeSyncState:           vi.fn(async () => {}),
    readMasteryOutlookCache:  vi.fn(async () => null),
    writeMasteryOutlookCache: vi.fn(async () => {}),
    readPLAssignments:        vi.fn(async () => ({})),
}));

import { renderOutcomeStudentTable, getOutcomeSaveSummary } from '../studentSyncTable.js';
import { buildSyncChip } from '../outcomeRow.js';
import { rowSavePhase, syncingOutcomeIds, rowsAwaitingOutcome } from '../masteryOutlookState.js';

const OID = '600';

/** Three students on outcome 600, each with an override that differs from Canvas. */
function makeCache() {
    const stu = (id) => ({
        id, name: `Student ${id}`, sortableName: `Student ${id}`,
        outcomes: [{ outcomeId: OID, plPrediction: 2, canvasScore: 2, attempts: [] }],
    });
    return {
        students: [stu('a'), stu('b'), stu('c')],
        sync_state: { [OID]: {
            a: { will_post: 3, will_post_lock: 'unlocked' },
            b: { will_post: 3, will_post_lock: 'unlocked' },
            c: { will_post: 3, will_post_lock: 'unlocked' },
        } },
        pl_assignments: { [OID]: { assignment_id: 'x' } },
        ignored_alignments: [],
    };
}

function banner(cache) {
    document.body.innerHTML = renderOutcomeStudentTable({ id: OID }, cache);
    const el = document.querySelector('.os-status-banner');
    return {
        cls:    [...el.classList].find(c => c !== 'os-status-banner'),
        text:   el.querySelector('.os-status-banner-left').textContent.replace(/\s+/g, ' ').trim(),
        button: el.querySelector('[data-action="os-post-all"]'),
    };
}

afterEach(() => {
    rowSavePhase.clear();
    syncingOutcomeIds.clear();
    rowsAwaitingOutcome.clear();
});

describe('save banner', () => {
    test('only remaining → "N students need updating" with Save grades to Canvas', () => {
        const b = banner(makeCache());
        expect(b.cls).toBe('warn');
        expect(b.text).toBe('⬆ 3 students need updating');
        expect(b.button.disabled).toBe(false);
        expect(b.button.textContent.trim()).toBe('Save grades to Canvas');
    });

    test('one pushing, one queued, one remaining → combined status and Save remaining (1)', () => {
        rowSavePhase.set(`${OID}_a`, 'pushing');
        rowSavePhase.set(`${OID}_b`, 'queued');

        const b = banner(makeCache());
        expect(b.cls).toBe('syncing');
        expect(b.text).toBe('Saving 1 student to Canvas… · 1 queued · 1 still to save');
        expect(b.button.disabled).toBe(false);
        expect(b.button.textContent.trim()).toBe('Save remaining (1)');
    });

    test('confirming with nothing left → disabled Confirming… button', () => {
        for (const id of ['a', 'b', 'c']) rowSavePhase.set(`${OID}_${id}`, 'verifying');
        const b = banner(makeCache());
        expect(b.text).toBe('Confirming 3 students in Canvas…');
        expect(b.button.disabled).toBe(true);
        expect(b.button.textContent.trim()).toBe('Confirming…');
    });

    test('rows waiting on the outcome score → non-blocking note; row shows ⏳; chip counts them', () => {
        const cache = makeCache();
        cache.sync_state[OID] = { a: { last_synced_score: 3, last_synced_at: new Date().toISOString() } };
        rowsAwaitingOutcome.add(`${OID}_a`);
        const b = banner(cache);
        expect(b.cls).toBe('ok');
        expect(b.text).toBe('✓ Canvas gradebook is up to date · ⏳ 1 outcome score updating');
        const marker = document.querySelector('tr[data-stu="a"] .os-sync-marker');
        expect(marker.classList.contains('verifying')).toBe(true);
        expect(marker.getAttribute('title')).toMatch(/waiting for Canvas to update the outcome score/);
        expect(buildSyncChip({ id: OID }, cache)).toContain('⏳ 1 verifying');
    });

    test('only queued → waiting message and disabled Queued… button', () => {
        for (const id of ['a', 'b', 'c']) rowSavePhase.set(`${OID}_${id}`, 'queued');
        const b = banner(makeCache());
        expect(b.cls).toBe('syncing');
        expect(b.text).toBe('⏳ 3 students queued — waiting for the current save to finish');
        expect(b.button.disabled).toBe(true);
        expect(b.button.textContent.trim()).toBe('Queued…');
    });

    test('save just started (rows checking) → counted as saving; button disabled, nothing to re-send', () => {
        for (const id of ['a', 'b', 'c']) rowSavePhase.set(`${OID}_${id}`, 'checking');
        const b = banner(makeCache());
        expect(b.text).toBe('Saving 3 students to Canvas…');
        expect(b.button.disabled).toBe(true);
        expect(b.button.textContent.trim()).toBe('Saving…');
    });

    test('nothing pending → up to date', () => {
        const cache = makeCache();
        cache.sync_state[OID] = {};
        const b = banner(cache);
        expect(b.cls).toBe('ok');
        expect(b.text).toBe('✓ Canvas gradebook is up to date');
        expect(b.button).toBeNull();
    });
});

describe('getOutcomeSaveSummary', () => {
    test('remainingIds excludes queued and in-flight rows', () => {
        rowSavePhase.set(`${OID}_a`, 'checking');
        rowSavePhase.set(`${OID}_b`, 'queued');

        expect(getOutcomeSaveSummary({ id: OID }, makeCache())).toEqual({
            saving: 1, verifying: 0, queued: 1, remaining: 1, remainingIds: ['c'],
        });
    });
});

describe('buildSyncChip', () => {
    test('shows Queued… when a row-level save for the outcome is queued', () => {
        rowSavePhase.set(`${OID}_b`, 'queued');
        expect(buildSyncChip({ id: OID }, makeCache())).toContain('Queued…');
    });

    test('shows Syncing… when any row of the outcome is checking, pushing, or verifying', () => {
        rowSavePhase.set(`${OID}_a`, 'checking');
        rowSavePhase.set(`${OID}_b`, 'queued');
        expect(buildSyncChip({ id: OID }, makeCache())).toContain('Syncing…');
    });

    test('Current Score (special) chip shows ⏳ N verifying instead of — while rows update', () => {
        const cs = { id: '603', title: 'Current Score' };
        const cache = {
            students: [{ id: 'a', name: 'Student a', sortableName: 'Student a',
                outcomes: [{ outcomeId: '603', plPrediction: null, canvasScore: 1, attempts: [] }] }],
            sync_state: {}, pl_assignments: {}, ignored_alignments: [],
        };
        expect(buildSyncChip(cs, cache, { isSpecial: true })).toContain('—');

        rowsAwaitingOutcome.add('603_a');
        expect(buildSyncChip(cs, cache, { isSpecial: true })).toContain('⏳ 1 verifying');

        document.body.innerHTML = renderOutcomeStudentTable(cs, cache);
        const marker = document.querySelector('tr[data-stu="a"] .os-sync-marker');
        expect(marker.classList.contains('verifying')).toBe(true);
        expect(marker.getAttribute('title')).toMatch(/waiting for Canvas to update the outcome score/);
    });

    test('no queued rows → not Queued', () => {
        expect(buildSyncChip({ id: OID }, makeCache())).not.toContain('Queued…');
    });
});
