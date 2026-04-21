// src/masteryOutlook/plOutlookStateMachine.js
/**
 * PL Outlook Sync State Machine
 *
 * Per-outcome state machine for syncing Power Law predicted scores back to
 * Canvas outcome rollups via hidden override assignments.
 *
 * Mirrors UpdateFlowStateMachine (src/gradebook/stateMachine.js) patterns:
 *   - Same transition/context/event API
 *   - Same on() / emit() event system
 *   - Same getStateHistory() / reset() shape
 *
 * Differences from the gradebook state machine:
 *   - Scoped to a single outcome (one instance per outcome)
 *   - Uses pl_assignments from mastery_outlook_cache.json for fast setup detection
 *   - No banner — progress via onProgress callback (inline in outcome row)
 *   - Filters departed students automatically
 */

import { logger } from '../utils/logger.js';

// ─── States ──────────────────────────────────────────────────────────────────

export const PL_STATES = {
    IDLE:                  'IDLE',
    CHECKING_SETUP:        'CHECKING_SETUP',
    CREATING_ASSIGNMENT:   'CREATING_ASSIGNMENT',
    CHECKING_STUDENTS:     'CHECKING_STUDENTS',
    FETCHING_SUBMISSIONS:  'FETCHING_SUBMISSIONS',
    CALCULATING_CHANGES:   'CALCULATING_CHANGES',
    SYNCING:               'SYNCING',
    VERIFYING:             'VERIFYING',
    COMPLETE:              'COMPLETE',
    ERROR:                 'ERROR'
};

// ─── Valid transitions ────────────────────────────────────────────────────────

const VALID_TRANSITIONS = {
    [PL_STATES.IDLE]:                 [PL_STATES.CHECKING_SETUP],
    [PL_STATES.CHECKING_SETUP]:       [PL_STATES.CREATING_ASSIGNMENT, PL_STATES.CHECKING_STUDENTS, PL_STATES.ERROR],
    [PL_STATES.CREATING_ASSIGNMENT]:  [PL_STATES.CHECKING_STUDENTS, PL_STATES.ERROR],
    [PL_STATES.CHECKING_STUDENTS]:    [PL_STATES.FETCHING_SUBMISSIONS, PL_STATES.CALCULATING_CHANGES, PL_STATES.ERROR],
    [PL_STATES.FETCHING_SUBMISSIONS]: [PL_STATES.CALCULATING_CHANGES, PL_STATES.ERROR],
    [PL_STATES.CALCULATING_CHANGES]:  [PL_STATES.SYNCING, PL_STATES.COMPLETE, PL_STATES.ERROR],
    [PL_STATES.SYNCING]:              [PL_STATES.VERIFYING, PL_STATES.ERROR],
    [PL_STATES.VERIFYING]:            [PL_STATES.VERIFYING, PL_STATES.COMPLETE, PL_STATES.ERROR],
    [PL_STATES.COMPLETE]:             [PL_STATES.IDLE],
    [PL_STATES.ERROR]:                [PL_STATES.IDLE]
};

// ─── State machine ────────────────────────────────────────────────────────────

export class PLOutlookStateMachine {
    /**
     * @param {Object} initialContext
     * @param {string}   initialContext.courseId
     * @param {string}   initialContext.outcomeId      - Canvas outcome ID
     * @param {string}   initialContext.outcomeName    - Human-readable name for UI
     * @param {Object}   initialContext.apiClient      - CanvasApiClient instance
     * @param {Function} [initialContext.onProgress]   - (state, outcomeName, message, done, total) => void
     * @param {Array}    [initialContext.targetUserIds] - If set, only sync these students
     */
    constructor(initialContext = {}) {
        this.currentState   = PL_STATES.IDLE;
        this.eventListeners = {};
        this.stateHistory   = [PL_STATES.IDLE];

        this.context = {
            courseId:             null,
            outcomeId:            null,
            outcomeName:          null,
            apiClient:            null,
            onProgress:           null,
            targetUserIds:        null,   // null = all students

            // Populated during CHECKING_SETUP
            assignmentId:         null,
            rubricId:             null,
            rubricAssociationId:  null,
            rubricCriterionId:    null,

            // Populated during CHECKING_STUDENTS / FETCHING_SUBMISSIONS
            activeUserIds:        null,   // Set of active enrolled student IDs
            submissionIdByUserId: null,   // Map<userId, submissionId>
            effectiveTargetIds:   null,

            // Populated during CALCULATING_CHANGES
            studentsToSync:       null,
            numberOfUpdates:      0,

            // Results
            successCount:         0,
            errors:               [],
            startTime:            null,
            error:                null,

            ...initialContext
        };
    }

    // ─── State accessors ───────────────────────────────────────────────────

    getCurrentState()          { return this.currentState; }
    getContext()               { return { ...this.context }; }
    updateContext(updates)     { this.context = { ...this.context, ...updates }; }
    getStateHistory()          { return [...this.stateHistory]; }

    canTransition(toState) {
        return (VALID_TRANSITIONS[this.currentState] || []).includes(toState);
    }

    transition(toState, contextUpdates = {}) {
        if (!this.canTransition(toState)) {
            throw new Error(
                `Invalid PL transition: ${this.currentState} → ${toState}. ` +
                `Valid: ${VALID_TRANSITIONS[this.currentState]?.join(', ') || 'none'}`
            );
        }
        const from      = this.currentState;
        this.currentState = toState;
        this.stateHistory.push(toState);
        this.updateContext(contextUpdates);

        logger.debug(`[PLSync] ${from} → ${toState}`);
        this.emit('stateChange', { from, to: toState, context: this.getContext() });
    }

    // ─── Progress helper ───────────────────────────────────────────────────

    /** Notify the UI of progress within the current state. */
    progress(message, done = null, total = null) {
        const { onProgress, outcomeName } = this.context;
        if (onProgress) onProgress(this.currentState, outcomeName, message, done, total);
    }

    // ─── Event system (mirrors UpdateFlowStateMachine) ─────────────────────

    on(event, callback) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        (this.eventListeners[event] || []).forEach(cb => {
            try { cb(data); } catch (err) {
                logger.error(`[PLSync] Error in event listener for ${event}:`, err);
            }
        });
    }

    // ─── Reset ─────────────────────────────────────────────────────────────

    reset() {
        this.currentState = PL_STATES.IDLE;
        this.stateHistory = [PL_STATES.IDLE];
        this.emit('reset', {});
        logger.debug('[PLSync] State machine reset to IDLE');
    }
}
