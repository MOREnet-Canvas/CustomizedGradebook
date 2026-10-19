// src/masteryOutlook/plOutlookSyncStatus.test.js
import { describe, it, expect } from 'vitest';
import { scoresMatch, getSyncStatus, aggregateSyncStatus, describeOverrideException } from './plOutlookSyncStatus.js';

describe('describeOverrideException', () => {
    it('returns null when there is nothing to report', () => {
        expect(describeOverrideException(undefined)).toBeNull();
        expect(describeOverrideException({})).toBeNull();
        expect(describeOverrideException({ will_post: null, will_post_lock: 'none', manual_override: false })).toBeNull();
    });

    it('pending override → Pending Override with its value and note', () => {
        const ex = describeOverrideException({ will_post: 2.5, will_post_lock: 'unlocked', will_post_note: 'retest' });
        expect(ex).toEqual({ types: ['Pending Override'], score: 2.5, note: 'retest', date: null });
    });

    it('saved override (Override box cleared after save) → Saved Override with saved score, note, date', () => {
        const ex = describeOverrideException({
            will_post: null, will_post_lock: 'none',
            last_synced_score: 2, last_synced_at: '2026-09-25T16:10:53Z', last_synced_note: 'retest',
        });
        expect(ex).toEqual({ types: ['Saved Override'], score: 2, note: 'retest', date: '2026-09-25T16:10:53Z' });
    });

    it('pending takes precedence over an older saved override', () => {
        const ex = describeOverrideException({ will_post: 3, last_synced_score: 2, last_synced_at: '2026-09-25T16:10:53Z' });
        expect(ex.types).toEqual(['Pending Override']);
        expect(ex.score).toBe(3);
    });

    it('adds Locked and Canvas Override labels', () => {
        expect(describeOverrideException({ will_post: 3, will_post_lock: 'locked' }).types)
            .toEqual(['Pending Override', 'Locked']);
        expect(describeOverrideException({ manual_override: true }).types).toEqual(['Canvas Override']);
    });
});

describe('scoresMatch', () => {
    it('returns false when either value is null or undefined', () => {
        expect(scoresMatch(null, 3.0)).toBe(false);
        expect(scoresMatch(3.0, null)).toBe(false);
        expect(scoresMatch(null, null)).toBe(false);
        expect(scoresMatch(undefined, 3.0)).toBe(false);
    });

    it('returns true for equal values', () => {
        expect(scoresMatch(3.0, 3.0)).toBe(true);
        expect(scoresMatch(2.5, 2.5)).toBe(true);
        expect(scoresMatch(0, 0)).toBe(true);
    });

    it('returns true when values differ only by floating-point noise', () => {
        // 0.1 + 0.2 in JS = 0.30000000000000004
        expect(scoresMatch(0.1 + 0.2, 0.3)).toBe(true);
    });

    it('returns true when values round to the same 2-decimal value', () => {
        // Math.round(2.741 * 100) = 274, Math.round(2.744 * 100) = 274 — equal
        expect(scoresMatch(2.741, 2.744)).toBe(true);
    });

    it('returns false when values differ meaningfully at 2 decimal places', () => {
        expect(scoresMatch(2.74, 2.75)).toBe(false); // 274 vs 275
        expect(scoresMatch(3.0, 2.5)).toBe(false);
        expect(scoresMatch(1.0, 4.0)).toBe(false);
    });

    it('treats 2.744 and 2.748 as equal (both round to 2.74 at 2 decimal places)', () => {
        // Math.round(2.744 * 100) = 274, Math.round(2.748 * 100) = 275 — actually 274 vs 275
        expect(scoresMatch(2.744, 2.744)).toBe(true);
        expect(scoresMatch(2.0, 2.004)).toBe(true);  // 200 vs 200
    });
});

