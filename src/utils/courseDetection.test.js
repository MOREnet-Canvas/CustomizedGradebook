// src/utils/courseDetection.test.js
/**
 * Unit tests for course detection utilities
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { hasAvgAssignment, determineCourseModel, matchesCourseNamePattern } from './courseDetection.js';

// Mock logger
vi.mock('./logger.js', () => ({
    logger: {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Mock config
vi.mock('../config.js', () => ({
    AVG_ASSIGNMENT_NAME: 'Current Score Assignment',
    STANDARDS_BASED_COURSE_PATTERNS: ['SBG', /Standards/i]
}));

describe('courseDetection', () => {
    describe('matchesCourseNamePattern', () => {
        test('returns true for string pattern match', () => {
            expect(matchesCourseNamePattern('Math SBG 101')).toBe(true);
            expect(matchesCourseNamePattern('SBG Science')).toBe(true);
        });

        test('returns true for regex pattern match', () => {
            expect(matchesCourseNamePattern('Standards-Based Math')).toBe(true);
            expect(matchesCourseNamePattern('standards course')).toBe(true);
        });

        test('returns false for non-matching course name', () => {
            expect(matchesCourseNamePattern('Traditional Math 101')).toBe(false);
            expect(matchesCourseNamePattern('Regular Science')).toBe(false);
        });

        test('returns false for null or empty course name', () => {
            expect(matchesCourseNamePattern(null)).toBe(false);
            expect(matchesCourseNamePattern('')).toBe(false);
        });

        test('is case-insensitive for string patterns', () => {
            expect(matchesCourseNamePattern('math sbg 101')).toBe(true);
            expect(matchesCourseNamePattern('MATH SBG 101')).toBe(true);
        });
    });

    describe('hasAvgAssignment', () => {
        let mockApiClient;

        beforeEach(() => {
            mockApiClient = {
                get: vi.fn()
            };
        });

        test('returns true when assignment with exact name exists', async () => {
            mockApiClient.get.mockResolvedValue([
                { id: '1', name: 'Current Score Assignment' },
                { id: '2', name: 'Other Assignment' }
            ]);

            const result = await hasAvgAssignment('12345', mockApiClient);

            expect(result).toBe(true);
            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/api/v1/courses/12345/assignments?search_term=Current%20Score%20Assignment',
                {},
                'checkAvgAssignment'
            );
        });

        test('returns false when no assignments match', async () => {
            mockApiClient.get.mockResolvedValue([
                { id: '1', name: 'Other Assignment' },
                { id: '2', name: 'Another Assignment' }
            ]);

            const result = await hasAvgAssignment('12345', mockApiClient);

            expect(result).toBe(false);
        });

        test('returns false when API returns empty array', async () => {
            mockApiClient.get.mockResolvedValue([]);

            const result = await hasAvgAssignment('12345', mockApiClient);

            expect(result).toBe(false);
        });

        test('returns false when API call fails', async () => {
            mockApiClient.get.mockRejectedValue(new Error('API Error'));

            const result = await hasAvgAssignment('12345', mockApiClient);

            expect(result).toBe(false);
        });

        test('returns false when API returns non-array', async () => {
            mockApiClient.get.mockResolvedValue({ error: 'Invalid response' });

            const result = await hasAvgAssignment('12345', mockApiClient);

            expect(result).toBe(false);
        });

        test('requires exact name match (not substring)', async () => {
            mockApiClient.get.mockResolvedValue([
                { id: '1', name: 'Current Score Assignment Extra' },
                { id: '2', name: 'My Current Score Assignment' }
            ]);

            const result = await hasAvgAssignment('12345', mockApiClient);

            expect(result).toBe(false);
        });
    });

    describe('determineCourseModel', () => {
        let mockApiClient;

        beforeEach(() => {
            mockApiClient = {
                get: vi.fn()
            };
        });

        test('returns standards with name-pattern reason when course name matches', async () => {
            const result = await determineCourseModel(
                { courseId: '12345', courseName: 'Math SBG 101' },
                null,
                { apiClient: mockApiClient }
            );

            expect(result).toEqual({
                model: 'standards',
                reason: 'name-pattern'
            });
            // Should not call API when name matches
            expect(mockApiClient.get).not.toHaveBeenCalled();
        });

        test('returns standards with avg-assignment reason when AVG assignment exists', async () => {
            mockApiClient.get.mockResolvedValue([
                { id: '1', name: 'Current Score Assignment' }
            ]);

            const result = await determineCourseModel(
                { courseId: '12345', courseName: 'Traditional Math' },
                null,
                { apiClient: mockApiClient }
            );

            expect(result).toEqual({
                model: 'standards',
                reason: 'avg-assignment'
            });
        });

        test('returns traditional when no pattern match and no AVG assignment', async () => {
            mockApiClient.get.mockResolvedValue([]);

            const result = await determineCourseModel(
                { courseId: '12345', courseName: 'Traditional Math' },
                null,
                { apiClient: mockApiClient }
            );

            expect(result).toEqual({
                model: 'traditional',
                reason: 'no-match'
            });
        });

        test('returns traditional with no-api-client reason when apiClient is missing', async () => {
            const result = await determineCourseModel(
                { courseId: '12345', courseName: 'Traditional Math' },
                null,
                { apiClient: null }
            );

            expect(result).toEqual({
                model: 'traditional',
                reason: 'no-api-client'
            });
        });

        test('returns traditional with invalid-input reason when courseId is missing', async () => {
            const result = await determineCourseModel(
                { courseId: null, courseName: 'Math 101' },
                null,
                { apiClient: mockApiClient }
            );

            expect(result).toEqual({
                model: 'traditional',
                reason: 'invalid-input'
            });
        });

        test('returns traditional with invalid-input reason when courseName is missing', async () => {
            const result = await determineCourseModel(
                { courseId: '12345', courseName: null },
                null,
                { apiClient: mockApiClient }
            );

            expect(result).toEqual({
                model: 'traditional',
                reason: 'invalid-input'
            });
        });

        test('checks name pattern before making API call', async () => {
            mockApiClient.get.mockResolvedValue([
                { id: '1', name: 'Current Score Assignment' }
            ]);

            await determineCourseModel(
                { courseId: '12345', courseName: 'Standards-Based Math' },
                null,
                { apiClient: mockApiClient }
            );

            // Should not call API when name matches pattern
            expect(mockApiClient.get).not.toHaveBeenCalled();
        });

        test('handles API errors gracefully', async () => {
            mockApiClient.get.mockRejectedValue(new Error('Network error'));

            const result = await determineCourseModel(
                { courseId: '12345', courseName: 'Traditional Math' },
                null,
                { apiClient: mockApiClient }
            );

            expect(result).toEqual({
                model: 'traditional',
                reason: 'no-match'
            });
        });
    });
});