# CSRF Token Testing - Quick Start Guide

## TL;DR - Run This First

1. Open any Canvas course page in your browser
2. Open DevTools Console (F12)
3. Copy/paste the contents of `test-csrf-bulk-simulation.js` into console
4. Run: `await testBulkOperationWithCachedToken()`
5. Read the recommendation at the end

**Expected result:** All requests succeed, token caching is safe ✅

## Why This Matters

Your CanvasApiClient design depends on whether CSRF tokens can be cached:

### Option A: Safe to Cache (Best)
```javascript
class CanvasApiClient {
    constructor() {
        this.csrfToken = this.getTokenCookie('_csrf_token'); // Once
    }
    
    async post(url, data) {
        return await fetch(url, {
            headers: { 'X-CSRF-Token': this.csrfToken } // Reuse
        });
    }
}
```

### Option B: Must Fetch Fresh (Worst)
```javascript
class CanvasApiClient {
    async post(url, data) {
        const token = this.getTokenCookie('_csrf_token'); // Every time
        return await fetch(url, {
            headers: { 'X-CSRF-Token': token }
        });
    }
}
```

## Test Files (In Order of Importance)

### 1. ⭐ `test-csrf-bulk-simulation.js` - RECOMMENDED
**Run this first.** Simulates your actual bulk grading workflow.
- Tests 10 sequential API calls with same cached token
- Mirrors your `submitGradesPerStudent()` function
- Safe (only GET requests)
- Takes ~5 seconds

### 2. `test-csrf-post-requests.js` - Thorough
Tests actual POST/PUT/DELETE operations.
- Creates temporary assignment
- Makes 5 PUT requests with cached token
- Tests DELETE with cached token
- Cleans up after itself
- Takes ~30 seconds

### 3. `test-csrf-caching.js` - Basic
Simple token stability test.
- Checks if token value changes
- Tests token after 10 second delay
- All GET requests
- Takes ~15 seconds

## How to Run

### Step 1: Open Canvas
Navigate to any course where you have teacher/admin access.

### Step 2: Open Console
Press F12 (or Cmd+Option+J on Mac) to open DevTools, click "Console" tab.

### Step 3: Load Test
Copy entire contents of test file and paste into console.

### Step 4: Run Test
Type the function name and press Enter:
```javascript
await testBulkOperationWithCachedToken()
```

### Step 5: Read Results
Look for the "RECOMMENDATION" section at the end of the output.

## What You'll See

### ✅ Success Output
```
=== RECOMMENDATION ===
✓ CanvasApiClient can safely cache CSRF token
✓ Fetch once in constructor or at first use
✓ Reuse for all subsequent requests in the session
```

**Action:** Implement simple token caching in CanvasApiClient.

### ⚠️ Warning Output
```
=== RECOMMENDATION ===
⚠️ TOKEN ROTATES BUT OLD TOKEN WORKS
→ Safe to cache, but monitor for failures
```

**Action:** Implement caching with refresh-on-error logic.

### ❌ Failure Output
```
=== RECOMMENDATION ===
✗ Implement token refresh logic
✗ Retry failed requests with fresh token
```

**Action:** Fetch token fresh for each request OR implement retry logic.

## Expected Results (Prediction)

Based on your current codebase analysis:

**Most likely outcome:** ✅ Safe to cache

**Evidence:**
1. Your code already caches token at function start
2. `submitGradesPerStudent()` uses one token for 500+ students
3. No retry logic exists, yet code works in production
4. `createOutcome()` uses one token for multiple polling requests

**Confidence:** 95% that caching will work fine.

## If Tests Fail

Unlikely, but if you see failures:

1. **Check Canvas version:** Older Canvas versions may behave differently
2. **Check session timeout:** Make sure you're logged in
3. **Check permissions:** Make sure you have teacher/admin access
4. **Try different course:** Some courses may have special settings
5. **Check browser console for errors:** Look for CORS or network issues

## Next Steps After Testing

### If caching is safe (expected):
1. ✅ Update task list to implement simple caching
2. ✅ Design CanvasApiClient with constructor-level token caching
3. ✅ Remove all `getTokenCookie()` calls from service files
4. ✅ Proceed with Phase 2: Implementation

### If caching is unsafe (unlikely):
1. ⚠️ Update task list to include token refresh logic
2. ⚠️ Design CanvasApiClient with retry mechanism
3. ⚠️ Keep `getTokenCookie()` calls but centralize in client
4. ⚠️ Add error handling for 403/422 responses

## Time Investment

- **Running tests:** 5 minutes
- **Analyzing results:** 2 minutes
- **Total:** < 10 minutes

This small investment will save hours of debugging later if you make the wrong assumption about token caching.

## Questions?

If test results are unclear or unexpected, share the console output and we can analyze together.

