# All-Grades Page Cache Troubleshooting Guide

## Issue: Courses Not Rendering as Standards-Based Despite Correct Detection

### Symptoms

- Console logs show correct letter grades being extracted (e.g., "Approaching Target", "Target", "Developing")
- Detection logs show cache hits with inconsistent values
- Some courses cached as `true`, others as `false` even with valid letter grades
- Final display shows courses as traditional (percentage) instead of standards-based (points)

### Root Cause: Stale Cache

The detection cache (`sessionStorage`) may contain incorrect values from a previous page load when:
1. The course didn't have a letter grade configured
2. The course was detected before letter grade validation was implemented
3. The detection logic had a bug that was later fixed

### Solution: Clear the Detection Cache

#### Option 1: Clear All Detection Cache (Recommended)

```javascript
// In browser console on /grades page
window.CG_clearDetectionCache();
```

Then refresh the page.

#### Option 2: Clear Specific Course Cache

```javascript
// In browser console
window.CG_clearDetectionCache('547'); // Replace with your course ID
```

Then refresh the page.

#### Option 3: Manual Cache Clearing

```javascript
// In browser console
Object.keys(sessionStorage)
    .filter(k => k.startsWith('standardsBased_'))
    .forEach(k => sessionStorage.removeItem(k));
```

Then refresh the page.

---

## Debugging Workflow

### Step 1: Check Current Cache State

```javascript
// In browser console
window.CG_debugDetectionCache();
```

**Example Output**:
```javascript
{
  "538": "true",   // ✅ Correct
  "544": "true",   // ✅ Correct
  "547": "false",  // ❌ WRONG! Should be true
  "548": "true"    // ✅ Correct
}
```

### Step 2: Identify Problematic Courses

Look for courses with:
- Cache value = `"false"`
- But has a valid letter grade (e.g., "Target", "Developing")

### Step 3: Clear Cache and Refresh

```javascript
window.CG_clearDetectionCache();
```

Then refresh the page.

### Step 4: Verify Detection

After refresh, check the console logs:

```
[TRACE] [Detection] Starting detection for course 547 "Points Scheme"
[TRACE] [Detection] Input: letterGrade="Target", skipApiCheck=false
[TRACE] [Detection] Step 1 - Cache: MISS  ← Should be MISS after clearing
[TRACE] [Detection] Step 2 - Pattern match: NO
[TRACE] [Detection] Step 3 - Letter grade validation: letterGrade="Target"
[TRACE] [Detection] Step 3 - isValidLetterGrade("Target") = true
[DEBUG] [Detection] ✅ Course "Points Scheme" detected as standards-based (valid letter grade: "Target")
```

### Step 5: Verify Rendering

Check the table rendering logs:

```
[TRACE] [Hybrid] Detection result for "Points Scheme": isStandardsBased=true
[TRACE] [Hybrid] Standards-based course: Points Scheme, percentage=80.5%, points=3.22, letterGrade=Target (from API)
[TRACE] [Hybrid] Final values for "Points Scheme": displayScore=3.22, displayType=points, displayLetterGrade=Target
[TRACE] [Table] Points Scheme: Rendering as SBG (3.22 Target)
```

**Key values to check**:
- `isStandardsBased=true` ✅
- `displayType=points` ✅
- Rendering as SBG ✅

---

## Common Issues

### Issue 1: Cache Hit with Wrong Value

**Symptom**:
```
[TRACE] [Detection] Step 1 - Cache: HIT (false)
```

**Cause**: Course was cached as traditional on a previous page load

**Solution**: Clear cache and refresh

### Issue 2: Detection Succeeds but Rendering Fails

**Symptom**:
```
[DEBUG] [Detection] ✅ Course detected as standards-based
[TRACE] [Hybrid] Detection result: isStandardsBased=true
[TRACE] [Table] Rendering as traditional (80.50%)  ← WRONG!
```

**Cause**: `displayType` is not being set to `'points'`

**Debug**:
Check the final values log:
```
[TRACE] [Hybrid] Final values: displayScore=80.5, displayType=percentage, displayLetterGrade=null
```

If `displayType=percentage` but `isStandardsBased=true`, there's a logic error.

**Possible causes**:
- `percentage === null` (no grade available)
- Logic error in display value calculation

### Issue 3: Letter Grade is Null

**Symptom**:
```
[TRACE] [Hybrid] Course "BigClass" (538): percentage=64.25, letterGrade="null"
[TRACE] [Detection] Step 3 - No letter grade provided, skipping validation
```

**Cause**: Canvas API didn't return a letter grade

**Solutions**:
1. Check if course has a grading scheme configured in Canvas
2. Verify student has a letter grade assigned
3. Check if course uses a custom grading scheme

