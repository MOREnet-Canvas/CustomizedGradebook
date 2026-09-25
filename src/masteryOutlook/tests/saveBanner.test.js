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
import {
    syncingStudentIds, syncStudentPhase, syncingOutcomeIds, queuedSyncKeys,
} from '../masteryOutlookState.js';

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
    syncingStudentIds.clear();
    syncStudentPhase.clear();
    syncingOutcomeIds.clear();
    queuedSyncKeys.clear();
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
        syncingOutcomeIds.add(OID);
        syncingStudentIds.add(`${OID}_a`);
        syncStudentPhase.set(`${OID}_a`, 'pushing');
        queuedSyncKeys.add(`${OID}_b`);

        const b = banner(makeCache());
        expect(b.cls).toBe('syncing');
        expect(b.text).toBe('Saving 1 student to Canvas… · 1 queued · 1 still to save');
        expect(b.button.disabled).toBe(false);
        expect(b.button.textContent.trim()).toBe('Save remaining (1)');
    });

    test('verifying with nothing left → disabled Verifying… button', () => {
        syncingOutcomeIds.add(OID);
        for (const id of ['a', 'b', 'c']) {
            syncingStudentIds.add(`${OID}_${id}`);
            syncStudentPhase.set(`${OID}_${id}`, 'verifying');
        }
        const b = banner(makeCache());
        expect(b.text).toBe('Waiting for Canvas to confirm 3 students…');
        expect(b.button.disabled).toBe(true);
        expect(b.button.textContent.trim()).toBe('Verifying…');
    });

    test('only queued → waiting message and disabled Queued… button', () => {
        for (const id of ['a', 'b', 'c']) queuedSyncKeys.add(`${OID}_${id}`);
        const b = banner(makeCache());
        expect(b.cls).toBe('syncing');
        expect(b.text).toBe('⏳ 3 students queued — waiting for the current save to finish');
        expect(b.button.disabled).toBe(true);
        expect(b.button.textContent.trim()).toBe('Queued…');
    });

    test('save started but rows not resolved yet → checking message', () => {
        syncingOutcomeIds.add(OID);
        const b = banner(makeCache());
        expect(b.text).toBe('Checking which students need saving… · 3 still to save');
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
        syncingStudentIds.add(`${OID}_a`);
        syncStudentPhase.set(`${OID}_a`, 'pushing');
        queuedSyncKeys.add(`${OID}_b`);

        expect(getOutcomeSaveSummary({ id: OID }, makeCache())).toEqual({
            saving: 1, verifying: 0, queued: 1, remaining: 1, remainingIds: ['c'],
        });
    });
});

describe('buildSyncChip', () => {
    test('shows Queued… when a row-level save for the outcome is queued', () => {
        queuedSyncKeys.add(`${OID}_b`);
        expect(buildSyncChip({ id: OID }, makeCache())).toContain('Queued…');
    });

    test('no queued rows → not Queued', () => {
        expect(buildSyncChip({ id: OID }, makeCache())).not.toContain('Queued…');
    });
});
