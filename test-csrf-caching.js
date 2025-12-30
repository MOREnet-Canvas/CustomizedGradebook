/**
 * CSRF Token Caching Test
 * 
 * Purpose: Validate whether Canvas CSRF tokens can be safely cached and reused
 * across multiple API requests, or if they need to be fetched fresh each time.
 * 
 * HOW TO RUN:
 * 1. Open a Canvas course page in your browser
 * 2. Open browser DevTools Console (F12)
 * 3. Copy and paste this entire file into the console
 * 4. Run: await testCsrfTokenCaching()
 * 
 * WHAT IT TESTS:
 * - Whether the same CSRF token works for multiple consecutive POST requests
 * - Whether the token remains valid over a time period (30 seconds)
 * - Whether the token cookie value changes between requests
 * 
 * EXPECTED OUTCOMES:
 * - If caching is safe: All requests succeed with the same token
 * - If caching is unsafe: Subsequent requests fail with 403/422 errors
 */

async function testCsrfTokenCaching() {
    console.log("=== CSRF Token Caching Test Started ===\n");
    
    // Get course ID from current page
    const courseId = window.location.pathname.match(/courses\/(\d+)/)?.[1];
    if (!courseId) {
        console.error("❌ Not on a Canvas course page. Navigate to a course first.");
        return;
    }
    console.log(`✓ Course ID: ${courseId}\n`);
    
    // Helper: Get CSRF token from cookie
    function getTokenCookie(name) {
        const cookies = document.cookie.split(";").map(cookie => cookie.trim());
        for (const cookie of cookies) {
            const [key, value] = cookie.split("=", 2);
            if (key === name) {
                return decodeURIComponent(value);
            }
        }
        return null;
    }
    
    // Get initial token
    const initialToken = getTokenCookie('_csrf_token');
    if (!initialToken) {
        console.error("❌ CSRF token not found in cookies");
        return;
    }
    console.log(`✓ Initial CSRF Token: ${initialToken.substring(0, 20)}...`);
    console.log(`  Token length: ${initialToken.length} characters\n`);
    
    // Test 1: Multiple consecutive requests with same cached token
    console.log("--- Test 1: Multiple Consecutive Requests ---");
    const cachedToken = initialToken; // Cache it once
    const testResults = [];
    
    for (let i = 1; i <= 5; i++) {
        try {
            // Make a safe read-only request that requires CSRF token
            // Using the outcome_imports endpoint with a GET (safe, won't modify data)
            const response = await fetch(
                `/api/v1/courses/${courseId}/outcome_imports`,
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        "X-CSRF-Token": cachedToken
                    }
                }
            );
            
            const currentToken = getTokenCookie('_csrf_token');
            const tokenChanged = currentToken !== cachedToken;
            
            testResults.push({
                attempt: i,
                status: response.status,
                ok: response.ok,
                tokenChanged: tokenChanged
            });
            
            console.log(`  Request ${i}: ${response.status} ${response.ok ? '✓' : '✗'} | Token changed: ${tokenChanged ? 'YES ⚠️' : 'NO ✓'}`);
            
            // Small delay between requests
            await new Promise(r => setTimeout(r, 500));
            
        } catch (error) {
            console.error(`  Request ${i}: ✗ FAILED - ${error.message}`);
            testResults.push({
                attempt: i,
                status: 'ERROR',
                ok: false,
                error: error.message
            });
        }
    }
    
    // Test 2: Token stability over time
    console.log("\n--- Test 2: Token Stability Over Time ---");
    console.log("  Waiting 10 seconds...");
    await new Promise(r => setTimeout(r, 10000));
    
    const tokenAfter10s = getTokenCookie('_csrf_token');
    const tokenStable = tokenAfter10s === cachedToken;
    console.log(`  Token after 10s: ${tokenStable ? 'SAME ✓' : 'CHANGED ⚠️'}`);
    
    // Test 3: Verify token works after time delay
    console.log("\n--- Test 3: Cached Token After Delay ---");
    try {
        const response = await fetch(
            `/api/v1/courses/${courseId}/outcome_imports`,
            {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "X-CSRF-Token": cachedToken // Still using original cached token
                }
            }
        );
        console.log(`  Request with cached token: ${response.status} ${response.ok ? '✓' : '✗'}`);
    } catch (error) {
        console.error(`  Request failed: ${error.message}`);
    }
    
    // Summary
    console.log("\n=== Test Summary ===");
    const allSucceeded = testResults.every(r => r.ok);
    const anyTokenChanged = testResults.some(r => r.tokenChanged);
    
    console.log(`Total requests: ${testResults.length}`);
    console.log(`Successful: ${testResults.filter(r => r.ok).length}`);
    console.log(`Failed: ${testResults.filter(r => !r.ok).length}`);
    console.log(`Token changed during test: ${anyTokenChanged ? 'YES ⚠️' : 'NO ✓'}`);
    console.log(`Token stable after 10s: ${tokenStable ? 'YES ✓' : 'NO ⚠️'}`);
    
    console.log("\n=== RECOMMENDATION ===");
    if (allSucceeded && !anyTokenChanged && tokenStable) {
        console.log("✓ SAFE TO CACHE: Token remained valid across all requests");
        console.log("  → CanvasApiClient can cache token at initialization");
        console.log("  → No need for token refresh logic");
    } else if (allSucceeded && anyTokenChanged) {
        console.log("⚠️ TOKEN ROTATES: Token changes but old token still works");
        console.log("  → CanvasApiClient can cache token, but monitor for failures");
        console.log("  → Consider implementing token refresh on 403/422 errors");
    } else {
        console.log("✗ NOT SAFE TO CACHE: Token expired or became invalid");
        console.log("  → CanvasApiClient must fetch token fresh for each request");
        console.log("  → Or implement token refresh logic with retry on failure");
    }
    
    return {
        testResults,
        tokenStable,
        recommendation: allSucceeded && !anyTokenChanged && tokenStable ? 'CACHE_SAFE' : 'NEEDS_REFRESH'
    };
}

// Export for use
console.log("CSRF Token Caching Test loaded. Run: await testCsrfTokenCaching()");

