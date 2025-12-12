// src/utils/canvasHelpers.js
/**
 * Canvas-Specific Helper Functions
 * 
 * This module contains utility functions specific to Canvas LMS:
 * - Finding assignments by name
 * - Extracting course IDs from URLs
 * - Extracting scores from the DOM
 */

import { AVG_ASSIGNMENT_NAME, VERBOSE_LOGGING } from "../config.js";

/**
 * Get the assignment ID for the average assignment by name
 * Used for displaying score on student course cards and as a fallback check when creating assignment
 * @param {string} courseId - Course ID
 * @returns {Promise<string|null>} Assignment ID or null if not found
 */
export async function getAssignmentId(courseId) {
    const response = await fetch(`/api/v1/courses/${courseId}/assignments?per_page=100`);
    const assignments = await response.json();

    const avgAssignment = assignments.find(a => a.name === AVG_ASSIGNMENT_NAME);
    return avgAssignment ? avgAssignment.id : null;
}

/**
 * Extract course ID from a Canvas URL
 * @param {string} href - URL like "/courses/512/grades/190"
 * @returns {string|null} Course ID or null if not found
 */
export function extractCourseIdFromHref(href) {
    const m = href.match(/^\/courses\/(\d+)\b/);
    return m ? m[1] : null;
}

/**
 * Extract the raw numeric score from the Current Score assignment row in the DOM
 * Searches for the assignment by name and extracts the score from various possible DOM locations
 * @returns {string|null} Raw numeric score (not a percentage) or null if not found
 */
export function extractCurrentScoreFromPage() {
    const assignmentLinks = document.querySelectorAll('a[href*="/assignments/"]');
    for (const link of assignmentLinks) {
        if (link.textContent.trim() === AVG_ASSIGNMENT_NAME) {
            const row = link.closest('tr');
            if (!row) continue;
            
            // Try multiple possible locations for the score
            const candidates = [
                row.querySelector('.original_score'),
                row.querySelector('.original_points'),
                row.querySelector('.assignment_score .grade')
            ];
            
            for (const el of candidates) {
                const txt = el?.textContent?.trim();
                if (!txt) continue;
                
                const m = txt.match(/(\d+(?:\.\d+)?)/);
                if (m) {
                    if (VERBOSE_LOGGING) {
                        console.log(`Found Current Score Assignment in table: ${m[1]} (from ${el.className})`);
                    }
                    return m[1]; // raw numeric, not a %
                }
            }
        }
    }
    
    if (VERBOSE_LOGGING) console.log('No Current Score Assignment found');
    return null;
}

