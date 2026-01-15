// src/student/gradeExtractor.js
/**
 * Grade Extractor Utility
 *
 * Extracts the Current Score Assignment value from the student grades page.
 * This is used to display the mastery score in place of traditional percentages.
 */

import { AVG_ASSIGNMENT_NAME, OUTCOME_AND_RUBRIC_RATINGS } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Convert a numeric score to a grade level description
 * Finds the closest matching rating from the configured scale
 *
 * @param {number|string} score - The numeric score (e.g., 2.74 or "2.74")
 * @returns {string|null} The grade level description (e.g., "Developing") or null if invalid
 */
export function scoreToGradeLevel(score) {
    const numScore = typeof score === 'string' ? parseFloat(score) : score;

    if (isNaN(numScore)) {
        logger.trace(`Invalid score for grade level conversion: ${score}`);
        return null;
    }

    // Sort ratings by points descending to find the closest match
    const sortedRatings = [...OUTCOME_AND_RUBRIC_RATINGS].sort((a, b) => b.points - a.points);

    // Find the rating that matches or is just below the score
    for (const rating of sortedRatings) {
        if (numScore >= rating.points) {
            return rating.description;
        }
    }

    // If score is below all ratings, return the lowest rating
    return sortedRatings[sortedRatings.length - 1]?.description || null;
}

/**
 * Extract the Current Score Assignment value and grade level from the grades page
 * Searches for the assignment row and extracts both the numeric score and letter grade
 *
 * @returns {{score: string, letterGrade: string|null}|null} Object with score and letterGrade, or null if not found
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
        const scoreCandidates = [
            row.querySelector('.original_score'),
            row.querySelector('.original_points'),
            row.querySelector('.assignment_score .grade')
        ];

        let score = null;
        for (const el of scoreCandidates) {
            if (!el) continue;

            const txt = el.textContent?.trim();
            if (!txt) continue;

            // Extract numeric value (e.g., "2.74" from "2.74 / 4")
            const match = txt.match(/(\d+(?:\.\d+)?)/);
            if (match) {
                score = match[1];
                logger.trace(`Found ${AVG_ASSIGNMENT_NAME} score in table: ${score} (from ${el.className})`);
                break;
            }
        }

        if (!score) continue;

        // Now try to find the letter grade in the same row
        // Canvas displays letter grades in various places depending on grading type
        let letterGrade = null;

        // Try to find letter grade in the score cell or nearby elements
        const letterGradeCandidates = [
            // Look for letter grade in tooltip or grade display
            row.querySelector('.assignment_score .tooltip'),
            row.querySelector('.assignment_score'),
            // Sometimes it's in a separate element
            row.querySelector('.letter-grade'),
            row.querySelector('.grade-display')
        ];

        for (const el of letterGradeCandidates) {
            if (!el) continue;

            const txt = el.textContent?.trim();
            if (!txt) continue;

            // Look for letter grade patterns (e.g., "Target", "Developing", "Beginning")
            // Match against our configured rating descriptions
            for (const rating of OUTCOME_AND_RUBRIC_RATINGS) {
                if (txt.includes(rating.description)) {
                    letterGrade = rating.description;
                    logger.trace(`Found letter grade in table: ${letterGrade}`);
                    break;
                }
            }

            if (letterGrade) break;
        }

        // If we didn't find a letter grade in the DOM, calculate it from the score
        if (!letterGrade) {
            letterGrade = scoreToGradeLevel(score);
            logger.trace(`Calculated letter grade from score: ${letterGrade}`);
        }

        logger.trace(`Extracted ${AVG_ASSIGNMENT_NAME}: score=${score}, letterGrade=${letterGrade}`);
        return { score, letterGrade };
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

