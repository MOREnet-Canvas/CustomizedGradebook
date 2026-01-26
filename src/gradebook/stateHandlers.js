// src/gradebook/stateHandlers.js
/**
 * State Handlers for Update Flow State Machine
 * 
 * Each handler function:
 * - Receives the state machine instance
 * - Performs the actions for that state
 * - Returns the next state to transition to
 * - Throws errors if something goes wrong (will transition to ERROR state)
 */

import { STATES } from "./stateMachine.js";
import { logger } from "../utils/logger.js";
import {
    AVG_OUTCOME_NAME,
    AVG_ASSIGNMENT_NAME,
    AVG_RUBRIC_NAME,
    PER_STUDENT_UPDATE_THRESHOLD,
    ENABLE_OUTCOME_UPDATES,
    ENABLE_GRADE_OVERRIDE,
    OVERRIDE_SCALE
} from "../config.js";
import { UserCancelledError } from "../utils/errorHandler.js";
import { CanvasApiClient } from "../utils/canvasApiClient.js";
import { calculateStudentAverages } from "../services/gradeCalculator.js";
import { postPerStudentGrades, beginBulkUpdate, waitForBulkGrading } from "../services/gradeSubmission.js";
import { verifyUIScores } from "../services/avgOutcomeVerification.js";
import { getElapsedTimeSinceStart, stopElapsedTimer } from "../utils/uiHelpers.js";

// Import Canvas API service functions
import { getRollup, getOutcomeObjectByName, createOutcome } from "../services/outcomeService.js";
import { getAssignmentObjectFromOutcomeObj, createAssignment } from "../services/assignmentService.js";
import { getRubricForAssignment, createRubric } from "../services/rubricService.js";
import { getAssignmentId } from "../utils/canvasHelpers.js";
import { enableCourseOverride, verifyOverrideScores } from "../services/gradeOverrideVerification.js";
import { getAllEnrollmentIds, getEnrollmentIdForUser, setOverrideScoreGQL } from "../services/gradeOverride.js";

/**
 * CHECKING_SETUP State Handler
 * Checks if outcome, assignment, and rubric exist
 * Transitions to CREATING_* states if resources are missing
 * Transitions to CALCULATING if all resources exist
 *
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance
 * @returns {Promise<string>} Next state (CREATING_OUTCOME, CREATING_ASSIGNMENT, CREATING_RUBRIC, or CALCULATING)
 * @throws {UserCancelledError} If user declines to create missing resources
 */
