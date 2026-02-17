// src/admin/loaderGenerator.js
/**
 * Loader Generator Module
 *
 * Implements the A/B/C generation model:
 * - A = External loader (district's Theme JS from textarea)
 * - B = Managed config block (generated fresh from dashboard UI state)
 * - C = CG_LOADER_TEMPLATE (stable CG loader logic from codebase)
 *
 * The managed config block (B):
 * - Is delimited by exact sentinels (BEGIN/END SECTION B: MANAGED CONFIG BLOCK)
 * - Contains ONLY configuration objects (window.CG_MANAGED.release and .config)
 * - Is always regenerated fresh (never copied from existing loader)
 */

import { logger } from '../utils/logger.js';
import { CG_LOADER_TEMPLATE } from './templates/cgLoaderTemplate.js';
import {
    DEFAULT_CHANNEL,
    DEFAULT_VERSION,
    DEFAULT_VERSION_TRACK,
    DEFAULT_SOURCE,
    DEFAULT_ENABLE_STUDENT_GRADE_CUSTOMIZATION,
    DEFAULT_ENABLE_GRADE_OVERRIDE,
    DEFAULT_ENFORCE_COURSE_OVERRIDE,
    DEFAULT_ENFORCE_COURSE_GRADING_SCHEME,
    DEFAULT_UPDATE_AVG_BUTTON_LABEL,
    DEFAULT_AVG_OUTCOME_NAME,
    DEFAULT_AVG_ASSIGNMENT_NAME,
    DEFAULT_AVG_RUBRIC_NAME,
    DEFAULT_MAX_POINTS,
    DEFAULT_MASTERY_THRESHOLD,
    DEFAULT_OUTCOME_AND_RUBRIC_RATINGS,
    DEFAULT_EXCLUDED_OUTCOME_KEYWORDS,
    DEFAULT_GRADING_SCHEME_ID,
    DEFAULT_GRADING_SCHEME,
    DEFAULT_GRADING_TYPE,
    DEFAULT_ENABLE_ACCOUNT_FILTER,
    DEFAULT_ALLOWED_ACCOUNT_IDS
} from './data/defaultConfigConstants.js';

// Sentinel markers for all sections
const A_BEGIN = '/* ========== BEGIN SECTION A: EXTERNAL LOADER ========== */';
const A_END = '/* ========== END SECTION A: EXTERNAL LOADER ========== */';
const B_BEGIN = '/* ========== BEGIN SECTION B: MANAGED CONFIG BLOCK ========== */';
const B_END = '/* ========== END SECTION B: MANAGED CONFIG BLOCK ========== */';
const C_BEGIN = '/* ========== BEGIN SECTION C: CG LOADER TEMPLATE ========== */';
const C_END = '/* ========== END SECTION C: CG LOADER TEMPLATE ========== */';

/**
 * Build managed config block (Section B)
 *
 * Generates the managed config block (B) with:
 * - window.CG_MANAGED.release (channel, version, source)
 * - window.CG_MANAGED.config (all configuration options from UI)
 *
 * @param {Object} options - Configuration options
 * @param {string} options.accountId - Account ID
 * @param {string} [options.channel='prod'] - Release channel (prod/dev)
 * @param {string} [options.version='v1.0.3'] - Release version
 * @param {string} [options.source='github_release'] - Release source (github_release/pages)
 * @param {boolean} [options.enableStudentGradeCustomization=true] - Enable student grade customization
 * @param {boolean} [options.enableGradeOverride=true] - Enable grade override
 * @param {boolean} [options.enforceCourseOverride=false] - Enforce course override setting via API
 * @param {string} [options.updateAvgButtonLabel='Update Current Score'] - Update average button label
 * @param {string} [options.avgOutcomeName='Current Score'] - Average outcome name
 * @param {string} [options.avgAssignmentName='Current Score Assignment'] - Average assignment name
 * @param {string} [options.avgRubricName='Current Score Rubric'] - Average rubric name
 * @param {number} [options.defaultMaxPoints=4] - Default max points for outcomes
 * @param {number} [options.defaultMasteryThreshold=3] - Default mastery threshold
 * @param {Array} [options.outcomeAndRubricRatings] - Rating scale for outcomes and rubrics
 * @param {Array} [options.excludedOutcomeKeywords] - Keywords to exclude from outcomes
 * @param {number|null} [options.defaultGradingSchemeId=null] - Default grading scheme ID
 * @param {Object|null} [options.defaultGradingScheme=null] - Default grading scheme object
 * @param {string} [options.defaultGradingType='points'] - Default grading type for assignments
 * @param {boolean} [options.enableAccountFilter=false] - Enable account filtering
 * @param {Array<string>} [options.allowedAccountIds=[]] - Array of allowed account IDs
 * @returns {string} Managed config block content (Section B)
 */
