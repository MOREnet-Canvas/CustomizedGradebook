// src/masteryOutlook/plOutlookStateHandlers.js
/**
 * PL Outlook Sync — State Handlers
 *
 * Mirrors stateHandlers.js patterns (src/gradebook/stateHandlers.js) but:
 *   - Uses pl_assignments from mastery_outlook_cache.json for fast setup detection
 *   - Reads PL predictions directly from cache.students (no separate lookup table)
 *   - Filters to active enrolled students only (handles departed students)
 *   - No floating banner — progress via onProgress callback (inline in outcome row)
 *
 * Each handler receives the PLOutlookStateMachine instance, performs its work,
 * and returns the next PL_STATE to transition to.
 */

import { PL_STATES } from './plOutlookStateMachine.js';
import { readMasteryOutlookCache, readPLAssignments, writePLAssignments } from './masteryOutlookCacheService.js';
import { submitRubricAssessmentBatch } from '../services/graphqlGradingService.js';
import { fetchCourseStudents } from '../services/enrollmentService.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_MAX_POINTS, OUTCOME_AND_RUBRIC_RATINGS } from '../config.js';

/** Compare two scores rounded to the hundredths place */
const scoresMatch = (a, b) => Math.round(a * 100) === Math.round(b * 100);

// ─── CHECKING_SETUP ──────────────────────────────────────────────────────────

/**
 * Fast setup check — reads pl_assignments from the cache first.
 * Only hits Canvas API on the very first run for a given outcome.
 */
export async function handleCheckingSetup(sm) {
    const { courseId, outcomeId, outcomeName, apiClient } = sm.getContext();
    sm.progress('Checking setup...');
    logger.debug(`[PLSync] CHECKING_SETUP for outcome ${outcomeId} (${outcomeName})`);

    const plAssignments = await readPLAssignments(courseId, apiClient);
    const cached        = plAssignments[outcomeId];

    if (cached?.assignment_id && cached?.criterion_id && cached?.rubric_association_id) {
        logger.debug(`[PLSync] Setup found in cache for outcome ${outcomeId}`);
        sm.updateContext({
            assignmentId:         cached.assignment_id,
            rubricId:             cached.rubric_id,
            rubricAssociationId:  cached.rubric_association_id,
            rubricCriterionId:    cached.criterion_id,
            submissionIdByUserId: cached.submission_ids
                ? new Map(Object.entries(cached.submission_ids).map(([k, v]) => [String(k), String(v)]))
                : null
        });
        return PL_STATES.CHECKING_STUDENTS;
    }

    logger.info(`[PLSync] No cached setup for outcome ${outcomeId} — running first-time setup`);
    return PL_STATES.CREATING_ASSIGNMENT;
}

// ─── CREATING_ASSIGNMENT ─────────────────────────────────────────────────────

/**
 * One-time setup per outcome:
 *   1. Set outcome calculation_method to 'latest' so PL override always wins
 *   2. Create assignment visible to everyone (Canvas creates submission records)
 *   3. Create rubric linked to the outcome
 *   4. Wait 3 s for Canvas to generate submission records
 *   5. Fetch and cache all submission IDs while still visible
 *   6. Flip assignment to only_visible_to_overrides: true
 *   7. Merge result into pl_assignments and write back to cache
 */
