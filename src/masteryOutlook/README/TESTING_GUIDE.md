# Outcomes Dashboard Testing Guide

Quick reference for testing the Outcomes Dashboard module.

---

## Phase 1: Canvas Files API Test (START HERE)

### Goal
Validate that Canvas Files API works in your beta environment before building the full module.

### Test Files Location
`tests/outcomesCacheFileTest.console.js` ← **Use this one first**

### Quick Start

1. **Open Canvas beta course** (any page with `/courses/{id}/` in URL)
2. **Open browser console** (`F12`)
3. **Copy-paste entire contents** of `outcomesCacheFileTest.console.js`
4. **Press Enter**
5. **Watch for green checkmarks** ✓

### Expected Results
```
✓ Folder created (id: 67890)
✓ File uploaded and confirmed (initial write) — file id: 11111
✓ File read back successfully
✓ Contents verified — computedBy matches
✓ File uploaded and confirmed (overwrite) — file id: 11111
✓ Overwrite verified — computedBy reflects new value
✅ All file tests complete!
```

### If Tests Fail
- See `tests/README_OutcomesCacheTests.md` for troubleshooting
- Common issues:
  - Not logged in → refresh and retry
  - Student account → need teacher/admin role
  - CORS errors → Files API may not be enabled

---

## Phase 2: Unpublished Page Test

### Goal
Verify teachers can access unpublished Canvas pages (students cannot).

### Steps

1. **Create test page manually in Canvas**
   - Go to Pages in your test course
   - Create new page:
     - Title: "Outcomes Dashboard Test"
     - URL: `outcomes-dashboard-test`
     - Body: `<div id="test-root">Page loaded successfully!</div>`
     - **Leave unpublished** ❌ Do not publish

2. **Test teacher access**
   - Navigate to: `/courses/{id}/pages/outcomes-dashboard-test`
   - **Expected:** Page loads, you see "Page loaded successfully!"
   - **If fails:** Check URL, verify you're logged in as teacher

3. **Test student access (optional)**
   - Use Student View or actual student account
   - Navigate to same URL
   - **Expected:** 404 error or "Unauthorized"

4. **Verify with JavaScript**
   ```javascript
   // In console on the unpublished page:
   console.log(document.querySelector('#test-root'));
   // Should log the div element
   ```

### Expected Results
- ✅ Teachers/admins can view unpublished page
- ✅ Students cannot view unpublished page (404)
- ✅ Page content loads correctly
- ✅ JavaScript can access DOM elements

---

## Phase 3: Integration Testing (After Modules Built)

### Pre-requisites
- ✅ Phase 1 complete (Files API working)
- ✅ Phase 2 complete (Unpublished pages working)
- ✅ All modules implemented

### Test Checklist

#### 1. Page Creation
```
□ Navigate to Course Settings
□ See "Create Outcomes Dashboard" button in sidebar
□ Click button
□ Verify success message
□ Check Pages - see "Outcomes Dashboard" page created
□ Check front page - see "View Outcomes Dashboard" button
```

#### 2. Dashboard Load (Empty State)
```
□ Navigate to /courses/{id}/pages/outcomes-dashboard
□ See dashboard container
□ See "No data yet" message
□ See "Refresh Data" button
□ No errors in console
```

#### 3. Data Refresh
```
□ Click "Refresh Data" button
□ See progress messages:
   - "Fetching outcome data..."
   - "Computing Power Law predictions..."
   - "Saving cache..."
   - "Rendering dashboard..."
□ Dashboard renders with outcome rows
□ Check Canvas Files - verify outcomes_cache.json exists
□ No errors in console
```

#### 4. Dashboard Display (Loaded State)
```
□ Outcome rows appear
□ Click outcome row - expands to show students
□ Student names appear (not just user IDs)
□ PL predictions shown for students with 3+ attempts
□ "NE" badges shown for students with <3 attempts
□ Class stats accurate (average, distribution)
□ Threshold slider works
```

#### 5. Threshold Persistence
```
□ Adjust threshold slider to 2.5
□ Refresh page (F5)
□ Threshold still at 2.5 (persisted in localStorage)
□ Switch to different browser/account
□ Threshold resets to default (per-user storage)
```

