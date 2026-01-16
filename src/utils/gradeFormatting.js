// src/utils/gradeFormatting.js
/**
 * Grade Formatting Utilities
 * 
 * Shared utilities for formatting grade displays across the application.
 * Used by dashboard, all-grades page, grade page customizer, and grade normalizer.
 * 
 * Functions:
 * - formatGradeDisplay: Format score with optional letter grade
 * - percentageToPoints: Convert percentage scores to point values
 */

import { DEFAULT_MAX_POINTS } from '../config.js';

/**
 * Format grade display with score and optional letter grade
 * 
 * Examples:
 * - formatGradeDisplay("2.74", "Target") => "2.74 (Target)"
 * - formatGradeDisplay("2.74", null) => "2.74"
 * - formatGradeDisplay(2.74, "Developing") => "2.74 (Developing)"
 * 
 * @param {string|number} score - Numeric score (can be string or number)
 * @param {string|null} letterGrade - Letter grade description (e.g., "Target", "Developing")
 * @returns {string} Formatted display string
 */
export function formatGradeDisplay(score, letterGrade) {
    // Convert score to string if it's a number
    const scoreStr = typeof score === 'number' ? score.toFixed(2) : String(score);
    
    if (letterGrade) {
        return `${scoreStr} (${letterGrade})`;
    }
    return scoreStr;
}

/**
 * Convert percentage score to point value based on configured maximum
 * 
 * Formula: (percentage / 100) * DEFAULT_MAX_POINTS
 * 
 * Examples:
 * - percentageToPoints(75) => 3.00 (if DEFAULT_MAX_POINTS = 4)
 * - percentageToPoints(50) => 2.00 (if DEFAULT_MAX_POINTS = 4)
 * - percentageToPoints(100) => 4.00 (if DEFAULT_MAX_POINTS = 4)
 * 
 * @param {number} percentage - Percentage score (0-100)
 * @returns {number} Point value (0-DEFAULT_MAX_POINTS scale)
 */
export function percentageToPoints(percentage) {
    return (percentage / 100) * DEFAULT_MAX_POINTS;
}