export async function handleCheckingSetup(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    // Set banner message based on grading mode
    const setupMessage = ENABLE_OUTCOME_UPDATES
        ? `Checking setup for "${AVG_OUTCOME_NAME}"...`
        : 'Checking setup for grade overrides...';
    banner.setText(setupMessage);
    logger.debug(`Grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);

    // Fetch rollup data (needed for both outcome and override modes)
    const data = await getRollup(courseId, apiClient);
    stateMachine.updateContext({ rollupData: data });

    // Only check/create outcome, assignment, and rubric if outcome updates are enabled
    if (ENABLE_OUTCOME_UPDATES) {
        // Check for outcome
        const outcomeObj = getOutcomeObjectByName(data);
        const outcomeId = outcomeObj?.id;

        if (!outcomeId) {
            const confirmCreate = confirm(`Outcome "${AVG_OUTCOME_NAME}" not found.\nWould you like to create it?`);
            if (!confirmCreate) throw new UserCancelledError("User declined to create missing outcome.");
            return STATES.CREATING_OUTCOME;
        }

        stateMachine.updateContext({ outcomeId });

        // Check for assignment
        let assignmentObj = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj, apiClient);

        // Fallback: try to find by name
        if (!assignmentObj) {
            const assignmentIdFromName = await getAssignmentId(courseId);
            if (assignmentIdFromName) {
                assignmentObj = await apiClient.get(
                    `/api/v1/courses/${courseId}/assignments/${assignmentIdFromName}`,
                    {},
                    "getAssignment:fallback"
                );
                logger.debug("Fallback assignment found by name:", assignmentObj);
            }
        }

        const assignmentId = assignmentObj?.id;

        if (!assignmentId) {
            const confirmCreate = confirm(`Assignment "${AVG_ASSIGNMENT_NAME}" not found.\nWould you like to create it?`);
            if (!confirmCreate) throw new UserCancelledError("User declined to create missing assignment.");
            return STATES.CREATING_ASSIGNMENT;
        }

        stateMachine.updateContext({ assignmentId });

        // Check for rubric
        const result = await getRubricForAssignment(courseId, assignmentId, apiClient);
        const rubricId = result?.rubricId;
        const rubricCriterionId = result?.criterionId;

        if (!rubricId) {
            const confirmCreate = confirm(`Rubric "${AVG_RUBRIC_NAME}" not found.\nWould you like to create it?`);
            if (!confirmCreate) throw new UserCancelledError("User declined to create missing rubric.");
            return STATES.CREATING_RUBRIC;
        }

        stateMachine.updateContext({ rubricId, rubricCriterionId });
    } else {
        logger.debug('Outcome updates disabled, skipping outcome/assignment/rubric checks');
        // In override-only mode, we still try to find outcomeId for calculating averages
        // (to exclude it from the calculation), but it's optional
        const outcomeObj = getOutcomeObjectByName(data);
        const outcomeId = outcomeObj?.id;
        if (outcomeId) {
            stateMachine.updateContext({ outcomeId });
            logger.debug(`Found outcomeId ${outcomeId} for exclusion from average calculation`);
        } else {
            logger.debug('No outcome found - will calculate averages without excluding any outcome');
        }
    }

    // Enable final grade override if configured
    if (ENABLE_GRADE_OVERRIDE) {
        try {
            await enableCourseOverride(courseId, apiClient);
        } catch (error) {
            logger.warn('Failed to enable course override, continuing anyway:', error);
            // Don't fail the entire flow if override setup fails
        }
    }

    // All resources exist (or not needed), move to calculating
    return STATES.CALCULATING;
}

/**
 * CREATING_OUTCOME State Handler
 * Creates the outcome and returns to CHECKING_SETUP
 */
export async function handleCreatingOutcome(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    banner.setText(`Creating "${AVG_OUTCOME_NAME}" Outcome...`);
    await createOutcome(courseId, apiClient);

    return STATES.CHECKING_SETUP;
}

/**
 * CREATING_ASSIGNMENT State Handler
 * Creates the assignment and returns to CHECKING_SETUP
 */
export async function handleCreatingAssignment(stateMachine) {
    const { courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    banner.setText(`Creating "${AVG_ASSIGNMENT_NAME}" Assignment...`);
    const assignmentId = await createAssignment(courseId, apiClient);
    stateMachine.updateContext({ assignmentId });

    return STATES.CHECKING_SETUP;
}

/**
 * CREATING_RUBRIC State Handler
 * Creates the rubric and returns to CHECKING_SETUP
 */
export async function handleCreatingRubric(stateMachine) {
    const { courseId, assignmentId, outcomeId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    banner.setText(`Creating "${AVG_RUBRIC_NAME}" Rubric...`);
    const rubricId = await createRubric(courseId, assignmentId, outcomeId, apiClient);
    stateMachine.updateContext({ rubricId });

    return STATES.CHECKING_SETUP;
}

/**
 * CALCULATING State Handler
 * Calculates student averages and determines next state
 */
export async function handleCalculating(stateMachine) {
    const { rollupData, outcomeId, courseId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    // Set banner message based on grading mode
    const calculatingMessage = ENABLE_OUTCOME_UPDATES
        ? `Calculating "${AVG_OUTCOME_NAME}" scores...`
        : 'Calculating student averages for grade overrides...';
    banner.setText(calculatingMessage);

    const averages = await calculateStudentAverages(rollupData, outcomeId, courseId, apiClient);
    const numberOfUpdates = averages.length;
    
    stateMachine.updateContext({ 
        averages, 
        numberOfUpdates,
        startTime: new Date().toISOString()
    });
    
    if (numberOfUpdates === 0) {
        // Mark as zero updates so COMPLETE handler can handle it appropriately
        stateMachine.updateContext({ zeroUpdates: true });
        return STATES.COMPLETE;
    }

    // Note: Individual localStorage keys removed - state machine context is now the single source of truth
    // The state machine already has: averages, outcomeId, startTime in its context
    // State machine will be saved to localStorage after this handler returns

    return STATES.UPDATING_GRADES;
}

/**
 * UPDATING_GRADES State Handler
 * Decides between per-student or bulk update and initiates the update
 */
export async function handleUpdatingGrades(stateMachine) {
    const { averages, courseId, assignmentId, rubricCriterionId, numberOfUpdates, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    // Check if outcome updates are enabled
    if (!ENABLE_OUTCOME_UPDATES) {
        logger.debug('Outcome updates disabled, skipping UPDATING_GRADES state');
        return STATES.VERIFYING;
    }

    // Decide update mode
    const usePerStudent = numberOfUpdates < PER_STUDENT_UPDATE_THRESHOLD;
    const updateMode = usePerStudent ? 'per-student' : 'bulk';

    stateMachine.updateContext({ updateMode });

    if (usePerStudent) {
        // Per-student update
        const message = `Detected ${numberOfUpdates} changes - updating scores one at a time for quicker processing.`;
        banner.hold(message, 3000);
        logger.debug('Per student update...');

        await postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, banner, apiClient, false);

        logger.debug(`handleUpdatingGrades complete, transitioning to VERIFYING`);
        return STATES.VERIFYING;
    } else {
        // Bulk update
        const message = `Detected ${numberOfUpdates} changes - using bulk update`;
        banner.hold(message, 3000);
        logger.debug(`Bulk update, detected ${numberOfUpdates} changes`);

        const progressId = await beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages, apiClient);
        stateMachine.updateContext({ progressId });
        logger.debug(`progressId: ${progressId}`);

        logger.debug(`handleUpdatingGrades complete, transitioning to POLLING_PROGRESS`);
        return STATES.POLLING_PROGRESS;
    }
}

/**
 * POLLING_PROGRESS State Handler
 * Polls the bulk update progress until complete
 */
export async function handlePollingProgress(stateMachine) {
    const { banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    logger.debug('Starting bulk update polling...');
    // waitForBulkGrading handles the polling internally
    await waitForBulkGrading(banner, apiClient, stateMachine);

    logger.debug(`handlePollingProgress complete, transitioning to VERIFYING`);
    return STATES.VERIFYING;
}

/**
 * VERIFYING State Handler
 * Verifies that outcome scores match expected values
 */
export async function handleVerifying(stateMachine) {
    const { courseId, averages, outcomeId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    // Check if outcome updates are enabled
    if (!ENABLE_OUTCOME_UPDATES) {
        logger.debug('Outcome updates disabled, skipping VERIFYING state');
        return STATES.VERIFYING_OVERRIDES;
    }

    logger.debug('Starting outcome score verification...');
    await verifyUIScores(courseId, averages, outcomeId, banner, apiClient, stateMachine);

    logger.debug(`handleVerifying complete, transitioning to VERIFYING_OVERRIDES`);
    return STATES.VERIFYING_OVERRIDES;
}

/**
 * VERIFYING_OVERRIDES State Handler
 * Submits and verifies grade overrides for all students
 */
export async function handleVerifyingOverrides(stateMachine) {
    const { courseId, averages, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    // Check if grade override is enabled
    if (!ENABLE_GRADE_OVERRIDE) {
        logger.debug('Grade override disabled, skipping VERIFYING_OVERRIDES state');
        return STATES.COMPLETE;
    }

    logger.debug('Starting grade override submission and verification...');
    banner.soft('Submitting grade overrides...');

    // Submit all grade overrides sequentially
    let successCount = 0;
    let failCount = 0;

    for (const { userId, average } of averages) {
        try {
            const enrollmentId = await getEnrollmentIdForUser(courseId, userId, apiClient);
            if (!enrollmentId) {
                logger.warn(`[override] No enrollmentId for user ${userId}`);
                failCount++;
                continue;
            }

            const override = OVERRIDE_SCALE(average);
            await setOverrideScoreGQL(enrollmentId, override, apiClient);
            logger.trace(`[override] user ${userId} → enrollment ${enrollmentId}: ${override}`);
            successCount++;
        } catch (e) {
            logger.warn(`[override] Failed for user ${userId}:`, e?.message || e);
            failCount++;
        }
    }

    logger.info(`Grade override submission complete: ${successCount} succeeded, ${failCount} failed`);

    // Verify override scores with retry logic
    const maxRetries = 3;
    const retryDelayMs = 2000; // 2 seconds between retries
    let overrideMismatches = [];

    try {
        const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            banner.soft(`Verifying grade overrides... (attempt ${attempt}/${maxRetries})`);
            logger.debug(`Override verification attempt ${attempt}/${maxRetries}...`);

            overrideMismatches = await verifyOverrideScores(courseId, averages, enrollmentMap, apiClient);

            if (overrideMismatches.length === 0) {
                logger.info(`All override scores verified successfully on attempt ${attempt}`);
                break;
            }

            // If mismatches found and not the last attempt, wait and retry
            if (attempt < maxRetries) {
                logger.warn(`Found ${overrideMismatches.length} override score mismatches on attempt ${attempt}, retrying in ${retryDelayMs/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            } else {
                // Last attempt - log final mismatches
                logger.warn(`Found ${overrideMismatches.length} override score mismatches after ${maxRetries} attempts`);
                logger.warn('Final mismatches:', overrideMismatches.map(m => ({
                    userId: m.userId,
                    expected: m.expected,
                    actual: m.actual
                })));
            }
        }
    } catch (error) {
        logger.warn('Override verification failed, continuing anyway:', error);
        // Don't fail the entire flow if override verification fails
    }

    logger.debug(`handleVerifyingOverrides complete, transitioning to COMPLETE`);
    return STATES.COMPLETE;
}

