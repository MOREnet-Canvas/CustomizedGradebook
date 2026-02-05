// src/admin/loaderGenerator.js
/**
 * Loader Generator Module
 *
 * Implements the A/B/C generation model:
 * - A = External loader (district's Theme JS from textarea)
 * - B = CG_LOADER_TEMPLATE (stable CG loader logic from codebase)
 * - C = Managed config block (generated fresh from dashboard UI state)
 *
 * The CG-managed block (C):
 * - Is delimited by exact sentinels (BEGIN/END CG MANAGED CODE)
 * - Contains ONLY configuration objects (window.CG_MANAGED.release and .config)
 * - Is always regenerated fresh (never copied from existing loader)
 */

import { logger } from '../utils/logger.js';
import { CG_LOADER_TEMPLATE } from './templates/cgLoaderTemplate.js';

// Sentinel markers for all sections
const A_BEGIN = '/* ========== BEGIN SECTION A: EXTERNAL LOADER ========== */';
const A_END = '/* ========== END SECTION A: EXTERNAL LOADER ========== */';
const B_BEGIN = '/* ========== BEGIN SECTION B: CG LOADER TEMPLATE ========== */';
const B_END = '/* ========== END SECTION B: CG LOADER TEMPLATE ========== */';
const C_BEGIN = '/* ========== BEGIN SECTION C: MANAGED CONFIG BLOCK ========== */';
const C_END = '/* ========== END SECTION C: MANAGED CONFIG BLOCK ========== */';

/**
 * Build CG-managed block (CONFIG-ONLY)
 *
 * Generates the managed config block (C) with:
 * - window.CG_MANAGED.release (channel, version, source)
 * - window.CG_MANAGED.config (configuration overrides from UI)
 *
 * @param {Object} options - Configuration options
 * @param {string} options.accountId - Account ID
 * @param {boolean} options.enableDashboard - Enable admin dashboard module
 * @param {string} options.dashboardLabel - Button label for admin dashboard
 * @param {string} [options.channel='prod'] - Release channel (prod/dev)
 * @param {string} [options.version='v1.0.2'] - Release version
 * @param {string} [options.source='github_release'] - Release source (github_release/pages)
 * @returns {string} CG-managed block content
 */
export function buildCGManagedBlock({
    accountId,
    enableDashboard,
    dashboardLabel,
    channel = 'prod',
    version = 'v1.0.2',
    source = 'github_release'
}) {
    logger.debug('[LoaderGenerator] Building CG-managed block', {
        accountId,
        enableDashboard,
        dashboardLabel,
        channel,
        version,
        source
    });

    const lines = [
        C_BEGIN,
        `/* Generated: ${new Date().toISOString()} */`,
        `/* Account: ${accountId ?? 'unknown'} */`,
        '/* Purpose: Version and configuration management for CG loader */',
        '',
        'window.CG_MANAGED = window.CG_MANAGED || {};',
        '',
        '// Release configuration',
        'window.CG_MANAGED.release = {',
        `    channel: ${JSON.stringify(channel)},`,
        `    version: ${JSON.stringify(version)},`,
        `    source: ${JSON.stringify(source)}`,
        '};',
        '',
        '// Configuration overrides',
        'window.CG_MANAGED.config = {',
        `    adminDashboard: ${enableDashboard ? 'true' : 'false'},`,
        `    adminDashboardLabel: ${JSON.stringify(dashboardLabel || 'Open CG Admin Dashboard')}`,
        '};',
        '',
        C_END
    ];

    return lines.join('\n');
}

/**
 * Assemble A+B+C loader output
 *
 * Implements deterministic A+B+C assembly:
 * - A = External loader (district's Theme JS) - copied verbatim
 * - B = CG_LOADER_TEMPLATE (stable CG loader) - inserted verbatim from codebase
 * - C = Managed config block - generated fresh from UI state
 *
 * Output format: A.trimEnd() + "\n\n" + B.trim() + "\n\n" + C.trimEnd() + "\n"
 *
 * @param {Object} options - Options
 * @param {string} options.baseLoaderText - Base loader text (A - external/district loader)
 * @param {string} options.cgBlock - CG-managed block (C - generated config)
 * @returns {string} Combined loader text (A+B+C)
 */
export function upsertCGBlockIntoLoader({ baseLoaderText, cgBlock }) {
    logger.debug('[LoaderGenerator] Assembling A+B+C loader output');

    // Extract A using the extractSections function
    const { A: extractedA } = extractSections(baseLoaderText);

    // Use extracted A if available, otherwise use the entire base text
    const A = extractedA || baseLoaderText.trimEnd();

    // B = CG loader template (from codebase)
    const B = CG_LOADER_TEMPLATE.trim();

    // C = Managed config block (generated fresh, already has markers)
    const C = cgBlock.trimEnd();

    // Assemble with section markers: A + B + C
    const output = `${A_BEGIN}\n${A}\n${A_END}\n\n${B_BEGIN}\n${B}\n${B_END}\n\n${C}\n`;

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
 * - B = CG loader template
 * - C = Managed config block
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
        B = combinedLoader.slice(bStart + B_BEGIN.length, bEnd).trim();
        logger.debug('[LoaderGenerator] Extracted Section B');
    }

    // Extract Section C
    const cStart = combinedLoader.indexOf(C_BEGIN);
    const cEnd = combinedLoader.indexOf(C_END);
    if (cStart !== -1 && cEnd !== -1 && cEnd > cStart) {
        C = combinedLoader.slice(cStart, cEnd + C_END.length).trim();
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
 * - Markers must be in correct order
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
        errors.push('Section C appears before Section B');
    }

    const valid = errors.length === 0;

    if (!valid) {
        logger.warn('[LoaderGenerator] Validation failed', { errors });
    }

    return { valid, errors };
}