/**
 * CSRF Token POST Request Test
 * 
 * Purpose: Test CSRF token caching with actual POST requests (the critical case)
 * This is more realistic since your app makes many POST/PUT requests for grading.
 * 
 * HOW TO RUN:
 * 1. Open a Canvas course page where you have teacher/admin access
 * 2. Open browser DevTools Console (F12)
 * 3. Copy and paste this entire file into the console
 * 4. Run: await testCsrfPostRequests()
 * 
 * WHAT IT TESTS:
 * - Creates a temporary assignment
 * - Makes multiple PUT requests to update it using the SAME cached CSRF token
 * - Verifies if the token remains valid across multiple mutations
 * - Cleans up by deleting the test assignment
 * 
 * SAFETY: This test creates and deletes a temporary assignment. It won't affect
 * existing course data, but you should run it in a test course if possible.
 */

async function testCsrfPostRequests() {
    console.log("=== CSRF Token POST Request Test Started ===\n");
    
    // Get course ID
    const courseId = window.location.pathname.match(/courses\/(\d+)/)?.[1];
    if (!courseId) {
        console.error("❌ Not on a Canvas course page");
        return;
    }
    console.log(`✓ Course ID: ${courseId}\n`);
    
    // Helper: Get CSRF token
    function getTokenCookie(name) {
        const cookies = document.cookie.split(";").map(cookie => cookie.trim());
        for (const cookie of cookies) {
            const [key, value] = cookie.split("=", 2);
            if (key === name) return decodeURIComponent(value);
        }
        return null;
    }
    
    // Get and cache the token ONCE
    const cachedToken = getTokenCookie('_csrf_token');
    if (!cachedToken) {
        console.error("❌ CSRF token not found");
        return;
    }
    console.log(`✓ Cached CSRF Token: ${cachedToken.substring(0, 20)}...\n`);
    
    let assignmentId = null;
    const testResults = [];
    
    try {
        // Step 1: Create a test assignment using cached token
        console.log("--- Step 1: Create Test Assignment ---");
        const createResponse = await fetch(
            `/api/v1/courses/${courseId}/assignments`,
            {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": cachedToken // Using cached token
                },
                body: JSON.stringify({
                    assignment: {
                        name: `[TEST] CSRF Token Test ${Date.now()}`,
                        submission_types: ["none"],
                        published: false,
                        points_possible: 100
                    }
                })
            }
        );
        
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error(`✗ Create failed: ${createResponse.status} - ${errorText}`);
            return;
        }
        
        const assignment = await createResponse.json();
        assignmentId = assignment.id;
        console.log(`✓ Created assignment ID: ${assignmentId}`);
        
        const tokenAfterCreate = getTokenCookie('_csrf_token');
        console.log(`  Token changed after POST: ${tokenAfterCreate !== cachedToken ? 'YES ⚠️' : 'NO ✓'}\n`);
        
        // Step 2: Make multiple PUT requests with the SAME cached token
        console.log("--- Step 2: Multiple PUT Requests (Same Cached Token) ---");
        
        for (let i = 1; i <= 5; i++) {
            const updateResponse = await fetch(
                `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
                {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": cachedToken // Still using original cached token!
                    },
                    body: JSON.stringify({
                        assignment: {
                            points_possible: 100 + i // Just change points slightly
                        }
                    })
                }
            );
            
            const currentToken = getTokenCookie('_csrf_token');
            const success = updateResponse.ok;
            
            testResults.push({
                attempt: i,
                status: updateResponse.status,
                ok: success,
                tokenChanged: currentToken !== cachedToken
            });
            
            console.log(`  PUT ${i}: ${updateResponse.status} ${success ? '✓' : '✗'} | Token changed: ${currentToken !== cachedToken ? 'YES ⚠️' : 'NO ✓'}`);
            
            if (!success) {
                const errorText = await updateResponse.text();
                console.error(`    Error: ${errorText.substring(0, 100)}`);
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
        
        // Step 3: Wait and test again
        console.log("\n--- Step 3: PUT After 5 Second Delay ---");
        await new Promise(r => setTimeout(r, 5000));
        
        const delayedResponse = await fetch(
            `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
            {
                method: "PUT",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": cachedToken // Still using original!
                },
                body: JSON.stringify({
                    assignment: {
                        points_possible: 200
                    }
                })
            }
        );
        
        console.log(`  PUT after delay: ${delayedResponse.status} ${delayedResponse.ok ? '✓' : '✗'}`);
        
    } finally {
        // Cleanup: Delete test assignment
        if (assignmentId) {
            console.log("\n--- Cleanup: Deleting Test Assignment ---");
            const deleteResponse = await fetch(
                `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
                {
                    method: "DELETE",
                    credentials: "same-origin",
                    headers: {
                        "X-CSRF-Token": cachedToken // Using cached token for delete too
                    }
                }
            );
            console.log(`  Delete: ${deleteResponse.status} ${deleteResponse.ok ? '✓' : '✗'}`);
        }
    }
    
    // Summary
    console.log("\n=== Test Summary ===");
    const allSucceeded = testResults.every(r => r.ok);
    const anyFailed = testResults.some(r => !r.ok);
    const anyTokenChanged = testResults.some(r => r.tokenChanged);
    
    console.log(`Total PUT requests: ${testResults.length}`);
    console.log(`Successful: ${testResults.filter(r => r.ok).length}`);
    console.log(`Failed: ${testResults.filter(r => !r.ok).length}`);
    console.log(`Token changed: ${anyTokenChanged ? 'YES ⚠️' : 'NO ✓'}`);
    
    console.log("\n=== RECOMMENDATION FOR CanvasApiClient ===");
    if (allSucceeded && !anyTokenChanged) {
        console.log("✅ SAFE TO CACHE CSRF TOKEN");
        console.log("  → Fetch token once in constructor or at first use");
        console.log("  → Reuse for all subsequent requests");
        console.log("  → No refresh logic needed");
    } else if (allSucceeded && anyTokenChanged) {
        console.log("⚠️ TOKEN ROTATES BUT OLD TOKEN WORKS");
        console.log("  → Can cache, but token value changes in cookie");
        console.log("  → Old cached token still accepted by Canvas");
        console.log("  → Safe to cache, but consider refresh on 403 errors");
    } else {
        console.log("❌ CACHING NOT SAFE");
        console.log("  → Must fetch token fresh for each request");
        console.log("  → OR implement token refresh with retry logic");
    }
    
    return { testResults, allSucceeded, anyTokenChanged };
}

console.log("CSRF POST Test loaded. Run: await testCsrfPostRequests()");

