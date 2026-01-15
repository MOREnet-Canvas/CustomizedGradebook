// src/student/gradeExtractor.js
/**
 * Grade Extractor Utility
 * 
 * Extracts the Current Score Assignment value from the student grades page.
 * This is used to display the mastery score in place of traditional percentages.
 */

import { AVG_ASSIGNMENT_NAME } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Extract the Current Score Assignment value from the grades page
 * Searches for the assignment row and extracts the numeric score
 * 
 * @returns {string|null} The numeric score as a string (e.g., "2.74") or null if not found
 */
export function extractCurrentScoreFromPage() {
    // Find all assignment links on the page
    const assignmentLinks = document.querySelectorAll('a[href*="/assignments/"]');
    
    for (const link of assignmentLinks) {
        // Check if this is the Current Score Assignment
        if (link.textContent.trim() !== AVG_ASSIGNMENT_NAME) {
            continue;
        }
        
        // Found the assignment, now find the score in the same row
        const row = link.closest('tr');
        if (!row) continue;
        
        // Try multiple selectors to find the score element
        const candidates = [
            row.querySelector('.original_score'),
            row.querySelector('.original_points'),
            row.querySelector('.assignment_score .grade')
        ];
        
        for (const el of candidates) {
            if (!el) continue;
            
            const txt = el.textContent?.trim();
            if (!txt) continue;
            
            // Extract numeric value (e.g., "2.74" from "2.74 / 4")
            const match = txt.match(/(\d+(?:\.\d+)?)/);
            if (match) {
                logger.trace(`Found ${AVG_ASSIGNMENT_NAME} in table: ${match[1]} (from ${el.className})`);
                return match[1];
            }
        }
    }
    
    logger.trace(`No ${AVG_ASSIGNMENT_NAME} found on page`);
    return null;
}

/**
 * Extract course ID from a href attribute
 * @param {string} href - The href value (e.g., "/courses/512/grades/190")
 * @returns {string|null} The course ID or null if not found
 */
export function extractCourseIdFromHref(href) {
    const match = href.match(/^\/courses\/(\d+)\b/);
    return match ? match[1] : null;
}