export async function handleCreatingAssignment(sm) {
    const { courseId, outcomeId, outcomeName, apiClient } = sm.getContext();
    sm.progress('Creating PL override assignment...');
    logger.info(`[PLSync] CREATING_ASSIGNMENT for outcome ${outcomeId}`);

    // Step 1: Set outcome calculation_method to 'latest'
    await apiClient.put(
        `/api/v1/outcomes/${outcomeId}`,
        { calculation_method: 'latest' },
        {}, 'PLSync:setCalculationMethod'
    );
    logger.debug(`[PLSync] Outcome ${outcomeId} calculation_method set to latest`);

    // Step 2: Create assignment visible to everyone
    const assignmentResp = await apiClient.post(
        `/api/v1/courses/${courseId}/assignments`,
        {
            assignment: {
                name:                      `PL Override — ${outcomeName}`,
                points_possible:           0,
                published:                 true,
                only_visible_to_overrides: false,
                post_manually:             true,
                grading_type:              'points',
                submission_types:          ['none'],
                omit_from_final_grade:     true
            }
        },
        {}, 'PLSync:createAssignment'
    );
    const assignmentId = assignmentResp.id;
    if (!assignmentId) throw new Error(`[PLSync] Failed to create assignment for outcome ${outcomeId}`);
    logger.debug(`[PLSync] Assignment created: ${assignmentId}`);

    // Step 3: Create rubric linked to the outcome
    sm.progress('Creating rubric...');
    const ratingsObj = {};
    OUTCOME_AND_RUBRIC_RATINGS.forEach((r, i) => {
        ratingsObj[String(i)] = { description: r.description, points: r.points };
    });

    const rubricResp = await apiClient.post(
        `/api/v1/courses/${courseId}/rubrics`,
        {
            rubric: {
                title:                      `PL Override Rubric — ${outcomeName}`,
                free_form_criterion_comments: false,
                criteria: {
                    '0': {
                        description:          outcomeName,
                        learning_outcome_id:  outcomeId,
                        criterion_use_range:  false,
                        points:               DEFAULT_MAX_POINTS,
                        ratings:              ratingsObj
                    }
                }
            },
            rubric_association: {
                association_id:   assignmentId,
                association_type: 'Assignment',
                use_for_grading:  true,
                purpose:          'grading'
            }
        },
        {}, 'PLSync:createRubric'
    );

    const rubricId           = rubricResp.rubric?.id;
    const rubricAssociationId = String(rubricResp.rubric_association?.id || '');
    if (!rubricId) throw new Error(`[PLSync] Failed to create rubric for outcome ${outcomeId}`);
    logger.debug(`[PLSync] Rubric created: ${rubricId}, association: ${rubricAssociationId}`);

    // Step 4: Fetch criterion ID from the assignment
    const asgDetail       = await apiClient.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, {}, 'PLSync:fetchAssignment');
    const rubricCriterionId = asgDetail.rubric?.[0]?.id;
    if (!rubricCriterionId) throw new Error(`[PLSync] Could not read criterion ID for outcome ${outcomeId}`);
    logger.debug(`[PLSync] Criterion ID: ${rubricCriterionId}`);

    // Step 5: Wait for Canvas to create submission records
    sm.progress('Waiting for submission records...');
    await new Promise(r => setTimeout(r, 3000));

    // Step 6: Fetch all submission IDs while still visible
    const submissions         = await apiClient.getAllPages(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, { per_page: 100 }, 'PLSync:fetchSubmissions');
    const submissionIdByUserId = new Map();
    submissions.forEach(s => {
        if (s.id && s.user_id) submissionIdByUserId.set(String(s.user_id), String(s.id));
    });
    logger.debug(`[PLSync] Got ${submissionIdByUserId.size} submission records`);

    // Step 7: Flip to hidden
    sm.progress('Hiding assignment from students...');
    await apiClient.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
        {
            assignment: {
                only_visible_to_overrides: true,
                post_manually:             true,
                points_possible:           0
            }
        },
        {}, 'PLSync:hideAssignment'
    );
    logger.debug(`[PLSync] Assignment finalized — hidden, post_manually:true, points:0`);
    logger.debug(`[PLSync] Assignment ${assignmentId} hidden from students`);

    // Step 8: Merge into pl_assignments and write back
    const submissionIdsObj = {};
    submissionIdByUserId.forEach((subId, userId) => { submissionIdsObj[userId] = subId; });

    const plAssignments = await readPLAssignments(courseId, apiClient);
    plAssignments[outcomeId] = {
        assignment_id:         assignmentId,
        rubric_id:             rubricId,
        rubric_association_id: rubricAssociationId,
        criterion_id:          rubricCriterionId,
        submission_ids:        submissionIdsObj,
        created_at:            new Date().toISOString()
    };
    await writePLAssignments(courseId, plAssignments, apiClient);
    logger.info(`[PLSync] Setup cached in mastery_outlook_cache.json for outcome ${outcomeId}`);

    sm.updateContext({ assignmentId, rubricId, rubricAssociationId, rubricCriterionId, submissionIdByUserId });
    return PL_STATES.CHECKING_STUDENTS;
}

// ─── CHECKING_STUDENTS ────────────────────────────────────────────────────────

/**
 * Compare active enrollment against cached submission IDs.
 * Filters out departed students. Identifies new students who need a submission record.
 */
