// tests/outcomesCacheFileTest.js
/**
 * ES Module Canvas Files API Test
 *
 * This is the ES module version for integration testing and module-based workflows.
 * For quick console testing, use outcomesCacheFileTest.console.js instead.
 *
 * Prerequisites:
 *   - Loaded as part of the bundled application
 *   - Run on a Canvas course page
 *   - User is logged in as teacher or admin
 *
 * Usage:
 *   import { runFileSaveTest } from './tests/outcomesCacheFileTest.js';
 *   const apiClient = new CanvasApiClient();
 *   await runFileSaveTest(apiClient);
 *
 * Or attach to window for console access:
 *   window.CG_testOutcomesCacheFiles = () => runFileSaveTest(new CanvasApiClient());
 *
 * Tests:
 *   1. Auto-detect course ID from URL (or use provided override)
 *   2. Create _mastery_cache folder (hidden from students)
 *   3. Write a small JSON file to that folder
 *   4. Read the file back and verify contents match
 *   5. Overwrite the file and verify new contents
 *   6. Report results with color-coded console output
 */

import { CanvasApiClient } from '../src/utils/canvasApiClient.js';
import { getCourseId } from '../src/utils/canvas.js';

const FOLDER_NAME = '_mastery_cache';
const FILE_NAME = 'outcomes_cache.json';

// Test payloads - courseId will be injected at runtime
function createTestPayload(courseId) {
    return {
        meta: {
            courseId: courseId,
            courseName: 'Test Course',
            computedAt: new Date().toISOString(),
            computedBy: 'module_test_v1',
            studentCount: 0,
            outcomeCount: 0,
            canvasScoringMethod: 'decaying_average',
            schemaVersion: '1.0'
        },
        outcomes: []
    };
}

function createTestPayloadV2(courseId) {
    const base = createTestPayload(courseId);
    return {
        ...base,
        meta: {
            ...base.meta,
            computedAt: new Date().toISOString(),
            computedBy: 'module_test_v2_overwrite'
        }
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`%c✓ ${msg}`, 'color: green; font-weight: bold;'); }
function fail(msg, err) { console.error(`%c✗ ${msg}`, 'color: red; font-weight: bold;', err); }
function info(msg) { console.log(`%c  ${msg}`, 'color: #888;'); }

// ─── Step 1: Ensure folder exists ───────────────────────────────────────────

async function ensureFolder(apiClient, courseId) {
    info('Step 1: Creating/verifying _mastery_cache folder...');

    // First, try to find folder by listing all course folders
    try {
        const allFolders = await apiClient.get(
            `/api/v1/courses/${courseId}/folders`,
            {},
            'listCourseFolders'
        );
        const existing = allFolders.find(f => f.name === FOLDER_NAME && !f.deleted);
        if (existing) {
            pass(`Folder already exists (id: ${existing.id})`);
            // Ensure it's locked
            await lockFolder(apiClient, existing.id);
            return existing.id;
        }
    } catch (e) {
        info('Could not list folders, will try to create...');
    }

    // Folder doesn't exist — create it
    try {
        const folder = await apiClient.post(
            `/api/v1/courses/${courseId}/folders`,
            {
                name: FOLDER_NAME,
                hidden: false,  // Visible to teachers
                locked: true    // UNPUBLISHED - prevents student access
            },
            {},
            'createCacheFolder'
        );
        pass(`Folder created (id: ${folder.id})`);
        return folder.id;
    } catch (e) {
        // If name conflict, try to find the existing folder by name
        if (e.message && (e.message.includes('already exists') || e.message.includes('taken'))) {
            info('Folder name exists (possibly deleted), searching...');
            try {
                const allFolders = await apiClient.get(
                    `/api/v1/courses/${courseId}/folders`,
                    {},
                    'searchExistingFolder'
                );
                const existing = allFolders.find(f => f.name === FOLDER_NAME);
                if (existing) {
                    pass(`Found existing folder (id: ${existing.id})`);
                    await lockFolder(apiClient, existing.id);
                    return existing.id;
                }
            } catch (searchError) {
                fail('Could not find existing folder', searchError);
            }
        }
        fail('Could not create folder', e);
        throw e;
    }
}