export function buildCGManagedBlock({
    accountId,
    channel = DEFAULT_CHANNEL,
    version = DEFAULT_VERSION,
    versionTrack = DEFAULT_VERSION_TRACK,
    source = DEFAULT_SOURCE,
    enableStudentGradeCustomization = DEFAULT_ENABLE_STUDENT_GRADE_CUSTOMIZATION,
    enableGradeOverride = DEFAULT_ENABLE_GRADE_OVERRIDE,
    enforceCourseOverride = DEFAULT_ENFORCE_COURSE_OVERRIDE,
    enforceCourseGradingScheme = DEFAULT_ENFORCE_COURSE_GRADING_SCHEME,
    updateAvgButtonLabel = DEFAULT_UPDATE_AVG_BUTTON_LABEL,
    avgOutcomeName = DEFAULT_AVG_OUTCOME_NAME,
    avgAssignmentName = DEFAULT_AVG_ASSIGNMENT_NAME,
    avgRubricName = DEFAULT_AVG_RUBRIC_NAME,
    defaultMaxPoints = DEFAULT_MAX_POINTS,
    defaultMasteryThreshold = DEFAULT_MASTERY_THRESHOLD,
    outcomeAndRubricRatings = DEFAULT_OUTCOME_AND_RUBRIC_RATINGS,
    excludedOutcomeKeywords = DEFAULT_EXCLUDED_OUTCOME_KEYWORDS,
    defaultGradingSchemeId = DEFAULT_GRADING_SCHEME_ID,
    defaultGradingScheme = DEFAULT_GRADING_SCHEME,
    defaultGradingType = DEFAULT_GRADING_TYPE,
    enableAccountFilter = DEFAULT_ENABLE_ACCOUNT_FILTER,
    allowedAccountIds = DEFAULT_ALLOWED_ACCOUNT_IDS
}) {
    logger.debug('[LoaderGenerator] Building managed config block (Section B)', {
        accountId,
        channel,
        version,
        versionTrack,
        source
    });

    const lines = [
        B_BEGIN,
        `/* Generated: ${new Date().toISOString()} */`,
        `/* Account: ${accountId ?? 'unknown'} */`,
        '/* Purpose: Version and configuration management for CG loader */',
        channel === 'prod' ? '/* NOTE: Keep version in sync with package.json */' : '',
        channel === 'auto-patch' ? `/* Auto-Patch Track: ${versionTrack} (auto-updates to latest patch) */` : '',
        '',
        'window.CG_MANAGED = window.CG_MANAGED || {};',
        '',
        '// Release configuration',
        'window.CG_MANAGED.release = {',
        `    channel: ${JSON.stringify(channel)},`,
        `    version: ${JSON.stringify(version)},${channel === 'prod' ? '  // Keep in sync with package.json version' : ''}`,
        channel === 'auto-patch' ? `    versionTrack: ${JSON.stringify(versionTrack)},  // Auto-updates to latest patch in this track` : '',
        `    source: ${JSON.stringify(source)}`,
        '};',
        '',
        '// Configuration overrides',
        'window.CG_MANAGED.config = {',
        `    // Feature flags`,
        `    ENABLE_STUDENT_GRADE_CUSTOMIZATION: ${enableStudentGradeCustomization ? 'true' : 'false'},`,
        `    ENABLE_GRADE_OVERRIDE: ${enableGradeOverride ? 'true' : 'false'},`,
        `    ENFORCE_COURSE_OVERRIDE: ${enforceCourseOverride ? 'true' : 'false'},`,
        `    ENFORCE_COURSE_GRADING_SCHEME: ${enforceCourseGradingScheme ? 'true' : 'false'},`,
        '',
        `    // UI labels`,
        `    UPDATE_AVG_BUTTON_LABEL: ${JSON.stringify(updateAvgButtonLabel)},`,
        `    AVG_OUTCOME_NAME: ${JSON.stringify(avgOutcomeName)},`,
        `    AVG_ASSIGNMENT_NAME: ${JSON.stringify(avgAssignmentName)},`,
        `    AVG_RUBRIC_NAME: ${JSON.stringify(avgRubricName)},`,
        '',
        `    // Outcome configuration`,
        `    DEFAULT_MAX_POINTS: ${defaultMaxPoints},`,
        `    DEFAULT_MASTERY_THRESHOLD: ${defaultMasteryThreshold},`,
        '',
        `    // Rating scale`,
        `    OUTCOME_AND_RUBRIC_RATINGS: ${JSON.stringify(outcomeAndRubricRatings, null, 8).replace(/\n/g, '\n    ')},`,
        '',
        `    // Outcome filtering`,
        `    EXCLUDED_OUTCOME_KEYWORDS: ${JSON.stringify(excludedOutcomeKeywords)},`,
        '',
        `    // Grading scheme and type`,
        `    DEFAULT_GRADING_SCHEME_ID: ${defaultGradingSchemeId !== null ? defaultGradingSchemeId : 'null'},`,
        `    DEFAULT_GRADING_SCHEME: ${defaultGradingScheme !== null ? JSON.stringify(defaultGradingScheme, null, 8).replace(/\n/g, '\n    ') : 'null'},`,
        `    DEFAULT_GRADING_TYPE: ${JSON.stringify(defaultGradingType)},`,
        '',
        `    // Account filtering`,
        `    ENABLE_ACCOUNT_FILTER: ${enableAccountFilter ? 'true' : 'false'},`,
        `    ALLOWED_ACCOUNT_IDS: ${JSON.stringify(allowedAccountIds)}`,
        '};',
        '',
        B_END
    ];

    return lines.join('\n');
}

