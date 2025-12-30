/**
 * CSRF Token Bulk Operation Simulation
 * 
 * Purpose: Simulate your actual use case - bulk grading operations where
 * a single CSRF token is cached and used for hundreds of sequential API calls.
 * 
 * This mirrors your submitGradesPerStudent() function which:
 * 1. Fetches CSRF token once
 * 2. Loops through all students
 * 3. Calls submitRubricScore() for each (which uses the same token)
 * 
 * HOW TO RUN:
 * 1. Open a Canvas course page with an existing assignment
 * 2. Open browser DevTools Console (F12)
 * 3. Update ASSIGNMENT_ID below with a real assignment ID from your course
 * 4. Run: await testBulkOperationWithCachedToken()
 * 
 * SAFETY: This test only reads data (GET requests), it won't modify anything.
 */

async function testBulkOperationWithCachedToken() {
    console.log("=== CSRF Token Bulk Operation Simulation ===\n");
    
    // Configuration
    const courseId = window.location.pathname.match(/courses\/(\d+)/)?.[1];
    if (!courseId) {
        console.error("❌ Not on a Canvas course page");
        return;
    }
    
    console.log(`✓ Course ID: ${courseId}`);
    console.log("⚠️ This test simulates bulk grading but only makes safe GET requests\n");
    
    // Helper: Get CSRF token
    function getTokenCookie(name) {
        const cookies = document.cookie.split(";").map(cookie => cookie.trim());
        for (const cookie of cookies) {
            const [key, value] = cookie.split("=", 2);
            if (key === name) return decodeURIComponent(value);
        }
        return null;
    }
    
    // Step 1: Cache token ONCE (simulating function start)
    console.log("--- Simulating: Function Start ---");
    const cachedToken = getTokenCookie('_csrf_token');
    if (!cachedToken) {
        console.error("❌ CSRF token not found");
        return;
    }
    console.log(`✓ Cached CSRF token once: ${cachedToken.substring(0, 20)}...`);
    console.log(`  (In real code: const csrfToken = getTokenCookie('_csrf_token'))\n`);
    
    // Step 2: Get list of students (simulating your averages array)
    console.log("--- Simulating: Fetching Student List ---");
    const studentsResponse = await fetch(
        `/api/v1/courses/${courseId}/users?enrollment_type[]=student&per_page=20`,
        {
            credentials: "same-origin"
        }
    );
    
    if (!studentsResponse.ok) {
        console.error("❌ Failed to fetch students");
        return;
    }
    
    const students = await studentsResponse.json();
    const studentCount = Math.min(students.length, 10); // Limit to 10 for quick test
    console.log(`✓ Found ${students.length} students, testing with ${studentCount}\n`);
    
    // Step 3: Simulate bulk grading loop
    console.log("--- Simulating: Bulk Grading Loop ---");
    console.log(`(In real code: for each student in averages array...)\n`);
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < studentCount; i++) {
        const student = students[i];
        const loopStartTime = Date.now();

        // Check token BEFORE request
        const tokenBeforeRequest = getTokenCookie('_csrf_token');
        const tokenChangedBeforeRequest = tokenBeforeRequest !== cachedToken;

        // Simulate submitRubricScore() - make an API call with cached token
        // Using outcome_rollups which is guaranteed to exist and work
        const response = await fetch(
            `/api/v1/courses/${courseId}/outcome_rollups?user_ids[]=${student.id}&per_page=1`,
            {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "X-CSRF-Token": cachedToken // Using SAME cached token!
                }
            }
        );

        // Check token AFTER request
        const tokenAfterRequest = getTokenCookie('_csrf_token');
        const tokenChangedAfterRequest = tokenAfterRequest !== cachedToken;
        const elapsed = Date.now() - loopStartTime;
        
        results.push({
            studentId: student.id,
            studentName: student.name,
            status: response.status,
            ok: response.ok,
            tokenChangedBefore: tokenChangedBeforeRequest,
            tokenChangedAfter: tokenChangedAfterRequest,
            tokenBefore: tokenBeforeRequest?.substring(0, 10),
            tokenAfter: tokenAfterRequest?.substring(0, 10),
            cachedTokenPrefix: cachedToken?.substring(0, 10),
            elapsed: elapsed
        });

        // Progress indicator
        const icon = response.ok ? '✓' : '✗';
        const tokenIcon = tokenChangedAfterRequest ? '⚠️' : '✓';
        console.log(`  [${i + 1}/${studentCount}] ${icon} ${student.name.substring(0, 20).padEnd(20)} | ${response.status} | Token: ${tokenIcon} | ${elapsed}ms`);

        // Debug token changes
        if (tokenChangedBeforeRequest || tokenChangedAfterRequest) {
            console.log(`      Token Before: ${tokenBeforeRequest?.substring(0, 15)}... Changed: ${tokenChangedBeforeRequest ? 'YES' : 'NO'}`);
            console.log(`      Token After:  ${tokenAfterRequest?.substring(0, 15)}... Changed: ${tokenChangedAfterRequest ? 'YES' : 'NO'}`);
            console.log(`      Cached Token: ${cachedToken?.substring(0, 15)}...`);
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`      Error: ${errorText.substring(0, 80)}`);
        }
        
        // Small delay to simulate processing time
        await new Promise(r => setTimeout(r, 100));
    }
    
    const totalTime = Date.now() - startTime;
    
    // Step 4: Verify token still valid after loop
    console.log("\n--- Simulating: After Loop Completion ---");
    const finalToken = getTokenCookie('_csrf_token');
    const tokenStillSame = finalToken === cachedToken;
    console.log(`Token still same as cached: ${tokenStillSame ? 'YES ✓' : 'NO ⚠️'}`);
    
    // Make one more request with cached token
    const finalTestResponse = await fetch(
        `/api/v1/courses/${courseId}/outcome_imports`,
        {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "X-CSRF-Token": cachedToken
            }
        }
    );
    console.log(`Final request with cached token: ${finalTestResponse.status} ${finalTestResponse.ok ? '✓' : '✗'}`);
    
    // Summary
    console.log("\n=== Test Results ===");
    const successCount = results.filter(r => r.ok).length;
    const failCount = results.filter(r => !r.ok).length;
    const tokenChangedBeforeCount = results.filter(r => r.tokenChangedBefore).length;
    const tokenChangedAfterCount = results.filter(r => r.tokenChangedAfter).length;
    const avgTime = results.reduce((sum, r) => sum + r.elapsed, 0) / results.length;

    // Check if all tokens are unique
    const uniqueTokensBefore = new Set(results.map(r => r.tokenBefore)).size;
    const uniqueTokensAfter = new Set(results.map(r => r.tokenAfter)).size;
    
    console.log(`Total operations: ${results.length}`);
    console.log(`Successful: ${successCount} (${(successCount / results.length * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failCount}`);
    console.log(`Token changed BEFORE request: ${tokenChangedBeforeCount} times`);
    console.log(`Token changed AFTER request: ${tokenChangedAfterCount} times`);
    console.log(`Unique tokens seen (before): ${uniqueTokensBefore}`);
    console.log(`Unique tokens seen (after): ${uniqueTokensAfter}`);
    console.log(`Average request time: ${avgTime.toFixed(0)}ms`);
    console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`Projected time for 500 students: ${(totalTime / studentCount * 500 / 1000 / 60).toFixed(1)} minutes`);

    console.log("\n=== TOKEN BEHAVIOR ANALYSIS ===");
    if (tokenChangedBeforeCount === 0 && tokenChangedAfterCount === 0) {
        console.log("✅ PERFECT: Token never changed");
        console.log("   Token remained stable throughout entire operation");
        console.log("   → Safe to cache token for bulk operations");
    } else if (tokenChangedBeforeCount > 0 && successCount === results.length) {
        console.log("⚠️ INTERESTING: Token changed but requests still succeeded");
        console.log(`   Token changed ${tokenChangedBeforeCount} times BEFORE requests`);
        console.log(`   Token changed ${tokenChangedAfterCount} times AFTER requests`);
        console.log(`   Saw ${uniqueTokensBefore} unique token values`);
        console.log("   → Canvas may be rotating tokens but accepting old ones");
        console.log("   → Need to investigate if cached token still works");
    } else if (tokenChangedBeforeCount > 0 && failCount > 0) {
        console.log("❌ PROBLEM: Token changed AND requests failed");
        console.log("   → Token rotation may be causing failures");
        console.log("   → Need to fetch fresh token for each request");
    } else {
        console.log("⚠️ MIXED RESULTS: Review details above");
    }
    
    console.log("\n=== RECOMMENDATION ===");
    console.log("Based on this simulation of your bulk grading workflow:");
    if (successCount === results.length) {
        console.log("✓ CanvasApiClient can safely cache CSRF token");
        console.log("✓ Fetch once in constructor or at first use");
        console.log("✓ Reuse for all subsequent requests in the session");
    } else {
        console.log("✗ Implement token refresh logic");
        console.log("✗ Retry failed requests with fresh token");
    }
    
    return {
        results,
        summary: {
            total: results.length,
            successful: successCount,
            failed: failCount,
            tokenChanges: tokenChangedCount,
            avgTimeMs: avgTime,
            totalTimeMs: totalTime
        }
    };
}

console.log("Bulk Operation Simulation loaded. Run: await testBulkOperationWithCachedToken()");