async function lockFolder(apiClient, folderId) {
    try {
        await apiClient.put(
            `/api/v1/folders/${folderId}`,
            {
                hidden: false,           // Teachers can see it
                locked: true,            // UNPUBLISHED - students blocked
                unlock_at: '',
                lock_at: '',
                visibility_level: 'inherit'
            },
            {},
            'lockCacheFolder'
        );
        info('Folder set to UNPUBLISHED (students cannot access)');
    } catch (e) {
        info('Could not update folder permissions (may not affect functionality)');
    }
}

// ─── Step 2: Upload file (Canvas 3-step process) ─────────────────────────────

async function uploadFile(apiClient, courseId, folderId, payload, label = 'write') {
    info(`Step 2 (${label}): Uploading ${FILE_NAME}...`);

    const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: 'application/json' }
    );
    const size = blob.size;

    // 2a. Notify Canvas — get pre-signed upload URL
    let uploadInstructions;
    try {
        uploadInstructions = await apiClient.post(
            `/api/v1/courses/${courseId}/files`,
            {
                name: FILE_NAME,
                size,
                content_type: 'application/json',
                parent_folder_id: folderId,
                on_duplicate: 'overwrite'
            },
            {},
            'filesApiStep1'
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
            body: formData,
            credentials: 'omit'  // No Canvas cookies for S3
        });
        info(`S3 upload status: ${s3Response.status}`);
    } catch (e) {
        fail(`S3 upload failed (${label})`, e);
        throw e;
    }

    // 2c. Confirm with Canvas (or wait for file to be available)
    let fileId = null;

    // Canvas auto-confirms on 201, but file may not be immediately available
    // Wait a moment for Canvas to process the upload
    if (s3Response.status === 201) {
        info('Upload successful, waiting for Canvas to process...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // File should now be available - search for it
        try {
            const files = await apiClient.get(
                `/api/v1/courses/${courseId}/files?search_term=${FILE_NAME}`,
                {},
                'searchUploadedFile'
            );
            const file = files.find(f => f.display_name === FILE_NAME);
            if (file) {
                pass(`File uploaded successfully (${label}) — file id: ${file.id}`);
                fileId = file.id;
            }
        } catch (searchErr) {
            info('Could not search for file, trying confirmation URL...');
        }
    }

    // Try explicit confirmation via Location header if file not found yet
    if (!fileId) {
        const confirmUrl = s3Response.headers.get('Location') || uploadInstructions.location;

        if (!confirmUrl) {
            fail('No confirmation URL and could not find file', { uploadInstructions, s3Response });
            throw new Error('Upload confirmation failed - file may not be available');
        }

        try {
            const confirmed = await apiClient.post(
                confirmUrl,
                {},
                {},
                'filesApiStep3'
            );
            pass(`File uploaded and confirmed (${label}) — file id: ${confirmed.id}`);
            fileId = confirmed.id;
        } catch (e) {
            fail(`File confirmation failed (${label})`, e);
            throw e;
        }
    }

    // 2d. Lock the file (UNPUBLISH it)
    info('2d. Setting file to UNPUBLISHED...');
    try {
        await apiClient.put(
            `/api/v1/files/${fileId}`,
            {
                locked: true,            // UNPUBLISHED - students blocked
                hidden: false,           // Teachers can see it
                unlock_at: '',
                lock_at: '',
                visibility_level: 'inherit'
            },
            {},
            'lockUploadedFile'
        );
        pass(`File set to UNPUBLISHED (students cannot access)`);
    } catch (lockErr) {
        fail(`Could not lock file (${label})`, lockErr);
    }

    return fileId;
}

