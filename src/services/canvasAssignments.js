// src/services/canvasAssignments.js
/**
 * Canvas Assignments API Service
 * 
 * Handles all Canvas API operations related to assignments:
 * - Finding assignments from outcome alignments
 * - Creating new assignments
 */

import { safeFetch, safeJsonParse } from "../utils/errorHandler.js";
import { getTokenCookie } from "../utils/canvas.js";
import { AVG_ASSIGNMENT_NAME, DEFAULT_MAX_POINTS } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Find an assignment by name from outcome alignments
 * @param {string} courseId - Canvas course ID
 * @param {object} outcomeObject - Outcome object with alignments
 * @returns {Promise<object|null>} Assignment object or null if not found
 */
export async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject) {
    const alignments = outcomeObject.alignments ?? [];

    for (const alignment of alignments) {
        if (!alignment.startsWith("assignment_")) continue;

        const assignmentId = alignment.split("_")[1];
        const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
        if (!res.ok) continue;

        const assignment = await res.json();
        if (assignment.name === AVG_ASSIGNMENT_NAME) {
            logger.debug("Assignment found:", assignment);
            return assignment;
        }
    }

    // If no match found
    logger.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in alignments`);
    return null;
}

/**
 * Create a new assignment via Canvas API
 * @param {string} courseId - Canvas course ID
 * @returns {Promise<string>} Created assignment ID
 */
export async function createAssignment(courseId) {
    const csrfToken = getTokenCookie('_csrf_token');

    const payload = {
        authenticity_token: csrfToken,
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

    const res = await safeFetch(
        `/api/v1/courses/${courseId}/assignments`,
        {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify(payload)
        },
        "createAssignment"
    );

    const assignment = await safeJsonParse(res, "createAssignment");
    logger.info("Assignment created:", assignment.name);
    return assignment.id;
}

