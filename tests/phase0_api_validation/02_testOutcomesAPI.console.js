// tests/phase0_api_validation/02_testOutcomesAPI.console.js
/**
 * Canvas Outcomes API Validation Test
 *
 * Tests the following endpoints:
 * - GET /api/v1/courses/{courseId}/outcome_rollups
 * - Validates response structure for linked outcomes and users
 * - Documents Canvas scoring methods and calculation fields
 *
 * Prerequisites:
 * - Navigate to a Canvas course page as teacher/admin
 * - Course must have at least 1 outcome and 1 student with outcome scores
 * - Open browser console (F12)
 * - Paste this entire script and press Enter
 *
 * Expected Results:
 * - Green checkmarks for all tests
 * - Outcome rollup data structure logged
 * - Linked outcomes and users data available
 */

(async function testOutcomesAPI() {
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
    // TEST: OUTCOME ROLLUPS API
    // ═══════════════════════════════════════════════════════════════════════

    console.group('%c📊 Canvas Outcomes API Test', 'font-size: 14px; font-weight: bold; color: #0066cc;');
    console.log('%cCourse ID:', 'font-weight: bold;', courseId);
    console.log('─'.repeat(60));
    console.log('');

    section('Test 1: Fetch Outcome Rollups');
    let rollupData = null;

    try {
        const response = await fetch(
            `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
            {
                headers: { 'X-CSRF-Token': csrfToken },
                credentials: 'same-origin'
            }
        );

        if (!response.ok) {
            fail(`Outcome Rollups API failed: ${response.status} ${response.statusText}`);
            console.log('');
            console.groupEnd();
            return;
        }

        rollupData = await response.json();
        pass('Outcome Rollups API successful');
        info(`Status: ${response.status} OK`);

    } catch (error) {
        fail('Outcome Rollups API request failed');
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

    // Check top-level structure
    if (rollupData.rollups && Array.isArray(rollupData.rollups)) {
        pass(`rollups array present (${rollupData.rollups.length} students)`);
    } else {
        fail('rollups array missing or not an array');
    }

    if (rollupData.linked && rollupData.linked.outcomes) {
        pass(`linked.outcomes present (${rollupData.linked.outcomes.length} outcomes)`);
    } else {
        fail('linked.outcomes missing');
    }

    if (rollupData.linked && rollupData.linked.users) {
        pass(`linked.users present (${rollupData.linked.users.length} users)`);
    } else {
        fail('linked.users missing');
    }

    if (rollupData.meta && rollupData.meta.pagination) {
        pass('meta.pagination present');
        info(`  per_page: ${rollupData.meta.pagination.per_page}, page: ${rollupData.meta.pagination.page}`);
    } else {
        fail('meta.pagination missing');
    }

    console.log('');


    // ═══════════════════════════════════════════════════════════════════════
    // ANALYZE LINKED OUTCOMES
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 3: Analyze Linked Outcomes');

    if (rollupData.linked && rollupData.linked.outcomes && rollupData.linked.outcomes.length > 0) {
        const outcome = rollupData.linked.outcomes[0];

        pass('Sample outcome structure:');
        console.table({
            'ID': outcome.id,
            'Title': outcome.title,
            'Points Possible': outcome.points_possible,
            'Mastery Points': outcome.mastery_points,
            'Calculation Method': outcome.calculation_method,
            'Calculation Int': outcome.calculation_int
        });

        info('Fields available:');
        info(`  - id: ${outcome.id}`);
        info(`  - title: "${outcome.title}"`);
        info(`  - points_possible: ${outcome.points_possible}`);
        info(`  - mastery_points: ${outcome.mastery_points}`);
        info(`  - calculation_method: "${outcome.calculation_method}"`);
        info(`  - calculation_int: ${outcome.calculation_int}`);
        info(`  - ratings: ${outcome.ratings ? outcome.ratings.length + ' levels' : 'none'}`);

        // List all outcomes
        console.log('');
        info('All outcomes in course:');
        rollupData.linked.outcomes.forEach((o, i) => {
            info(`  ${i + 1}. ${o.title} (id: ${o.id})`);
        });
    } else {
        fail('No outcomes found in course - create at least 1 outcome to test');
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // ANALYZE ROLLUPS (STUDENT SCORES)
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 4: Analyze Student Rollups');

    if (rollupData.rollups && rollupData.rollups.length > 0) {
        const studentRollup = rollupData.rollups[0];

        pass(`Sample student rollup structure (user_id: ${studentRollup.links.user})`);

        if (studentRollup.scores && studentRollup.scores.length > 0) {
            const score = studentRollup.scores[0];
            info('Score object fields:');
            info(`  - score: ${score.score}`);
            info(`  - count: ${score.count} (number of attempts)`);
            info(`  - links.outcome: ${score.links.outcome}`);

            console.log('');
            info('Sample score data:');
            console.table(studentRollup.scores.map(s => ({
                'Outcome ID': s.links.outcome,
                'Score': s.score,
                'Count': s.count
            })));
        } else {
            fail('No scores found for students - assign rubric scores to test');
        }
    } else {
        fail('No student rollups found - enroll students and assign scores to test');
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // FULL DATA DUMP
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 5: Full Response Data');
    info('Complete rollup data logged below (expand to inspect):');
    console.log(rollupData);

    console.log('');
    console.log('─'.repeat(60));
    console.log('%c✅ Outcomes API Test Complete', 'color: green; font-weight: bold; font-size: 14px;');
    console.log('');
    console.log('%cKey Findings:', 'font-weight: bold;');
    console.log(`  • ${rollupData.linked?.outcomes?.length || 0} outcomes found`);
    console.log(`  • ${rollupData.rollups?.length || 0} students with data`);
    console.log(`  • Scoring method: ${rollupData.linked?.outcomes?.[0]?.calculation_method || 'N/A'}`);
    console.log('');
    console.log('%cResponse Structure:', 'font-weight: bold;');
    console.log('  • rollupData.rollups[] - Per-student outcome scores');
    console.log('  • rollupData.linked.outcomes[] - Outcome metadata');
    console.log('  • rollupData.linked.users[] - User information');
    console.log('  • rollupData.meta.pagination - Pagination info');
    console.groupEnd();

})().catch(err => {
    console.error('%c❌ Unexpected error in test script:', 'color: red; font-weight: bold;', err);
});