export async function handleCheckingStudents(sm) {
    const { courseId, submissionIdByUserId, targetUserIds, apiClient } = sm.getContext();
    sm.progress('Checking student roster...');
    logger.debug('[PLSync] CHECKING_STUDENTS');

    const students    = await fetchCourseStudents(courseId, apiClient);
    const activeUserIds = new Set(students.map(s => String(s.userId)));
    logger.debug(`[PLSync] ${activeUserIds.size} active students`);

    // Log departed students (they're skipped but their submission IDs stay cached)
    if (submissionIdByUserId) {
        submissionIdByUserId.forEach((_, userId) => {
            if (!activeUserIds.has(userId)) {
                logger.info(`[PLSync] Student ${userId} has left the course — will be skipped`);
            }
        });
    }

    // Find new students who joined after initial setup (no cached submission ID yet)
    const cachedUserIds = new Set(submissionIdByUserId?.keys() || []);
    const newStudents   = [...activeUserIds].filter(id => !cachedUserIds.has(id));

    // Apply targetUserIds filter (single-student sync)
    const effectiveTargetIds = targetUserIds
        ? new Set(targetUserIds.map(String).filter(id => activeUserIds.has(id)))
        : activeUserIds;

    sm.updateContext({ activeUserIds, effectiveTargetIds });

    if (newStudents.length > 0) {
        logger.info(`[PLSync] ${newStudents.length} new student(s) need submission records`);
        sm.updateContext({ newStudents });
        return PL_STATES.FETCHING_SUBMISSIONS;
    }

    return PL_STATES.CALCULATING_CHANGES;
}

// ─── FETCHING_SUBMISSIONS ─────────────────────────────────────────────────────

/**
 * Fetch submission IDs for students who joined after initial setup.
 * Uses the same visibility-toggle pattern as CREATING_ASSIGNMENT.
 */
export async function handleFetchingSubmissions(sm) {
    const { courseId, assignmentId, outcomeId, newStudents, submissionIdByUserId, apiClient } = sm.getContext();
    sm.progress(`Fetching submission records for ${newStudents.length} new student(s)...`);
    logger.info(`[PLSync] FETCHING_SUBMISSIONS for ${newStudents.length} new student(s)`);

    await apiClient.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, { assignment: { only_visible_to_overrides: false } }, {}, 'PLSync:showForNewStudents');
    await new Promise(r => setTimeout(r, 3000));

    const submissions  = await apiClient.getAllPages(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, { per_page: 100 }, 'PLSync:fetchNewSubmissions');
    const updatedMap   = submissionIdByUserId ? new Map(submissionIdByUserId) : new Map();
    let newCount       = 0;
    submissions.forEach(s => {
        if (s.id && s.user_id && newStudents.includes(String(s.user_id))) {
            updatedMap.set(String(s.user_id), String(s.id));
            newCount++;
        }
    });
    logger.debug(`[PLSync] Got ${newCount} new submission records`);

    await apiClient.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, { assignment: { only_visible_to_overrides: true } }, {}, 'PLSync:rehideAssignment');

    // Persist updated submission map
    const plAssignments = await readPLAssignments(courseId, apiClient);
    if (plAssignments[outcomeId]) {
        const subIdsObj = {};
        updatedMap.forEach((subId, userId) => { subIdsObj[userId] = subId; });
        plAssignments[outcomeId].submission_ids = subIdsObj;
        await writePLAssignments(courseId, plAssignments, apiClient);
    }

    sm.updateContext({ submissionIdByUserId: updatedMap });
    return PL_STATES.CALCULATING_CHANGES;
}

// ─── CALCULATING_CHANGES ──────────────────────────────────────────────────────

/**
 * Compare PL predictions (from mastery_outlook_cache.json) vs current Canvas
 * outcome rollup scores. Builds list of students who need syncing.
 *
 * PL predictions are read directly from cache.students[n].outcomes[n].plPrediction
 * — no separate lookup table needed.
 */
