// src/services/rubricService.js
/**
 * Rubric Service Module
 *
 * Handles all Canvas API operations related to rubrics:
 * - Finding rubrics for assignments
 * - Creating new rubrics linked to outcomes
 */

import { CanvasApiClient } from "../utils/canvasApiClient.js";
import {
    AVG_RUBRIC_NAME,
    AVG_OUTCOME_NAME,
    DEFAULT_MAX_POINTS,
    DEFAULT_MASTERY_THRESHOLD,
    OUTCOME_AND_RUBRIC_RATINGS
} from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Get rubric for an assignment
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Assignment ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<object|null>} Object with {rubricId, criterionId} or null if not found
 */
export async function getRubricForAssignment(courseId, assignmentId, apiClient) {
    const assignment = await apiClient.get(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
        {},
        "getRubric"
    );

    const rubricSettings = assignment.rubric_settings;
    if (!rubricSettings || rubricSettings.title !== AVG_RUBRIC_NAME) {
        return null; // probably null because it hasn't been created yet, want to continue to create
    }

    const rubricCriteria = assignment.rubric;
    if (!rubricCriteria || !Array.isArray(rubricCriteria) || rubricCriteria.length === 0) {
        return null; // probably null because it hasn't been created yet, want to continue to create
    }

    const criterionId = rubricCriteria[0].id; // grab the first criterion's ID
    const rubricId = rubricSettings.id;

    logger.debug("Found rubric and first criterion ID:", {rubricId, criterionId});

    return {rubricId, criterionId};
}

/**
 * Create a new rubric linked to an outcome
 * @param {string} courseId - Canvas course ID
 * @param {string} assignmentId - Assignment ID to link rubric to
 * @param {string} outcomeId - Outcome ID to link rubric to
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<string>} Created rubric ID
 */
export async function createRubric(courseId, assignmentId, outcomeId, apiClient) {
    const rubricRatings = {};
    OUTCOME_AND_RUBRIC_RATINGS.forEach((rating, index) => {
        rubricRatings[index] = {
            description: rating.description,
            points: rating.points
        };
    });

    const rubricPayload = {
        'rubric': {
            'title': AVG_RUBRIC_NAME,
            'free_form_criterion_comments': false,
            'criteria': {
                "0": {
                    'description': `${AVG_OUTCOME_NAME} criteria was used to create this rubric`,
                    'criterion_use_range': false,
                    'points': DEFAULT_MAX_POINTS,
                    'mastery_points': DEFAULT_MASTERY_THRESHOLD,
                    'learning_outcome_id': outcomeId,
                    'ratings': rubricRatings,
                }
            }
        },
        rubric_association: {
            association_type: "Assignment",
            association_id: assignmentId,
            use_for_grading: true,
            purpose: "grading",
            hide_points: true
        }
    };

    const rubric = await apiClient.post(
        `/api/v1/courses/${courseId}/rubrics`,
        rubricPayload,
        {},
        "createRubric"
    );

    logger.debug("Rubric created and linked to outcome:", rubric);
    return rubric.id;
}

