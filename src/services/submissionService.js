// src/services/submissionService.js
/**
 * Submission Service
 *
 * Handles fetching submission IDs and rubric association IDs for GraphQL grading operations.
 * Implements localStorage caching to minimize API calls.
 */

import { logger } from "../utils/logger.js";

/**
 * Fetch all submissions for an assignment and extract submission IDs and rubric association ID
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<{submissionIdByUserId: Map<string, string>, rubricAssociationId: string|null}>}
 */
export async function fetchAllSubmissions(courseId, assignmentId, apiClient) {
    logger.debug(`Fetching submissions for assignment ${assignmentId}...`);
    
    const submissionIdByUserId = new Map();
    let rubricAssociationId = null;
    
    // Check localStorage cache for rubric association ID
    const cacheKey = `cg_rubric_assoc_${courseId}_${assignmentId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        rubricAssociationId = cached;
        logger.debug(`Using cached rubricAssociationId: ${rubricAssociationId}`);
    }
    
    // Fetch submissions with full rubric assessment
    let url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?include[]=full_rubric_assessment`;
    
    while (url) {
        const submissions = await apiClient.get(url, {}, "fetchAllSubmissions");
        
        for (const submission of submissions) {
            if (submission.user_id && submission.id) {
                submissionIdByUserId.set(String(submission.user_id), String(submission.id));
            }
            
            // Extract rubric association ID from first submission with rubric data
            if (!rubricAssociationId && submission.rubric_assessment) {
                // The rubric_assessment object may contain metadata about the association
                // However, Canvas API doesn't always include association ID in submission response
                // We'll need to fetch it separately if not found
            }
        }
        
        // TODO: Implement pagination if needed
        url = null;
    }
    
    logger.debug(`Fetched ${submissionIdByUserId.size} submission IDs`);
    
    // If rubric association ID not found in submissions, fetch it separately
    if (!rubricAssociationId) {
        logger.debug('Rubric association ID not found in submissions, fetching separately...');
        // We'll need the rubricId to fetch the association
        // This will be handled by the caller if needed
    }
    
    return { submissionIdByUserId, rubricAssociationId };
}

/**
 * Fetch rubric association ID for an assignment
 * @param {string} courseId - Course ID
 * @param {string} rubricId - Rubric ID
 * @param {string} assignmentId - Assignment ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<string|null>} Rubric association ID or null if not found
 */
export async function fetchRubricAssociationId(courseId, rubricId, assignmentId, apiClient) {
    logger.debug(`Fetching rubric association ID for rubric ${rubricId}...`);
    
    try {
        const rubric = await apiClient.get(
            `/api/v1/courses/${courseId}/rubrics/${rubricId}?include=associations`,
            {},
            "fetchRubricAssociationId"
        );
        
        // Find the association for this assignment
        const associations = rubric.associations || [];
        const association = associations.find(a => 
            String(a.association_id) === String(assignmentId) && 
            a.association_type === 'Assignment'
        );
        
        if (association && association.id) {
            const associationId = String(association.id);
            logger.debug(`Found rubric association ID: ${associationId}`);
            
            // Cache it
            const cacheKey = `cg_rubric_assoc_${courseId}_${assignmentId}`;
            localStorage.setItem(cacheKey, associationId);
            
            return associationId;
        }
        
        logger.warn('Rubric association not found for this assignment');
        return null;
    } catch (error) {
        logger.error('Failed to fetch rubric association ID:', error);
        return null;
    }
}