export async function handleCalculatingChanges(sm) {
    const { courseId, outcomeId, outcomeName, submissionIdByUserId,
            rubricAssociationId, rubricCriterionId, effectiveTargetIds, apiClient } = sm.getContext();

    sm.progress('Calculating changes...');
    logger.debug(`[PLSync] CALCULATING_CHANGES for outcome ${outcomeId}`);

    // Read PL predictions from the shared cache (populated by Refresh Data)
    const cache = await readMasteryOutlookCache(courseId, apiClient);
    if (!cache) {
        throw new Error('[PLSync] No mastery outlook cache found — run Refresh Data first');
    }

    // Build userId → plPrediction map from cache.students
    const plPredictionByUserId = new Map();
    (cache.students || []).forEach(student => {
        const outcomeData = student.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
        if (outcomeData?.plPrediction !== null && outcomeData?.plPrediction !== undefined && outcomeData?.status !== 'NE') {
            plPredictionByUserId.set(String(student.id), outcomeData.plPrediction);
        }
    });
    logger.debug(`[PLSync] ${plPredictionByUserId.size} student(s) have PL predictions for outcome ${outcomeId}`);

    // Fetch current Canvas outcome rollup scores
    // Note: Canvas returns { rollups: [...], linked: {...} } — not a plain array
    const rollupResponse = await apiClient.get(
        `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
        {}, 'PLSync:fetchRollups'
    );
    const rollups = rollupResponse.rollups || [];

    const canvasScoreByUserId = new Map();
    rollups.forEach(rollup => {
        const userId = String(rollup.links?.user);
        const score  = rollup.scores?.find(s => String(s.links?.outcome) === String(outcomeId))?.score;
        if (score !== undefined && score !== null) canvasScoreByUserId.set(userId, score);
    });

    // Build sync list
    const studentsToSync      = [];
    let skippedNoChange       = 0;
    let skippedNoSubmission   = 0;
    let skippedNoPrediction   = 0;

    for (const userId of effectiveTargetIds) {
        const submissionId = submissionIdByUserId?.get(userId);
        if (!submissionId) { skippedNoSubmission++; logger.warn(`[PLSync] No submission ID for student ${userId} — skipping`); continue; }

        const plScore = plPredictionByUserId.get(userId);
        if (plScore === undefined) { skippedNoPrediction++; logger.debug(`[PLSync] No PL prediction for student ${userId} — skipping`); continue; }

        const canvasScore = canvasScoreByUserId.get(userId);
        if (canvasScore !== undefined && scoresMatch(plScore, canvasScore)) { skippedNoChange++; continue; }

        studentsToSync.push({
            userId,
            submissionId,
            rubricAssociationId,
            rubricCriterionId,
            points: plScore,
            score:  plScore,
            plScore,
            canvasScore: canvasScore ?? null
        });
    }

    const numberOfUpdates = studentsToSync.length;
    logger.info(
        `[PLSync] ${outcomeName}: ${numberOfUpdates} need sync, ` +
        `${skippedNoChange} no change, ${skippedNoPrediction} no prediction, ${skippedNoSubmission} no submission`
    );

    sm.updateContext({ studentsToSync, numberOfUpdates, startTime: new Date().toISOString() });

    if (numberOfUpdates === 0) {
        sm.updateContext({ zeroUpdates: true });
        return PL_STATES.COMPLETE;
    }

    return PL_STATES.SYNCING;
}

// ─── SYNCING ──────────────────────────────────────────────────────────────────

/**
 * Batch sync PL scores to Canvas via GraphQL.
 * Uses the existing submitRubricAssessmentBatch — same as handleUpdatingGrades.
 */
export async function handleSyncing(sm) {
    const { studentsToSync, numberOfUpdates, apiClient } = sm.getContext();
    sm.progress(`Syncing ${numberOfUpdates} student(s)...`, 0, numberOfUpdates);
    logger.info(`[PLSync] SYNCING ${numberOfUpdates} student(s)`);

    const { successCount, errors, retryCounts } = await submitRubricAssessmentBatch(
        studentsToSync,
        apiClient,
        {
            concurrency:  5,
            maxAttempts:  3,
            retryDelayMs: 500,
            onProgress:   (done, total) => sm.progress('Syncing...', done, total)
        }
    );

    logger.info(`[PLSync] Batch complete: ${successCount}/${numberOfUpdates} ok, ${errors.length} error(s)`);

    if (errors.length > 0) {
        logger.warn('[PLSync] Permanent errors:', errors.map(e => ({ userId: e.userId, score: e.average, error: e.error })));
    }

    sm.updateContext({ successCount, errors, retryCounts });
    return PL_STATES.VERIFYING;
}

// ─── VERIFYING ────────────────────────────────────────────────────────────────

/**
 * Re-fetch outcome rollups for synced students and confirm scores match PL predictions.
 * Retries up to 3 times with 2 s delay — mirrors handleVerifyingOverrides pattern.
 */
export async function handleVerifying(sm) {
    const { courseId, outcomeId, studentsToSync, apiClient } = sm.getContext();
    sm.progress('Verifying scores...');
    logger.debug('[PLSync] VERIFYING');

    const maxRetries          = 3;
    const retryDelayMs        = 2000;
    const userIds             = studentsToSync.map(s => s.userId);
    let mismatches            = [];
    let previousMismatchCount = Infinity;
    let attempt               = 1;

    while (attempt <= maxRetries) {
        sm.progress(`Verifying... (attempt ${attempt}/${maxRetries})`);

        const rollupResponse = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_rollups?include[]=users&per_page=100`,
            {}, 'PLSync:verifyRollups'
        );
        const rollups = rollupResponse.rollups || [];

        const actualScores = new Map();
        rollups.forEach(rollup => {
            const userId = String(rollup.links?.user);
            if (!userIds.includes(userId)) return;
            const score = rollup.scores?.find(s => String(s.links?.outcome) === String(outcomeId))?.score;
            if (score !== undefined) actualScores.set(userId, score);
        });

        mismatches = studentsToSync.filter(s => {
            const actual = actualScores.get(s.userId);
            return actual === undefined || !scoresMatch(actual, s.plScore);
        });

        if (mismatches.length === 0) {
            logger.info(`[PLSync] All scores verified on attempt ${attempt}`);
            break;
        }

        if (mismatches.length < previousMismatchCount) {
            logger.info(`[PLSync] Mismatches reduced to ${mismatches.length}, resetting retry counter`);
            previousMismatchCount = mismatches.length;
            attempt = 1;
            await new Promise(r => setTimeout(r, retryDelayMs));
            continue;
        }

        previousMismatchCount = mismatches.length;

        if (attempt < maxRetries) {
            logger.warn(`[PLSync] ${mismatches.length} mismatch(es) on attempt ${attempt}, retrying...`);
            attempt++;
            await new Promise(r => setTimeout(r, retryDelayMs));
        } else {
            logger.warn(`[PLSync] ${mismatches.length} mismatch(es) after ${maxRetries} attempts`);
            break;
        }
    }

    sm.updateContext({ verifyMismatches: mismatches });
    return PL_STATES.COMPLETE;
}