#### 6. Intervention Sidebar
```
□ Sidebar shows students below threshold
□ "Re-teach" panel shows outcomes below threshold
□ Counts are accurate
□ Clicking student/outcome navigates or highlights
```

#### 7. Error Handling
```
□ Simulate network failure (offline mode)
□ Click Refresh - see error message
□ Error message is clear and helpful
□ "Retry" option available
□ No silent fallback to localStorage
```

---

## Testing Script for Phase 3

Copy-paste into console on dashboard page after full implementation:

```javascript
// Test cache read/write
async function testCachePipeline() {
    const { readOutcomesCache, writeOutcomesCache } = await import('./src/outcomesDashboard/outcomesCacheService.js');
    const { CanvasApiClient } = await import('./src/utils/canvasApiClient.js');
    const { getCourseId } = await import('./src/utils/canvas.js');
    
    const apiClient = new CanvasApiClient();
    const courseId = getCourseId();
    
    console.log('📖 Reading cache...');
    const cache = await readOutcomesCache(courseId, apiClient);
    console.log('Cache data:', cache);
    
    if (cache) {
        console.log('✅ Cache read successful');
        console.log('  Students:', cache.meta.studentCount);
        console.log('  Outcomes:', cache.meta.outcomeCount);
        console.log('  Computed:', cache.meta.computedAt);
    } else {
        console.log('⚠️ No cache found - run refresh first');
    }
}

testCachePipeline();
```

---

## Performance Benchmarks

Track these metrics during testing:

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Folder check | <500ms | Cached after first check |
| File upload (3-step) | 2-5s | Depends on file size, network |
| File read | 1-2s | S3 download |
| Outcome rollups fetch | 5-15s | Depends on student count |
| Power Law computation | <1s | Pure JavaScript, fast |
| Full refresh (30 students, 12 outcomes) | 10-20s | Network-bound |

---

## Known Issues / Expected Behavior

### ✅ Expected
- First page load shows empty state (no cache yet)
- Refresh takes 10-20 seconds for typical course
- Students with <3 attempts show "NE" status
- Threshold slider updates immediately (no save button needed)
- Cache file is hidden from students in Files UI

### ⚠️ Known Limitations
- No real-time updates - manual refresh only
- Large courses (100+ students) may take 30-60s to refresh
- Power Law requires minimum 3 data points
- No CSV export (Phase 2 feature)
- No historical tracking (Phase 2 feature)

---

## Logging & Debugging

### Enable trace logging
```javascript
// In console:
logger.setLevel('trace');

// Then run operations - you'll see detailed logs
```

### Check cache schema
```javascript
// In console after refresh:
const cache = await readOutcomesCache(courseId, apiClient);
console.log('Schema version:', cache.meta.schemaVersion);
console.log('First outcome:', cache.outcomes[0]);
console.log('First student:', cache.outcomes[0].students[0]);
```

### Verify localStorage threshold
```javascript
const courseId = getCourseId();
const userId = ENV.current_user_id;
const key = `cg_threshold_${courseId}_${userId}`;
console.log('Stored threshold:', localStorage.getItem(key));
```

---

## Test Sign-off Checklist

Before considering module complete:

```
□ Phase 1: Files API test passes
□ Phase 2: Unpublished page test passes
□ Phase 3: All integration tests pass
□ No console errors during normal operation
□ Performance within expected ranges
□ Error messages are clear and helpful
□ Data persists correctly in Canvas Files
□ Threshold persists correctly in localStorage
□ Student names resolve correctly (no user IDs shown)
□ Power Law calculations verified manually (spot check)
□ Module works in both published and unpublished page modes
□ Permission check blocks students correctly
□ Documentation updated (README.md)
```

---

## Next Steps After Testing

1. ✅ All tests pass → Module ready for beta deployment
2. 🚀 Deploy to beta environment
3. 👥 Teacher user acceptance testing
4. 📊 Collect feedback
5. 🔧 Iterate based on feedback
6. ✅ Production deployment

---

**For detailed test procedures, see:**
- `tests/README_OutcomesCacheTests.md` - Files API tests
- `src/outcomesDashboard/README.md` - Full module documentation
