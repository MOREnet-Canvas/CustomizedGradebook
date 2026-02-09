// src/admin/data/gradingSchemeExamples.js
/**
 * Example Grading Scheme Templates
 * 
 * These are pre-configured grading scheme examples that administrators can use
 * as templates for creating new grading schemes in their Canvas account.
 */

/**
 * Example grading schemes array
 * 
 * Each scheme follows the Canvas API grading standard format:
 * - title: Display name of the grading scheme
 * - scaling_factor: Multiplier for converting decimal values (e.g., 4 for 4-point scale, 1 for percentage)
 * - points_based: Boolean indicating if scheme is points-based (true) or percentage-based (false)
 * - data: Array of grading scale entries with name and value (0-1 decimal range)
 */
export const GRADING_SCHEME_EXAMPLES = [
    {
        id: "example-cbe-points",
        title: "CBE - Points",
        scaling_factor: 4,
        points_based: true,
        context_type: "Example",
        data: [
            { name: "Exemplary", value: 1.0 },
            { name: "Beyond Target", value: 0.875 },
            { name: "Target", value: 0.75 },
            { name: "Approaching Target", value: 0.625 },
            { name: "Developing", value: 0.5 },
            { name: "Beginning", value: 0.375 },
            { name: "Needs Partial Support", value: 0.25 },
            { name: "Needs Full Support", value: 0.125 },
            { name: "No Evidence", value: 0 }
        ]
    },
    {
        id: "example-cbe-percentage",
        title: "CBE - Percentage",
        scaling_factor: 1,
        points_based: false,
        context_type: "Example",
        data: [
            { name: "4", value: 0.94 },
            { name: "3.5", value: 0.93 },
            { name: "3.35", value: 0.92 },
            { name: "3.2", value: 0.91 },
            { name: "3.15", value: 0.9 },
            { name: "3.0", value: 0.89 },
            { name: "2.5", value: 0.84 },
            { name: "2", value: 0.8 },
            { name: "1.5", value: 0.77 },
            { name: "1", value: 0.74 },
            { name: "0.5", value: 0.7 },
            { name: "0", value: 0 }
        ]
    }
];

/**
 * Get all example grading schemes
 * 
 * @returns {Array} Array of example grading schemes
 */
export function getGradingSchemeExamples() {
    return GRADING_SCHEME_EXAMPLES;
}

/**
 * Get a specific example grading scheme by ID
 * 
 * @param {string} id - Example scheme ID
 * @returns {Object|null} Example grading scheme or null if not found
 */
export function getGradingSchemeExampleById(id) {
    return GRADING_SCHEME_EXAMPLES.find(scheme => scheme.id === id) || null;
}

