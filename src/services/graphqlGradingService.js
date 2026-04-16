// src/services/graphqlGradingService.js
/**
 * GraphQL Grading Service
 *
 * Reusable primitives for submitting rubric assessments via Canvas GraphQL.
 * Handles both submission-level and enrollment-level operations in one request.
 *
 * Exports:
 * - submitRubricAssessment       — single student, single submission
 * - submitRubricAssessmentBatch  — multiple students with concurrency control,
 *                                  per-attempt retry delay, and a deferred second pass
 */

import { logger } from "../utils/logger.js";

/**
 * Submit a rubric assessment for a single student submission via GraphQL.
 * Dynamically composes up to 5 mutations in one request depending on which params are provided:
 *   1. saveRubricAssessment           — always included
 *   2. setOverrideScore               — when enrollmentId is provided
 *   3. setOverrideStatus              — when enrollmentId AND overrideStatusId are provided
 *   4. updateSubmissionGradeStatus    — when customStatusId is provided
 *   5. createSubmissionComment        — when comment is provided
 *
 * @param {Object} params
 * @param {string} params.submissionId          - Canvas submission ID
 * @param {string} params.rubricAssociationId   - Rubric association ID
 * @param {string} params.rubricCriterionId     - Rubric criterion ID
 * @param {number} params.points                - Score to set on the rubric criterion
 * @param {boolean} [params.clearPoints=false]  - If true, omits points (Canvas clear behavior — passing null causes 422)
 * @param {string} [params.enrollmentId]        - Enrollment ID. When provided, triggers setOverrideScore + setOverrideStatus.
 * @param {number|null} [params.overrideScore]  - Enrollment-level override score. Pass null to clear.
 * @param {string|null} [params.overrideStatusId] - Enrollment-level custom status ID. Pass null to clear. Omit to leave unchanged.
 * @param {string|null} [params.customStatusId] - Submission-level custom status ID. Pass null to clear. Omit to leave unchanged.
 * @param {string} [params.comment]             - Optional submission comment text
 * @param {CanvasApiClient} apiClient           - Canvas API client instance
 * @returns {Promise<{customGradeStatusId: string|null}>}
 * @throws {Error} If the GraphQL request fails or Canvas returns rubric errors
 */
export async function submitRubricAssessment(params, apiClient) {
    const {
        submissionId,
        rubricAssociationId,
        rubricCriterionId,
        points,
        clearPoints = false,
        enrollmentId,
        overrideScore,
        overrideStatusId,
        customStatusId,
        comment
    } = params;

    logger.debug(`[GraphQLGrading] submitRubricAssessment for submission ${submissionId}`);
    logger.trace(`[GraphQLGrading] clearPoints=${clearPoints}, points=${points}, enrollmentId=${enrollmentId}`);

    // Build rubric assessment details — omit points entirely when clearing (Canvas rejects points: null with 422)
    const criterionKey = "criterion_" + rubricCriterionId;
    const criterionData = clearPoints
        ? { save_comment: "0" }
        : { points, comments: null, save_comment: "0" };

    const assessmentDetails = {
        assessment_type: "grading",
        [criterionKey]: criterionData
    };

    // Determine which optional mutations to include.
    // undefined means "leave unchanged" — do not send that mutation at all.
    const includeOverride = enrollmentId !== undefined;
    const includeOverrideStatus = includeOverride && overrideStatusId !== undefined;
    const includeStatus = customStatusId !== undefined;
    const includeComment = comment !== undefined && comment !== null && comment !== "";

    logger.trace(`[GraphQLGrading] includeOverride=${includeOverride}, includeStatus=${includeStatus}, includeComment=${includeComment}`);

    const query = `
    mutation SubmitRubricAssessment(
      $submissionId: ID!
      $rubricAssociationId: ID!
      $assessmentDetails: JSON!
      ${includeOverride ? "$enrollmentId: ID!, $overrideScore: Float," : ""}
      ${includeOverrideStatus ? "$overrideStatusId: ID," : ""}
      ${includeStatus ? "$customStatusId: ID," : ""}
      ${includeComment ? "$commentText: String!," : ""}
    ) {
      rubric: saveRubricAssessment(input: {
        rubricAssociationId: $rubricAssociationId
        submissionId: $submissionId
        assessmentDetails: $assessmentDetails
        gradedAnonymously: false
        provisional: false
      }) {
        errors { attribute message __typename }
        __typename
      }
      ${includeOverride ? `
      override: setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        __typename
      }` : ""}
      ${includeOverrideStatus ? `
      overrideStatus: setOverrideStatus(input: { enrollmentId: $enrollmentId, customGradeStatusId: $overrideStatusId }) {
        __typename
      }` : ""}
      ${includeStatus ? `
      status: updateSubmissionGradeStatus(input: { submissionId: $submissionId, customGradeStatusId: $customStatusId }) {
        submission { id customGradeStatusId __typename }
      }` : ""}
      ${includeComment ? `
      comment: createSubmissionComment(input: { submissionId: $submissionId, comment: $commentText }) {
        __typename
      }` : ""}
    }`;

    const variables = {
        submissionId: String(submissionId),
        rubricAssociationId: String(rubricAssociationId),
        assessmentDetails: JSON.stringify(assessmentDetails),
        ...(includeOverride && { enrollmentId: String(enrollmentId), overrideScore }),
        ...(includeOverrideStatus && { overrideStatusId }),
        ...(includeStatus && { customStatusId }),
        ...(includeComment && { commentText: comment })
    };

    const json = await apiClient.graphql(query, variables, "submitRubricAssessment");

    if (json.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    if (json.data?.rubric?.errors?.length > 0) {
        throw new Error(`Rubric assessment errors: ${JSON.stringify(json.data.rubric.errors)}`);
    }

    const customGradeStatusId = json.data?.status?.submission?.customGradeStatusId ?? null;

    logger.trace(`[GraphQLGrading] Complete for submission ${submissionId}, customGradeStatusId=${customGradeStatusId}`);

    return { customGradeStatusId };
}