/**
 * COMPLETE State Handler
 * Shows success message and cleans up
 */
export async function handleComplete(stateMachine) {
    const { numberOfUpdates, banner, courseId, zeroUpdates } = stateMachine.getContext();

    const elapsedTime = getElapsedTimeSinceStart(stateMachine);
    stopElapsedTimer(banner);

    // Determine what was updated based on grading mode
    const updateTarget = ENABLE_OUTCOME_UPDATES && ENABLE_GRADE_OVERRIDE
        ? `${AVG_OUTCOME_NAME} and grade overrides`
        : ENABLE_OUTCOME_UPDATES
            ? AVG_OUTCOME_NAME
            : 'grade overrides';

    // Handle zero updates case (no changes needed)
    if (zeroUpdates || numberOfUpdates === 0) {
        banner.setText(`No changes to ${updateTarget} found.`);
        alert(`No changes to ${updateTarget} have been found. No updates performed.`);

        // Remove banner after a short delay
        setTimeout(() => {
            banner.remove();
        }, 2000);

        return STATES.IDLE;
    }

    // Normal completion with updates
    banner.setText(`${numberOfUpdates} student ${updateTarget} updated successfully! (elapsed time: ${elapsedTime}s)`);

    // Save completion data
    localStorage.setItem(`duration_${courseId}`, elapsedTime);
    localStorage.setItem(`lastUpdateAt_${courseId}`, new Date().toISOString());

    alert(`All ${updateTarget} have been updated. (elapsed time: ${elapsedTime}s)\nYou may need to refresh the page to see the new scores.`);

    return STATES.IDLE;
}

