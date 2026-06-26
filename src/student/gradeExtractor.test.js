// src/student/gradeExtractor.test.js
// Tests for pure logic only — DOM-dependent extractCurrentScoreFromPage() is excluded.
import { describe, it, expect, vi } from 'vitest';
import { scoreToGradeLevel } from './gradeExtractor.js';

// Mock config.js to avoid TDZ bug (PL_GRADING_TYPE referenced before initialization)
vi.mock('../config.js', () => ({
    AVG_ASSIGNMENT_NAME: 'Current Score Assignment',
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
}));

vi.mock('../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../utils/canvas.js', () => ({
    extractCourseIdFromHref: vi.fn(),
}));

// Default rating scale used in tests (mirrors config.js defaults):
//   Exemplary (4), Beyond Target (3.5), Target (3), Approaching Target (2.5),
//   Developing (2), Beginning (1.5), Needs Partial Support (1),
//   Needs Full Support (0.5), Insufficient Evidence (0)

describe('scoreToGradeLevel', () => {
    it('returns null for non-numeric input', () => {
        expect(scoreToGradeLevel('abc')).toBeNull();
        expect(scoreToGradeLevel(NaN)).toBeNull();
    });

    it('returns correct description for exact rating boundary scores', () => {
        expect(scoreToGradeLevel(4)).toBe('Exemplary');
        expect(scoreToGradeLevel(3.5)).toBe('Beyond Target');
        expect(scoreToGradeLevel(3)).toBe('Target');
        expect(scoreToGradeLevel(2.5)).toBe('Approaching Target');
        expect(scoreToGradeLevel(2)).toBe('Developing');
        expect(scoreToGradeLevel(1.5)).toBe('Beginning');
        expect(scoreToGradeLevel(1)).toBe('Needs Partial Support');
        expect(scoreToGradeLevel(0.5)).toBe('Needs Full Support');
        expect(scoreToGradeLevel(0)).toBe('Insufficient Evidence');
    });

    it('returns correct description for scores between boundaries', () => {
        // 3.7 is between 3.5 and 4 → "Beyond Target"
        expect(scoreToGradeLevel(3.7)).toBe('Beyond Target');
        // 2.74 is between 2.5 and 3 → "Approaching Target"
        expect(scoreToGradeLevel(2.74)).toBe('Approaching Target');
        // 1.79 is between 1.5 and 2 → "Beginning"
        expect(scoreToGradeLevel(1.79)).toBe('Beginning');
        // 0.8 is between 0.5 and 1 → "Needs Full Support"
        expect(scoreToGradeLevel(0.8)).toBe('Needs Full Support');
    });

    it('returns lowest rating for scores below all boundaries', () => {
        // Anything below 0 falls off the bottom; return last rating
        expect(scoreToGradeLevel(-1)).toBe('Insufficient Evidence');
    });

    it('accepts numeric strings as input', () => {
        expect(scoreToGradeLevel('3')).toBe('Target');
        expect(scoreToGradeLevel('1.79')).toBe('Beginning');
    });

    it('returns "Exemplary" for scores at or above 4', () => {
        // Score of exactly 4 matches the Exemplary boundary
        expect(scoreToGradeLevel(4)).toBe('Exemplary');
        // Score above 4 is also resolved to Exemplary (first match in descending sort)
        expect(scoreToGradeLevel(4.5)).toBe('Exemplary');
    });
});
