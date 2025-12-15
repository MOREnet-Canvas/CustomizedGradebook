// src/gradebook/stateMachine.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { UpdateFlowStateMachine, STATES } from './stateMachine.js';

describe('UpdateFlowStateMachine', () => {
    let stateMachine;

    beforeEach(() => {
        stateMachine = new UpdateFlowStateMachine();
        // Clear localStorage before each test
        localStorage.clear();
    });

    // ===== Basic State Management =====
    
    test('initializes in IDLE state', () => {
        expect(stateMachine.getCurrentState()).toBe(STATES.IDLE);
    });

    test('initializes with default context', () => {
        const context = stateMachine.getContext();
        expect(context.courseId).toBe(null);
        expect(context.outcomeId).toBe(null);
        expect(context.retryCount).toBe(0);
    });

    test('initializes with custom context', () => {
        const sm = new UpdateFlowStateMachine(STATES.IDLE, { courseId: '12345' });
        expect(sm.getContext().courseId).toBe('12345');
    });

    test('transitions to valid states', () => {
        stateMachine.transition(STATES.CHECKING_SETUP);
        expect(stateMachine.getCurrentState()).toBe(STATES.CHECKING_SETUP);
    });

    test('rejects invalid transitions', () => {
        expect(() => {
            stateMachine.transition(STATES.COMPLETE);
        }).toThrow(/Invalid transition/);
    });

    test('canTransition returns true for valid transitions', () => {
        expect(stateMachine.canTransition(STATES.CHECKING_SETUP)).toBe(true);
    });

    test('canTransition returns false for invalid transitions', () => {
        expect(stateMachine.canTransition(STATES.COMPLETE)).toBe(false);
    });

    test('tracks state history', () => {
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CALCULATING);
        
        const history = stateMachine.getStateHistory();
        expect(history).toEqual([STATES.IDLE, STATES.CHECKING_SETUP, STATES.CALCULATING]);
    });

    test('updates context on transition', () => {
        stateMachine.transition(STATES.CHECKING_SETUP, { courseId: '12345' });
        expect(stateMachine.getContext().courseId).toBe('12345');
    });

    test('updateContext merges context data', () => {
        stateMachine.updateContext({ courseId: '12345', outcomeId: '67890' });
        const context = stateMachine.getContext();
        expect(context.courseId).toBe('12345');
        expect(context.outcomeId).toBe('67890');
    });

    // ===== Event Emission =====

    test('emits stateChange event on transition', () => {
        const listener = vi.fn();
        stateMachine.on('stateChange', listener);

        stateMachine.transition(STATES.CHECKING_SETUP);

        expect(listener).toHaveBeenCalledWith({
            from: STATES.IDLE,
            to: STATES.CHECKING_SETUP,
            context: expect.any(Object)
        });
    });

    test('supports multiple event listeners', () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        
        stateMachine.on('stateChange', listener1);
        stateMachine.on('stateChange', listener2);

        stateMachine.transition(STATES.CHECKING_SETUP);

        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
    });

    test('handles errors in event listeners gracefully', () => {
        const errorListener = vi.fn(() => { throw new Error('Listener error'); });
        const goodListener = vi.fn();
        
        stateMachine.on('stateChange', errorListener);
        stateMachine.on('stateChange', goodListener);

        // Should not throw
        expect(() => {
            stateMachine.transition(STATES.CHECKING_SETUP);
        }).not.toThrow();

        // Good listener should still be called
        expect(goodListener).toHaveBeenCalled();
    });

    // ===== Persistence =====

    test('serializes state to JSON', () => {
        stateMachine.updateContext({ courseId: '12345' });
        stateMachine.transition(STATES.CHECKING_SETUP);

        const serialized = stateMachine.serialize();

        expect(serialized.currentState).toBe(STATES.CHECKING_SETUP);
        expect(serialized.context.courseId).toBe('12345');
        expect(serialized.stateHistory).toEqual([STATES.IDLE, STATES.CHECKING_SETUP]);
        expect(serialized.timestamp).toBeDefined();
    });

    test('deserializes state from JSON', () => {
        const data = {
            currentState: STATES.CALCULATING,
            context: { courseId: '12345', outcomeId: '67890' },
            stateHistory: [STATES.IDLE, STATES.CHECKING_SETUP, STATES.CALCULATING],
            timestamp: new Date().toISOString()
        };

        stateMachine.deserialize(data);

        expect(stateMachine.getCurrentState()).toBe(STATES.CALCULATING);
        expect(stateMachine.getContext().courseId).toBe('12345');
        expect(stateMachine.getStateHistory()).toEqual(data.stateHistory);
    });

    test('saves state to localStorage', () => {
        stateMachine.updateContext({ courseId: '12345' });
        stateMachine.transition(STATES.CHECKING_SETUP);

        stateMachine.saveToLocalStorage('12345');

        const stored = localStorage.getItem('updateFlow_state_12345');
        expect(stored).toBeDefined();
        
        const parsed = JSON.parse(stored);
        expect(parsed.currentState).toBe(STATES.CHECKING_SETUP);
    });

    test('loads state from localStorage', () => {
        const data = {
            currentState: STATES.CALCULATING,
            context: { courseId: '12345' },
            stateHistory: [STATES.IDLE, STATES.CALCULATING],
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('updateFlow_state_12345', JSON.stringify(data));

        const loaded = stateMachine.loadFromLocalStorage('12345');

        expect(loaded).toBe(true);
        expect(stateMachine.getCurrentState()).toBe(STATES.CALCULATING);
    });

    test('ignores old state from localStorage (> 1 hour)', () => {
        const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const data = {
            currentState: STATES.CALCULATING,
            context: { courseId: '12345' },
            stateHistory: [STATES.IDLE, STATES.CALCULATING],
            timestamp: oldTimestamp.toISOString()
        };
        localStorage.setItem('updateFlow_state_12345', JSON.stringify(data));

        const loaded = stateMachine.loadFromLocalStorage('12345');

        expect(loaded).toBe(false);
        expect(stateMachine.getCurrentState()).toBe(STATES.IDLE);
    });

    test('clears state from localStorage', () => {
        localStorage.setItem('updateFlow_state_12345', 'test');

        stateMachine.clearLocalStorage('12345');

        expect(localStorage.getItem('updateFlow_state_12345')).toBe(null);
    });

    // ===== Edge Cases =====

    test('handles self-transition (POLLING_PROGRESS)', () => {
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CALCULATING);
        stateMachine.transition(STATES.UPDATING_GRADES);
        stateMachine.transition(STATES.POLLING_PROGRESS);

        expect(() => {
            stateMachine.transition(STATES.POLLING_PROGRESS);
        }).not.toThrow();

        expect(stateMachine.getCurrentState()).toBe(STATES.POLLING_PROGRESS);
    });

    test('reset returns to IDLE state', () => {
        stateMachine.updateContext({ courseId: '12345', outcomeId: '67890' });
        stateMachine.transition(STATES.CHECKING_SETUP);

        stateMachine.reset();

        expect(stateMachine.getCurrentState()).toBe(STATES.IDLE);
        expect(stateMachine.getContext().outcomeId).toBe(null);
        expect(stateMachine.getContext().courseId).toBe('12345');
    });

    test('reset emits reset event', () => {
        const listener = vi.fn();
        stateMachine.on('reset', listener);

        stateMachine.reset();

        expect(listener).toHaveBeenCalled();
    });

    // ===== Complex State Flows =====

    test('supports complete resource creation flow', () => {
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CREATING_OUTCOME);
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CREATING_ASSIGNMENT);
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CREATING_RUBRIC);
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CALCULATING);

        expect(stateMachine.getCurrentState()).toBe(STATES.CALCULATING);
    });

    test('supports per-student update flow', () => {
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CALCULATING);
        stateMachine.transition(STATES.UPDATING_GRADES);
        stateMachine.transition(STATES.VERIFYING);
        stateMachine.transition(STATES.COMPLETE);

        expect(stateMachine.getCurrentState()).toBe(STATES.COMPLETE);
    });

    test('supports bulk update flow with polling', () => {
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CALCULATING);
        stateMachine.transition(STATES.UPDATING_GRADES);
        stateMachine.transition(STATES.POLLING_PROGRESS);
        stateMachine.transition(STATES.POLLING_PROGRESS);
        stateMachine.transition(STATES.VERIFYING);
        stateMachine.transition(STATES.COMPLETE);

        expect(stateMachine.getCurrentState()).toBe(STATES.COMPLETE);
    });

    test('supports error recovery flow', () => {
        stateMachine.transition(STATES.CHECKING_SETUP);
        stateMachine.transition(STATES.CREATING_OUTCOME);
        stateMachine.transition(STATES.ERROR);
        stateMachine.transition(STATES.IDLE);

        expect(stateMachine.getCurrentState()).toBe(STATES.IDLE);
    });
});

