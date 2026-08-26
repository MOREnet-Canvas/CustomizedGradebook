#!/usr/bin/env node
// scripts/canvas-test/setupTestFixtures.js
/**
 * Creates the folder/file fixtures needed to independently verify Canvas's
 * file visibility_level / locked interaction on morenetlab, including the
 * previously-untested folder-lock cascade case.
 *
 * Fixtures created under a course's Files, in a top-level "CG_Test_Fixtures" folder:
 *   unlocked_folder/  (locked: false)
 *     fixture_unlocked_institution.json           - locked:false, visibility_level:institution
 *     fixture_locked_institution.json              - locked:true,  visibility_level:institution
 *   locked_folder/    (locked: true)
 *     fixture_unlocked_institution_in_locked_folder.json - locked:false, visibility_level:institution
 *
 * SAFETY: this script only performs write operations. It defaults to a DRY
 * RUN — it prints every request it would make (method, path, body) without
 * executing any of them. Pass --confirm to actually run the writes, and only
 * after showing the exact calls to the project owner first (per project policy).
 *
 * Usage:
 *   node scripts/canvas-test/setupTestFixtures.js                # dry run (default)
 *   node scripts/canvas-test/setupTestFixtures.js --confirm       # actually create fixtures
 *
 * Required env vars: CANVAS_TEST_TOKEN, CANVAS_TEST_COURSE_ID
 * Optional: CANVAS_TEST_HOST (defaults to morenetlab.instructure.com)
 */

import { canvasGet, canvasPost, canvasPut } from './canvasClient.js';

const CONFIRM = process.argv.includes('--confirm');
const COURSE_ID = process.env.CANVAS_TEST_COURSE_ID;

if (!COURSE_ID) {
    console.error('[CanvasTest] CANVAS_TEST_COURSE_ID environment variable is required.');
    process.exit(1);
}

function logPlannedCall(description, method, path, body) {
    console.log(`\n[CanvasTest] ${CONFIRM ? 'EXECUTING' : 'DRY RUN (would execute)'}: ${description}`);
    console.log(`  ${method} ${path}`);
    if (body) { console.log(`  body: ${JSON.stringify(body)}`); }
}

async function ensureFolder(name, parentFolderId, { locked }) {
    logPlannedCall(
        `find-or-create folder "${name}" (locked: ${locked})`,
        'POST',
        `/api/v1/courses/${COURSE_ID}/folders`,
        { name, parent_folder_id: parentFolderId, hidden: false, locked }
    );
    if (!CONFIRM) { return `DRY_RUN_FOLDER_ID_${name}`; }

    const existingRes = await canvasGet(`/api/v1/courses/${COURSE_ID}/folders?per_page=100`);
    const existing = (await existingRes.json()).find(f => f.name === name && f.parent_folder_id === parentFolderId && !f.deleted);
    if (existing) {
        console.log(`  -> already exists (id: ${existing.id})`);
        return existing.id;
    }

    const res = await canvasPost(`/api/v1/courses/${COURSE_ID}/folders`, {
        body: { name, parent_folder_id: parentFolderId, hidden: false, locked }
    });
    const folder = await res.json();
    console.log(`  -> created (id: ${folder.id})`);
    return folder.id;
}

async function uploadJsonFixture(filename, folderId, { locked, visibilityLevel }) {
    const content = JSON.stringify({ fixture: filename, createdAt: new Date().toISOString() });

    logPlannedCall(
        `upload "${filename}" then set locked:${locked}, visibility_level:${visibilityLevel}`,
        'POST',
        `/api/v1/courses/${COURSE_ID}/files`,
        { name: filename, size: content.length, content_type: 'application/json', parent_folder_id: folderId, on_duplicate: 'overwrite' }
    );
    if (!CONFIRM) { return; }

    const uploadInstructionsRes = await canvasPost(`/api/v1/courses/${COURSE_ID}/files`, {
        body: { name: filename, size: content.length, content_type: 'application/json', parent_folder_id: folderId, on_duplicate: 'overwrite' }
    });
    const uploadInstructions = await uploadInstructionsRes.json();

    const formData = new FormData();
    Object.entries(uploadInstructions.upload_params).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', new Blob([content], { type: 'application/json' }), filename);

    const uploadRes = await fetch(uploadInstructions.upload_url, { method: 'POST', body: formData });
    if (!uploadRes.ok) {
        throw new Error(`Upload failed for ${filename}: ${uploadRes.status} ${uploadRes.statusText}`);
    }
    const uploaded = await uploadRes.json();

    console.log(`  -> uploaded (file id: ${uploaded.id}), setting locked:${locked}, visibility_level:${visibilityLevel}`);
    await canvasPut(`/api/v1/files/${uploaded.id}`, {
        body: { locked, hidden: false, visibility_level: visibilityLevel }
    });
    console.log(`  -> done`);
}

async function main() {
    console.log(`[CanvasTest] ${CONFIRM ? 'LIVE RUN' : 'DRY RUN'} — creating fixtures in course ${COURSE_ID}`);
    if (!CONFIRM) {
        console.log('[CanvasTest] No requests will actually be made. Re-run with --confirm to execute after reviewing the calls above.\n');
    }

    const rootRes = CONFIRM ? await canvasGet(`/api/v1/courses/${COURSE_ID}/folders/root`) : null;
    const rootFolderId = CONFIRM ? (await rootRes.json()).id : 'DRY_RUN_ROOT_ID';

    const topFolderId = await ensureFolder('CG_Test_Fixtures', rootFolderId, { locked: false });
    const unlockedFolderId = await ensureFolder('unlocked_folder', topFolderId, { locked: false });
    const lockedFolderId = await ensureFolder('locked_folder', topFolderId, { locked: true });

    await uploadJsonFixture('fixture_unlocked_institution.json', unlockedFolderId, { locked: false, visibilityLevel: 'institution' });
    await uploadJsonFixture('fixture_locked_institution.json', unlockedFolderId, { locked: true, visibilityLevel: 'institution' });
    await uploadJsonFixture('fixture_unlocked_institution_in_locked_folder.json', lockedFolderId, { locked: false, visibilityLevel: 'institution' });

    console.log(`\n[CanvasTest] ${CONFIRM ? 'Fixtures created.' : 'Dry run complete — nothing was created.'}`);
}

main().catch(err => {
    console.error('[CanvasTest] Failed:', err.message);
    process.exit(1);
});
