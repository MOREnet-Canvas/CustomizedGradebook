// src/masteryOutlook/plOutlookStateMachine.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PLOutlookStateMachine, PL_STATES } from './plOutlookStateMachine.js';

// PLOutlookStateMachine uses logger internally — mock it
vi.mock('../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

describe('PLOutlookStateMachine', () => {
    let sm;

    beforeEach(() => {
        sm = new PLOutlookStateMachine({
            courseId:    '100',
            outcomeId:   '598',
            outcomeName: 'Algebra',
            apiClient:   {}
        });
    });

    // ── Initialization ──────────────────────────────────────────────────────

    test('initializes in IDLE state', () => {
        expect(sm.getCurrentState()).toBe(PL_STATES.IDLE);
    });

    test('initializes with provided context', () => {
        const ctx = sm.getContext();
        expect(ctx.courseId).toBe('100');
        expect(ctx.outcomeId).toBe('598');
        expect(ctx.outcomeName).toBe('Algebra');
    });

    test('initializes with null fields for runtime-populated context', () => {
        const ctx = sm.getContext();
        expect(ctx.assignmentId).toBeNull();
        expect(ctx.studentsToSync).toBeNull();
        expect(ctx.errors).toEqual([]);   // constructor default is [], not null
    });

    test('initializes with single-entry state history', () => {
        expect(sm.getStateHistory()).toEqual([PL_STATES.IDLE]);
    });

    // ── Transitions ─────────────────────────────────────────────────────────

    test('transitions from IDLE to CHECKING_SETUP', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        expect(sm.getCurrentState()).toBe(PL_STATES.CHECKING_SETUP);
    });

    test('rejects invalid transition and throws', () => {
        expect(() => sm.transition(PL_STATES.COMPLETE))
            .toThrow(/Invalid PL transition/);
    });

    test('error message includes from-state, to-state, and valid transitions', () => {
        try {
            sm.transition(PL_STATES.SYNCING);
        } catch (e) {
            expect(e.message).toContain(PL_STATES.IDLE);
            expect(e.message).toContain(PL_STATES.SYNCING);
            expect(e.message).toContain(PL_STATES.CHECKING_SETUP);
        }
    });

    test('canTransition returns true for valid target', () => {
        expect(sm.canTransition(PL_STATES.CHECKING_SETUP)).toBe(true);
    });

    test('canTransition returns false for invalid target', () => {
        expect(sm.canTransition(PL_STATES.COMPLETE)).toBe(false);
    });

    test('VERIFYING allows self-transition (retry loop)', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.transition(PL_STATES.CHECKING_STUDENTS);
        sm.transition(PL_STATES.CALCULATING_CHANGES);
        sm.transition(PL_STATES.SYNCING);
        sm.transition(PL_STATES.VERIFYING);
        expect(() => sm.transition(PL_STATES.VERIFYING)).not.toThrow();
        expect(sm.getCurrentState()).toBe(PL_STATES.VERIFYING);
    });

    // ── State history ────────────────────────────────────────────────────────

    test('tracks full state history', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.transition(PL_STATES.CHECKING_STUDENTS);
        expect(sm.getStateHistory()).toEqual([
            PL_STATES.IDLE,
            PL_STATES.CHECKING_SETUP,
            PL_STATES.CHECKING_STUDENTS
        ]);
    });

    test('getStateHistory returns a copy (not the internal array)', () => {
        const h1 = sm.getStateHistory();
        h1.push('tampered');
        expect(sm.getStateHistory()).toEqual([PL_STATES.IDLE]);
    });

    // ── Context ──────────────────────────────────────────────────────────────

    test('transition with contextUpdates merges into context', () => {
        sm.transition(PL_STATES.CHECKING_SETUP, { assignmentId: 42 });
        expect(sm.getContext().assignmentId).toBe(42);
        expect(sm.getContext().courseId).toBe('100'); // existing field preserved
    });

    test('updateContext merges without changing state', () => {
        sm.updateContext({ successCount: 7 });
        expect(sm.getContext().successCount).toBe(7);
        expect(sm.getCurrentState()).toBe(PL_STATES.IDLE);
    });

    test('getContext returns a snapshot (not live reference)', () => {
        const snap = sm.getContext();
        sm.updateContext({ successCount: 99 });
        expect(snap.successCount).not.toBe(99);
    });

    // ── Progress callback ────────────────────────────────────────────────────

    test('progress() calls onProgress with current state and outcomeName', () => {
        const onProgress = vi.fn();
        sm.updateContext({ onProgress });
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.progress('Checking...', 1, 10);
        expect(onProgress).toHaveBeenCalledWith(
            PL_STATES.CHECKING_SETUP,
            'Algebra',
            'Checking...',
            1,
            10
        );
    });

    test('progress() does not throw when onProgress is null', () => {
        sm.updateContext({ onProgress: null });
        expect(() => sm.progress('msg')).not.toThrow();
    });

    // ── Event system ─────────────────────────────────────────────────────────

    test('emits stateChange on transition with from/to/context', () => {
        const listener = vi.fn();
        sm.on('stateChange', listener);
        sm.transition(PL_STATES.CHECKING_SETUP);
        expect(listener).toHaveBeenCalledWith({
            from:    PL_STATES.IDLE,
            to:      PL_STATES.CHECKING_SETUP,
            context: expect.any(Object)
        });
    });

    test('multiple listeners all fire', () => {
        const a = vi.fn(), b = vi.fn();
        sm.on('stateChange', a);
        sm.on('stateChange', b);
        sm.transition(PL_STATES.CHECKING_SETUP);
        expect(a).toHaveBeenCalled();
        expect(b).toHaveBeenCalled();
    });

    test('listener error does not prevent other listeners from firing', () => {
        const bad  = vi.fn(() => { throw new Error('boom'); });
        const good = vi.fn();
        sm.on('stateChange', bad);
        sm.on('stateChange', good);
        expect(() => sm.transition(PL_STATES.CHECKING_SETUP)).not.toThrow();
        expect(good).toHaveBeenCalled();
    });

    // ── reset() ──────────────────────────────────────────────────────────────

    test('reset returns to IDLE', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.reset();
        expect(sm.getCurrentState()).toBe(PL_STATES.IDLE);
    });

    test('reset clears state history to [IDLE]', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.reset();
        expect(sm.getStateHistory()).toEqual([PL_STATES.IDLE]);
    });

    test('reset emits reset event', () => {
        const listener = vi.fn();
        sm.on('reset', listener);
        sm.reset();
        expect(listener).toHaveBeenCalled();
    });

    // ── Full flows ────────────────────────────────────────────────────────────

    test('happy path with cached setup: IDLE → … → COMPLETE → IDLE', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.transition(PL_STATES.CHECKING_STUDENTS);
        sm.transition(PL_STATES.CALCULATING_CHANGES);
        sm.transition(PL_STATES.SYNCING);
        sm.transition(PL_STATES.VERIFYING);
        sm.transition(PL_STATES.COMPLETE);
        sm.transition(PL_STATES.IDLE);
        expect(sm.getCurrentState()).toBe(PL_STATES.IDLE);
    });

    test('first-run path includes CREATING_ASSIGNMENT', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.transition(PL_STATES.CREATING_ASSIGNMENT);
        sm.transition(PL_STATES.CHECKING_STUDENTS);
        sm.transition(PL_STATES.CALCULATING_CHANGES);
        sm.transition(PL_STATES.COMPLETE);
        expect(sm.getCurrentState()).toBe(PL_STATES.COMPLETE);
    });

    test('new-student path includes FETCHING_SUBMISSIONS', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.transition(PL_STATES.CHECKING_STUDENTS);
        sm.transition(PL_STATES.FETCHING_SUBMISSIONS);
        sm.transition(PL_STATES.CALCULATING_CHANGES);
        sm.transition(PL_STATES.SYNCING);
        sm.transition(PL_STATES.VERIFYING);
        sm.transition(PL_STATES.COMPLETE);
        expect(sm.getCurrentState()).toBe(PL_STATES.COMPLETE);
    });

    test('error path: any state can reach ERROR → IDLE', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.transition(PL_STATES.ERROR);
        sm.transition(PL_STATES.IDLE);
        expect(sm.getCurrentState()).toBe(PL_STATES.IDLE);
    });

    test('no-change path: CALCULATING_CHANGES → COMPLETE (skips SYNCING)', () => {
        sm.transition(PL_STATES.CHECKING_SETUP);
        sm.transition(PL_STATES.CHECKING_STUDENTS);
        sm.transition(PL_STATES.CALCULATING_CHANGES);
        sm.transition(PL_STATES.COMPLETE);
        expect(sm.getCurrentState()).toBe(PL_STATES.COMPLETE);
    });
});