// src/config.js
/**
 * ============================================================================
 * CustomizedGradebook - Configuration
 * ============================================================================
 *
 * This file provides configuration constants for the CustomizedGradebook.
 *
 * RUNTIME OVERRIDE SUPPORT:
 * -------------------------
 * All constants can be overridden at runtime via window.CG_CONFIG, which is
 * set by the loader files (upload_dev.js or upload_production.js).
 *
 * This allows users to customize configuration by editing only the loader
 * files without needing to rebuild the bundle. The values in this file serve
 * as fallback defaults when window.CG_CONFIG is not set or doesn't contain
 * a specific constant.
 *
 * EXECUTION ORDER:
 * ----------------
 * 1. Loader file (upload_dev.js or upload_production.js) runs first
 * 2. Loader sets window.CG_CONFIG with user-customized values
 * 3. Loader injects the main bundle script
 * 4. Main bundle loads and this config.js module is imported
 * 5. Constants read from window.CG_CONFIG (if set) or use defaults below
 *
 * CUSTOMIZATION WORKFLOW:
 * -----------------------
 * To customize configuration:
 * 1. Edit window.CG_CONFIG in upload_dev.js or upload_production.js
 * 2. Inject the updated loader into Canvas (no rebuild needed)
 * 3. The main bundle will automatically use the customized values
 *
 * ============================================================================
 */

// Feature flags
export const ENABLE_STUDENT_GRADE_CUSTOMIZATION = window.CG_CONFIG?.ENABLE_STUDENT_GRADE_CUSTOMIZATION ?? true;
export const REMOVE_ASSIGNMENT_TAB = window.CG_CONFIG?.REMOVE_ASSIGNMENT_TAB ?? false;
export const PER_STUDENT_UPDATE_THRESHOLD = window.CG_CONFIG?.PER_STUDENT_UPDATE_THRESHOLD ?? 25;
export const MASTERY_REFRESH_ENABLED = window.CG_CONFIG?.MASTERY_REFRESH_ENABLED ?? true;

// Grading mode configuration
// ENABLE_OUTCOME_UPDATES: Controls whether outcome scores (and assignments/rubrics) are updated
// ENABLE_GRADE_OVERRIDE: Controls whether final grade overrides are updated
// Supported modes:
//   - Outcome only: ENABLE_OUTCOME_UPDATES=true, ENABLE_GRADE_OVERRIDE=false
//   - Override only: ENABLE_OUTCOME_UPDATES=false, ENABLE_GRADE_OVERRIDE=true
//   - Both (default): ENABLE_OUTCOME_UPDATES=true, ENABLE_GRADE_OVERRIDE=true
export const ENABLE_OUTCOME_UPDATES = window.CG_CONFIG?.ENABLE_OUTCOME_UPDATES ?? true;
export const ENABLE_GRADE_OVERRIDE = window.CG_CONFIG?.ENABLE_GRADE_OVERRIDE ?? true;

// Grade scaling function (0-4 scale to 0-100 scale)
// Default: multiply by 25 to convert 0-4 range to 0-100 range
const defaultOverrideScale = (avg) => Number((avg * 25).toFixed(2));
export const OVERRIDE_SCALE = window.CG_CONFIG?.OVERRIDE_SCALE ?? defaultOverrideScale;

// UI labels and resource names
export const UPDATE_AVG_BUTTON_LABEL = window.CG_CONFIG?.UPDATE_AVG_BUTTON_LABEL ?? "Update Current Score";
export const AVG_OUTCOME_NAME = window.CG_CONFIG?.AVG_OUTCOME_NAME ?? "Current Score";
export const AVG_ASSIGNMENT_NAME = window.CG_CONFIG?.AVG_ASSIGNMENT_NAME ?? "Current Score Assignment";
export const AVG_RUBRIC_NAME = window.CG_CONFIG?.AVG_RUBRIC_NAME ?? "Current Score Rubric";

// Outcome configuration
export const DEFAULT_MAX_POINTS = window.CG_CONFIG?.DEFAULT_MAX_POINTS ?? 4;
export const DEFAULT_MASTERY_THRESHOLD = window.CG_CONFIG?.DEFAULT_MASTERY_THRESHOLD ?? 3;

// Rating scale for outcomes and rubrics
// Default: 9-level scale from 0 (No Evidence) to 4 (Exemplary)
const defaultRatings = [
    { description: "Exemplary", points: 4 },
    { description: "Beyond Target", points: 3.5 },
    { description: "Target", points: 3 },
    { description: "Approaching Target", points: 2.5 },
    { description: "Developing", points: 2 },
    { description: "Beginning", points: 1.5 },
    { description: "Needs Partial Support", points: 1 },
    { description: "Needs Full Support", points: 0.5 },
    { description: "No Evidence", points: 0 }
];
export const OUTCOME_AND_RUBRIC_RATINGS = window.CG_CONFIG?.OUTCOME_AND_RUBRIC_RATINGS ?? defaultRatings;

// Outcome filtering
const defaultExcludedKeywords = [];
export const EXCLUDED_OUTCOME_KEYWORDS = window.CG_CONFIG?.EXCLUDED_OUTCOME_KEYWORDS ?? defaultExcludedKeywords;

// Standards-Based Course Detection (for all-grades page)
// Array of patterns to match against course names to identify standards-based courses
// Supports both string matching (case-insensitive) and regex patterns
// Examples: ["Standards Based", "SBG", "Mastery", /^SBG-/, /\[SBG\]/]
const defaultStandardsBasedPatterns = [
    "Standards Based",
    "SBG",
    "Mastery",
    /\[SBG\]/i,
    /^SBG[-\s]/i
];
export const STANDARDS_BASED_COURSE_PATTERNS = window.CG_CONFIG?.STANDARDS_BASED_COURSE_PATTERNS ?? defaultStandardsBasedPatterns;

// Mastery Refresh Configuration
// Delay in milliseconds to wait for Canvas to propagate points_possible changes
// before reverting back to 0 (default: 5 seconds)
export const MASTERY_REFRESH_DELAY_MS = window.CG_CONFIG?.MASTERY_REFRESH_DELAY_MS ?? 5000;

// Maximum time in milliseconds to wait for Canvas to propagate assignment changes
// and recompute per-student gradebook data (default: 15 seconds)
export const MASTERY_REFRESH_PROPAGATION_TIMEOUT_MS = window.CG_CONFIG?.MASTERY_REFRESH_PROPAGATION_TIMEOUT_MS ?? 15000;

// Time in milliseconds between polling attempts when checking for propagation
// (default: 2 seconds)
export const MASTERY_REFRESH_PROPAGATION_POLL_INTERVAL_MS = window.CG_CONFIG?.MASTERY_REFRESH_PROPAGATION_POLL_INTERVAL_MS ?? 2000;