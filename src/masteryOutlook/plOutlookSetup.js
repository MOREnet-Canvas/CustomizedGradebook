// src/masteryOutlook/plOutlookSetup.js
/**
 * PL Outlook Setup — Canvas Infrastructure Helpers
 *
 * Responsible for detecting and establishing the Canvas assignment/rubric
 * infrastructure required by the PL sync flow.
 *
 * Current exports:
 *   - findExistingPLAssignment — search Canvas for an existing PL assignment
 *     before creating a new one; prevents duplicates on cache reset
 *
 * Future home for:
 *   - handleCreatingAssignment logic (currently in plOutlookStateHandlers.js)
 *     once it is large enough to warrant extraction from the state handler file
 *   - Any logic related to detecting orphaned rubrics, re-adopting assignments
 *     after a Canvas course copy, or validating existing setup integrity
 */

import { logger } from '../utils/logger.js';
import { PL_ASSIGNMENT_SUFFIX } from '../config.js';

/**
 * Search Canvas for an existing PL assignment for this outcome.
 *
 * Prevents duplicate "Projected Score" assignments when the cache is deleted
 * and the outcome is re-initialized. If an assignment matching the expected
 * name already exists in Canvas, it should be adopted rather than a new one
 * created.
 *
 * Expected name format: "${outcomeName} — ${PL_ASSIGNMENT_SUFFIX}"
 * e.g. "Argumentative Writing — Projected Score"
 *
 * Uses search_term to narrow the Canvas API results, then confirms with an
 * exact name match to avoid false positives.
 *
 * Returns null (safe fallback) on any API error so the caller always falls
 * through to creation rather than failing silently.
 *
 * @param {string} courseId
 * @param {string} outcomeName
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<Object|null>} Canvas assignment object if found, null if not
 */
export async function findExistingPLAssignment(courseId, outcomeName, apiClient) {
    const expectedName = `${outcomeName} — ${PL_ASSIGNMENT_SUFFIX}`;
    try {
        const results = await apiClient.getAllPages(
            `/api/v1/courses/${courseId}/assignments`,
            { search_term: PL_ASSIGNMENT_SUFFIX, per_page: 50 },
            'PLSync:searchAssignments'
        );
        return results.find(a => a.name === expectedName) ?? null;
    } catch (err) {
        logger.warn(`[PLSync] Assignment search failed — will proceed with creation: ${err.message}`);
        return null;   // safe fallback — create new if search fails
    }
}
