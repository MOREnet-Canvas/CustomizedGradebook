/**
 * CSRF Old Token Validity Test
 * 
 * Purpose: Test if an OLD cached CSRF token still works even after the
 * cookie value has changed. This is the CRITICAL question for caching.
 * 
 * HOW TO RUN:
 * 1. Open a Canvas course page
 * 2. Open browser DevTools Console (F12)
 * 3. Copy/paste this file into console
 * 4. Run: await testOldTokenValidity()
 */

async function testOldTokenValidity() {
    console.log("=== Old CSRF Token Validity Test ===\n");
    
    const courseId = window.location.pathname.match(/courses\/(\d+)/)?.[1];
    if (!courseId) {
        console.error("❌ Not on a Canvas course page");
        return;
    }
    
    // Helper: Get CSRF token
    function getTokenCookie(name) {
        const cookies = document.cookie.split(";").map(cookie => cookie.trim());
        for (const cookie of cookies) {
            const [key, value] = cookie.split("=", 2);
            if (key === name) return decodeURIComponent(value);
        }
        return null;
    }
    
    // Helper: Try ENV.AUTHENTICITY_TOKEN as fallback
    function getTokenFromEnv() {
        return typeof ENV !== 'undefined' ? ENV.AUTHENTICITY_TOKEN : null;
    }
    
    // Helper: Get token from any source
    function getToken() {
        return getTokenCookie('_csrf_token') || getTokenFromEnv();
    }
    
    // Step 1: Cache the initial token
    console.log("--- Step 1: Cache Initial Token ---");
    const cachedToken = getToken();
    if (!cachedToken) {
        console.error("❌ No CSRF token found");
        return;
    }
    console.log(`✓ Cached token: ${cachedToken.substring(0, 30)}...`);
    console.log(`  Length: ${cachedToken.length} characters\n`);
    
    // Step 2: Make a request with cached token (should work)
    console.log("--- Step 2: Test Cached Token (Immediate) ---");
    const response1 = await fetch(
        `/api/v1/courses/${courseId}/assignments?per_page=1`,
        {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "X-CSRF-Token": cachedToken
            }
        }
    );
    console.log(`Request 1: ${response1.status} ${response1.ok ? '✓' : '✗'}`);
    
    const tokenAfterRequest1 = getToken();
    const tokenChanged1 = tokenAfterRequest1 !== cachedToken;
    console.log(`Token changed after request: ${tokenChanged1 ? 'YES ⚠️' : 'NO ✓'}`);
    if (tokenChanged1) {
        console.log(`  Old token: ${cachedToken.substring(0, 20)}...`);
        console.log(`  New token: ${tokenAfterRequest1.substring(0, 20)}...`);
    }
    
    // Step 3: Make several more requests to potentially trigger token rotation
    console.log("\n--- Step 3: Make Multiple Requests ---");
    for (let i = 2; i <= 5; i++) {
        await fetch(`/api/v1/courses/${courseId}/assignments?per_page=1`, {
            credentials: "same-origin"
        });
        await new Promise(r => setTimeout(r, 200));
    }
    
    const currentToken = getToken();
    const tokenChangedNow = currentToken !== cachedToken;
    console.log(`After 5 requests, token changed: ${tokenChangedNow ? 'YES ⚠️' : 'NO ✓'}`);
    if (tokenChangedNow) {
        console.log(`  Cached token: ${cachedToken.substring(0, 20)}...`);
        console.log(`  Current token: ${currentToken.substring(0, 20)}...`);
    }
    
    // Step 4: THE CRITICAL TEST - Use OLD cached token after cookie changed
    console.log("\n--- Step 4: CRITICAL TEST - Use Old Cached Token ---");
    console.log("Testing if OLD cached token still works after cookie changed...\n");
    
    const testResults = [];
    for (let i = 1; i <= 3; i++) {
        const beforeToken = getToken();
        
        // Use the ORIGINAL cached token (not the current one!)
        const response = await fetch(
            `/api/v1/courses/${courseId}/assignments?per_page=1`,
            {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "X-CSRF-Token": cachedToken // OLD cached token!
                }
            }
        );
        
        const afterToken = getToken();
        const usingOldToken = beforeToken !== cachedToken;
        
        testResults.push({
            attempt: i,
            status: response.status,
            ok: response.ok,
            usingOldToken: usingOldToken,
            currentTokenPrefix: beforeToken?.substring(0, 15),
            cachedTokenPrefix: cachedToken?.substring(0, 15)
        });
        
        console.log(`  Attempt ${i}:`);
        console.log(`    Request status: ${response.status} ${response.ok ? '✓' : '✗'}`);
        console.log(`    Using old token: ${usingOldToken ? 'YES (cookie changed)' : 'NO (cookie same)'}`);
        console.log(`    Current cookie: ${beforeToken?.substring(0, 20)}...`);
        console.log(`    Cached token:   ${cachedToken?.substring(0, 20)}...`);
        console.log(`    Tokens match:   ${beforeToken === cachedToken ? 'YES ✓' : 'NO ✗'}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log(`    Error: ${errorText.substring(0, 100)}`);
        }
        
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Summary
    console.log("\n=== RESULTS ===");
    const allSucceeded = testResults.every(r => r.ok);
    const anyUsedOldToken = testResults.some(r => r.usingOldToken);
    
    console.log(`Total tests: ${testResults.length}`);
    console.log(`All succeeded: ${allSucceeded ? 'YES ✓' : 'NO ✗'}`);
    console.log(`Used old token: ${anyUsedOldToken ? 'YES' : 'NO'}`);
    
    console.log("\n=== CONCLUSION ===");
    if (allSucceeded && anyUsedOldToken) {
        console.log("✅ OLD TOKENS WORK!");
        console.log("   Even though the cookie changed, the old cached token still works");
        console.log("   → SAFE TO CACHE: CanvasApiClient can cache token at initialization");
        console.log("   → Canvas accepts old tokens even after rotation");
    } else if (allSucceeded && !anyUsedOldToken) {
        console.log("✅ TOKEN STABLE!");
        console.log("   Token never changed during the test");
        console.log("   → SAFE TO CACHE: CanvasApiClient can cache token at initialization");
    } else if (!allSucceeded && anyUsedOldToken) {
        console.log("❌ OLD TOKENS REJECTED!");
        console.log("   Requests failed when using old cached token");
        console.log("   → NOT SAFE TO CACHE: Must fetch fresh token for each request");
        console.log("   → OR implement token refresh with retry logic");
    } else {
        console.log("⚠️ UNCLEAR RESULTS - Review details above");
    }
    
    return {
        cachedToken: cachedToken.substring(0, 20) + '...',
        currentToken: currentToken?.substring(0, 20) + '...',
        tokenChanged: currentToken !== cachedToken,
        testResults,
        allSucceeded,
        recommendation: allSucceeded ? 'SAFE_TO_CACHE' : 'NOT_SAFE'
    };
}

console.log("Old Token Validity Test loaded. Run: await testOldTokenValidity()");