/**
 * ERROR State Handler
 * Handles errors and indicates premature termination
 */
export async function handleError(stateMachine) {
    const { error, banner } = stateMachine.getContext();

    logger.error('Update ended prematurely:', error);

    if (banner) {
        banner.setText(`Update ended prematurely: ${error.message}. You can re-run the update to ensure all scores are correctly set.`);
        setTimeout(() => banner.remove(), 5000);
    }

    return STATES.IDLE;
}

/**
 * State handler registry
 * Maps state names to handler functions
 */
export const STATE_HANDLERS = {
    [STATES.CHECKING_SETUP]: handleCheckingSetup,
    [STATES.CREATING_OUTCOME]: handleCreatingOutcome,
    [STATES.CREATING_ASSIGNMENT]: handleCreatingAssignment,
    [STATES.CREATING_RUBRIC]: handleCreatingRubric,
    [STATES.CALCULATING]: handleCalculating,
    [STATES.UPDATING_GRADES]: handleUpdatingGrades,
    [STATES.POLLING_PROGRESS]: handlePollingProgress,
    [STATES.VERIFYING]: handleVerifying,
    [STATES.VERIFYING_OVERRIDES]: handleVerifyingOverrides,
    [STATES.COMPLETE]: handleComplete,
    [STATES.ERROR]: handleError
};