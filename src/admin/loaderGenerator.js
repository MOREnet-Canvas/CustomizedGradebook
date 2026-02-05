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

// Sentinel markers for CG-managed block
const CG_BEGIN = '/* BEGIN CG MANAGED CODE */';
const CG_END = '/* END CG MANAGED CODE */';

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
        CG_BEGIN,
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
        CG_END
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

    // Extract A: Remove any existing CG loader (B) and managed block (C) from base text
    let externalLoader = baseLoaderText;

    // Remove existing CG-managed block (C) if present
    const beginIdx = externalLoader.indexOf(CG_BEGIN);
    const endIdx = externalLoader.indexOf(CG_END);

    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
        logger.debug('[LoaderGenerator] Removing existing CG-managed block from external loader');
        const before = externalLoader.slice(0, beginIdx);
        const after = externalLoader.slice(endIdx + CG_END.length);
        externalLoader = (before + after).trim();
    }

    // Remove existing CG loader template (B) if present
    // Look for the CG loader IIFE pattern
    const cgLoaderPattern = /\(function\s*\(\)\s*\{[\s\S]*?\/\/\s*={5,}\s*CG LOADER[\s\S]*?\}\)\(\);?/;
    if (cgLoaderPattern.test(externalLoader)) {
        logger.debug('[LoaderGenerator] Removing existing CG loader template from external loader');
        externalLoader = externalLoader.replace(cgLoaderPattern, '').trim();
    }

    // A = External loader (district code only)
    const A = externalLoader.trimEnd();

    // B = CG loader template (from codebase)
    const B = CG_LOADER_TEMPLATE.trim();

    // C = Managed config block (generated fresh)
    const C = cgBlock.trimEnd();

    // Assemble: A + B + C
    const output = `${A}\n\n${B}\n\n${C}\n`;

    logger.debug('[LoaderGenerator] A+B+C assembly complete', {
        aLength: A.length,
        bLength: B.length,
        cLength: C.length,
        totalLength: output.length
    });

    return output;
}

/**
 * Validate assembled loader output
 *
 * Performs safety checks:
 * - Output must contain exactly one BEGIN and one END sentinel
 * - BEGIN must occur after A and B sections (in the C section)
 *
 * @param {string} output - Assembled loader output
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateLoaderOutput(output) {
    const errors = [];

    // Count sentinels
    const beginCount = (output.match(/\/\* BEGIN CG MANAGED CODE \*\//g) || []).length;
    const endCount = (output.match(/\/\* END CG MANAGED CODE \*\//g) || []).length;

    if (beginCount === 0) {
        errors.push('Missing BEGIN CG MANAGED CODE sentinel');
    } else if (beginCount > 1) {
        errors.push(`Found ${beginCount} BEGIN sentinels (expected exactly 1)`);
    }

    if (endCount === 0) {
        errors.push('Missing END CG MANAGED CODE sentinel');
    } else if (endCount > 1) {
        errors.push(`Found ${endCount} END sentinels (expected exactly 1)`);
    }

    // Check sentinel order
    const beginIdx = output.indexOf(CG_BEGIN);
    const endIdx = output.indexOf(CG_END);

    if (beginIdx !== -1 && endIdx !== -1 && endIdx <= beginIdx) {
        errors.push('END sentinel appears before BEGIN sentinel');
    }

    // Check that sentinels are in the final section (after CG loader template)
    const cgLoaderIdx = output.indexOf('// CG LOADER - CONFIGURATION MERGE');
    if (cgLoaderIdx !== -1 && beginIdx !== -1 && beginIdx < cgLoaderIdx) {
        errors.push('BEGIN sentinel appears before CG loader template (should be after)');
    }

    const valid = errors.length === 0;

    if (!valid) {
        logger.warn('[LoaderGenerator] Validation failed', { errors });
    }

    return { valid, errors };
}