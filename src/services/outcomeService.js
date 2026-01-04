// src/services/outcomeService.js
/**
 * Outcome Service Module
 *
 * Handles all Canvas API operations related to outcomes:
 * - Fetching outcome rollup data
 * - Finding outcomes by name
 * - Creating new outcomes
 */

import { TimeoutError } from "../utils/errorHandler.js";
import { CanvasApiClient } from "../utils/canvasApiClient.js";
import {
    AVG_OUTCOME_NAME,
    DEFAULT_MASTERY_THRESHOLD,
    OUTCOME_AND_RUBRIC_RATINGS
} from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Fetch outcome rollup data for a course
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<object>} Rollup data including outcomes and users
 */
export async function getRollup(courseId, apiClient) {
    const rollupData = await apiClient.get(
        `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
        {},
        "getRollup"
    );
    logger.debug("rollupData: ", rollupData);
    return rollupData;
}

/**
 * Find an outcome by name in rollup data
 * @param {object} data - Rollup data from getRollup()
 * @returns {object|null} Outcome object or null if not found
 */
export function getOutcomeObjectByName(data) {
    const outcomeTitle = AVG_OUTCOME_NAME;
    logger.debug("Outcome Title:", outcomeTitle);
    logger.debug("data:", data);
    const outcomes = data?.linked?.outcomes ?? [];
    logger.debug("outcomes: ", outcomes);
    if (outcomes.length === 0) {
        logger.warn("No outcomes found in rollup data.");
        return null;
    }
    const match = outcomes.find(o => o.title === outcomeTitle);
    logger.debug("match: ", match);
    if (!match) {
        logger.warn(`Outcome not found: "${outcomeTitle}"`);
    }
    return match ?? null;
}

/**
 * Create a new outcome via Canvas CSV import API
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<void>}
 */
export async function createOutcome(courseId, apiClient) {
    const randomSuffix = Math.random().toString(36).substring(2, 10); // 8-char alphanumeric
    const vendorGuid = `MOREnet_${randomSuffix}`;

    const ratingsCsv = OUTCOME_AND_RUBRIC_RATINGS
        .map(r => `${r.points},"${r.description}"`)
        .join(',');

    const csvContent =
        `vendor_guid,object_type,title,description,calculation_method,mastery_points\n` +
        `"${vendorGuid}",outcome,"${AVG_OUTCOME_NAME}","Auto-generated outcome: ${AVG_OUTCOME_NAME}",latest,"${DEFAULT_MASTERY_THRESHOLD}",${ratingsCsv}`;

    logger.debug("Importing outcome via CSV...");

    const importData = await apiClient.post(
        `/api/v1/courses/${courseId}/outcome_imports?import_type=instructure_csv`,
        csvContent,
        {
            headers: {
                "Content-Type": "text/csv"
            }
        },
        "createOutcome"
    );

    const importId = importData.id;
    logger.debug(`Outcome import started: ID ${importId}`);

    // Wait until the import completes
    let attempts = 0;
    let status = null;
    const maxAttempts = 15;
    const pollIntervalMs = 2000;

    while (attempts++ < maxAttempts) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
        const pollData = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_imports/${importId}`,
            {},
            "createOutcome:poll"
        );

        const state = pollData.workflow_state;
        logger.debug(`Poll attempt ${attempts}: ${state}`);

        if (state === "succeeded") {
            status = pollData;
            break;
        } else if (state === "failed") {
            throw new Error("Outcome import failed");
        }
    }

    // After 30s with no result
    if (!status) {
        throw new TimeoutError(
            "Timed out waiting for outcome import to complete",
            maxAttempts * pollIntervalMs
        );
    }

    logger.debug("Outcome fully created");
}

