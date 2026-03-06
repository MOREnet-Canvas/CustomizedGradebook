# TODO: Fix All-Grades Page Double Processing

## Issue

The all-grades page customizer is sometimes executing twice, causing duplicate snapshot population and unnecessary processing.

## Symptoms

**Console logs show duplicate processing:**
```
[INFO] Applying all-grades page customizations...
[INFO] [All-Grades] Found 8 active student courses...
[DEBUG] [Refresh] Refreshing snapshot for course 571...
[DEBUG] [Snapshot] Populating snapshot for course 571...
...
[INFO] [All-Grades] Found 8 active student courses...  ← DUPLICATE!
[DEBUG] [Refresh] Refreshing snapshot for course 571...  ← DUPLICATE!
[DEBUG] [Snapshot] Populating snapshot for course 571...  ← DUPLICATE!
```

**Behavior:**
- Appears to be random/timing-dependent
- More likely to occur when browser DevTools console is open
- Both runs complete and write snapshots
- Results in duplicate work but not duplicate API calls (due to caching)

## Root Cause

The `initAllGradesPageCustomizer()` function calls `applyCustomizations()` twice:

1. **Immediate call** on initialization
2. **Observer-triggered call** when the grades table is detected in the DOM

**Code location:** `src/student/allGradesPageCustomizer.js:388-408`

```javascript
export function initAllGradesPageCustomizer() {
    logger.debug('Initializing all-grades page customizer');
    
    // Try immediately
    applyCustomizations();  // ← FIRST RUN
    
    // Also observe for lazy-loaded content
    createPersistentObserver(() => {
        const table = document.querySelector('table.course_details.student_grades');
        if (table && !table.dataset.customized && !processed) {
            logger.debug('Grades table detected, applying customizations...');
            applyCustomizations();  // ← SECOND RUN (observer triggers)
        }
    }, {
        config: OBSERVER_CONFIGS.CHILD_LIST,
        target: document.body,
        name: 'AllGradesPageCustomizer'
    });
}
```

### Race Condition

The `processed` flag is intended to prevent duplicate execution, but it doesn't work when:
1. First run starts, sets `processed = true` at the beginning of `applyCustomizations()`
2. Observer triggers **before** first run completes
3. Observer checks `processed` flag - but the check happens **before** the flag is set
4. Both runs proceed simultaneously

**The issue:** The flag is checked in the observer callback, but set inside `applyCustomizations()`. If both calls happen nearly simultaneously, both see `processed = false`.

## Impact

**Current impact (with Q1/Q2 caching):**
- ⚠️ Duplicate processing work (CPU/memory waste)
- ⚠️ Duplicate snapshot writes (last one wins)
- ✅ **No duplicate API calls** (caching prevents this)
- ⚠️ Confusing debug logs

**Previous impact (before Q1/Q2 caching):**
- ❌ Duplicate API calls for course detection
- ❌ Duplicate API calls for grade fetching
- ❌ Significant performance impact

## Proposed Solutions

### Option A: Set Flag Before Async Work
Move the `processed = true` assignment to the very beginning of `applyCustomizations()`, before any async work:

```javascript
async function applyCustomizations() {
    // Prevent duplicate processing
    if (processed) {
        logger.trace('[All-Grades] Already processed, skipping');
        return;
    }
    processed = true;  // ← Set IMMEDIATELY, before any async work
    
    logger.info('Applying all-grades page customizations...');
    // ... rest of function
}
```

### Option B: Disconnect Observer After First Success
Modify the observer to disconnect after the first successful run:

```javascript
const observer = createPersistentObserver(() => {
    const table = document.querySelector('table.course_details.student_grades');
    if (table && !table.dataset.customized && !processed) {
        logger.debug('Grades table detected, applying customizations...');
        applyCustomizations();
        return true;  // ← Signal to disconnect observer
    }
    return false;
}, ...);
```

### Option C: Use Conditional Observer Instead
Replace `createPersistentObserver` with `createConditionalObserver` which automatically disconnects on success:

```javascript
// Try immediately
const didRun = await applyCustomizations();

// If content is lazy-loaded, observe and retry
if (!didRun) {
    createConditionalObserver(async () => {
        const success = await applyCustomizations();
        return success; // Disconnect when successful
    }, {
        timeout: 30000,
        config: OBSERVER_CONFIGS.CHILD_LIST,
        target: document.body,
        name: 'AllGradesPageCustomizer'
    });
}
```

## Recommendation

**Option A** is the simplest and most robust:
- Minimal code change
- Prevents race condition at the source
- Consistent with other customizers
- No changes to observer logic needed

## Testing

After implementing the fix:

1. **Test with DevTools closed:**
   - Refresh page multiple times
   - Verify only one `[INFO] Applying all-grades page customizations...` message

2. **Test with DevTools console open:**
   - Refresh page multiple times
   - Verify only one processing run

3. **Test with slow network:**
   - Throttle network to "Slow 3G"
   - Verify observer doesn't trigger duplicate processing

4. **Check for regressions:**
   - Verify table still gets customized on lazy-loaded content
   - Verify no errors in console

## Related Files

- `src/student/allGradesPageCustomizer.js` - Main file to modify
- `src/utils/observerHelpers.js` - Observer utility functions
- `src/student/gradePageCustomizer.js` - Similar pattern (uses conditional observer)

## Priority

**Medium** - Not critical since Q1/Q2 caching prevents duplicate API calls, but should be fixed for code quality and performance.

## Status

**Open** - Identified 2026-03-06, needs implementation.

