# CSRF Token Caching Test Strategy

## Purpose
Determine whether Canvas CSRF tokens can be safely cached and reused across multiple API requests in the CanvasApiClient class, or if they need to be fetched fresh for each request.

## Background
Currently, your codebase calls `getTokenCookie('_csrf_token')` fresh for every API request that needs authentication. This works but is inefficient. If we can cache the token, the CanvasApiClient can:
- Fetch the token once at initialization
- Reuse it for all subsequent requests
- Improve performance by avoiding repeated cookie parsing

## Test Files Provided

### 1. `test-csrf-caching.js` - Basic Token Stability Test
**What it tests:**
- Whether the CSRF token value remains stable over time
- Whether the token cookie changes between requests
- Token validity after a 10-second delay

**How to run:**
```javascript
// In browser console on a Canvas course page:
await testCsrfTokenCaching()
```

**Low risk:** Only makes GET requests, won't modify any data.

### 2. `test-csrf-post-requests.js` - Real-World POST/PUT Test
**What it tests:**
- Creates a temporary assignment using cached token
- Makes 5 consecutive PUT requests with the SAME cached token
- Tests token validity after a 5-second delay
- Verifies DELETE works with cached token
- Cleans up test data

**How to run:**
```javascript
// In browser console on a Canvas course page (preferably a test course):
await testCsrfPostRequests()
```

**Medium risk:** Creates and deletes a test assignment. Run in a test course if possible.

## What to Look For

### ✅ Safe to Cache (Best Case)
**Indicators:**
- All requests succeed (status 200-299)
- Token cookie value never changes
- Token works after time delays
- No 403 (Forbidden) or 422 (Unprocessable Entity) errors

**CanvasApiClient Design:**
```javascript
class CanvasApiClient {
    constructor() {
        this.csrfToken = this.getTokenCookie('_csrf_token'); // Cache once
    }
    
    post(url, data) {
        // Use this.csrfToken for all requests
    }
}
```

### ⚠️ Token Rotates But Works (Acceptable)
**Indicators:**
- All requests succeed
- Token cookie value changes between requests
- Old cached token still accepted by Canvas

**CanvasApiClient Design:**
```javascript
class CanvasApiClient {
    constructor() {
        this.csrfToken = this.getTokenCookie('_csrf_token'); // Cache once
    }
    
    async post(url, data) {
        // Use cached token, but refresh on 403 errors
        try {
            return await this.makeRequest(url, data, this.csrfToken);
        } catch (error) {
            if (error.status === 403) {
                this.csrfToken = this.getTokenCookie('_csrf_token'); // Refresh
                return await this.makeRequest(url, data, this.csrfToken); // Retry
            }
            throw error;
        }
    }
}
```

### ❌ Not Safe to Cache (Worst Case)
**Indicators:**
- Subsequent requests fail with 403/422 errors
- Token becomes invalid after first use
- Token expires quickly

**CanvasApiClient Design:**
```javascript
class CanvasApiClient {
    post(url, data) {
        const token = this.getTokenCookie('_csrf_token'); // Fetch fresh every time
        return this.makeRequest(url, data, token);
    }
}
```

## Expected Results (Based on Canvas Behavior)

Based on typical Canvas LMS behavior and your current codebase patterns:

**Most Likely:** ✅ Safe to Cache
- Canvas typically uses session-based CSRF tokens
- Your code currently works with `getTokenCookie()` called at function start, then used for multiple operations
- Example: `submitGradesPerStudent()` calls `submitRubricScore()` hundreds of times in a loop, each fetching the token fresh but they all work

**Why current code suggests caching is safe:**
1. `beginBulkUpdate()` fetches token once, then makes multiple API calls
2. `createOutcome()` fetches token once, then polls multiple times
3. No retry logic exists for token refresh, yet the code works in production

## Next Steps After Testing

### If Safe to Cache:
1. ✅ Implement simple token caching in CanvasApiClient constructor
2. ✅ Remove all `getTokenCookie()` calls from service files
3. ✅ Simplify API client code

### If Token Rotates:
1. ⚠️ Implement token caching with refresh-on-403 logic
2. ⚠️ Add retry mechanism for failed requests
3. ⚠️ Monitor for 403 errors in production

### If Not Safe to Cache:
1. ❌ Fetch token fresh for each request
2. ❌ Keep current pattern but centralize in CanvasApiClient
3. ❌ Consider alternative authentication methods

## Running the Tests

**Recommended order:**
1. Run `test-csrf-caching.js` first (safest, read-only)
2. If results look good, run `test-csrf-post-requests.js` (creates test data)
3. Review console output and recommendations
4. Share results to inform CanvasApiClient design decisions

**Where to run:**
- Development/test Canvas instance (preferred)
- Production Canvas instance (acceptable, tests are safe)
- Any course where you have teacher/admin permissions

**Time required:**
- Test 1: ~15 seconds
- Test 2: ~30 seconds
- Total: < 1 minute

## Questions These Tests Answer

1. ✅ Can we cache the CSRF token at CanvasApiClient initialization?
2. ✅ Do we need token refresh logic?
3. ✅ Will the token remain valid for the duration of a bulk grading operation (potentially minutes)?
4. ✅ Does the token cookie value change during normal operations?
5. ✅ What error codes indicate token expiration (403, 422, other)?

## Additional Manual Testing (Optional)

If you want to be extra thorough:

1. **Long-running test:** Modify test to wait 5 minutes between requests
2. **High-volume test:** Make 100+ consecutive requests with same token
3. **Cross-tab test:** Cache token in one tab, use in another tab's requests
4. **Session timeout test:** Wait for Canvas session timeout, verify token expires

These are overkill for initial validation but useful if you see unexpected behavior.

