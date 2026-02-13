// src/services/courseService.js
/**
 * Course Service Module
 *
 * Handles Canvas API operations for course-level settings:
 * - Enabling/configuring course grading schemes
 * - Other course-level configuration operations
 */

import { CanvasApiClient } from "../utils/canvasApiClient.js";
import { DEFAULT_GRADING_SCHEME_ID } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Enable course-level grading scheme
 * Sets the course to use a specific grading standard
 * 
 * This uses a non-standard Canvas endpoint (POST /courses/:id with form encoding)
 * rather than the REST API, as Canvas doesn't expose this setting via /api/v1/courses/:id/settings
 * 
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<boolean>} True if grading scheme was enabled
 */
export async function enableCourseGradingScheme(courseId, apiClient) {
    const gradingStandardId = DEFAULT_GRADING_SCHEME_ID;
    
    if (!gradingStandardId) {
        logger.debug('No grading scheme selected, skipping course grading scheme enforcement');
        return false;
    }
    
    try {
        logger.debug(`Enabling course grading scheme: grading_standard_id=${gradingStandardId}`);
        
        // Build form-encoded body
        const body = new URLSearchParams({
            _method: "patch",
            authenticity_token: apiClient.csrfToken,
            "course[course_grading_standard_enabled]": "1",
            "course[grading_standard_id]": String(gradingStandardId),
        });
        
        // Use CanvasApiClient with custom headers for form-encoded content
        await apiClient.post(
            `/courses/${courseId}`,
            body.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                }
            },
            "enableCourseGradingScheme"
        );
        
        logger.info(`Course grading scheme enabled: grading_standard_id=${gradingStandardId}`);
        return true;
    } catch (error) {
        logger.error('Failed to enable course grading scheme:', error);
        throw error;
    }
}