/**
 * Assemble A+B+C loader output
 *
 * Implements deterministic A+B+C assembly:
 * - A = External loader (district's Theme JS) - copied verbatim
 * - B = Managed config block - generated fresh from UI state (MUST come before C)
 * - C = CG_LOADER_TEMPLATE (stable CG loader) - inserted verbatim from codebase
 *
 * IMPORTANT: Section B must come before Section C because Section C reads
 * window.CG_MANAGED.release at runtime. If C executes before B is defined,
 * it will fall back to hardcoded defaults.
 *
 * Output format: A.trimEnd() + "\n\n" + B.trimEnd() + "\n\n" + C.trim() + "\n"
 *
 * @param {Object} options - Options
 * @param {string} options.baseLoaderText - Base loader text (A - external/district loader)
 * @param {string} options.cgBlock - Managed config block (B - generated config)
 * @returns {string} Combined loader text (A+B+C)
 */
export function upsertCGBlockIntoLoader({ baseLoaderText, cgBlock }) {
    logger.debug('[LoaderGenerator] Assembling A+B+C loader output');

    // Extract A using the extractSections function
    const { A: extractedA } = extractSections(baseLoaderText);

    // Use extracted A if available, otherwise use the entire base text
    const A = extractedA || baseLoaderText.trimEnd();

    // B = Managed config block (generated fresh, already has markers)
    const B = cgBlock.trimEnd();

    // C = CG loader template (from codebase)
    const C = CG_LOADER_TEMPLATE.trim();

    // Assemble with section markers: A + B + C (B must come before C!)
    const output = `${A_BEGIN}\n${A}\n${A_END}\n\n${B}\n\n${C_BEGIN}\n${C}\n${C_END}\n`;

    logger.debug('[LoaderGenerator] A+B+C assembly complete', {
        aLength: A.length,
        bLength: B.length,
        cLength: C.length,
        totalLength: output.length
    });

    return output;
}

