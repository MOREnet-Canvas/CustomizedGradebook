// tests/outcomesCacheFileTest.student.js
/**
 * STUDENT PERMISSION TEST - Console Script
 * 
 * This test verifies that students CANNOT access the outcomes cache files/folders.
 * Run this as a STUDENT (not teacher) to verify security is working.
 * 
 * Prerequisites:
 *   - Navigate to any page in the Canvas course as a STUDENT
 *   - Be logged in as a student (or use Student View)
 *   - Paste this entire script into browser console
 *   - Press Enter
 * 
 * Expected Results:
 *   - All access attempts should FAIL with 401/403 errors
 *   - Students should NOT be able to read cache files
 *   - Students should NOT be able to list folder contents
 */

(async function testStudentPermissions() {
    'use strict';
    
    const PARENT_FOLDER_NAME = 'MOREnet_CustomizedGradebook';
    const CACHE_FOLDER_NAME = 'outcomes_cache';
    const FILE_NAME = 'outcomes_cache.json';
    
    // Auto-detect course ID
    const courseId = (function getCourseId() {
        const match = window.location.pathname.match(/\/courses\/(\d+)/);
        if (!match) {
            console.error('%c❌ Not on a course page', 'color: red; font-weight: bold;');
            return null;
        }
        return match[1];
    })();
    
    if (!courseId) {
        console.error('%c⚠️ Test aborted - no course ID found in URL', 'color: red; font-weight: bold;');
        return;
    }
    
    // Get CSRF token
    const csrfCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('_csrf_token='));
    
    if (!csrfCookie) {
        console.error('%c❌ CSRF token not found - are you logged in?', 'color: red; font-weight: bold;');
        return;
    }
    
    const csrfToken = decodeURIComponent(csrfCookie.split('=')[1]);
    
    // Helper functions
    function pass(msg) {
        console.log(`%c✓ ${msg}`, 'color: green; font-weight: bold;');
    }
    
    function fail(msg) {
        console.log(`%c✗ ${msg}`, 'color: red; font-weight: bold;');
    }
    
    function info(msg) {
        console.log(`%c  ${msg}`, 'color: #888;');
    }
    
    function section(msg) {
        console.log(`%c${msg}`, 'color: #0066cc; font-weight: bold; font-size: 12px;');
    }
    
    console.group('%c🔒 Student Permission Test', 'font-size: 14px; font-weight: bold; color: #0066cc;');
    console.log('%cCourse ID:', 'font-weight: bold;', courseId);
    console.log('%cTesting as:', 'font-weight: bold;', ENV?.current_user?.name || 'Unknown User');
    console.log('%cUser roles:', 'font-weight: bold;', ENV?.current_user_roles?.join(', ') || 'Unknown');
    console.log('─'.repeat(60));
    console.log('');
    
    let allTestsPassed = true;
    
    // Test 1: Try to list all folders
    section('Test 1: Attempting to list course folders...');
    try {
        const response = await fetch(`/api/v1/courses/${courseId}/folders`, {
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const folders = await response.json();
            const parentFolder = folders.find(f => f.name === PARENT_FOLDER_NAME);
            const cacheFolder = folders.find(f => f.name === CACHE_FOLDER_NAME);
            
            if (parentFolder) {
                fail(`SECURITY ISSUE: Student can see parent folder "${PARENT_FOLDER_NAME}"`);
                info(`Folder ID: ${parentFolder.id}, Locked: ${parentFolder.locked}`);
                allTestsPassed = false;
            } else {
                pass(`Parent folder "${PARENT_FOLDER_NAME}" not visible to student (good)`);
            }
            
            if (cacheFolder) {
                fail(`SECURITY ISSUE: Student can see cache folder "${CACHE_FOLDER_NAME}"`);
                info(`Folder ID: ${cacheFolder.id}, Locked: ${cacheFolder.locked}`);
                allTestsPassed = false;
            } else {
                pass(`Cache folder "${CACHE_FOLDER_NAME}" not visible to student (good)`);
            }
        } else {
            info(`Cannot list folders (status: ${response.status}) - this is expected for students`);
        }
    } catch (e) {
        info('Error listing folders (expected for students): ' + e.message);
    }
    console.log('');
    
    // Test 2: Try to access parent folder directly (if we know the ID from teacher test)
    section('Test 2: Attempting direct folder access...');
    info('Note: Need folder ID from teacher test to attempt direct access');
    info('If you have the folder ID, test with: /api/v1/folders/{folderId}');
    console.log('');
    
    // Test 3: Try to search for cache file
    section('Test 3: Attempting to search for cache file...');
    let foundFileId = null;
    try {
        const response = await fetch(`/api/v1/courses/${courseId}/files?search_term=${FILE_NAME}`, {
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin'
        });

        if (response.ok) {
            const files = await response.json();
            const cacheFile = files.find(f => f.display_name === FILE_NAME);

            if (cacheFile) {
                fail(`SECURITY ISSUE: Student can find cache file "${FILE_NAME}"`);
                info(`File ID: ${cacheFile.id}, Locked: ${cacheFile.locked}`);
                foundFileId = cacheFile.id;
                allTestsPassed = false;

                // Test 3b: Try to download the file
                section('Test 3b: Attempting to download found file...');
                try {
                    const fileResponse = await fetch(cacheFile.url);
                    if (fileResponse.ok) {
                        fail('CRITICAL SECURITY ISSUE: Student can download cache file!');
                        const content = await fileResponse.text();
                        info(`File size: ${content.length} bytes`);
                        allTestsPassed = false;
                    } else {
                        pass(`File download blocked (status: ${fileResponse.status})`);
                    }
                } catch (downloadErr) {
                    pass('File download blocked: ' + downloadErr.message);
                }
            } else {
                pass(`Cache file "${FILE_NAME}" not visible in search (good)`);
            }
        } else if (response.status === 401 || response.status === 403) {
            pass(`File search blocked (status: ${response.status}) - access denied`);
        } else {
            info(`File search returned status: ${response.status}`);
        }
    } catch (e) {
        pass('File search blocked: ' + e.message);
    }
    console.log('');
    
    // Test 4: Try to access with direct file ID
    section('Test 4: Direct file access test');

    // If we found a file in Test 3, test direct access automatically
    if (foundFileId) {
        info(`Testing direct access to file ID: ${foundFileId}`);
        try {
            const response = await fetch(`/api/v1/files/${foundFileId}`, {
                headers: { 'X-CSRF-Token': csrfToken },
                credentials: 'same-origin'
            });

            if (response.ok) {
                const file = await response.json();

                // Check if file is actually locked for the student
                if (file.locked_for_user === true || !file.url || file.url === '') {
                    pass('File is locked for students - metadata accessible but cannot download');
                    info(`File: ${file.display_name}, locked_for_user: ${file.locked_for_user}, url: ${file.url ? 'present' : 'empty'}`);
                    if (file.lock_explanation) {
                        info(`Lock reason: ${file.lock_explanation}`);
                    }
                } else {
                    fail('CRITICAL SECURITY ISSUE: Student can access file by direct ID!');
                    info(`File name: ${file.display_name}, Locked: ${file.locked}, locked_for_user: ${file.locked_for_user}`);
                    info(`Download URL is accessible: ${file.url}`);
                    allTestsPassed = false;
                }
            } else if (response.status === 401 || response.status === 403) {
                pass(`Direct file access blocked (status: ${response.status})`);
            } else {
                info(`Unexpected status: ${response.status}`);
            }
        } catch (e) {
            pass('Direct file access blocked: ' + e.message);
        }
    } else {
        info('No file found to test - if you have file ID from teacher test:');
        info('Run: window.testDirectFileAccess(fileId)');
    }
    console.log('');
    
    window.testDirectFileAccess = async (fileId) => {
        console.log('');
        section(`Testing direct access to file ID: ${fileId}`);
        try {
            const response = await fetch(`/api/v1/files/${fileId}`, {
                headers: { 'X-CSRF-Token': csrfToken },
                credentials: 'same-origin'
            });

            if (response.ok) {
                const file = await response.json();

                // Check if file is actually locked for the student
                if (file.locked_for_user === true || !file.url || file.url === '') {
                    pass('File is locked for students - metadata accessible but cannot download');
                    info(`File: ${file.display_name}, locked_for_user: ${file.locked_for_user}, url: ${file.url ? 'present' : 'empty'}`);
                    if (file.lock_explanation) {
                        info(`Lock reason: ${file.lock_explanation}`);
                    }
                    return true;
                } else {
                    fail('CRITICAL SECURITY ISSUE: Student can access file by direct ID!');
                    info(`File name: ${file.display_name}, Locked: ${file.locked}, locked_for_user: ${file.locked_for_user}`);
                    info(`Download URL is accessible: ${file.url}`);
                    return false;
                }
            } else if (response.status === 401 || response.status === 403) {
                pass(`Direct file access blocked (status: ${response.status})`);
                return true;
            } else {
                info(`Unexpected status: ${response.status}`);
                return true;
            }
        } catch (e) {
            pass('Direct file access blocked: ' + e.message);
            return true;
        }
    };
    
    console.log('');
    console.log('─'.repeat(60));
    
    if (allTestsPassed) {
        console.log('%c✅ All security tests PASSED!', 'color: green; font-weight: bold; font-size: 14px;');
        console.log('');
        console.log('%cStudents CANNOT:', 'font-weight: bold;');
        console.log('  ✓ See cache folders in Files browser');
        console.log('  ✓ Find cache files via search');
        console.log('  ✓ Download cache files');
        console.log('');
        console.log('%c🔒 Security is properly configured!', 'color: green; font-weight: bold;');
    } else {
        console.log('%c❌ SECURITY ISSUES DETECTED!', 'color: red; font-weight: bold; font-size: 14px;');
        console.log('');
        console.log('%c⚠️ Students CAN access cache files - review folder/file permissions!', 'color: red; font-weight: bold;');
        console.log('');
        console.log('Check that folders and files have:');
        console.log('  • locked: true');
        console.log('  • hidden: false');
        console.log('  • visibility_level: "inherit"');
    }
    
    console.groupEnd();
    
})().catch(err => {
    console.error('%c❌ Unexpected error in test script:', 'color: red; font-weight: bold;', err);
});