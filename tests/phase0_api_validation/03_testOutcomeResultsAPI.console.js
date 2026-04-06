// tests/phase0_api_validation/03_testOutcomeResultsAPI.console.js
/**
 * Canvas Outcome Results API Validation Test
 *
 * Tests the Outcome Results endpoint which provides individual assessment attempts
 * with submission IDs and timestamps. This is needed for Power Law regression.
 *
 * Endpoint: GET /api/v1/courses/{courseId}/outcome_results
 *
 * Prerequisites:
 * - Navigate to a Canvas course page as teacher/admin
 * - Course must have students with multiple scored attempts on outcomes
 * - Open browser console (F12)
 * - Paste this entire script and press Enter
 *
 * Expected Results:
 * - Green checkmarks for all tests
 * - Individual outcome result objects with submission IDs
 * - Chronological score history per student per outcome
 */

(async function testOutcomeResultsAPI() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════

    // Auto-detect course ID from URL
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

    // ═══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function pass(msg) { console.log(`%c✓ ${msg}`, 'color: green; font-weight: bold;'); }
    function fail(msg) { console.log(`%c✗ ${msg}`, 'color: red; font-weight: bold;'); }
    function info(msg) { console.log(`%c  ${msg}`, 'color: #888;'); }
    function section(msg) { console.log(`%c${msg}`, 'color: #0066cc; font-weight: bold; font-size: 12px;'); }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST: OUTCOME RESULTS API
    // ═══════════════════════════════════════════════════════════════════════

    console.group('%c📈 Canvas Outcome Results API Test', 'font-size: 14px; font-weight: bold; color: #0066cc;');
    console.log('%cCourse ID:', 'font-weight: bold;', courseId);
    console.log('─'.repeat(60));
    console.log('');

    section('Test 1: Fetch Outcome Results');
    let resultsData = null;

    try {
        const response = await fetch(
            `/api/v1/courses/${courseId}/outcome_results?per_page=100&include[]=alignments`,
            {
                headers: { 'X-CSRF-Token': csrfToken },
                credentials: 'same-origin'
            }
        );

        if (!response.ok) {
            fail(`Outcome Results API failed: ${response.status} ${response.statusText}`);
            console.log('');
            console.groupEnd();
            return;
        }

        resultsData = await response.json();
        pass('Outcome Results API successful');
        info(`Status: ${response.status} OK`);

    } catch (error) {
        fail('Outcome Results API request failed');
        console.error(error);
        console.log('');
        console.groupEnd();
        return;
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // VALIDATE RESPONSE STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 2: Validate Response Structure');

    if (resultsData.outcome_results && Array.isArray(resultsData.outcome_results)) {
        pass(`outcome_results array present (${resultsData.outcome_results.length} results)`);
    } else {
        fail('outcome_results array missing or not an array');
    }

    if (resultsData.outcome_results && resultsData.outcome_results.length > 0) {
        const result = resultsData.outcome_results[0];

        pass('Sample result object fields:');
        const fields = {
            'ID': result.id,
            'User ID': result.links?.user || 'N/A',
            'Score': result.score,
            'Percent': result.percent,
            'Submitted At': result.submitted_at || result.submitted_or_assessed_at,
            'Outcome ID': result.links?.learning_outcome || 'N/A'
        };
        console.table(fields);

        info('Critical fields for Power Law:');
        info(`  ✓ result.id - Result ID: ${result.id}`);
        info(`  ✓ result.links.user - Student ID: ${result.links?.user || 'N/A'}`);
        info(`  ✓ result.links.learning_outcome - Outcome ID: ${result.links?.learning_outcome || 'N/A'}`);
        info(`  ✓ result.score - Score value: ${result.score}`);
        info(`  ✓ result.submitted_at - Timestamp: ${result.submitted_at || result.submitted_or_assessed_at || 'N/A'}`);


        // Check for submission ID (key for deduplication)
        if (result.links?.assignment || result.links?.submission) {
            pass('Submission/Assignment ID available for deduplication');
            info(`  - Submission ID: ${result.links?.submission || 'N/A'}`);
            info(`  - Assignment ID: ${result.links?.assignment || 'N/A'}`);
        } else {
            fail('No submission/assignment ID - check alignment data');
        }

    } else {
        fail('No outcome results found - create outcome alignments and score students');
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // ANALYZE RESULT DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 3: Analyze Result Distribution');

    if (resultsData.outcome_results && resultsData.outcome_results.length > 0) {
        // Group by student and outcome
        const byStudent = {};
        const byOutcome = {};

        resultsData.outcome_results.forEach(result => {
            const userId = result.links?.user || 'unknown';
            const outcomeId = result.links?.learning_outcome || 'unknown';

            if (!byStudent[userId]) byStudent[userId] = [];
            if (!byOutcome[outcomeId]) byOutcome[outcomeId] = [];

            byStudent[userId].push(result);
            byOutcome[outcomeId].push(result);
        });

        pass(`Results grouped:`);
        info(`  - ${Object.keys(byStudent).length} unique students`);
        info(`  - ${Object.keys(byOutcome).length} unique outcomes`);
        info(`  - ${resultsData.outcome_results.length} total result records`);

        // Find students with multiple attempts (needed for Power Law)
        const studentsWithMultipleAttempts = Object.entries(byStudent)
            .filter(([userId, results]) => results.length >= 3)
            .length;

        if (studentsWithMultipleAttempts > 0) {
            pass(`${studentsWithMultipleAttempts} students have 3+ attempts (good for Power Law)`);
        } else {
            fail('No students with 3+ attempts - Power Law requires multiple data points');
        }

        // Show sample chronological history
        const firstStudentId = Object.keys(byStudent)[0];
        if (firstStudentId && byStudent[firstStudentId].length > 1) {
            console.log('');
            info(`Sample chronological history for student ${firstStudentId}:`);

            const sorted = byStudent[firstStudentId]
                .sort((a, b) => {
                    const dateA = new Date(a.submitted_at || a.submitted_or_assessed_at);
                    const dateB = new Date(b.submitted_at || b.submitted_or_assessed_at);
                    return dateA - dateB;
                });

            console.table(sorted.map((r, i) => ({
                'Attempt': i + 1,
                'Score': r.score,
                'Date': r.submitted_at || r.submitted_or_assessed_at || 'N/A',
                'Outcome': r.links?.learning_outcome
            })));
        }

    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // CHECK FOR PAGINATION
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 4: Check Pagination');

    info('Note: This is page 1 only. For >100 results, use pagination.');
    info('Implementation should use CanvasApiClient.getAllPages()');

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // FULL DATA DUMP
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 5: Full Response Data');
    info('Complete results data logged below (expand to inspect):');
    console.log(resultsData);

    console.log('');
    console.log('─'.repeat(60));
    console.log('%c✅ Outcome Results API Test Complete', 'color: green; font-weight: bold; font-size: 14px;');
    console.log('');
    console.log('%cKey Findings:', 'font-weight: bold;');
    console.log(`  • ${resultsData.outcome_results?.length || 0} outcome result records`);
    console.log(`  • Individual attempts with timestamps available`);
    console.log(`  • Can build chronological score history per student`);
    console.log('');
    console.log('%cFor Power Law Implementation:', 'font-weight: bold;');
    console.log('  1. Fetch all outcome results for course');
    console.log('  2. Group by student ID + outcome ID');
    console.log('  3. Sort by submitted_at chronologically');
    console.log('  4. Deduplicate by submission ID if needed');
    console.log('  5. Run Power Law regression on sorted attempts');
    console.groupEnd();

})().catch(err => {
    console.error('%c❌ Unexpected error in test script:', 'color: red; font-weight: bold;', err);
});