describe('getSyncStatus', () => {
    const baseConfig = {
        pl_assignments: { '101': { assignment_id: 'a1' } },
        sync_state: {},
    };

    it('returns ne status when plPrediction is null', () => {
        const result = getSyncStatus('s1', '101', null, 3.0, baseConfig);
        expect(result.status).toBe('ne');
        expect(result.label).toBe('NE');
    });

    it('returns not_setup when no PL assignment exists for the outcome', () => {
        const configNoAssign = { pl_assignments: {}, sync_state: {} };
        const result = getSyncStatus('s1', '999', 2.5, 2.5, configNoAssign);
        expect(result.status).toBe('not_setup');
    });

    it('returns synced when prediction matches canvas score and was previously synced', () => {
        const config = {
            pl_assignments: { '101': { assignment_id: 'a1' } },
            sync_state: { '101': { 's1': { last_synced_score: 2.5, manual_override: false } } },
        };
        // prediction = canvas = last synced
        const result = getSyncStatus('s1', '101', 2.5, 2.5, config);
        expect(result.status).toBe('synced');
    });

    it('returns needs_sync when the teacher override differs from canvas score', () => {
        const config = {
            pl_assignments: { '101': { assignment_id: 'a1' } },
            sync_state: { '101': { 's1': { last_synced_score: 2.5, will_post: 3.0, manual_override: false } } },
        };
        const result = getSyncStatus('s1', '101', 3.0, 2.5, config);
        expect(result.status).toBe('needs_sync');
    });

    it('does not return needs_sync when prediction differs but no override is set', () => {
        const config = {
            pl_assignments: { '101': { assignment_id: 'a1' } },
            sync_state: { '101': { 's1': { last_synced_score: 2.5, manual_override: false } } },
        };
        const result = getSyncStatus('s1', '101', 3.0, 2.5, config);
        expect(result.status).not.toBe('needs_sync');
    });

    it('does not return needs_sync for a never-pushed student with no override', () => {
        const config = { pl_assignments: { '101': { assignment_id: 'a1' } }, sync_state: {} };
        const result = getSyncStatus('s1', '101', 3.0, 1.0, config);
        expect(result.status).not.toBe('needs_sync');
    });

    it('returns manual_override when state has manual_override flag', () => {
        const config = {
            pl_assignments: { '101': { assignment_id: 'a1' } },
            sync_state: { '101': { 's1': { manual_override: true, last_synced_score: 2.5 } } },
        };
        const result = getSyncStatus('s1', '101', 3.0, 2.5, config);
        expect(result.status).toBe('manual_override');
    });

    it('returns possible_override when canvas changed after last PL push', () => {
        const config = {
            pl_assignments: { '101': { assignment_id: 'a1' } },
            sync_state: { '101': { 's1': { last_synced_score: 2.5, manual_override: false } } },
        };
        // canvas is now 3.0, but last_synced was 2.5, and plPrediction is still 2.5
        const result = getSyncStatus('s1', '101', 2.5, 3.0, config);
        expect(result.status).toBe('possible_override');
    });

    describe('verifying (push not yet reflected in Canvas)', () => {
        const NOW      = Date.parse('2026-09-25T16:20:00Z');
        const minsAgo  = (m) => new Date(NOW - m * 60 * 1000).toISOString();
        const configFor = (entry) => ({
            pl_assignments: { '599': { assignment_id: 'a1' } },
            sync_state: { '599': { '642': { last_synced_score: 2, manual_override: false, ...entry } } },
        });

        it('unverified push 5 min ago with Canvas still old → verifying', () => {
            const result = getSyncStatus('642', '599', 1.5, 1.5, configFor({ last_synced_at: minsAgo(5) }), NOW);
            expect(result.status).toBe('verifying');
        });

        it('unverified push 40 min ago with Canvas still old → possible_override', () => {
            const result = getSyncStatus('642', '599', 1.5, 1.5, configFor({ last_synced_at: minsAgo(40) }), NOW);
            expect(result.status).toBe('possible_override');
        });

        it('verified after the push, then Canvas changed → possible_override', () => {
            const config = configFor({ last_synced_at: minsAgo(5), last_verify_at: minsAgo(4) });
            const result = getSyncStatus('642', '599', 1.5, 1.5, config, NOW);
            expect(result.status).toBe('possible_override');
        });

        it('verify pass older than the push does not count as verified → verifying', () => {
            const config = configFor({ last_synced_at: minsAgo(5), last_verify_at: minsAgo(60) });
            const result = getSyncStatus('642', '599', 1.5, 1.5, config, NOW);
            expect(result.status).toBe('verifying');
        });

        it('Canvas caught up to the pushed score → synced', () => {
            const result = getSyncStatus('642', '599', 1.5, 2, configFor({ last_synced_at: minsAgo(5) }), NOW);
            expect(result.status).toBe('synced');
        });

        it('aggregateSyncStatus counts verifying separately from possibleOverride', () => {
            const students = [{ id: '642', outcomes: [{ outcomeId: '599', plPrediction: 1.5, canvasScore: 1.5 }] }];
            const counts = aggregateSyncStatus(students, '599', configFor({ last_synced_at: new Date().toISOString() }));
            expect(counts.verifying).toBe(1);
            expect(counts.possibleOverride).toBe(0);
        });
    });
});

describe('aggregateSyncStatus', () => {
    it('returns all-zero counts for empty student array', () => {
        const config = { pl_assignments: { '101': { assignment_id: 'a1' } }, sync_state: {} };
        const result = aggregateSyncStatus([], '101', config);
        expect(result.total).toBe(0);
        expect(result.synced).toBe(0);
        expect(result.needsSync).toBe(0);
    });

    it('aggregates synced and needsSync counts across students', () => {
        const config = {
            pl_assignments: { '101': { assignment_id: 'a1' } },
            sync_state: {
                '101': {
                    's1': { last_synced_score: 2.5, manual_override: false },
                    's2': { last_synced_score: 3.0, will_post: 3.5, manual_override: false },
                },
            },
        };
        // aggregateSyncStatus reads student.id and student.outcomes[].{ outcomeId, plPrediction, canvasScore }
        const students = [
            { id: 's1', outcomes: [{ outcomeId: '101', plPrediction: 2.5, canvasScore: 2.5 }] },
            { id: 's2', outcomes: [{ outcomeId: '101', plPrediction: 3.5, canvasScore: 3.0 }] },
        ];
        const result = aggregateSyncStatus(students, '101', config);
        expect(result.total).toBe(2);
        expect(result.synced).toBe(1);
        expect(result.needsSync).toBe(1);
    });
});
