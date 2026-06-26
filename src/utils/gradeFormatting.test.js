// src/utils/gradeFormatting.test.js
import { describe, it, expect, vi } from 'vitest';
import {
    formatGradeDisplay,
    percentageToPoints,
    calculateDisplayValue,
    DISPLAY_SOURCE,
} from './gradeFormatting.js';

// Mock config.js to avoid TDZ bug (PL_GRADING_TYPE referenced before initialization)
vi.mock('../config.js', () => ({
    DEFAULT_MAX_POINTS: 4,
    OUTCOME_AND_RUBRIC_RATINGS: [
        { description: 'Exemplary', points: 4 },
        { description: 'Beyond Target', points: 3.5 },
        { description: 'Target', points: 3 },
        { description: 'Approaching Target', points: 2.5 },
        { description: 'Developing', points: 2 },
        { description: 'Beginning', points: 1.5 },
        { description: 'Needs Partial Support', points: 1 },
        { description: 'Needs Full Support', points: 0.5 },
        { description: 'Insufficient Evidence', points: 0 },
    ],
    AVG_ASSIGNMENT_NAME: 'Current Score Assignment',
    STANDARDS_BASED_COURSE_PATTERNS: ['SBG', /Standards/i],
}));

vi.mock('./logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('formatGradeDisplay', () => {
    it('formats score with letter grade', () => {
        expect(formatGradeDisplay('2.74', 'Target')).toBe('2.74 (Target)');
        expect(formatGradeDisplay(2.74, 'Developing')).toBe('2.74 (Developing)');
    });

    it('formats score without letter grade', () => {
        expect(formatGradeDisplay('2.74', null)).toBe('2.74');
        expect(formatGradeDisplay('2.74', undefined)).toBe('2.74');
        expect(formatGradeDisplay('2.74', '')).toBe('2.74');
    });

    it('converts numeric score to 2-decimal string', () => {
        expect(formatGradeDisplay(3, null)).toBe('3.00');
        expect(formatGradeDisplay(2.5, 'Approaching Target')).toBe('2.50 (Approaching Target)');
    });

    it('passes string score through unchanged', () => {
        expect(formatGradeDisplay('3.00', 'Target')).toBe('3.00 (Target)');
    });
});

describe('percentageToPoints', () => {
    it('converts percentage to 0-4 scale (DEFAULT_MAX_POINTS = 4)', () => {
        expect(percentageToPoints(100)).toBe(4);
        expect(percentageToPoints(75)).toBe(3);
        expect(percentageToPoints(50)).toBe(2);
        expect(percentageToPoints(0)).toBe(0);
    });

    it('handles fractional percentages', () => {
        // 68.5% * 4 / 100 = 2.74
        expect(percentageToPoints(68.5)).toBeCloseTo(2.74, 5);
    });
});

describe('calculateDisplayValue', () => {
    describe('ASSIGNMENT source', () => {
        it('shows score and valid letter grade', () => {
            const { displayValue, ariaLabel } = calculateDisplayValue({
                score: 2.74,
                letterGrade: 'Developing',
                source: DISPLAY_SOURCE.ASSIGNMENT,
            });
            expect(displayValue).toBe('2.74 (Developing)');
            expect(ariaLabel).toBe('Grade: 2.74, letter grade Developing');
        });

        it('suppresses numeric letter grade for assignment source', () => {
            const { displayValue } = calculateDisplayValue({
                score: 2.74,
                letterGrade: '1.79',
                source: DISPLAY_SOURCE.ASSIGNMENT,
            });
            expect(displayValue).toBe('2.74');
        });

        it('shows score without letter grade when letter grade is absent', () => {
            const { displayValue } = calculateDisplayValue({
                score: 3.0,
                letterGrade: null,
                source: DISPLAY_SOURCE.ASSIGNMENT,
            });
            expect(displayValue).toBe('3.00');
        });
    });

    describe('ENROLLMENT source', () => {
        it('converts to points when letter grade matches rating scale', () => {
            // 75% of 4 = 3.00
            const { displayValue, ariaLabel } = calculateDisplayValue({
                score: 75,
                letterGrade: 'Target',
                source: DISPLAY_SOURCE.ENROLLMENT,
            });
            expect(displayValue).toBe('3.00 (Target)');
            expect(ariaLabel).toBe('Grade: 3.00, letter grade Target');
        });

        it('falls back to percentage when letter grade does not match rating scale', () => {
            const { displayValue, ariaLabel } = calculateDisplayValue({
                score: 85,
                letterGrade: 'B',
                source: DISPLAY_SOURCE.ENROLLMENT,
            });
            expect(displayValue).toBe('85.00% (B)');
            expect(ariaLabel).toBe('Grade: 85.00%, letter grade B');
        });

        it('shows plain percentage when letter grade is absent', () => {
            const { displayValue } = calculateDisplayValue({
                score: 90,
                letterGrade: null,
                source: DISPLAY_SOURCE.ENROLLMENT,
            });
            expect(displayValue).toBe('90.00%');
        });
    });

    describe('PERCENTAGE source (default)', () => {
        it('shows percentage with letter grade if present', () => {
            const { displayValue } = calculateDisplayValue({
                score: 92.5,
                letterGrade: 'A',
                source: DISPLAY_SOURCE.PERCENTAGE,
            });
            expect(displayValue).toBe('92.50% (A)');
        });

        it('shows plain percentage without letter grade', () => {
            const { displayValue, ariaLabel } = calculateDisplayValue({ score: 92.5 });
            expect(displayValue).toBe('92.50%');
            expect(ariaLabel).toBe('Grade: 92.50%');
        });
    });

    describe('null/undefined score', () => {
        it('returns letter grade when score is null', () => {
            const { displayValue } = calculateDisplayValue({
                score: null,
                letterGrade: 'Developing',
                source: DISPLAY_SOURCE.ASSIGNMENT,
            });
            expect(displayValue).toBe('Developing');
        });

        it('returns N/A when score and letter grade are both null', () => {
            const { displayValue } = calculateDisplayValue({ score: null });
            expect(displayValue).toBe('N/A');
        });
    });

    describe('includeAriaLabel=false', () => {
        it('omits ariaLabel from result', () => {
            const result = calculateDisplayValue({
                score: 3.0,
                letterGrade: 'Target',
                source: DISPLAY_SOURCE.ASSIGNMENT,
                includeAriaLabel: false,
            });
            expect(result.displayValue).toBeDefined();
            expect(result.ariaLabel).toBeUndefined();
        });
    });
});
