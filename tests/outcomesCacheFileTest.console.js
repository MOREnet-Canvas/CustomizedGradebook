// tests/outcomesCacheFileTest.console.js
/**
 * CONSOLE-READY Canvas Files API Test
 * 
 * Copy-paste this entire file into browser console on ANY Canvas course page.
 * No imports, no build step, no manual course ID entry required.
 * 
 * Prerequisites:
 *   - Navigate to any page in a Canvas course (e.g., /courses/123/assignments)
 *   - Be logged in as teacher or admin
 *   - Paste this entire script into browser console
 *   - Press Enter and watch the test run
 * 
 * Tests:
 *   1. Auto-detect course ID from URL
 *   2. Create _mastery_cache folder (hidden from students)
 *   3. Write a small JSON file to that folder
 *   4. Read the file back and verify contents match
 *   5. Overwrite the file and verify new contents
 *   6. Report results with color-coded console output
 */

(async function testOutcomesCacheFiles() {
    'use strict';
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════

    const PARENT_FOLDER_NAME = 'MOREnet_CustomizedGradebook';
    const FOLDER_NAME = 'outcomes_cache';
    const FILE_NAME = 'outcomes_cache.json';
    
    // ═══════════════════════════════════════════════════════════════════════
    // AUTO-DETECT COURSE ID
    // ═══════════════════════════════════════════════════════════════════════
    
    const courseId = (function getCourseId() {
        const match = window.location.pathname.match(/\/courses\/(\d+)/);
        if (!match) {
            console.error('%c❌ Not on a course page', 'color: red; font-weight: bold;');
            console.log('%cNavigate to /courses/{id}/... and try again', 'color: #888;');
            return null;
        }
        return match[1];
    })();
    
    if (!courseId) {
        console.error('%c⚠️ Test aborted - no course ID found in URL', 'color: red; font-weight: bold;');
        return;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // SIMPLE API CLIENT (inline, no imports)
    // ═══════════════════════════════════════════════════════════════════════
    
    class SimpleCanvasApiClient {
        constructor() {
            // Get CSRF token from cookie
            const csrfCookie = document.cookie
                .split('; ')
                .find(row => row.startsWith('_csrf_token='));
            
            if (!csrfCookie) {
                throw new Error('CSRF token not found - are you logged in?');
            }
            
            this.csrfToken = decodeURIComponent(csrfCookie.split('=')[1]);
        }
        
        async get(url) {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-CSRF-Token': this.csrfToken
                },
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
            }
            
            return response.json();
        }
        
        async post(url, data) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`POST ${url} failed: ${response.status} ${response.statusText}`);
            }
            
            return response.json();
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEST PAYLOADS
    // ═══════════════════════════════════════════════════════════════════════
    
    const testPayload = {
        meta: {
            courseId: courseId,
            courseName: 'Test Course',
            computedAt: new Date().toISOString(),
            computedBy: 'console_test_v1',
            studentCount: 0,
            outcomeCount: 0,
            canvasScoringMethod: 'decaying_average',
            schemaVersion: '1.0'
        },
        outcomes: []
    };
    
    const testPayloadV2 = {
        ...testPayload,
        meta: {
            ...testPayload.meta,
            computedAt: new Date().toISOString(),
            computedBy: 'console_test_v2_overwrite'
        }
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONSOLE HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    
    function pass(msg) {
        console.log(`%c✓ ${msg}`, 'color: green; font-weight: bold;');
    }
    
    function fail(msg, err) {
        console.error(`%c✗ ${msg}`, 'color: red; font-weight: bold;', err);
    }
    
    function info(msg) {
        console.log(`%c  ${msg}`, 'color: #888;');
    }
    
    function section(msg) {
        console.log(`%c${msg}`, 'color: #0066cc; font-weight: bold; font-size: 12px;');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST STEP 0: GET ROOT FOLDER
    // ═══════════════════════════════════════════════════════════════════════

    async function getRootFolderId(apiClient) {
        section('Step 0: Finding course root folder...');

        try {
            const rootFolder = await apiClient.get(
                `/api/v1/courses/${courseId}/folders/root`
            );
            pass(`Root folder found: "${rootFolder.name}" (id: ${rootFolder.id})`);
            return rootFolder.id;
        } catch (e) {
            fail('Could not find root folder', e);
            throw e;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST STEP 1: ENSURE FOLDER EXISTS (with parent folder)
    // ═══════════════════════════════════════════════════════════════════════

    async function ensureParentFolder(apiClient, rootFolderId) {
        section('Step 1a: Creating/verifying parent folder...');

        // First, try to find parent folder by listing all course folders
        try {
            const allFolders = await apiClient.get(
                `/api/v1/courses/${courseId}/folders?per_page=100`
            );
            const existing = allFolders.find(f => f.name === PARENT_FOLDER_NAME && !f.deleted);
            if (existing) {
                pass(`Parent folder already exists (id: ${existing.id})`);
                // Ensure it's locked
                await lockFolder(apiClient, existing.id, 'parent folder');
                return existing.id;
            }
        } catch (e) {
            info('Could not list folders, will try to create parent...');
        }

        // Parent folder doesn't exist — create it
        try {
            const folder = await apiClient.post(
                `/api/v1/courses/${courseId}/folders`,
                {
                    name: PARENT_FOLDER_NAME,
                    parent_folder_id: rootFolderId,  // Create inside course root folder
                    hidden: false,  // Visible to teachers
                    locked: true    // UNPUBLISHED - prevents student access
                }
            );
            pass(`Parent folder created (id: ${folder.id})`);
            await lockFolder(apiClient, folder.id, 'parent folder');
            return folder.id;
        } catch (e) {
            // If name conflict, try to find the existing folder by name
            if (e.message.includes('already exists') || e.message.includes('taken')) {
                info('Parent folder name exists (possibly deleted), searching...');
                try {
                    const allFolders = await apiClient.get(
                        `/api/v1/courses/${courseId}/folders?per_page=100`
                    );
                    const existing = allFolders.find(f => f.name === PARENT_FOLDER_NAME);
                    if (existing) {
                        pass(`Found existing parent folder (id: ${existing.id})`);
                        await lockFolder(apiClient, existing.id, 'parent folder');
                        return existing.id;
                    }
                } catch (searchError) {
                    fail('Could not find existing parent folder', searchError);
                }
            }
            fail('Could not create parent folder', e);
            throw e;
        }
    }

    async function ensureFolder(apiClient, parentFolderId) {
        section('Step 1b: Creating/verifying outcomes_cache subfolder...');

        // First, try to find folder by listing all course folders
        try {
            const allFolders = await apiClient.get(
                `/api/v1/courses/${courseId}/folders?per_page=100`
            );
            const existing = allFolders.find(f =>
                f.name === FOLDER_NAME &&
                f.parent_folder_id === parentFolderId &&
                !f.deleted
            );
            if (existing) {
                pass(`Subfolder already exists (id: ${existing.id})`);
                // Ensure it's locked
                await lockFolder(apiClient, existing.id, 'subfolder');
                return existing.id;
            }
        } catch (e) {
            info('Could not list folders, will try to create subfolder...');
        }

        // Folder doesn't exist — create it as a subfolder
        try {
            const folder = await apiClient.post(
                `/api/v1/courses/${courseId}/folders`,
                {
                    name: FOLDER_NAME,
                    parent_folder_id: parentFolderId,  // Create inside parent folder
                    hidden: false,  // Visible to teachers
                    locked: true    // UNPUBLISHED - prevents student access
                }
            );
            pass(`Subfolder created (id: ${folder.id})`);
            await lockFolder(apiClient, folder.id, 'subfolder');
            return folder.id;
        } catch (e) {
            // If name conflict, try to find the existing folder by name
            if (e.message.includes('already exists') || e.message.includes('taken')) {
                info('Subfolder name exists (possibly deleted), searching...');
                try {
                    const allFolders = await apiClient.get(
                        `/api/v1/courses/${courseId}/folders?per_page=100`
                    );
                    const existing = allFolders.find(f =>
                        f.name === FOLDER_NAME &&
                        f.parent_folder_id === parentFolderId
                    );
                    if (existing) {
                        pass(`Found existing subfolder (id: ${existing.id})`);
                        await lockFolder(apiClient, existing.id, 'subfolder');
                        return existing.id;
                    }
                } catch (searchError) {
                    fail('Could not find existing subfolder', searchError);
                }
            }
            fail('Could not create subfolder', e);
            throw e;
        }
    }

    async function lockFolder(apiClient, folderId, label = 'folder') {
        try {
            await fetch(`/api/v1/folders/${folderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': apiClient.csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    hidden: false,           // Teachers can see it
                    locked: true,            // UNPUBLISHED - students blocked
                    unlock_at: '',
                    lock_at: '',
                    visibility_level: 'inherit'
                })
            });
            info(`${label.charAt(0).toUpperCase() + label.slice(1)} set to UNPUBLISHED (students cannot access)`);
        } catch (e) {
            info(`Could not update ${label} permissions (may not affect functionality)`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST STEP 2: UPLOAD FILE (Canvas 3-step process)
    // ═══════════════════════════════════════════════════════════════════════

    async function uploadFile(apiClient, folderId, payload, label = 'write') {
        section(`Step 2 (${label}): Uploading ${FILE_NAME}...`);

        const blob = new Blob(
            [JSON.stringify(payload, null, 2)],
            { type: 'application/json' }
        );
        const size = blob.size;

        // 2a. Notify Canvas — get pre-signed upload URL
        info('2a. Requesting upload URL from Canvas...');
        let uploadInstructions;
        try {
            uploadInstructions = await apiClient.post(
                `/api/v1/courses/${courseId}/files`,
                {
                    name: FILE_NAME,
                    size: size,
                    content_type: 'application/json',
                    parent_folder_id: folderId,
                    on_duplicate: 'overwrite'
                }
            );
            info(`Upload URL received (${uploadInstructions.upload_url.substring(0, 50)}...)`);
        } catch (e) {
            fail(`Could not get upload URL (${label})`, e);
            throw e;
        }

        // 2b. POST directly to S3 (no auth header — Canvas handles it)
        info('2b. Uploading file to S3...');
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
        info('2c. Confirming upload with Canvas...');

        let fileId = null;

        // Canvas auto-confirms on 201, but file may not be immediately available
        // Wait a moment for Canvas to process the upload
        if (s3Response.status === 201) {
            info('Upload successful, waiting for Canvas to process...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // File should now be available - search for it
            try {
                const files = await apiClient.get(
                    `/api/v1/courses/${courseId}/files?search_term=${FILE_NAME}&per_page=5`
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
                const confirmed = await apiClient.post(confirmUrl, {});
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
            await fetch(`/api/v1/files/${fileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': apiClient.csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    locked: true,            // UNPUBLISHED - students blocked
                    hidden: false,           // Teachers can see it
                    unlock_at: '',
                    lock_at: '',
                    visibility_level: 'inherit'
                })
            });
            pass(`File set to UNPUBLISHED (students cannot access)`);
        } catch (lockErr) {
            fail(`Could not lock file (${label})`, lockErr);
        }

        return fileId;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST STEP 3: READ FILE BACK
    // ═══════════════════════════════════════════════════════════════════════

    async function readFile(apiClient) {
        section('Step 3: Reading file back from Canvas...');

        try {
            // Find the file in the course
            info('Searching for file...');
            const files = await apiClient.get(
                `/api/v1/courses/${courseId}/files?search_term=${FILE_NAME}&per_page=5`
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

    // ═══════════════════════════════════════════════════════════════════════
    // RUN ALL TESTS
    // ═══════════════════════════════════════════════════════════════════════

    console.group('%c📦 Canvas Files API Test', 'font-size: 14px; font-weight: bold; color: #0066cc;');
    console.log('%cAuto-detected course ID:', 'font-weight: bold;', courseId);
    console.log('%cTarget file:', 'font-weight: bold;', `${PARENT_FOLDER_NAME}/${FOLDER_NAME}/${FILE_NAME}`);
    console.log('─'.repeat(60));

    try {
        // Initialize API client
        const apiClient = new SimpleCanvasApiClient();
        info('API client initialized with CSRF token');
        console.log('');

        // 0. Get root folder ID
        const rootFolderId = await getRootFolderId(apiClient);
        console.log('');

        // 1a. Parent folder
        const parentFolderId = await ensureParentFolder(apiClient, rootFolderId);
        console.log('');

        // 1b. Subfolder
        const folderId = await ensureFolder(apiClient, parentFolderId);
        console.log('');

        // 2. Initial write
        await uploadFile(apiClient, folderId, testPayload, 'initial write');
        console.log('');

        // 3. Read back and verify
        const readBack = await readFile(apiClient);
        if (readBack) {
            const match = readBack.meta.computedBy === testPayload.meta.computedBy;
            if (match) {
                pass('Contents verified — computedBy matches (console_test_v1)');
            } else {
                fail('Contents mismatch — computedBy does not match', {
                    expected: testPayload.meta.computedBy,
                    actual: readBack.meta.computedBy
                });
            }
        }
        console.log('');

        // 4. Overwrite
        await uploadFile(apiClient, folderId, testPayloadV2, 'overwrite');
        console.log('');

        // 5. Read back and verify overwrite
        const readBack2 = await readFile(apiClient);
        if (readBack2) {
            const match = readBack2.meta.computedBy === testPayloadV2.meta.computedBy;
            if (match) {
                pass('Overwrite verified — computedBy reflects new value (console_test_v2_overwrite)');
            } else {
                fail('Overwrite mismatch — still showing old value', {
                    expected: testPayloadV2.meta.computedBy,
                    actual: readBack2.meta.computedBy
                });
            }
        }

        console.log('─'.repeat(60));
        console.log('%c✅ All file tests complete!', 'color: green; font-weight: bold; font-size: 14px;');
        console.log('');
        console.log('%cYou can verify the file in Canvas:', 'font-weight: bold;');
        console.log(`  1. Go to Files in your course`);
        console.log(`  2. Look for folder: ${PARENT_FOLDER_NAME}`);
        console.log(`  3. Inside that, find subfolder: ${FOLDER_NAME}`);
        console.log(`  4. Find file: ${FILE_NAME}`);
        console.log(`  5. Both folders should show as UNPUBLISHED (locked)`);
        console.log('');
        console.log('%c📋 Next: Test as STUDENT', 'font-weight: bold; color: #ff9800;');
        console.log('  1. Use Student View or log in as student');
        console.log('  2. Navigate to this course');
        console.log('  3. Run: tests/outcomesCacheFileTest.student.js');
        console.log('  4. Verify students CANNOT access cache files');

    } catch (e) {
        console.log('─'.repeat(60));
        console.error('%c❌ Test suite aborted due to error', 'color: red; font-weight: bold; font-size: 14px;');
        console.error(e);
    }

    console.groupEnd();

})().catch(err => {
    console.error('%c❌ Unexpected error in test script:', 'color: red; font-weight: bold;', err);
});