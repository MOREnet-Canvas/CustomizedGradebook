// src/services/assignmentService.js
/**
 * Assignment Service Module
 *
 * Handles all Canvas API operations related to assignments:
 * - Finding assignments from outcome alignments
 * - Creating new assignments
 */

import { CanvasApiClient } from "../utils/canvasApiClient.js";
import { AVG_ASSIGNMENT_NAME, DEFAULT_MAX_POINTS } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Find an assignment by name from outcome alignments
 * @param {string} courseId - Canvas course ID
 * @param {object} outcomeObject - Outcome object with alignments
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<object|null>} Assignment object or null if not found
 */
export async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject, apiClient) {
    const alignments = outcomeObject.alignments ?? [];

    for (const alignment of alignments) {
        if (!alignment.startsWith("assignment_")) continue;

        const assignmentId = alignment.split("_")[1];
        try {
            const assignment = await apiClient.get(
                `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
                {},
                "getAssignment"
            );

            if (assignment.name === AVG_ASSIGNMENT_NAME) {
                logger.debug("Assignment found:", assignment);
                return assignment;
            }
        } catch (error) {
            // If assignment not found or error, continue to next alignment
            logger.debug(`Assignment ${assignmentId} not accessible:`, error.message);
            continue;
        }
    }

    // If no match found
    logger.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in alignments`);
    return null;
}

/**
 * Create a new assignment via Canvas API
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<string>} Created assignment ID
 */
export async function createAssignment(courseId, apiClient) {
    const payload = {
        assignment: {
            name: AVG_ASSIGNMENT_NAME,
            position: 1,
            submission_types: ["none"], // no student submissions needed
            published: true,
            notify_of_update: true,
            points_possible: DEFAULT_MAX_POINTS,
            grading_type: "gpa_scale",
            omit_from_final_grade: true,
        }
    };

    const assignment = await apiClient.post(
        `/api/v1/courses/${courseId}/assignments`,
        payload,
        {},
        "createAssignment"
    );

    logger.info("Assignment created:", assignment.name);
    return assignment.id;
}

