#!/usr/bin/env node
// buildScripts/update-mobile-version-manifest.js
/**
 * Update Mobile Version Manifest for Auto-Patch Loader
 *
 * This script:
 * 1. Fetches all git tags matching mobile-v*.*.* pattern
 * 2. Groups versions by major.minor
 * 3. Finds the latest patch for each minor version
 * 4. Generates mobile-versions.json manifest
 * 5. Writes to root directory for GitHub Pages deployment
 *
 * Triggered by:
 * - GitHub Actions on mobile release.published
 * - Manual execution: node buildScripts/update-mobile-version-manifest.js
 */

import fs from 'fs';
import { execSync } from 'child_process';

console.log('[CG Mobile] Starting version manifest update...');

// Fetch all mobile release tags from git
let tags;
try {
    tags = execSync('git tag --list "mobile-v*" --sort=-version:refname', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);
    console.log(`[CG Mobile] Found ${tags.length} mobile version tags`);
} catch (error) {
    console.error('[CG Mobile] Failed to fetch git tags:', error.message);
    process.exit(1);
}

// Parse semantic versions (mobile-v1.0.0 format)
const versions = tags.map(tag => {
    const match = tag.match(/^mobile-v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        console.warn(`[CG Mobile] Skipping non-semver tag: ${tag}`);
        return null;
    }
    return {
        tag,
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10)
    };
}).filter(Boolean);

console.log(`[CG Mobile] Parsed ${versions.length} semantic version tags`);

if (versions.length === 0) {
    console.error('[CG Mobile] No valid semantic version tags found');
    process.exit(1);
}

// Group by major.minor and find latest patch for each
const byMinor = {};
versions.forEach(v => {
    const key = `mobile-v${v.major}.${v.minor}`;
    if (!byMinor[key] || v.patch > byMinor[key].patch) {
        byMinor[key] = v;
    }
});

console.log('[CG Mobile] Latest patches by minor version:');
Object.entries(byMinor).forEach(([key, version]) => {
    console.log(`  ${key}-latest → ${version.tag}`);
});

// Build manifest
const manifest = {};

// Add minor version tracks (e.g., "mobile-v1.0-latest": "mobile-v1.0.5")
for (const [key, version] of Object.entries(byMinor)) {
    manifest[`${key}-latest`] = version.tag;
}

// Sort all versions (newest first)
const allVersions = versions.sort((a, b) => {
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    return b.patch - a.patch;
});

// Add special aliases
manifest.latest = allVersions[0]?.tag || 'mobile-v1.0.0';
manifest.stable = allVersions[0]?.tag || 'mobile-v1.0.0';

// Add metadata
manifest._generated = new Date().toISOString();
manifest._totalVersions = versions.length;

console.log('\n[CG Mobile] Generated manifest:');
console.log(JSON.stringify(manifest, null, 2));

// Write to file
const outputPath = 'mobile-versions.json';
try {
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\n[CG Mobile] ✓ Written to ${outputPath}`);
} catch (error) {
    console.error(`[CG Mobile] Failed to write ${outputPath}:`, error.message);
    process.exit(1);
}

console.log('[CG Mobile] Version manifest update complete');