// ─── COMPLETE ─────────────────────────────────────────────────────────────────

export async function handleComplete(sm) {
    const { numberOfUpdates, successCount, errors, verifyMismatches, zeroUpdates, outcomeName } = sm.getContext();

    if (zeroUpdates || numberOfUpdates === 0) {
        sm.progress('No changes needed');
        logger.info(`[PLSync] No changes needed for ${outcomeName}`);
        return PL_STATES.IDLE;
    }

    const mismatchCount = verifyMismatches?.length || 0;
    const errorCount    = errors?.length || 0;

    if (mismatchCount > 0 || errorCount > 0) {
        sm.progress(`Done — ${successCount} updated, ${errorCount} error(s), ${mismatchCount} verify mismatch(es)`);
    } else {
        sm.progress(`Done — ${successCount} student(s) synced`);
    }

    logger.info(`[PLSync] COMPLETE for ${outcomeName}: ${successCount} synced, ${errorCount} errors, ${mismatchCount} mismatches`);
    return PL_STATES.IDLE;
}

// ─── ERROR ────────────────────────────────────────────────────────────────────

export async function handleError(sm) {
    const { error, outcomeName } = sm.getContext();
    logger.error(`[PLSync] ERROR for ${outcomeName}:`, error);
    sm.progress(`Error: ${error?.message || 'Unknown error'}`);
    return PL_STATES.IDLE;
}

// ─── Handler registry ─────────────────────────────────────────────────────────

export const PL_STATE_HANDLERS = {
    [PL_STATES.CHECKING_SETUP]:       handleCheckingSetup,
    [PL_STATES.CREATING_ASSIGNMENT]:  handleCreatingAssignment,
    [PL_STATES.CHECKING_STUDENTS]:    handleCheckingStudents,
    [PL_STATES.FETCHING_SUBMISSIONS]: handleFetchingSubmissions,
    [PL_STATES.CALCULATING_CHANGES]:  handleCalculatingChanges,
    [PL_STATES.SYNCING]:              handleSyncing,
    [PL_STATES.VERIFYING]:            handleVerifying,
    [PL_STATES.COMPLETE]:             handleComplete,
    [PL_STATES.ERROR]:                handleError
};