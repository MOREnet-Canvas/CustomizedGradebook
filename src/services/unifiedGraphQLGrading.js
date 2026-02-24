// src/services/unifiedGraphQLGrading.js
/**
 * Unified GraphQL Grading Service
 *
 * Implements the unified GraphQL mutation that combines 5 operations:
 * 1. setOverrideScore
 * 2. setOverrideStatus
 * 3. updateSubmissionGradeStatus
 * 4. saveRubricAssessment
 * 5. createSubmissionComment
 *
 * Handles both IE (Insufficient Evidence) and SCORE cases.
 */

import { logger } from "../utils/logger.js";
import { ENABLE_GRADE_CUSTOM_STATUS, DEFAULT_CUSTOM_STATUS_ID } from "../config.js";

/**
 * Submit a unified grade update via GraphQL
 * @param {Object} params - Grading parameters
 * @param {string} params.enrollmentId - Student's enrollment ID
 * @param {string} params.submissionId - Submission ID
 * @param {string} params.rubricAssociationId - Rubric association ID
 * @param {string} params.rubricCriterionId - Rubric criterion ID
 * @param {string} params.action - "IE" or "SCORE"
 * @param {number|null} params.overrideScore - Override score (null for IE, scaled value for SCORE)
 * @param {number|null} params.rubricPoints - Rubric points (null for IE, raw average for SCORE)
 * @param {string} params.comment - Submission comment text
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<void>}
 * @throws {Error} If GraphQL request fails
 */
export async function submitUnifiedGrade(params, apiClient) {
    const {
        enrollmentId,
        submissionId,
        rubricAssociationId,
        rubricCriterionId,
        action,
        overrideScore,
        rubricPoints,
        comment
    } = params;

    logger.debug(`[UnifiedGQL] Starting ${action} for enrollment ${enrollmentId}, submission ${submissionId}`);
    logger.trace(`[UnifiedGQL] overrideScore=${overrideScore}, rubricPoints=${rubricPoints}`);

    // Build assessment details
    const criterionKey = "criterion_" + rubricCriterionId;
    let assessmentDetails;

    if (action === "IE") {
        // IE case: Omit points entirely to clear rubric assessment
        assessmentDetails = {
            assessment_type: "grading",
            [criterionKey]: {
                save_comment: "0"
            }
        };
    } else {
        // SCORE case: Set rubric points
        assessmentDetails = {
            assessment_type: "grading",
            [criterionKey]: {
                points: rubricPoints,
                comments: null,
                save_comment: "0"
            }
        };
    }

    // Determine custom status IDs based on action and config
    let assignmentCustomStatusId = null;
    let overrideCustomStatusId = null;

    if (ENABLE_GRADE_CUSTOM_STATUS) {
        if (action === "IE") {
            // IE case: Set both to DEFAULT_CUSTOM_STATUS_ID
            assignmentCustomStatusId = DEFAULT_CUSTOM_STATUS_ID;
            overrideCustomStatusId = DEFAULT_CUSTOM_STATUS_ID;
        } else {
            // SCORE case: Clear both (set to null)
            assignmentCustomStatusId = null;
            overrideCustomStatusId = null;
        }
    }

    // Build unified GraphQL mutation
    const query = `
    mutation UnifiedGrading(
      $enrollmentId: ID!
      $submissionId: ID!
      $overrideScore: Float
      $overrideCustomStatusId: ID
      $assignmentCustomStatusId: ID
      $rubricAssociationId: ID!
      $assessmentDetails: JSON!
      $commentText: String!
    ) {
      a: setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        __typename
      }
      
      b: setOverrideStatus(input: { enrollmentId: $enrollmentId, customGradeStatusId: $overrideCustomStatusId }) {
        __typename
      }
      
      c: updateSubmissionGradeStatus(input: { submissionId: $submissionId, customGradeStatusId: $assignmentCustomStatusId }) {
        submission { id customGradeStatusId __typename }
      }
      
      d: saveRubricAssessment(input: {
        rubricAssociationId: $rubricAssociationId
        submissionId: $submissionId
        assessmentDetails: $assessmentDetails
        gradedAnonymously: false
        provisional: false
      }) {
        errors { attribute message __typename }
        __typename
      }
      
      e: createSubmissionComment(input: {
        submissionId: $submissionId
        comment: $commentText
      }) {
        __typename
      }
    }`;

    const variables = {
        enrollmentId: String(enrollmentId),
        submissionId: String(submissionId),
        overrideScore: overrideScore,
        overrideCustomStatusId: overrideCustomStatusId,
        assignmentCustomStatusId: assignmentCustomStatusId,
        rubricAssociationId: String(rubricAssociationId),
        assessmentDetails: JSON.stringify(assessmentDetails),
        commentText: comment
    };

    const json = await apiClient.graphql(query, variables, "submitUnifiedGrade");

    // Check for errors
    if (json.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    // Check for rubric assessment errors
    if (json.data?.d?.errors && json.data.d.errors.length > 0) {
        throw new Error(`Rubric assessment errors: ${JSON.stringify(json.data.d.errors)}`);
    }

    logger.trace(`[UnifiedGQL] ${action} submitted successfully for enrollment ${enrollmentId}`);
}