// ─── Step 3: Read file back ──────────────────────────────────────────────────

async function readFile(apiClient, courseId) {
    info('Step 3: Reading file back from Canvas...');
    try {
        // Find the file in the folder
        const files = await apiClient.get(
            `/api/v1/courses/${courseId}/files?search_term=${FILE_NAME}&per_page=5`,
            {},
            'searchCacheFile'
        );

        const file = files.find(f => f.display_name === FILE_NAME);
        if (!file) {
            fail('File not found after upload');
            return null;
        }

        info(`File found (id: ${file.id}) — fetching contents...`);

        // Fetch the actual file contents from the download URL
        // Add cache-busting query parameter to prevent browser cache
        const fileUrl = file.url + (file.url.includes('?') ? '&' : '?') + '_=' + Date.now();
        const response = await fetch(fileUrl);
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

/**
 * Run Canvas Files API test suite
 * @param {CanvasApiClient} apiClient - Initialized Canvas API client
 * @param {string} courseIdOverride - Optional course ID override (auto-detects from URL if not provided)
 */
export async function runFileSaveTest(apiClient, courseIdOverride = null) {
    // Auto-detect course ID from URL if not provided
    const courseId = courseIdOverride || getCourseId();

    if (!courseId) {
        console.error('%c❌ Cannot run test - no course ID found', 'color: red; font-weight: bold;');
        console.log('%cEither navigate to a course page or provide courseId parameter', 'color: #888;');
        return;
    }

    console.group('%cCanvas File Save/Read Test (ES Module)', 'font-size:14px; font-weight:bold; color: #0066cc;');
    console.log('Course ID:', courseId);
    console.log('Target file:', `${FOLDER_NAME}/${FILE_NAME}`);
    console.log('─'.repeat(60));

    try {
        // Create test payloads with actual course ID
        const testPayload = createTestPayload(courseId);
        const testPayloadV2 = createTestPayloadV2(courseId);

        // 1. Folder
        const folderId = await ensureFolder(apiClient, courseId);

        // 2. Initial write
        await uploadFile(apiClient, courseId, folderId, testPayload, 'initial write');

        // 3. Read back and verify
        const readBack = await readFile(apiClient, courseId);
        if (readBack) {
            const match = readBack.meta.computedBy === testPayload.meta.computedBy;
            match
                ? pass('Contents verified — computedBy matches (module_test_v1)')
                : fail('Contents mismatch — computedBy does not match', {
                    expected: testPayload.meta.computedBy,
                    actual: readBack.meta.computedBy
                });
        }

        // 4. Overwrite
        await uploadFile(apiClient, courseId, folderId, testPayloadV2, 'overwrite');

        // 5. Read back and verify overwrite
        const readBack2 = await readFile(apiClient, courseId);
        if (readBack2) {
            const match = readBack2.meta.computedBy === testPayloadV2.meta.computedBy;
            match
                ? pass('Overwrite verified — computedBy reflects new value (module_test_v2_overwrite)')
                : fail('Overwrite mismatch — still showing old value', {
                    expected: testPayloadV2.meta.computedBy,
                    actual: readBack2.meta.computedBy
                });
        }

        console.log('─'.repeat(60));
        pass('All file tests complete');
        console.log('');
        console.log('%cVerify in Canvas Files:', 'font-weight: bold;');
        console.log(`  Folder: ${FOLDER_NAME} (hidden from students)`);
        console.log(`  File: ${FILE_NAME}`);

    } catch (e) {
        console.log('─'.repeat(60));
        fail('Test suite aborted due to error above', e);
    }

    console.groupEnd();
}

// Attach to window for easy console access
// Usage: window.CG_testOutcomesCacheFiles()
if (typeof window !== 'undefined') {
    window.CG_testOutcomesCacheFiles = async (courseIdOverride = null) => {
        const apiClient = new CanvasApiClient();
        await runFileSaveTest(apiClient, courseIdOverride);
    };
}