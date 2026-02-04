// src/admin/loaderGenerator.js
/**
 * Loader Generator Module
 *
 * Generates CONFIG-ONLY CG-managed blocks and combines them with district loaders.
 *
 * The CG-managed block:
 * - Is delimited by exact sentinels (BEGIN/END CG MANAGED CODE)
 * - Contains ONLY configuration flags (no script injection)
 * - Is appended at the end of the file (or replaces existing block)
 * - Sets window.CG_CONFIG.features.adminDashboard and related flags
 */

import { logger } from '../utils/logger.js';

// Sentinel markers for CG-managed block
const CG_BEGIN = '/* BEGIN CG MANAGED CODE */';
const CG_END = '/* END CG MANAGED CODE */';

/**
 * Build CG-managed block (CONFIG-ONLY)
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.accountId - Account ID
 * @param {boolean} options.enableDashboard - Enable admin dashboard module
 * @param {string} options.dashboardLabel - Button label for admin dashboard
 * @returns {string} CG-managed block content
 */
export function buildCGManagedBlock({ accountId, enableDashboard, dashboardLabel }) {
    logger.debug('[LoaderGenerator] Building CG-managed block', {
        accountId,
        enableDashboard,
        dashboardLabel
    });

    const lines = [
        CG_BEGIN,
        `/* Generated: ${new Date().toISOString()} */`,
        `/* Account: ${accountId ?? 'unknown'} */`,
        '/* Purpose: Configure CG features without altering district loader behavior */',
        '',
        'window.CG_CONFIG = window.CG_CONFIG || {};',
        'window.CG_CONFIG.features = window.CG_CONFIG.features || {};',
        `window.CG_CONFIG.features.adminDashboard = ${enableDashboard ? 'true' : 'false'};`,
        `window.CG_CONFIG.features.adminDashboardLabel = ${JSON.stringify(dashboardLabel || 'Open CG Admin Dashboard')};`,
        '',
        'window.__CG_ADMIN_DASHBOARD_ENABLED__ = ' + (enableDashboard ? 'true' : 'false') + ';',
        '',
        CG_END
    ];

    return lines.join('\n');
}

/**
 * Insert or replace CG-managed block in loader
 * 
 * If a CG-managed block already exists (both sentinels found), replace it.
 * Otherwise, append the block at the end of the file.
 * 
 * @param {Object} options - Options
 * @param {string} options.baseLoaderText - Base loader text (district loader)
 * @param {string} options.cgBlock - CG-managed block to insert
 * @returns {string} Combined loader text
 */
export function upsertCGBlockIntoLoader({ baseLoaderText, cgBlock }) {
    logger.debug('[LoaderGenerator] Upserting CG block into loader');

    const beginIdx = baseLoaderText.indexOf(CG_BEGIN);
    const endIdx = baseLoaderText.indexOf(CG_END);

    // Replace existing CG block
    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
        logger.debug('[LoaderGenerator] Replacing existing CG block');

        const before = baseLoaderText.slice(0, beginIdx).trimEnd();
        const after = baseLoaderText.slice(endIdx + CG_END.length).trimStart();

        return `${before}\n\n${cgBlock}\n\n${after}\n`;
    }

    // Append at end
    logger.debug('[LoaderGenerator] Appending CG block at end');

    const trimmed = baseLoaderText.trimEnd();
    return `${trimmed}\n\n${cgBlock}\n`;
}