// src/services/graphqlGradingService.js
/**
 * GraphQL Grading Service
 *
 * Reusable primitives for submitting rubric assessments via Canvas GraphQL.
 * Handles submission-level operations only — no enrollment-level overrides.
 *
 * Exports:
 * - submitRubricAssessment  — single student, single submission
 * - submitRubricAssessmentBatch — multiple students with concurrency control
 */

import { logger } from "../utils/logger.js";

/**
 * Submit a rubric assessment for a single student submission via GraphQL.
 * Handles rubric scoring, optional submission custom status, and optional comment.
 * Does NOT touch enrollment-level overrides (setOverrideScore / setOverrideStatus).
 *
 * @param {Object} params
 * @param {string} params.submissionId - Canvas submission ID
 * @param {string} params.rubricAssociationId - Rubric association ID
 * @param {string} params.rubricCriterionId - Rubric criterion ID
 * @param {number} params.points - Score to set
 * @param {boolean} [params.clearPoints=false] - If true, omits points from payload entirely (Canvas clear behavior — passing null causes 422)
 * @param {string|null} [params.customStatusId] - Submission-level custom status ID. Pass null to clear. Omit entirely to leave unchanged.
 * @param {string} [params.comment] - Optional submission comment text
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<{customGradeStatusId: string|null}>} The custom grade status ID on the submission after update
 * @throws {Error} If the GraphQL request fails or Canvas returns rubric errors
 */
export async function submitRubricAssessment(params, apiClient) {
    const {
        submissionId,
        rubricAssociationId,
        rubricCriterionId,
        points,
        clearPoints = false,
        customStatusId,
        comment
    } = params;

    logger.debug(`[GraphQLGrading] submitRubricAssessment for submission ${submissionId}`);
    logger.trace(`[GraphQLGrading] clearPoints=${clearPoints}, points=${points}`);

    // Build assessment details — omit points entirely when clearing (Canvas rejects points: null with 422)
    const criterionKey = "criterion_" + rubricCriterionId;
    const criterionData = clearPoints
        ? { save_comment: "0" }
        : { points, comments: null, save_comment: "0" };

    const assessmentDetails = {
        assessment_type: "grading",
        [criterionKey]: criterionData
    };

    // Determine which optional mutations to include
    // customStatusId === undefined means "leave unchanged" — do not send the mutation at all
    const includeStatus = customStatusId !== undefined;
    const includeComment = comment !== undefined && comment !== null && comment !== "";

    logger.trace(`[GraphQLGrading] includeStatus=${includeStatus}, includeComment=${includeComment}`);

    // Build query dynamically to avoid unintended side effects from unused mutations
    const query = `
    mutation SubmitRubricAssessment(
      $submissionId: ID!
      $rubricAssociationId: ID!
      $assessmentDetails: JSON!
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
 * Submit rubric assessments for multiple students with concurrency control and retry logic.
 *
 * @param {Array<Object>} students - Array of params objects for submitRubricAssessment
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {Object} [options]
 * @param {number} [options.concurrency=5] - Max simultaneous requests
 * @param {number} [options.maxAttempts=3] - Max retry attempts per student on failure
 * @param {Function} [options.onProgress] - Progress callback: (successCount, total) => void
 * @returns {Promise<{successCount: number, errors: Array<{index: number, submissionId: string, error: string}>}>}
 */
export async function submitRubricAssessmentBatch(students, apiClient, options = {}) {
    const {
        concurrency = 5,
        maxAttempts = 3,
        onProgress = null
    } = options;

    const total = students.length;
    let successCount = 0;
    const errors = [];

    logger.info(`[GraphQLGrading] Batch start: ${total} students, concurrency=${concurrency}, maxAttempts=${maxAttempts}`);

    for (let i = 0; i < total; i += concurrency) {
        const chunk = students.slice(i, i + concurrency);

        await Promise.all(chunk.map(async (params, chunkIndex) => {
            const index = i + chunkIndex;
            const submissionId = String(params.submissionId ?? index);
            let attempt = 1;
            let success = false;

            while (attempt <= maxAttempts && !success) {
                try {
                    await submitRubricAssessment(params, apiClient);
                    successCount++;
                    success = true;
                    logger.trace(`[GraphQLGrading] Batch: submission ${submissionId} succeeded (attempt ${attempt})`);
                } catch (error) {
                    logger.warn(`[GraphQLGrading] Batch: submission ${submissionId} failed (attempt ${attempt}/${maxAttempts}): ${error.message}`);
                    if (attempt === maxAttempts) {
                        errors.push({ index, submissionId, error: error.message });
                    }
                    attempt++;
                }
            }

            if (onProgress) {
                onProgress(successCount, total);
            }
        }));
    }

    logger.info(`[GraphQLGrading] Batch complete: ${successCount}/${total} succeeded, ${errors.length} errors`);

    return { successCount, errors };
}