**Manual API Test**:
```javascript
fetch('/api/v1/users/self/enrollments?type[]=StudentEnrollment&state[]=active&include[]=total_scores', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
})
.then(r => r.json())
.then(data => {
    const course = data.find(e => e.course_id === 538); // Replace with your course ID
    console.log('Grades:', course.grades);
});
```

---

## Prevention

### Best Practices

1. **Clear cache after configuration changes**:
   - After updating `OUTCOME_AND_RUBRIC_RATINGS`
   - After changing course grading schemes
   - After fixing detection bugs

2. **Use debug functions regularly**:
   ```javascript
   // Check cache state
   window.CG_debugDetectionCache();
   
   // Clear if needed
   window.CG_clearDetectionCache();
   ```

3. **Monitor console logs**:
   - Enable TRACE logging for detailed debugging
   - Check for cache hits with unexpected values
   - Verify detection results match expectations

### Cache Invalidation Strategy

The cache is stored in `sessionStorage`, which means:
- ✅ Cleared when browser tab is closed
- ✅ Cleared when browser is restarted
- ❌ NOT cleared on page refresh
- ❌ NOT cleared when navigating within Canvas

**Recommendation**: Clear cache manually after:
- Updating configuration
- Fixing detection bugs
- Changing course settings in Canvas

---

## Debug Functions Reference

### `window.CG_debugDetectionCache()`

Shows all cached detection results.

**Returns**: Object mapping course IDs to cached values

**Example**:
```javascript
window.CG_debugDetectionCache();
// Output: { "538": "true", "547": "false", "548": "true" }
```

### `window.CG_clearDetectionCache(courseId)`

Clears detection cache for a specific course or all courses.

**Parameters**:
- `courseId` (optional): Course ID to clear, or omit to clear all

**Examples**:
```javascript
// Clear specific course
window.CG_clearDetectionCache('547');

// Clear all courses
window.CG_clearDetectionCache();
```

### `window.CG_testAllGradesDataSources()`

Runs comprehensive test comparing different data source approaches.

**Usage**:
```javascript
window.CG_testAllGradesDataSources();
```

---

## Expected Console Output (After Cache Clear)

```
[INFO] Applying all-grades page customizations...
[TRACE] [Hybrid] Step 1: Extracting course list from DOM...
[TRACE] [Hybrid] Found 4 courses in DOM
[TRACE] [Hybrid] Step 2: Fetching grade data from Enrollments API...
[TRACE] [Hybrid] Fetched 4 enrollments from API
[TRACE] [Hybrid] Course 547 from API: percentage=80.5%, letterGrade="Target"
[TRACE] [Hybrid] Step 3: Enriching courses with grades and detection...
[TRACE] [Hybrid] Course "Points Scheme" (547): percentage=80.5, letterGrade="Target"
[TRACE] [Detection] Starting detection for course 547 "Points Scheme"
[TRACE] [Detection] Input: letterGrade="Target", skipApiCheck=false
[TRACE] [Detection] Step 1 - Cache: MISS  ← No cache after clearing
[TRACE] [Detection] Step 2 - Pattern match: NO
[TRACE] [Detection] Step 3 - Letter grade validation: letterGrade="Target"
[TRACE] [Detection] Step 3 - isValidLetterGrade("Target") = true
[DEBUG] [Detection] ✅ Course "Points Scheme" detected as standards-based (valid letter grade: "Target")
[TRACE] [Hybrid] Detection result for "Points Scheme": isStandardsBased=true
[TRACE] [Hybrid] Standards-based course: Points Scheme, percentage=80.5%, points=3.22, letterGrade=Target (from API)
[TRACE] [Hybrid] Final values for "Points Scheme": displayScore=3.22, displayType=points, displayLetterGrade=Target
[TRACE] [Table] Points Scheme: Rendering as SBG (3.22 Target)
[TRACE] [Table] Points Scheme details: isStandardsBased=true, displayType=points, displayScore=3.22
[DEBUG] [Hybrid] Processed 4 courses: 4 standards-based, 0 traditional
[INFO] All-grades customization complete: 4 courses (4 SBG, 0 traditional)
```

**Key indicators of success**:
- ✅ Cache: MISS (not using stale cache)
- ✅ Detection: ✅ detected as standards-based
- ✅ displayType=points
- ✅ Rendering as SBG
- ✅ Final count: 4 SBG, 0 traditional

---

## Related Documentation

- `docs/ALL_GRADES_DETECTION_DEBUGGING.md` - Comprehensive debugging guide
- `docs/ALL_GRADES_ENHANCED_DEBUGGING.md` - Enhanced debugging implementation
- `docs/ALL_GRADES_DETECTION_FIX.md` - Detection fix documentation

