#!/usr/bin/env node
// scripts/canvas-test/verifyVisibility.js
/**
 * Read-only verification: confirms Canvas's visibility_level/locked file
 * interaction against the fixtures created by setupTestFixtures.js, as a
 * non-enrolled student, via as_user_id masquerade.
 *
 * Safe to run any time — this script only issues GET requests. It does not
 * create, modify, lock, unlock, or delete anything.
 *
 * Usage:
 *   node scripts/canvas-test/verifyVisibility.js
 *
 * Required env vars: CANVAS_TEST_TOKEN, CANVAS_TEST_COURSE_ID, CANVAS_TEST_STUDENT_ID
 * Optional: CANVAS_TEST_HOST (defaults to morenetlab.instructure.com)
 */

import { canvasGet } from './canvasClient.js';

const COURSE_ID = process.env.CANVAS_TEST_COURSE_ID;
const STUDENT_ID = process.env.CANVAS_TEST_STUDENT_ID;

if (!COURSE_ID || !STUDENT_ID) {
    console.error('[CanvasTest] CANVAS_TEST_COURSE_ID and CANVAS_TEST_STUDENT_ID environment variables are required.');
    process.exit(1);
}

async function findFixtureFile(displayName) {
    const res = await canvasGet(`/api/v1/courses/${COURSE_ID}/files`, {
        query: { search_term: displayName, per_page: 10 }
    });
    if (!res.ok) {
        throw new Error(`Failed to search for ${displayName}: ${res.status} ${res.statusText}`);
    }
    const results = await res.json();
    return results.find(f => f.display_name === displayName) || null;
}

async function checkAsStudent(fileId, label) {
    // Metadata check, masquerading as the student.
    const metaRes = await canvasGet(`/api/v1/files/${fileId}`, { asUserId: STUDENT_ID });
    const metaStatus = metaRes.status;

    let downloadStatus = 'skipped (metadata blocked)';
    if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta.url) {
            const downloadRes = await fetch(meta.url);
            downloadStatus = downloadRes.status;
        }
    }

    console.log(`  ${label}: metadata as_user_id=${STUDENT_ID} -> ${metaStatus}; download -> ${downloadStatus}`);
    return { metaStatus, downloadStatus };
}

async function main() {
    console.log(`[CanvasTest] Verifying file visibility behavior in course ${COURSE_ID}, masquerading as student ${STUDENT_ID}\n`);

    const fixtures = [
        { name: 'fixture_unlocked_institution.json', expect: 'student should be able to read this (200/200)' },
        { name: 'fixture_locked_institution.json', expect: 'student should be BLOCKED regardless of visibility_level (401/403)' },
        { name: 'fixture_unlocked_institution_in_locked_folder.json', expect: 'UNKNOWN until now — tests folder-lock cascade' }
    ];

    for (const fixture of fixtures) {
        const file = await findFixtureFile(fixture.name);
        if (!file) {
            console.log(`[CanvasTest] ${fixture.name}: NOT FOUND — run setupTestFixtures.js --confirm first`);
            continue;
        }
        console.log(`[CanvasTest] ${fixture.name} (expect: ${fixture.expect})`);
        await checkAsStudent(file.id, fixture.name);
        console.log('');
    }
}

main().catch(err => {
    console.error('[CanvasTest] Failed:', err.message);
    process.exit(1);
});
