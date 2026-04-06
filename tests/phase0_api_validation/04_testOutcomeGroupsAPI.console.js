// tests/phase0_api_validation/04_testOutcomeGroupsAPI.console.js
/**
 * Canvas Outcome Groups API Validation Test
 *
 * Tests fetching outcome names and metadata via Outcome Groups.
 * This is used for the dashboard's default state (no cache).
 *
 * Endpoints:
 * - GET /api/v1/courses/{courseId}/outcome_groups
 * - GET /api/v1/courses/{courseId}/outcome_groups/{groupId}/outcomes
 *
 * Prerequisites:
 * - Navigate to a Canvas course page as teacher/admin
 * - Course must have at least 1 learning outcome created
 * - Open browser console (F12)
 * - Paste this entire script and press Enter
 *
 * Expected Results:
 * - Green checkmarks for all tests
 * - List of outcome names and IDs
 * - Outcome metadata (title, description, points)
 */

(async function testOutcomeGroupsAPI() {
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

    async function apiGet(url) {
        const response = await fetch(url, {
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST: OUTCOME GROUPS API
    // ═══════════════════════════════════════════════════════════════════════

    console.group('%c🎯 Canvas Outcome Groups API Test', 'font-size: 14px; font-weight: bold; color: #0066cc;');
    console.log('%cCourse ID:', 'font-weight: bold;', courseId);
    console.log('─'.repeat(60));
    console.log('');

    section('Test 1: Fetch Outcome Groups');
    let groups = null;

    try {
        groups = await apiGet(`/api/v1/courses/${courseId}/outcome_groups?per_page=100`);
        pass(`Outcome Groups API successful (${groups.length} groups)`);

        if (groups.length === 0) {
            fail('No outcome groups found - create at least 1 outcome in the course');
            console.groupEnd();
            return;
        }

        info('Outcome groups:');
        groups.forEach((g, i) => {
            info(`  ${i + 1}. ${g.title} (id: ${g.id}, ${g.outcomes_count || 0} outcomes)`);
        });

    } catch (error) {
        fail(`Outcome Groups API failed: ${error.message}`);
        console.error(error);
        console.groupEnd();
        return;
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // TEST: FETCH OUTCOMES FROM EACH GROUP
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 2: Fetch Outcomes from Each Group');
    let allOutcomes = [];

    try {
        const outcomePromises = groups.map(g =>
            apiGet(`/api/v1/courses/${courseId}/outcome_groups/${g.id}/outcomes?per_page=100`)
        );

        const outcomeArrays = await Promise.all(outcomePromises);
        allOutcomes = outcomeArrays.flat();

        pass(`Fetched ${allOutcomes.length} outcomes from ${groups.length} groups`);

    } catch (error) {
        fail(`Fetching outcomes failed: ${error.message}`);
        console.error(error);
        console.groupEnd();
        return;
    }

    console.log('');


    // ═══════════════════════════════════════════════════════════════════════
    // ANALYZE OUTCOME STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 3: Analyze Outcome Structure');

    if (allOutcomes.length > 0) {
        const firstOutcome = allOutcomes[0];

        // Note: Outcome Groups API returns { outcome: {...} } wrapper
        const outcome = firstOutcome.outcome || firstOutcome;

        pass('Sample outcome structure:');
        console.table({
            'ID': outcome.id,
            'Title': outcome.title,
            'Display Name': outcome.display_name || outcome.title,
            'Description': outcome.description ? outcome.description.substring(0, 50) + '...' : 'N/A',
            'Points Possible': outcome.points_possible || 'N/A',
            'Mastery Points': outcome.mastery_points || 'N/A',
            'Calculation Method': outcome.calculation_method || 'N/A'
        });

        info('Fields needed for dashboard default state:');
        info(`  ✓ outcome.id - ${outcome.id}`);
        info(`  ✓ outcome.title - "${outcome.title}"`);
        info(`  ✓ outcome.display_name - "${outcome.display_name || outcome.title}"`);

        console.log('');
        info('All outcomes in course:');
        console.table(allOutcomes.map((o, i) => {
            const outcome = o.outcome || o;
            return {
                'Index': i + 1,
                'ID': outcome.id,
                'Title': outcome.title,
                'Points': outcome.points_possible || 'N/A'
            };
        }));

    } else {
        fail('No outcomes found - create at least 1 outcome to test');
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // SAMPLE IMPLEMENTATION
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 4: Sample Implementation Pattern');

    info('Function to fetch outcome names:');
    console.log(`
async function fetchOutcomeNames(courseId, apiClient) {
    // Step 1: Get all outcome groups
    const groups = await apiClient.get(
        \`/api/v1/courses/\${courseId}/outcome_groups\`
    );

    // Step 2: Fetch outcomes from each group
    const results = await Promise.all(
        groups.map(g =>
            apiClient.get(
                \`/api/v1/courses/\${courseId}/outcome_groups/\${g.id}/outcomes\`
            )
        )
    );

    // Step 3: Flatten and map to simple format
    return results.flat().map((o, i) => ({
        id: o.outcome.id,
        title: o.outcome.title,
        displayOrder: i + 1
    }));
}
    `);

    pass('Implementation pattern documented above');

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // FULL DATA DUMP
    // ═══════════════════════════════════════════════════════════════════════

    section('Test 5: Full Response Data');
    info('Complete outcome groups logged below:');
    console.log('Groups:', groups);
    console.log('Outcomes:', allOutcomes);

    console.log('');
    console.log('─'.repeat(60));
    console.log('%c✅ Outcome Groups API Test Complete', 'color: green; font-weight: bold; font-size: 14px;');
    console.log('');
    console.log('%cKey Findings:', 'font-weight: bold;');
    console.log(`  • ${groups?.length || 0} outcome groups`);
    console.log(`  • ${allOutcomes.length} total outcomes`);
    console.log(`  • Outcome names and IDs available`);
    console.log('');
    console.log('%cFor Dashboard Default State:', 'font-weight: bold;');
    console.log('  1. Fetch outcome groups');
    console.log('  2. Fetch outcomes from each group');
    console.log('  3. Map to { id, title, displayOrder }');
    console.log('  4. Render outcome rows with "NE" placeholders');
    console.groupEnd();

})().catch(err => {
    console.error('%c❌ Unexpected error in test script:', 'color: red; font-weight: bold;', err);
});