/**
 * Submit rubric assessments for multiple students with concurrency control,
 * per-attempt retry delay, and a deferred second pass for persistent failures.
 *
 * Flow:
 *   First pass  — students processed in chunks of `concurrency` simultaneously.
 *                 Each student gets up to `maxAttempts` tries with `retryDelayMs` between attempts.
 *                 Any student that exhausts all attempts is queued for the second pass.
 *   Second pass — all first-pass failures are retried sequentially, again up to `maxAttempts`.
 *                 Students still failing after the second pass are added to the permanent errors list.
 *
 * @param {Array<Object>} students   - Array of params objects for submitRubricAssessment.
 *   Each object should include `userId` and `score` (or `points`) for error reporting.
 * @param {CanvasApiClient} apiClient
 * @param {Object} [options]
 * @param {number} [options.concurrency=5]     - Max simultaneous requests per chunk
 * @param {number} [options.maxAttempts=3]     - Max retry attempts per student per pass
 * @param {number} [options.retryDelayMs=500]  - Milliseconds to wait between retry attempts
 * @param {Function} [options.onProgress]      - Callback: (successCount, total) => void
 * @returns {Promise<{
 *   successCount: number,
 *   errors: Array<{index: number, submissionId: string, userId: string, average: number, error: string}>,
 *   retryCounts: Array<{userId: string, attempts: number}>
 * }>}
 */
export async function submitRubricAssessmentBatch(students, apiClient, options = {}) {
    const {
        concurrency = 5,
        maxAttempts = 3,
        retryDelayMs = 500,
        onProgress = null
    } = options;

    const total = students.length;
    let successCount = 0;
    const errors = [];
    const retryCounts = [];
    const deferred = []; // Students that exhaust all first-pass attempts

    logger.info(`[GraphQLGrading] Batch start: ${total} students, concurrency=${concurrency}, maxAttempts=${maxAttempts}`);

    // --- First pass: process all students in concurrent chunks ---
    for (let i = 0; i < total; i += concurrency) {
        const chunk = students.slice(i, i + concurrency);

        await Promise.all(chunk.map(async (params, chunkIndex) => {
            const index = i + chunkIndex;
            const submissionId = String(params.submissionId ?? index);
            const userId = String(params.userId ?? index);
            let attempt = 1;
            let success = false;
            let lastError = null;

            while (attempt <= maxAttempts && !success) {
                try {
                    if (attempt > 1) await new Promise(r => setTimeout(r, retryDelayMs));
                    await submitRubricAssessment(params, apiClient);
                    successCount++;
                    success = true;
                    if (attempt > 1) retryCounts.push({ userId, attempts: attempt });
                    logger.trace(`[GraphQLGrading] Batch: submission ${submissionId} ok (attempt ${attempt})`);
                } catch (err) {
                    lastError = err.message;
                    logger.warn(`[GraphQLGrading] Batch: submission ${submissionId} failed (attempt ${attempt}/${maxAttempts}): ${err.message}`);
                    attempt++;
                }
            }

            if (!success) deferred.push({ index, params, lastError });
            if (onProgress) onProgress(successCount, total);
        }));
    }

    // --- Second pass: retry all first-pass failures sequentially ---
    if (deferred.length > 0) {
        logger.info(`[GraphQLGrading] Second-pass retry for ${deferred.length} deferred students`);

        for (const { index, params, lastError } of deferred) {
            const submissionId = String(params.submissionId ?? index);
            const userId = String(params.userId ?? index);
            let attempt = 1;
            let success = false;
            let finalError = lastError;

            while (attempt <= maxAttempts && !success) {
                try {
                    if (attempt > 1) await new Promise(r => setTimeout(r, retryDelayMs));
                    await submitRubricAssessment(params, apiClient);
                    successCount++;
                    success = true;
                    retryCounts.push({ userId, attempts: maxAttempts + attempt });
                    logger.debug(`[GraphQLGrading] Second-pass: submission ${submissionId} ok (attempt ${attempt})`);
                } catch (err) {
                    finalError = err.message;
                    logger.warn(`[GraphQLGrading] Second-pass: submission ${submissionId} failed (attempt ${attempt}/${maxAttempts}): ${err.message}`);
                    attempt++;
                }
            }

            if (!success) {
                errors.push({
                    index,
                    submissionId,
                    userId,
                    average: params.score ?? params.points,
                    error: finalError ?? "Failed after all retry attempts"
                });
            }

            if (onProgress) onProgress(successCount, total);
        }
    }

    logger.info(`[GraphQLGrading] Batch complete: ${successCount}/${total} succeeded, ${errors.length} permanent errors`);

    return { successCount, errors, retryCounts };
}