/**
 * Extract sections A, B, and C from a combined loader
 *
 * Intelligently parses a combined loader to extract:
 * - A = External loader (district code)
 * - B = Managed config block
 * - C = CG loader template
 *
 * @param {string} combinedLoader - Combined loader text
 * @returns {Object} Extracted sections { A: string, B: string, C: string }
 */
export function extractSections(combinedLoader) {
    logger.debug('[LoaderGenerator] Extracting sections from combined loader');

    let A = '';
    let B = '';
    let C = '';

    // Extract Section A
    const aStart = combinedLoader.indexOf(A_BEGIN);
    const aEnd = combinedLoader.indexOf(A_END);
    if (aStart !== -1 && aEnd !== -1 && aEnd > aStart) {
        A = combinedLoader.slice(aStart + A_BEGIN.length, aEnd).trim();
        logger.debug('[LoaderGenerator] Extracted Section A');
    }

    // Extract Section B
    const bStart = combinedLoader.indexOf(B_BEGIN);
    const bEnd = combinedLoader.indexOf(B_END);
    if (bStart !== -1 && bEnd !== -1 && bEnd > bStart) {
        B = combinedLoader.slice(bStart, bEnd + B_END.length).trim();
        logger.debug('[LoaderGenerator] Extracted Section B');
    }

    // Extract Section C
    const cStart = combinedLoader.indexOf(C_BEGIN);
    const cEnd = combinedLoader.indexOf(C_END);
    if (cStart !== -1 && cEnd !== -1 && cEnd > cStart) {
        C = combinedLoader.slice(cStart + C_BEGIN.length, cEnd).trim();
        logger.debug('[LoaderGenerator] Extracted Section C');
    }

    logger.debug('[LoaderGenerator] Section extraction complete', {
        aLength: A.length,
        bLength: B.length,
        cLength: C.length
    });

    return { A, B, C };
}

/**
 * Validate assembled loader output
 *
 * Performs safety checks:
 * - Output must contain section markers for A, B, and C
 * - Markers must be in correct order: A → B → C
 *
 * @param {string} output - Assembled loader output
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateLoaderOutput(output) {
    const errors = [];

    // Check for Section A markers
    if (!output.includes(A_BEGIN)) {
        errors.push('Missing Section A BEGIN marker');
    }
    if (!output.includes(A_END)) {
        errors.push('Missing Section A END marker');
    }

    // Check for Section B markers
    if (!output.includes(B_BEGIN)) {
        errors.push('Missing Section B BEGIN marker');
    }
    if (!output.includes(B_END)) {
        errors.push('Missing Section B END marker');
    }

    // Check for Section C markers
    if (!output.includes(C_BEGIN)) {
        errors.push('Missing Section C BEGIN marker');
    }
    if (!output.includes(C_END)) {
        errors.push('Missing Section C END marker');
    }

    // Check marker order
    const aBeginIdx = output.indexOf(A_BEGIN);
    const aEndIdx = output.indexOf(A_END);
    const bBeginIdx = output.indexOf(B_BEGIN);
    const bEndIdx = output.indexOf(B_END);
    const cBeginIdx = output.indexOf(C_BEGIN);
    const cEndIdx = output.indexOf(C_END);

    if (aBeginIdx !== -1 && aEndIdx !== -1 && aEndIdx <= aBeginIdx) {
        errors.push('Section A END marker appears before BEGIN marker');
    }
    if (bBeginIdx !== -1 && bEndIdx !== -1 && bEndIdx <= bBeginIdx) {
        errors.push('Section B END marker appears before BEGIN marker');
    }
    if (cBeginIdx !== -1 && cEndIdx !== -1 && cEndIdx <= cBeginIdx) {
        errors.push('Section C END marker appears before BEGIN marker');
    }

    // Check that sections appear in order: A, then B, then C
    if (aBeginIdx !== -1 && bBeginIdx !== -1 && bBeginIdx <= aBeginIdx) {
        errors.push('Section B appears before Section A');
    }
    if (bBeginIdx !== -1 && cBeginIdx !== -1 && cBeginIdx <= bBeginIdx) {
        errors.push('Section C appears before Section B (Section B must come before C!)');
    }

    const valid = errors.length === 0;

    if (!valid) {
        logger.warn('[LoaderGenerator] Validation failed', { errors });
    }

    return { valid, errors };
}