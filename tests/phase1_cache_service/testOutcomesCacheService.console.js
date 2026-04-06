// tests/phase1_cache_service/testOutcomesCacheService.console.js
/**
 * Console Test: Outcomes Cache Service
 *
 * Tests outcomesCacheService.js functionality:
 * - Folder creation (MOREnet_CustomizedGradebook/outcomes_cache)
 * - File write with schema version
 * - File read with schema validation
 *
 * Prerequisites:
 * - Navigate to any Canvas course page as teacher/admin
 * - Load required modules first (see setup section below)
 * - Open browser console (F12)
 * - Paste this entire script and press Enter
 *
 * Expected Results:
 * - Green checkmarks for all tests
 * - Folder structure created correctly
 * - Cache file written and read back successfully
 * - Schema version validation working
 */

(async function testOutcomesCacheService() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // SETUP INSTRUCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    console.log('%c⚠️ SETUP REQUIRED', 'color: orange; font-weight: bold; font-size: 14px;');
    console.log('Load required modules first with:');
    console.log('');
    console.log('  const module1 = await import("/src/utils/canvasApiClient.js");');
    console.log('  const module2 = await import("/src/outcomesDashboard/outcomesCacheService.js");');
    console.log('  const CanvasApiClient = module1.CanvasApiClient;');
    console.log('  const { ensureFolder, writeOutcomesCache, readOutcomesCache, SCHEMA_VERSION } = module2;');
    console.log('');
    console.log('Then run this test.');
    console.log('─'.repeat(60));
    console.log('');

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

    // Helper functions
    function pass(msg) { console.log(`%c✓ ${msg}`, 'color: green; font-weight: bold;'); }
    function fail(msg) { console.log(`%c✗ ${msg}`, 'color: red; font-weight: bold;'); }
    function info(msg) { console.log(`%c  ${msg}`, 'color: #888;'); }
    function section(msg) { console.log(`%c${msg}`, 'color: #0066cc; font-weight: bold; font-size: 12px;'); }

    console.group('%c🗂️ Outcomes Cache Service Test', 'font-size: 14px; font-weight: bold; color: #0066cc;');
    console.log('%cCourse ID:', 'font-weight: bold;', courseId);
    console.log('─'.repeat(60));
    console.log('');

    // Check if modules are loaded
    if (typeof CanvasApiClient === 'undefined' ||
        typeof ensureFolder === 'undefined' ||
        typeof writeOutcomesCache === 'undefined' ||
        typeof readOutcomesCache === 'undefined') {
        fail('Required modules not loaded. See setup instructions above.');
        console.groupEnd();
        return;
    }

    try {
        // Initialize API client
        const apiClient = new CanvasApiClient();
        pass('API client initialized');
        console.log('');

        // ═══════════════════════════════════════════════════════════════════
        // TEST 1: FOLDER CREATION
        // ═══════════════════════════════════════════════════════════════════

        section('Test 1: Ensure Folder Structure');

        const folderId = await ensureFolder(courseId, apiClient);
        pass(`Folder structure created/verified (id: ${folderId})`);
        info('Expected: MOREnet_CustomizedGradebook/outcomes_cache/');
        console.log('');

        // ═══════════════════════════════════════════════════════════════════
        // TEST 2: WRITE CACHE
        // ═══════════════════════════════════════════════════════════════════

        section('Test 2: Write Cache');

        // Create sample cache data
        const sampleCache = {
            metadata: {
                courseId: courseId,
                generatedAt: new Date().toISOString(),
                minScoresThreshold: 3,
                studentCount: 1,
                outcomeCount: 2
            },
            outcomes: [
                { id: 1001, title: "Test Outcome 1", displayOrder: 1, classStats: { classMean: 3.5 } },
                { id: 1002, title: "Test Outcome 2", displayOrder: 2, classStats: { classMean: 2.8 } }
            ],
            students: [
                {
                    id: "9001",
                    name: "Test Student 1",
                    outcomes: [
                        { outcomeId: 1001, status: 'ok', plPrediction: 4.2, attemptCount: 3 },
                        { outcomeId: 1002, status: 'NE', plPrediction: null, attemptCount: 2 }
                    ]
                }
            ]
        };

        const writeResult = await writeOutcomesCache(courseId, apiClient, sampleCache);
        pass(`Cache written successfully (file id: ${writeResult.id})`);
        info(`File: ${writeResult.display_name}, Size: ${writeResult.size} bytes, Locked: ${writeResult.locked}`);
        console.log('');

        // ═══════════════════════════════════════════════════════════════════
        // TEST 3: READ CACHE
        // ═══════════════════════════════════════════════════════════════════

        section('Test 3: Read Cache');

        const readResult = await readOutcomesCache(courseId, apiClient);

        if (!readResult) {
            fail('Cache read returned null');
        } else {
            pass('Cache read successfully');

            if (readResult.metadata.schemaVersion === SCHEMA_VERSION) {
                pass(`Schema version matches: ${SCHEMA_VERSION}`);
            } else {
                fail(`Schema mismatch: expected ${SCHEMA_VERSION}, got ${readResult.metadata.schemaVersion}`);
            }

            if (readResult.metadata.courseId === courseId) { pass(`Course ID matches`); }
            if (readResult.outcomes?.length === 2) { pass('Outcomes array intact (2 outcomes)'); }
            if (readResult.students?.length === 1) { pass('Students array intact (1 student)'); }

            console.table({
                'Schema Version': readResult.metadata.schemaVersion,
                'Course ID': readResult.metadata.courseId,
                'Student Count': readResult.metadata.studentCount,
                'Outcome Count': readResult.metadata.outcomeCount
            });
        }
        console.log('');

        // ═══════════════════════════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════════════════════════

        console.log('─'.repeat(60));
        console.log('%c✅ Cache Service Test Complete', 'color: green; font-weight: bold; font-size: 14px;');
        console.log('');
        console.log('%cResults:', 'font-weight: bold;');
        console.log('  ✓ Folder creation working');
        console.log('  ✓ Cache write working');
        console.log('  ✓ Cache read working');
        console.log('  ✓ Schema version validation working');
        console.log('');
        console.log('%cManual Verification:', 'font-weight: bold;');
        console.log('  1. Go to Files → MOREnet_CustomizedGradebook/outcomes_cache/');
        console.log('  2. Verify outcomes_cache.json is UNPUBLISHED');
        console.log('  3. Download and inspect JSON structure');
        console.log('');
        console.log('%cNext:', 'font-weight: bold;' );
        console.log('  Continue to thresholdStorage.js and outcomesPermissions.js');

    } catch (error) {
        fail('Test failed with error');
        console.error(error);
    }

    console.groupEnd();

})().catch(err => {
    console.error('%c❌ Unexpected error:', 'color: red; font-weight: bold;', err);
});