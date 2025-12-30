/**
 * CSRF Token Diagnostic Test
 * 
 * Purpose: Verify that we're reading the CSRF token correctly and understand
 * how Canvas manages the token cookie.
 * 
 * HOW TO RUN:
 * 1. Open any Canvas page
 * 2. Open browser DevTools Console (F12)
 * 3. Copy/paste this file into console
 * 4. Run: testCsrfTokenDiagnostic()
 */

function testCsrfTokenDiagnostic() {
    console.log("=== CSRF Token Diagnostic Test ===\n");
    
    // Helper: Get CSRF token (same as your codebase)
    function getTokenCookie(name) {
        const cookies = document.cookie.split(";").map(cookie => cookie.trim());
        for (const cookie of cookies) {
            const [key, value] = cookie.split("=", 2);
            if (key === name) return decodeURIComponent(value);
        }
        return null;
    }
    
    // Test 1: Check all cookies
    console.log("--- All Cookies ---");
    const allCookies = document.cookie.split(";").map(c => c.trim());
    console.log(`Total cookies: ${allCookies.length}`);
    allCookies.forEach(cookie => {
        const [key] = cookie.split("=", 2);
        if (key.includes('csrf') || key.includes('token')) {
            console.log(`  Found: ${key}`);
        }
    });
    
    // Test 2: Try different token names
    console.log("\n--- Trying Different Token Names ---");
    const tokenNames = [
        '_csrf_token',
        'csrf_token',
        '_csrf',
        'XSRF-TOKEN',
        'authenticity_token'
    ];
    
    tokenNames.forEach(name => {
        const token = getTokenCookie(name);
        if (token) {
            console.log(`✓ ${name}: ${token.substring(0, 30)}... (length: ${token.length})`);
        } else {
            console.log(`✗ ${name}: not found`);
        }
    });
    
    // Test 3: Check Canvas ENV object
    console.log("\n--- Canvas ENV Object ---");
    if (typeof ENV !== 'undefined') {
        console.log("✓ ENV object exists");
        if (ENV.AUTHENTICITY_TOKEN) {
            console.log(`✓ ENV.AUTHENTICITY_TOKEN: ${ENV.AUTHENTICITY_TOKEN.substring(0, 30)}... (length: ${ENV.AUTHENTICITY_TOKEN.length})`);
        } else {
            console.log("✗ ENV.AUTHENTICITY_TOKEN: not found");
        }
    } else {
        console.log("✗ ENV object not found");
    }
    
    // Test 4: Check meta tags
    console.log("\n--- Meta Tags ---");
    const csrfMetaTag = document.querySelector('meta[name="csrf-token"]');
    if (csrfMetaTag) {
        const metaToken = csrfMetaTag.getAttribute('content');
        console.log(`✓ <meta name="csrf-token">: ${metaToken.substring(0, 30)}... (length: ${metaToken.length})`);
    } else {
        console.log("✗ <meta name='csrf-token'> not found");
    }
    
    // Test 5: Compare all sources
    console.log("\n--- Token Comparison ---");
    const cookieToken = getTokenCookie('_csrf_token');
    const envToken = typeof ENV !== 'undefined' ? ENV.AUTHENTICITY_TOKEN : null;
    const metaToken = csrfMetaTag ? csrfMetaTag.getAttribute('content') : null;
    
    console.log("Comparing token sources:");
    console.log(`  Cookie (_csrf_token):     ${cookieToken ? cookieToken.substring(0, 20) + '...' : 'NOT FOUND'}`);
    console.log(`  ENV.AUTHENTICITY_TOKEN:   ${envToken ? envToken.substring(0, 20) + '...' : 'NOT FOUND'}`);
    console.log(`  Meta tag (csrf-token):    ${metaToken ? metaToken.substring(0, 20) + '...' : 'NOT FOUND'}`);
    
    if (cookieToken && envToken) {
        console.log(`\n  Cookie == ENV: ${cookieToken === envToken ? 'YES ✓' : 'NO ✗'}`);
    }
    if (cookieToken && metaToken) {
        console.log(`  Cookie == Meta: ${cookieToken === metaToken ? 'YES ✓' : 'NO ✗'}`);
    }
    if (envToken && metaToken) {
        console.log(`  ENV == Meta: ${envToken === metaToken ? 'YES ✓' : 'NO ✗'}`);
    }
    
    // Test 6: Watch for token changes
    console.log("\n--- Token Stability Test ---");
    console.log("Checking if token changes over 5 seconds...");
    
    const initialToken = cookieToken || envToken || metaToken;
    if (!initialToken) {
        console.error("❌ No CSRF token found from any source!");
        return;
    }
    
    console.log(`Initial token: ${initialToken.substring(0, 30)}...`);
    
    let checkCount = 0;
    const interval = setInterval(() => {
        checkCount++;
        const currentCookieToken = getTokenCookie('_csrf_token');
        const currentEnvToken = typeof ENV !== 'undefined' ? ENV.AUTHENTICITY_TOKEN : null;
        
        const cookieChanged = currentCookieToken !== cookieToken;
        const envChanged = currentEnvToken !== envToken;
        
        console.log(`  Check ${checkCount}: Cookie ${cookieChanged ? 'CHANGED ⚠️' : 'same ✓'} | ENV ${envChanged ? 'CHANGED ⚠️' : 'same ✓'}`);
        
        if (checkCount >= 5) {
            clearInterval(interval);
            console.log("\n=== DIAGNOSTIC COMPLETE ===");
            console.log("\nRECOMMENDATION:");
            if (cookieToken) {
                console.log("✓ Use: getTokenCookie('_csrf_token')");
                console.log("  This matches your current codebase implementation");
            } else if (envToken) {
                console.log("⚠️ Use: ENV.AUTHENTICITY_TOKEN");
                console.log("  Cookie not available, use ENV object instead");
            } else if (metaToken) {
                console.log("⚠️ Use: document.querySelector('meta[name=\"csrf-token\"]').content");
                console.log("  Cookie and ENV not available, use meta tag");
            }
        }
    }, 1000);
    
    return {
        cookieToken,
        envToken,
        metaToken,
        allMatch: cookieToken === envToken && envToken === metaToken
    };
}

console.log("CSRF Diagnostic Test loaded. Run: testCsrfTokenDiagnostic()");

