// tests/outcomesCacheFileTest.js
/**
 * Standalone test for Canvas course file save/read operations.
 * Run this in the browser console on a Canvas beta course page,
 * or inject it via your existing script loader.
 *
 * Prerequisites:
 *   - You are logged in as a teacher or admin
 *   - The course ID below matches a course in your beta environment
 *   - Your apiClient instance is available (adjust import as needed)
 *
 * Tests:
 *   1. Create _mastery_cache folder (hidden from students)
 *   2. Write a small JSON file to that folder
 *   3. Read the file back and verify contents match
 *   4. Overwrite the file and verify new contents
 *   5. Report results clearly
 */

import { CanvasApiClient } from '../src/services/canvasApiClient.js'; // adjust path

const TEST_COURSE_ID = 'YOUR_BETA_COURSE_ID'; // replace before running
const FOLDER_NAME    = '_mastery_cache';
const FILE_NAME      = 'outcomes_cache.json';

const testPayload = {
    meta: {
        courseId:            TEST_COURSE_ID,
        courseName:          'Test Course',
        computedAt:          new Date().toISOString(),
        computedBy:          'test_script',
        studentCount:        0,
        outcomeCount:        0,
        canvasScoringMethod: 'decaying_average',
        schemaVersion:       '1.0'
    },
    outcomes: []
};

const testPayloadV2 = {
    ...testPayload,
    meta: {
        ...testPayload.meta,
        computedAt: new Date().toISOString(),
        computedBy: 'test_script_overwrite'
    }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`%c✓ ${msg}`, 'color: green; font-weight: bold;'); }
function fail(msg, err) { console.error(`%c✗ ${msg}`, 'color: red; font-weight: bold;', err); }
function info(msg) { console.log(`%c  ${msg}`, 'color: #888;'); }

// ─── Step 1: Ensure folder exists ───────────────────────────────────────────

async function ensureFolder(apiClient) {
    info('Step 1: Creating/verifying _mastery_cache folder...');
    try {
        // Check if folder already exists
        const existing = await apiClient.get(
            `/api/v1/courses/${TEST_COURSE_ID}/folders/by_path/${FOLDER_NAME}`
        );
        pass(`Folder already exists (id: ${existing.id})`);
        return existing.id;
    } catch (e) {
        if (e.status !== 404) { fail('Unexpected error checking folder', e); throw e; }
    }

    // Folder doesn't exist — create it
    try {
        const folder = await apiClient.post(
            `/api/v1/courses/${TEST_COURSE_ID}/folders`,
            {
                name:   FOLDER_NAME,
                hidden: true  // not visible to students in Files UI
            }
        );
        pass(`Folder created (id: ${folder.id})`);
        return folder.id;
    } catch (e) {
        fail('Could not create folder', e);
        throw e;
    }
}

// ─── Step 2: Upload file (Canvas 3-step process) ─────────────────────────────

async function uploadFile(apiClient, folderId, payload, label = 'write') {
    info(`Step 2 (${label}): Uploading ${FILE_NAME}...`);

    const blob    = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: 'application/json' }
    );
    const size = blob.size;

    // 2a. Notify Canvas — get pre-signed upload URL
    let uploadInstructions;
    try {
        uploadInstructions = await apiClient.post(
            `/api/v1/courses/${TEST_COURSE_ID}/files`,
            {
                name:                FILE_NAME,
                size,
                content_type:        'application/json',
                parent_folder_id:    folderId,
                on_duplicate:        'overwrite'
            }
        );
        info(`Upload URL received from Canvas`);
    } catch (e) {
        fail(`Could not get upload URL (${label})`, e);
        throw e;
    }

    // 2b. POST directly to S3 (no auth header — Canvas handles it)
    const formData = new FormData();
    Object.entries(uploadInstructions.upload_params).forEach(([k, v]) => {
        formData.append(k, v);
    });
    formData.append('file', blob, FILE_NAME);

    let s3Response;
    try {
        s3Response = await fetch(uploadInstructions.upload_url, {
            method: 'POST',
            body:   formData
        });
        info(`S3 upload status: ${s3Response.status}`);
    } catch (e) {
        fail(`S3 upload failed (${label})`, e);
        throw e;
    }

    // 2c. Confirm with Canvas — follow redirect location
    // Canvas returns 3xx — get the confirmation URL from Location header
    const confirmUrl = s3Response.headers.get('Location') || s3Response.url;
    try {
        const confirmed = await apiClient.post(confirmUrl, {});
        pass(`File uploaded and confirmed (${label}) — file id: ${confirmed.id}`);
        return confirmed.id;
    } catch (e) {
        fail(`File confirmation failed (${label})`, e);
        throw e;
    }
}

// ─── Step 3: Read file back ──────────────────────────────────────────────────

async function readFile(apiClient) {
    info('Step 3: Reading file back from Canvas...');
    try {
        // Find the file in the folder
        const files = await apiClient.get(
            `/api/v1/courses/${TEST_COURSE_ID}/files`,
            { search_term: FILE_NAME, per_page: 5 }
        );

        const file = files.find(f => f.display_name === FILE_NAME);
        if (!file) {
            fail('File not found after upload');
            return null;
        }

        info(`File found (id: ${file.id}) — fetching contents...`);

        // Fetch the actual file contents from the download URL
        const response = await fetch(file.url);
        if (!response.ok) {
            fail(`Could not fetch file contents — status: ${response.status}`);
            return null;
        }

        const parsed = await response.json();
        pass('File read back successfully');
        return parsed;
    } catch (e) {
        fail('Error reading file', e);
        return null;
    }
}

// ─── Run all tests ───────────────────────────────────────────────────────────

export async function runFileSaveTest(apiClient) {
    console.group('%cCanvas File Save/Read Test', 'font-size:14px; font-weight:bold;');
    console.log('Course ID:', TEST_COURSE_ID);
    console.log('Target file:', `${FOLDER_NAME}/${FILE_NAME}`);
    console.log('─'.repeat(40));

    try {
        // 1. Folder
        const folderId = await ensureFolder(apiClient);

        // 2. Initial write
        await uploadFile(apiClient, folderId, testPayload, 'initial write');

        // 3. Read back and verify
        const readBack = await readFile(apiClient);
        if (readBack) {
            const match = readBack.meta.computedBy === testPayload.meta.computedBy;
            match
                ? pass('Contents verified — computedBy matches')
                : fail('Contents mismatch — computedBy does not match', readBack);
        }

        // 4. Overwrite
        await uploadFile(apiClient, folderId, testPayloadV2, 'overwrite');

        // 5. Read back and verify overwrite
        const readBack2 = await readFile(apiClient);
        if (readBack2) {
            const match = readBack2.meta.computedBy === testPayloadV2.meta.computedBy;
            match
                ? pass('Overwrite verified — computedBy reflects new value')
                : fail('Overwrite mismatch — still showing old value', readBack2);
        }

        console.log('─'.repeat(40));
        pass('All file tests complete');

    } catch (e) {
        console.log('─'.repeat(40));
        fail('Test suite aborted due to error above', e);
    }

    console.groupEnd();
}