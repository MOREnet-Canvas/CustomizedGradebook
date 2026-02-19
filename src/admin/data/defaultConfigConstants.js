// src/admin/data/defaultConfigConstants.js
/**
 * Default Configuration Constants
 *
 * Centralized default values for loader generation and admin dashboard UI.
 * These values are used as:
 * - Default parameter values in buildCGManagedBlock()
 * - Initial UI values in the admin dashboard configuration panel
 *
 * Single source of truth for all default configuration values.
 */

/**
 * Release configuration defaults
 */
export const DEFAULT_CHANNEL = 'prod';
export const DEFAULT_VERSION = 'v1.0.3';
export const DEFAULT_VERSION_TRACK = null;
export const DEFAULT_SOURCE = 'github_release';

/**
 * Feature flag defaults
 */
export const DEFAULT_ENABLE_STUDENT_GRADE_CUSTOMIZATION = true;
export const DEFAULT_ENABLE_GRADE_OVERRIDE = true;
export const DEFAULT_ENFORCE_COURSE_OVERRIDE = false;
export const DEFAULT_ENFORCE_COURSE_GRADING_SCHEME = false;

/**
 * UI label defaults
 */
export const DEFAULT_UPDATE_AVG_BUTTON_LABEL = 'Update Current Score';
export const DEFAULT_AVG_OUTCOME_NAME = 'Current Score';
export const DEFAULT_AVG_ASSIGNMENT_NAME = 'Current Score Assignment';
export const DEFAULT_AVG_RUBRIC_NAME = 'Current Score Rubric';

/**
 * Outcome configuration defaults
 */
export const DEFAULT_MAX_POINTS = 4;
export const DEFAULT_MASTERY_THRESHOLD = 3;

/**
 * Rating scale for outcomes and rubrics
 * Default: 9-level scale from 0 (Insufficient Evidence) to 4 (Exemplary)
 */
export const DEFAULT_OUTCOME_AND_RUBRIC_RATINGS = [
    { description: "Exemplary", points: 4 },
    { description: "Beyond Target", points: 3.5 },
    { description: "Target", points: 3 },
    { description: "Approaching Target", points: 2.5 },
    { description: "Developing", points: 2 },
    { description: "Beginning", points: 1.5 },
    { description: "Needs Partial Support", points: 1 },
    { description: "Needs Full Support", points: 0.5 },
    { description: "Insufficient Evidence", points: 0 }
];

/**
 * Outcome filtering defaults
 */
export const DEFAULT_EXCLUDED_OUTCOME_KEYWORDS = ["Homework Completion"];

/**
 * Grading scheme configuration defaults
 */
export const DEFAULT_GRADING_SCHEME_ID = null;
export const DEFAULT_GRADING_SCHEME = null;
export const DEFAULT_GRADING_TYPE = 'points';

/**
 * Account filter defaults
 */
export const DEFAULT_ENABLE_ACCOUNT_FILTER = false;
export const DEFAULT_ALLOWED_ACCOUNT_IDS = [];