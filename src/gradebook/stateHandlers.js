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
    ENFORCE_COURSE_OVERRIDE,
    ENFORCE_COURSE_GRADING_SCHEME,
    OVERRIDE_SCALE,
    USE_UNIFIED_GRAPHQL_ONLY
} from "../config.js";
import { UserCancelledError } from "../utils/errorHandler.js";
import { CanvasApiClient } from "../utils/canvasApiClient.js";
import { calculateStudentAverages, calculateStudentAveragesWithIE } from "../services/gradeCalculator.js";
import { postPerStudentGrades, beginBulkUpdate, waitForBulkGrading } from "../services/gradeSubmission.js";
import { fetchAllSubmissions, fetchRubricAssociationId } from "../services/submissionService.js";
import { submitUnifiedGrade } from "../services/unifiedGraphQLGrading.js";
import { verifyUIScores } from "../services/avgOutcomeVerification.js";
import { getElapsedTimeSinceStart, stopElapsedTimer } from "../utils/uiHelpers.js";

// Import Canvas API service functions
import { getRollup, getOutcomeObjectByName, createOutcome } from "../services/outcomeService.js";
import { getAssignmentObjectFromOutcomeObj, createAssignment } from "../services/assignmentService.js";
import { getRubricForAssignment, createRubric } from "../services/rubricService.js";
import { enableCourseOverride, verifyOverrideScores } from "../services/gradeOverrideVerification.js";
import { getAllEnrollmentIds, getEnrollmentIdForUser, setOverrideScoreGQL } from "../services/gradeOverride.js";
import { enableCourseGradingScheme } from "../services/courseService.js";
import { refreshMasteryForAssignment } from "../services/masteryRefreshService.js";
import { clearAllSnapshots } from "../services/courseSnapshotService.js";

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
        logger.trace(`Assignment object from outcome:`, assignmentObj);
        // Fallback: try to find by name
        if (!assignmentObj) {
            const assignments = await apiClient.get(
                `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`,
                {},
                "getAssignment:fallback"
            );
            assignmentObj = assignments.find(a => a.name === AVG_ASSIGNMENT_NAME);
            if (assignmentObj) {
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
        logger.trace(`Rubric found:`, result);

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
    if (ENABLE_GRADE_OVERRIDE && ENFORCE_COURSE_OVERRIDE) {
        try {
            await enableCourseOverride(courseId, apiClient);
        } catch (error) {
            logger.warn('Failed to enable course override, continuing anyway:', error);
            // Don't fail the entire flow if override setup fails
        }
    }

    // Enable course grading scheme if configured
    if (ENFORCE_COURSE_GRADING_SCHEME) {
        try {
            await enableCourseGradingScheme(courseId, apiClient);
        } catch (error) {
            logger.warn('Failed to enable course grading scheme, continuing anyway:', error);
            // Don't fail the entire flow if grading scheme setup fails
        }
    }

    // Branch based on grading mode
    logger.debug(`[GraphQL Check] USE_UNIFIED_GRAPHQL_ONLY=${USE_UNIFIED_GRAPHQL_ONLY}, ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}`);
    if (USE_UNIFIED_GRAPHQL_ONLY && ENABLE_OUTCOME_UPDATES) {
        logger.debug('GraphQL-only mode enabled, transitioning to PRELOAD_SUBMISSIONS');
        return STATES.PRELOAD_SUBMISSIONS;
    }

    // All resources exist (or not needed), move to calculating
    logger.debug('Using standard path, transitioning to CALCULATING');
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

    // Clear course snapshot cache to force re-detection of course type
    clearAllSnapshots();
    logger.debug('[UpdateFlow] Cleared course snapshots after creating outcome');

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

    // Clear course snapshot cache to force re-detection of course type
    clearAllSnapshots();
    logger.debug('[UpdateFlow] Cleared course snapshots after creating assignment');

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
 * PRELOAD_SUBMISSIONS State Handler
 * Fetches submission IDs and rubric association ID for GraphQL grading
 * Only used when USE_UNIFIED_GRAPHQL_ONLY is enabled
 */
export async function handlePreloadSubmissions(stateMachine) {
    const { courseId, assignmentId, rubricId, banner } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    banner.setText('Preloading submission data for GraphQL grading...');
    logger.debug('Fetching submission IDs and rubric association ID...');

    // Fetch all submissions
    logger.trace('[Preload] Calling fetchAllSubmissions...');
    const { submissionIdByUserId, rubricAssociationId: cachedAssocId } =
        await fetchAllSubmissions(courseId, assignmentId, apiClient);

    logger.trace(`[Preload] Fetched ${submissionIdByUserId.size} submissions`);

    let rubricAssociationId = cachedAssocId;

    // If not found in submissions or cache, fetch separately
    if (!rubricAssociationId) {
        logger.trace('[Preload] No cached rubricAssociationId, fetching separately...');
        rubricAssociationId = await fetchRubricAssociationId(courseId, rubricId, assignmentId, apiClient);
    } else {
        logger.trace(`[Preload] Using cached rubricAssociationId: ${rubricAssociationId}`);
    }

    logger.debug(`Preloaded ${submissionIdByUserId.size} submission IDs, rubricAssociationId: ${rubricAssociationId}`);

    stateMachine.updateContext({
        submissionIdByUserId,
        rubricAssociationId
    });

    return STATES.CALCULATING;
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

    let averages;
    let numberOfUpdates;

    // Use IE-aware calculation for GraphQL-only mode
    logger.debug(`[GraphQL Check] USE_UNIFIED_GRAPHQL_ONLY=${USE_UNIFIED_GRAPHQL_ONLY}, ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}`);
    if (USE_UNIFIED_GRAPHQL_ONLY && ENABLE_OUTCOME_UPDATES) {
        logger.debug('Using IE-aware calculation for GraphQL-only mode');
        averages = calculateStudentAveragesWithIE(rollupData, outcomeId);
        numberOfUpdates = averages.length;
    } else {
        logger.debug('Using standard calculation');
        averages = await calculateStudentAverages(rollupData, outcomeId, courseId, apiClient);
        numberOfUpdates = averages.length;
    }

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
    const { averages, courseId, assignmentId, rubricCriterionId, numberOfUpdates, banner,
            submissionIdByUserId, rubricAssociationId } = stateMachine.getContext();
    const apiClient = new CanvasApiClient();

    // Check if outcome updates are enabled
    if (!ENABLE_OUTCOME_UPDATES) {
        logger.debug('Outcome updates disabled, skipping UPDATING_GRADES state');
        return STATES.VERIFYING;
    }

    // GraphQL-only path
    logger.debug(`[GraphQL Check] USE_UNIFIED_GRAPHQL_ONLY=${USE_UNIFIED_GRAPHQL_ONLY}`);
    if (USE_UNIFIED_GRAPHQL_ONLY) {
        logger.debug('Using GraphQL-only grading path');
        banner.setText(`Updating grades via GraphQL for ${numberOfUpdates} students...`);

        // Get enrollment map
        const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);

        const maxAttempts = 3;
        const errors = [];
        let successCount = 0;

        for (const student of averages) {
            const { userId, average, action, zeroCount } = student;

            logger.trace(`[GraphQL] Processing student ${userId}: action=${action}, average=${average}, zeroCount=${zeroCount}`);

            // Get required IDs
            const enrollmentId = enrollmentMap.get(String(userId));
            const submissionId = submissionIdByUserId?.get(String(userId));

            if (!enrollmentId || !submissionId) {
                logger.warn(`Missing IDs for user ${userId}: enrollmentId=${enrollmentId}, submissionId=${submissionId}`);
                errors.push({ userId, error: 'Missing enrollment or submission ID' });
                continue;
            }

            // Determine override score and rubric points based on action
            let overrideScore = null;
            let rubricPoints = null;
            let comment = '';
            const timestamp = new Date().toLocaleString();

            if (action === "IE") {
                // IE case: Clear everything, set custom status
                overrideScore = null;
                rubricPoints = null;
                comment = `Insufficient evidence for ${AVG_ASSIGNMENT_NAME} calculation: (${zeroCount} outcome${zeroCount === 1 ? '' : 's'} with zero score). Updated: ${timestamp}`;
            } else {
                // SCORE case: Set scores
                overrideScore = OVERRIDE_SCALE(average);
                rubricPoints = average;
                comment = `Score: ${average}  Updated: ${timestamp}`;
            }

            logger.trace(`[GraphQL] Determined: overrideScore=${overrideScore}, rubricPoints=${rubricPoints}`);

            // Retry logic
            let attempt = 1;
            let success = false;

            while (attempt <= maxAttempts && !success) {
                try {
                    logger.trace(`[GraphQL] Calling submitUnifiedGrade for user ${userId} (attempt ${attempt}/${maxAttempts})`);
                    await submitUnifiedGrade({
                        enrollmentId,
                        submissionId,
                        rubricAssociationId,
                        rubricCriterionId,
                        action,
                        overrideScore,
                        rubricPoints,
                        comment
                    }, apiClient);

                    successCount++;
                    success = true;
                    logger.trace(`[GraphQL] ${action} submitted for user ${userId} (attempt ${attempt})`);
                } catch (error) {
                    logger.warn(`[GraphQL] Failed for user ${userId} (attempt ${attempt}/${maxAttempts}):`, error.message);
                    if (attempt === maxAttempts) {
                        errors.push({ userId, error: error.message });
                    }
                    attempt++;
                }
            }

            // Update banner periodically
            if (successCount % 5 === 0) {
                banner.soft(`Updated ${successCount}/${numberOfUpdates} students via GraphQL...`);
            }
        }

        logger.info(`GraphQL grading complete: ${successCount}/${numberOfUpdates} successful, ${errors.length} errors`);

        if (errors.length > 0) {
            logger.warn('GraphQL grading errors:', errors);
        }

        logger.debug(`handleUpdatingGrades complete, transitioning to REFRESHING_MASTERY`);
        return STATES.REFRESHING_MASTERY;
    }

    // Existing REST/bulk pipeline (default behavior)
    logger.debug('Using REST/bulk pipeline (default behavior)');
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

        logger.debug(`handleUpdatingGrades complete, transitioning to REFRESHING_MASTERY`);
        return STATES.REFRESHING_MASTERY;
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

    logger.debug(`handlePollingProgress complete, transitioning to REFRESHING_MASTERY`);
    return STATES.REFRESHING_MASTERY;
}

/**
 * REFRESHING_MASTERY State Handler
 * Refreshes mastery levels for the avg assignment after grades are uploaded
 */
export async function handleRefreshingMastery(stateMachine) {
    const { courseId, assignmentId, banner } = stateMachine.getContext();

    if (!assignmentId) {
        logger.warn('No assignmentId in context, skipping mastery refresh');
        return STATES.VERIFYING;
    }

    try {
        logger.debug('Refreshing mastery for avg assignment...');
        banner.soft('Refreshing mastery levels...');

        await refreshMasteryForAssignment(courseId, assignmentId);

        logger.info('Mastery refresh completed for avg assignment');
    } catch (error) {
        logger.warn('Failed to refresh mastery for avg assignment, continuing anyway:', error);
        // Don't fail the entire flow if mastery refresh fails
    }

    // GraphQL mode: Skip verification states (overrides already submitted in UPDATING_GRADES)
    if (USE_UNIFIED_GRAPHQL_ONLY) {
        logger.debug(`handleRefreshingMastery complete, transitioning to COMPLETE (GraphQL mode - verification skipped)`);
        return STATES.COMPLETE;
    }

    logger.debug(`handleRefreshingMastery complete, transitioning to VERIFYING`);
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

    // Track if all overrides failed (indicates course override setting may not be enabled)
    const allOverridesFailed = failCount > 0 && successCount === 0 && averages.length > 0;

    // Store override failure status in context for completion message
    if (allOverridesFailed && !ENFORCE_COURSE_OVERRIDE) {
        stateMachine.updateContext({ overridesNotEnabled: true });
    }

    // Verify override scores with retry logic
    // Option A: Reset counter when mismatches decrease
    const maxRetries = 3;
    const retryDelayMs = 2000; // 2 seconds between retries
    let overrideMismatches = [];
    let previousMismatchCount = Infinity;
    let attempt = 1;

    try {
        const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);

        while (attempt <= maxRetries) {
            banner.soft(`Verifying grade overrides... (attempt ${attempt}/${maxRetries})`);
            logger.debug(`Override verification attempt ${attempt}/${maxRetries}...`);

            overrideMismatches = await verifyOverrideScores(courseId, averages, enrollmentMap, apiClient);
            const currentMismatchCount = overrideMismatches.length;

            if (currentMismatchCount === 0) {
                logger.info(`All override scores verified successfully on attempt ${attempt}`);
                break;
            }

            // Check if mismatches decreased (progress made)
            if (currentMismatchCount < previousMismatchCount) {
                logger.info(`Mismatches decreased from ${previousMismatchCount} to ${currentMismatchCount}, resetting retry counter`);
                previousMismatchCount = currentMismatchCount;
                attempt = 1; // Reset counter - we're making progress
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                continue;
            }

            // No progress made
            previousMismatchCount = currentMismatchCount;

            // If not the last attempt, wait and retry
            if (attempt < maxRetries) {
                logger.warn(`Found ${currentMismatchCount} override score mismatches on attempt ${attempt}, retrying in ${retryDelayMs/1000}s...`);
                attempt++;
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            } else {
                // Last attempt - log final mismatches
                logger.warn(`Found ${currentMismatchCount} override score mismatches after ${maxRetries} attempts with no progress`);
                logger.warn('Final mismatches:', overrideMismatches.map(m => ({
                    userId: m.userId,
                    expected: m.expected,
                    actual: m.actual
                })));

                // If all verifications failed and ENFORCE_COURSE_OVERRIDE is false, likely course setting not enabled
                if (currentMismatchCount === averages.length && !ENFORCE_COURSE_OVERRIDE) {
                    stateMachine.updateContext({ overridesNotEnabled: true });
                }

                // Store mismatch count for completion message
                stateMachine.updateContext({ overrideMismatchCount: currentMismatchCount });
                break;
            }
        }

        // Store final mismatch count in context (even if zero)
        if (overrideMismatches.length > 0) {
            stateMachine.updateContext({ overrideMismatchCount: overrideMismatches.length });
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
    const { numberOfUpdates, banner, courseId, zeroUpdates, overridesNotEnabled, overrideMismatchCount } = stateMachine.getContext();

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
    let bannerText = `${numberOfUpdates} student ${updateTarget} updated successfully! (elapsed time: ${elapsedTime}s)`;

    // Add warning to banner if there are override mismatches
    if (overrideMismatchCount && overrideMismatchCount > 0) {
        bannerText += ` ⚠️ ${overrideMismatchCount} override verification mismatches`;
    }

    banner.setText(bannerText);

    // Save completion data
    localStorage.setItem(`duration_${courseId}`, elapsedTime);
    localStorage.setItem(`lastUpdateAt_${courseId}`, new Date().toISOString());

    // Build completion message
    let completionMessage = `All ${updateTarget} have been updated. (elapsed time: ${elapsedTime}s)\nYou may need to refresh the page to see the new scores.`;

    // Add warning if override grades were not enabled in the course
    if (overridesNotEnabled && ENABLE_GRADE_OVERRIDE && !ENFORCE_COURSE_OVERRIDE) {
        completionMessage += '\n\nOverride grades not enabled for this course';
    }

    // Add warning if there are override verification mismatches
    if (overrideMismatchCount && overrideMismatchCount > 0) {
        completionMessage += `\n\n⚠️ Update complete but ${overrideMismatchCount} students may not have correct override grades. Please try running again.`;
    }

    alert(completionMessage);

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
    [STATES.PRELOAD_SUBMISSIONS]: handlePreloadSubmissions,
    [STATES.CALCULATING]: handleCalculating,
    [STATES.UPDATING_GRADES]: handleUpdatingGrades,
    [STATES.POLLING_PROGRESS]: handlePollingProgress,
    [STATES.REFRESHING_MASTERY]: handleRefreshingMastery,
    [STATES.VERIFYING]: handleVerifying,
    [STATES.VERIFYING_OVERRIDES]: handleVerifyingOverrides,
    [STATES.COMPLETE]: handleComplete,
    [STATES.ERROR]: handleError
};