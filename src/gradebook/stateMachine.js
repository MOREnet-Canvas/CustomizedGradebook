// src/gradebook/stateMachine.js
/**
 * Update Flow State Machine
 * 
 * Manages the state and transitions for the grade update flow.
 * Provides state persistence, event emission, and transition validation.
 */

import { logger } from "../utils/logger.js";

/**
 * All possible states in the update flow
 */
export const STATES = {
    IDLE: 'IDLE',
    CHECKING_SETUP: 'CHECKING_SETUP',
    CREATING_OUTCOME: 'CREATING_OUTCOME',
    CREATING_ASSIGNMENT: 'CREATING_ASSIGNMENT',
    CREATING_RUBRIC: 'CREATING_RUBRIC',
    CALCULATING: 'CALCULATING',
    UPDATING_GRADES: 'UPDATING_GRADES',
    POLLING_PROGRESS: 'POLLING_PROGRESS',
    VERIFYING: 'VERIFYING',
    COMPLETE: 'COMPLETE',
    ERROR: 'ERROR'
};

/**
 * Valid state transitions
 * Maps each state to an array of states it can transition to
 */
const VALID_TRANSITIONS = {
    [STATES.IDLE]: [STATES.CHECKING_SETUP],
    [STATES.CHECKING_SETUP]: [STATES.CREATING_OUTCOME, STATES.CREATING_ASSIGNMENT, STATES.CREATING_RUBRIC, STATES.CALCULATING, STATES.ERROR],
    [STATES.CREATING_OUTCOME]: [STATES.CHECKING_SETUP, STATES.ERROR],
    [STATES.CREATING_ASSIGNMENT]: [STATES.CHECKING_SETUP, STATES.ERROR],
    [STATES.CREATING_RUBRIC]: [STATES.CHECKING_SETUP, STATES.ERROR],
    [STATES.CALCULATING]: [STATES.UPDATING_GRADES, STATES.COMPLETE, STATES.ERROR],
    [STATES.UPDATING_GRADES]: [STATES.POLLING_PROGRESS, STATES.VERIFYING, STATES.ERROR],
    [STATES.POLLING_PROGRESS]: [STATES.POLLING_PROGRESS, STATES.VERIFYING, STATES.ERROR],
    [STATES.VERIFYING]: [STATES.VERIFYING, STATES.COMPLETE, STATES.ERROR],
    [STATES.COMPLETE]: [STATES.IDLE],
    [STATES.ERROR]: [STATES.IDLE]
};

/**
 * Update Flow State Machine
 */
export class UpdateFlowStateMachine {
    /**
     * Create a new state machine
     * @param {string} initialState - Initial state (default: IDLE)
     * @param {object} initialContext - Initial context data
     */
    constructor(initialState = STATES.IDLE, initialContext = {}) {
        this.currentState = initialState;
        this.context = {
            courseId: null,
            outcomeId: null,
            assignmentId: null,
            rubricId: null,
            rubricCriterionId: null,
            rollupData: null,
            averages: null,
            progressId: null,
            startTime: null,
            numberOfUpdates: 0,
            banner: null,
            error: null,
            retryCount: 0,
            updateMode: null, // 'per-student' or 'bulk'
            ...initialContext
        };
        this.eventListeners = {};
        this.stateHistory = [initialState];
    }

    /**
     * Get the current state
     * @returns {string} Current state name
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * Get the current context
     * @returns {object} Current context data
     */
    getContext() {
        return { ...this.context };
    }

    /**
     * Update context data
     * @param {object} updates - Context updates to merge
     */
    updateContext(updates) {
        this.context = { ...this.context, ...updates };
    }

    /**
     * Check if a transition is valid
     * @param {string} toState - Target state
     * @returns {boolean} True if transition is valid
     */
    canTransition(toState) {
        const validStates = VALID_TRANSITIONS[this.currentState] || [];
        return validStates.includes(toState);
    }

    /**
     * Transition to a new state
     * @param {string} toState - Target state
     * @param {object} contextUpdates - Optional context updates
     * @throws {Error} If transition is invalid
     */
    transition(toState, contextUpdates = {}) {
        if (!this.canTransition(toState)) {
            throw new Error(
                `Invalid transition from ${this.currentState} to ${toState}. ` +
                `Valid transitions: ${VALID_TRANSITIONS[this.currentState]?.join(', ') || 'none'}`
            );
        }

        const fromState = this.currentState;
        this.currentState = toState;
        this.stateHistory.push(toState);
        this.updateContext(contextUpdates);

        logger.debug(`State transition: ${fromState} → ${toState}`);

        // Emit state change event
        this.emit('stateChange', {
            from: fromState,
            to: toState,
            context: this.getContext()
        });
    }

    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        const listeners = this.eventListeners[event] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                logger.error(`Error in event listener for ${event}:`, error);
            }
        });
    }



    /**
     * Get state history
     * @returns {array} Array of state names in order
     */
    getStateHistory() {
        return [...this.stateHistory];
    }

    /**
     * Reset state machine to IDLE
     */
    reset() {
        this.currentState = STATES.IDLE;
        this.context = {
            courseId: this.context.courseId, // Keep courseId
            outcomeId: null,
            assignmentId: null,
            rubricId: null,
            rubricCriterionId: null,
            rollupData: null,
            averages: null,
            progressId: null,
            startTime: null,
            numberOfUpdates: 0,
            banner: null,
            error: null,
            retryCount: 0,
            updateMode: null
        };
        this.stateHistory = [STATES.IDLE];

        logger.debug('State machine reset to IDLE');
        this.emit('reset', {});
    }
}

