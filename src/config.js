// src/config.js
export const ENABLE_STUDENT_GRADE_CUSTOMIZATION = true;
export const REMOVE_ASSIGNMENT_TAB = false;
export const PER_STUDENT_UPDATE_THRESHOLD = 25;

// Grading mode configuration
// ENABLE_OUTCOME_UPDATES: Controls whether outcome scores (and assignments/rubrics) are updated
// ENABLE_GRADE_OVERRIDE: Controls whether final grade overrides are updated
// Supported modes:
//   - Outcome only: ENABLE_OUTCOME_UPDATES=true, ENABLE_GRADE_OVERRIDE=false
//   - Override only: ENABLE_OUTCOME_UPDATES=false, ENABLE_GRADE_OVERRIDE=true
//   - Both (default): ENABLE_OUTCOME_UPDATES=true, ENABLE_GRADE_OVERRIDE=true
export const ENABLE_OUTCOME_UPDATES = true;
export const ENABLE_GRADE_OVERRIDE = true;

export const OVERRIDE_SCALE = (avg) => Number((avg * 25).toFixed(2)); // 0–4 -> 0–100

export const UPDATE_AVG_BUTTON_LABEL = "Update Current Score";
export const AVG_OUTCOME_NAME = "Current Score";
export const AVG_ASSIGNMENT_NAME = "Current Score Assignment";
export const AVG_RUBRIC_NAME = "Current Score Rubric";
export const DEFAULT_MAX_POINTS = 4;
export const DEFAULT_MASTERY_THRESHOLD = 3;

export const OUTCOME_AND_RUBRIC_RATINGS = [
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

export const EXCLUDED_OUTCOME_KEYWORDS = ["Homework Completion"];
