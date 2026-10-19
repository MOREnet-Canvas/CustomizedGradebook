// src/masteryOutlook/tests/cacheWriteMerge.test.js
// A cache write must never drop sync_state / pl_assignments / metadata that is
// already on disk, and must write the view's `meta` as `metadata`.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { mergeCacheForWrite, normalizeCacheMetadata, SCHEMA_VERSION } from '../masteryOutlookCacheService.js';

const disk = {
    metadata: { schemaVersion: '1.0', computedAt: '2026-09-25T15:00:00Z', studentCount: 5, outcomeCount: 6 },
    students: [{ id: 'old' }],
    sync_state: {
        '599': {
            '642': { last_synced_score: 2, last_synced_at: '2026-09-25T16:10:53Z', last_synced_note: 'retest' },
            '643': { will_post: 3, will_post_lock: 'unlocked' },
        },
        '603': { '643': { avg_verify_at: '2026-09-25T17:31:00Z', avg_verify_mismatch: false } },
    },
    pl_assignments: { '598': { assignment_id: 'a598' }, '599': { assignment_id: 'a599' } },
    ignored_alignments: [{ student_id: '642', outcome_id: '599', alignment_id: 'x' }],
};

describe('mergeCacheForWrite', () => {
    test('a view write from an older copy keeps sync_state entries that exist only on disk', () => {
        const incoming = {
            meta: { schemaVersion: '1.0', customOutcomeOrder: ['599'] },
            students: [{ id: 'new' }],
            sync_state: { '599': { '644': { will_post: 2.5, will_post_lock: 'unlocked' } } },
        };

        const out = mergeCacheForWrite(disk, incoming);

        expect(out.sync_state['599']['642']).toEqual(disk.sync_state['599']['642']);
        expect(out.sync_state['599']['643']).toEqual(disk.sync_state['599']['643']);
        expect(out.sync_state['599']['644']).toEqual({ will_post: 2.5, will_post_lock: 'unlocked' });
        expect(out.sync_state['603']['643']).toEqual(disk.sync_state['603']['643']);
        expect(out.students).toEqual([{ id: 'new' }]);   // non-merged sections come from incoming
    });

    test('incoming fields win, including null resets; disk-only fields are kept', () => {
        const incoming = { sync_state: { '599': { '643': {
            will_post: null, will_post_lock: 'none', last_synced_score: 3, last_synced_at: '2026-09-25T19:00:00Z',
        } } } };

        const entry = mergeCacheForWrite(disk, incoming).sync_state['599']['643'];

        expect(entry).toEqual({
            will_post: null, will_post_lock: 'none', last_synced_score: 3, last_synced_at: '2026-09-25T19:00:00Z',
        });
    });

    test('view `meta` is written as `metadata` without dropping disk computedAt; no `meta` key', () => {
        const out = mergeCacheForWrite(disk, { meta: { schemaVersion: '1.0', customOutcomeOrder: ['599'] } });

        expect(out.meta).toBeUndefined();
        expect(out.metadata).toEqual({
            schemaVersion: SCHEMA_VERSION, computedAt: '2026-09-25T15:00:00Z', studentCount: 5, outcomeCount: 6,
            customOutcomeOrder: ['599'],
        });
    });

    test('Refresh Data metadata overrides disk metadata', () => {
        const out = mergeCacheForWrite(disk, { metadata: { computedAt: '2026-09-25T20:00:00Z', studentCount: 7 } });
        expect(out.metadata.computedAt).toBe('2026-09-25T20:00:00Z');
        expect(out.metadata.studentCount).toBe(7);
        expect(out.metadata.outcomeCount).toBe(6);
    });

    test('pl_assignments: incoming wins per outcome, disk-only outcomes are kept', () => {
        const out = mergeCacheForWrite(disk, { pl_assignments: { '599': { assignment_id: 'a599-new' } } });
        expect(out.pl_assignments).toEqual({ '598': { assignment_id: 'a598' }, '599': { assignment_id: 'a599-new' } });
    });

    test('ignored_alignments comes from incoming so un-ignoring sticks', () => {
        expect(mergeCacheForWrite(disk, { ignored_alignments: [] }).ignored_alignments).toEqual([]);
    });

    test('no file on disk yet → incoming written with metadata.schemaVersion', () => {
        const out = mergeCacheForWrite(null, { metadata: { courseId: '566' }, sync_state: {} });
        expect(out.metadata).toEqual({ courseId: '566', schemaVersion: SCHEMA_VERSION });
        expect(out.sync_state).toEqual({});
    });

    test('does not mutate its inputs', () => {
        const before = JSON.stringify(disk);
        const incoming = { sync_state: { '599': { '642': { will_post: 1 } } } };
        mergeCacheForWrite(disk, incoming);
        expect(JSON.stringify(disk)).toBe(before);
        expect(incoming).toEqual({ sync_state: { '599': { '642': { will_post: 1 } } } });
    });
});

describe('normalizeCacheMetadata', () => {
    test('combines a file split between `meta` and `metadata` (what older writes produced)', () => {
        const split = {
            meta:     { schemaVersion: '1.0', customOutcomeOrder: ['599'], computedAt: '2026-09-25T15:00:00Z', studentCount: 5 },
            metadata: { schemaVersion: '1.0' },
        };
        expect(normalizeCacheMetadata(split)).toEqual({
            schemaVersion: '1.0', customOutcomeOrder: ['599'], computedAt: '2026-09-25T15:00:00Z', studentCount: 5,
        });
    });

    test('metadata wins over meta for the same field; missing both → {}', () => {
        expect(normalizeCacheMetadata({ meta: { computedAt: 'old' }, metadata: { computedAt: 'new' } }))
            .toEqual({ computedAt: 'new' });
        expect(normalizeCacheMetadata(null)).toEqual({});
    });
});
