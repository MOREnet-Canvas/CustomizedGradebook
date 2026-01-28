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
 * - calculateDisplayValue: Calculate display value and aria label for grades
 */

import { DEFAULT_MAX_POINTS } from '../config.js';
import { isValidLetterGrade } from './courseDetection.js';
import { logger } from './logger.js';

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

/**
 * Grade source types for display calculation
 */
export const DISPLAY_SOURCE = {
    /** Grade from AVG Assignment (0-4 scale) */
    ASSIGNMENT: 'assignment',
    /** Grade from Enrollment API (percentage) */
    ENROLLMENT: 'enrollment',
    /** Grade from percentage value (generic) */
    PERCENTAGE: 'percentage'
};

/**
 * Calculate display value and aria label for a grade
 *
 * Handles different grade sources and formats appropriately:
 * - Assignment grades (0-4 scale): Display as-is with letter grade
 * - Enrollment grades with valid letter grade: Convert percentage to points
 * - Enrollment grades without valid letter grade: Display as percentage
 * - Generic percentage grades: Display as percentage
 *
 * @param {Object} options - Grade display options
 * @param {number} options.score - Numeric score value (0-4 for assignment, 0-100 for percentage)
 * @param {string|null} [options.letterGrade=null] - Letter grade (e.g., "Target", "Developing")
 * @param {string} [options.source=DISPLAY_SOURCE.PERCENTAGE] - Grade source type
 * @param {boolean} [options.includeAriaLabel=true] - Whether to include aria label in result
 * @returns {{displayValue: string, ariaLabel: string}} Formatted display strings
 *
 * @example
 * // Assignment grade with letter grade
 * calculateDisplayValue({ score: 2.74, letterGrade: 'Developing', source: DISPLAY_SOURCE.ASSIGNMENT })
 * // => { displayValue: '2.74 (Developing)', ariaLabel: 'Grade: 2.74, letter grade Developing' }
 *
 * @example
 * // Enrollment grade with valid letter grade (converts to points)
 * calculateDisplayValue({ score: 68.5, letterGrade: 'Developing', source: DISPLAY_SOURCE.ENROLLMENT })
 * // => { displayValue: '2.74 (Developing)', ariaLabel: 'Grade: 2.74, letter grade Developing' }
 *
 * @example
 * // Enrollment grade without valid letter grade (shows percentage)
 * calculateDisplayValue({ score: 85, letterGrade: 'B', source: DISPLAY_SOURCE.ENROLLMENT })
 * // => { displayValue: '85.00% (B)', ariaLabel: 'Grade: 85.00%, letter grade B' }
 *
 * @example
 * // Generic percentage grade
 * calculateDisplayValue({ score: 92.5, source: DISPLAY_SOURCE.PERCENTAGE })
 * // => { displayValue: '92.50%', ariaLabel: 'Grade: 92.50%' }
 */
export function calculateDisplayValue(options) {
    const {
        score,
        letterGrade = null,
        source = DISPLAY_SOURCE.PERCENTAGE,
        includeAriaLabel = true
    } = options;

    let displayValue;
    let ariaLabel;

    if (source === DISPLAY_SOURCE.ASSIGNMENT) {
        // AVG assignment: 0-4 scale, show with 2 decimals and letter grade if available
        const scoreStr = score.toFixed(2);
        const isNumericLetterGrade =
            typeof letterGrade === 'string' &&
            /^[0-9]+(\.[0-9]+)?$/.test(letterGrade.trim());
        if (isNumericLetterGrade) {
            logger.trace(
                `[Grade Display] Suppressing numeric letterGrade "${letterGrade}" for assignment source`
            );
        }

        if (letterGrade && !isNumericLetterGrade) {
            displayValue = `${scoreStr} (${letterGrade})`;
            ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = scoreStr;
            ariaLabel = `Grade: ${scoreStr}`;
        }
        logger.trace(`[Grade Display] Assignment grade: display=${displayValue}`);

    } else if (source === DISPLAY_SOURCE.ENROLLMENT) {
        // Enrollment grade: convert to point value if letter grade matches rating scale
        // Otherwise fall back to percentage display
        const isValidGrade = isValidLetterGrade(letterGrade);

        // Trace logging for debugging
        if (!letterGrade) {
            logger.trace(`[Grade Display] Letter grade is empty/null/undefined`);
        } else {
            logger.trace(`[Grade Display] Checking "${letterGrade}" against rating scale: ${isValidGrade ? 'MATCH FOUND' : 'NO MATCH'}`);
        }

        if (isValidGrade) {
            // Letter grade matches rating scale - calculate and display as point value
            const pointValue = percentageToPoints(score);
            const scoreStr = pointValue.toFixed(2);
            displayValue = `${scoreStr} (${letterGrade})`;
            ariaLabel = `Grade: ${scoreStr}, letter grade ${letterGrade}`;
            logger.trace(`[Grade Display] Converted to points: ${score}% -> ${pointValue} -> display="${displayValue}"`);
        } else {
            // Letter grade doesn't match or is missing - display as percentage
            const percentageStr = `${score.toFixed(2)}%`;
            if (letterGrade) {
                displayValue = `${percentageStr} (${letterGrade})`;
                ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
                logger.trace(`[Grade Display] Letter grade "${letterGrade}" not in rating scale, using percentage: display="${displayValue}"`);
            } else {
                displayValue = percentageStr;
                ariaLabel = `Grade: ${percentageStr}`;
                logger.trace(`[Grade Display] No letter grade, using percentage: display="${displayValue}"`);
            }
        }

    } else {
        // Generic percentage or unknown source - display as percentage
        const percentageStr = `${score.toFixed(2)}%`;
        if (letterGrade) {
            displayValue = `${percentageStr} (${letterGrade})`;
            ariaLabel = `Grade: ${percentageStr}, letter grade ${letterGrade}`;
        } else {
            displayValue = percentageStr;
            ariaLabel = `Grade: ${percentageStr}`;
        }
        logger.trace(`[Grade Display] Percentage grade: display=${displayValue}`);
    }

    if (includeAriaLabel) {
        return { displayValue, ariaLabel };
    } else {
        return { displayValue };
    }
}