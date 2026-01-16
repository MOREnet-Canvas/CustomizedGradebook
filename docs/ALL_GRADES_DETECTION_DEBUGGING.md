# All-Grades Page Detection Debugging Guide

## Enhanced Debugging Features

The all-grades page now includes comprehensive debugging to help identify why a course is or isn't being detected as standards-based.

---

## Enable Debug Logging

```javascript
// In browser console on /grades page
localStorage.setItem('CG_LOG_LEVEL', 'trace');
```

Then refresh the page.

---

## What to Look For

### 1. Course Data Extraction

Look for these logs for each course:

```
[TRACE] [Hybrid] Course "BigClass" (538): percentage=64.25, letterGrade="Developing"
```

**Check**:
- ✅ `percentage` should be a number (e.g., `64.25`)
- ✅ `letterGrade` should be a string (e.g., `"Developing"`) or `"null"`
- ❌ If letterGrade is `"null"`, the course won't be detected via letter grade validation

### 2. Detection Process

For each course, you'll see detailed detection steps:

```
[TRACE] [Detection] Starting detection for course 538 "BigClass"
[TRACE] [Detection] Input: letterGrade="Developing", skipApiCheck=false
[TRACE] [Detection] Step 1 - Cache: MISS
[TRACE] [Detection] Step 2 - Pattern match: NO
[TRACE] [Detection] Step 3 - Letter grade validation: letterGrade="Developing"
[TRACE] [Detection] Step 3 - isValidLetterGrade("Developing") = true
[DEBUG] [Detection] ✅ Course "BigClass" detected as standards-based (valid letter grade: "Developing")
```

**Detection Steps**:
1. **Cache**: Check if result is cached
2. **Pattern**: Check if course name matches `STANDARDS_BASED_COURSE_PATTERNS`
3. **Letter Grade**: Check if letter grade matches `OUTCOME_AND_RUBRIC_RATINGS`
4. **AVG Assignment**: Check if course has "Current Score Assignment"

**Expected for problematic course**:
- Step 1: MISS (not cached yet)
- Step 2: NO (doesn't match pattern)
- Step 3: Should be **YES** if letter grade is valid
- Step 4: Should not be reached if Step 3 succeeds

### 3. Letter Grade Validation

If Step 3 fails, you'll see:

```
[TRACE] [Detection] Step 3 - Letter grade "B" does NOT match any rating. Available: Exemplary, Beyond Target, Target, Approaching Target, Developing, Beginning, Needs Partial Support, Needs Full Support, No Evidence
```

**This tells you**:
- The exact letter grade being checked
- All available rating descriptions
- Why it failed (letter grade doesn't match any rating)

### 4. Final Result

```
[DEBUG] [Hybrid] Processed 4 courses: 3 standards-based, 1 traditional
[DEBUG] [Hybrid] Grade sources: 4 from DOM, 0 from API
```

**Check**:
- Number of standards-based vs traditional courses
- If a course should be SBG but isn't, check the detection logs above

### 5. Course Breakdown (TRACE level)

```
[TRACE] [Hybrid] Course breakdown:
[TRACE]   [SBG] Algebra I [SBG]: 3.21 (Target)
[TRACE]   [SBG] BigClass: 2.57 (Developing)
[TRACE]   [SBG] Science 101: 2.85 (Approaching Target)
[TRACE]   [TRAD] English 10: 85.50%
```

**Check**:
- Each course's type (SBG or TRAD)
- Display value (points with letter grade for SBG, percentage for TRAD)
- If a course is marked TRAD but should be SBG, trace back to its detection logs

---

## Common Issues

### Issue 1: Letter Grade is `null`

**Symptom**:
```
[TRACE] [Hybrid] Course "BigClass" (538): percentage=64.25, letterGrade="null"
[TRACE] [Detection] Step 3 - No letter grade provided, skipping validation
```

**Cause**: Canvas API didn't return a letter grade for this course

**Solutions**:
1. Check if the course has a grading scheme configured in Canvas
2. Check if the student has a letter grade assigned
3. Verify the API response includes `grades.current_grade` or `grades.final_grade`

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

**Expected**:
```javascript
{
    current_score: 64.25,
    final_score: 64.25,
    current_grade: "Developing",  // ← Should be present
    final_grade: "Developing"
}
```

### Issue 2: Letter Grade Doesn't Match Rating Scale

**Symptom**:
```
[TRACE] [Detection] Step 3 - isValidLetterGrade("B") = false
[TRACE] [Detection] Step 3 - Letter grade "B" does NOT match any rating. Available: Exemplary, Beyond Target, Target, ...
```

**Cause**: The letter grade from Canvas doesn't match any description in `OUTCOME_AND_RUBRIC_RATINGS`

**Solutions**:
1. Check if the letter grade is spelled correctly (case-insensitive match)
2. Verify `OUTCOME_AND_RUBRIC_RATINGS` includes this letter grade
3. Check for extra whitespace (now trimmed automatically)

**Check Configuration**:
```javascript
// In console
console.log('Rating descriptions:', window.CG_CONFIG.OUTCOME_AND_RUBRIC_RATINGS.map(r => r.description));
```

**Expected**:
```javascript
["Exemplary", "Beyond Target", "Target", "Approaching Target", "Developing", "Beginning", "Needs Partial Support", "Needs Full Support", "No Evidence"]
```

### Issue 3: Cache Hit with Wrong Value

**Symptom**:
```
[TRACE] [Detection] Step 1 - Cache: HIT (false)
```

**Cause**: Course was previously detected as traditional and cached

**Solution**: Clear the cache
```javascript
// Clear cache for specific course
sessionStorage.removeItem('standardsBased_538'); // Replace with your course ID

// Or clear all detection cache
Object.keys(sessionStorage)
    .filter(k => k.startsWith('standardsBased_'))
    .forEach(k => sessionStorage.removeItem(k));
```

Then refresh the page.

### Issue 4: "Course ID not found on page" Error

**Symptom**:
```
[ERROR] Course ID not found on page.
```

**Cause**: Some code is calling `getCourseId()` which expects a course-specific page (e.g., `/courses/123/grades`), but the all-grades page is at `/grades`

**This is expected**: The all-grades page doesn't have a course ID in the URL. This error can be ignored if it's not affecting functionality.

**To investigate**: Check the stack trace to see where it's being called from.

---

## Debugging Workflow

### Step 1: Identify the Problematic Course

1. Enable TRACE logging
2. Refresh `/grades` page
3. Look for the course in the breakdown:
   ```
   [TRACE]   [TRAD] BigClass: 64.25%  ← Should be SBG!
   ```

### Step 2: Find Its Detection Logs

Search console for:
```
[Detection] Starting detection for course 538 "BigClass"
```

### Step 3: Analyze Each Detection Step

Check each step:
- **Step 1 (Cache)**: Should be MISS on first load
- **Step 2 (Pattern)**: Check if course name should match a pattern
- **Step 3 (Letter Grade)**: **KEY STEP** - Check if letter grade is valid
- **Step 4 (AVG Assignment)**: Only reached if Steps 2-3 fail

### Step 4: Identify the Failure Point

**If Step 3 shows**:
```
[TRACE] [Detection] Step 3 - No letter grade provided, skipping validation
```
→ **Issue**: Letter grade is null (see Issue 1 above)

**If Step 3 shows**:
```
[TRACE] [Detection] Step 3 - isValidLetterGrade("B") = false
```
→ **Issue**: Letter grade doesn't match rating scale (see Issue 2 above)

**If Step 3 shows**:
```
[TRACE] [Detection] Step 3 - isValidLetterGrade("Developing") = true
[DEBUG] [Detection] ✅ Course "BigClass" detected as standards-based
```
→ **Success**: Course should be detected correctly

### Step 5: Verify Final Display

Check the course breakdown:
```
[TRACE]   [SBG] BigClass: 2.57 (Developing)  ← Should show this
```

If it still shows as TRAD, there may be a display logic issue.

---

## Logging Levels

### INFO
- High-level summary (e.g., "All-grades customization complete: 4 courses")

### DEBUG
- Detection results (e.g., "✅ Course detected as standards-based")
- Processing summary (e.g., "Processed 4 courses: 3 SBG, 1 traditional")

### TRACE
- Detailed step-by-step information
- Each detection step with results
- Course data extraction
- Performance timing
- Course breakdown

**Recommendation**: Use TRACE for debugging, DEBUG for normal operation.

---

## Expected Console Output (TRACE Level)

```
[INFO] Applying all-grades page customizations...
[TRACE] [Hybrid] Step 1: Extracting course list from DOM...
[TRACE] [Hybrid] Found 4 course rows in DOM
[TRACE] [Hybrid] Course "BigClass": DOM grade text="64.25%", percentage=64.25
[TRACE] [Hybrid] Extracted 4 courses from DOM
[TRACE] [Hybrid] Step 2: Fetching grade data from Enrollments API...
[TRACE] [Hybrid] Fetched 4 enrollments from API
[TRACE] [Hybrid] Course 538 from API: percentage=64.25%, letterGrade="Developing"
[TRACE] [Hybrid] Step 3: Enriching courses with grades and detection...
[TRACE] [Hybrid] Course "BigClass" (538): percentage=64.25, letterGrade="Developing"
[TRACE] [Detection] Starting detection for course 538 "BigClass"
[TRACE] [Detection] Input: letterGrade="Developing", skipApiCheck=false
[TRACE] [Detection] Step 1 - Cache: MISS
[TRACE] [Detection] Step 2 - Pattern match: NO
[TRACE] [Detection] Step 3 - Letter grade validation: letterGrade="Developing"
[TRACE] [Detection] Step 3 - isValidLetterGrade("Developing") = true
[DEBUG] [Detection] ✅ Course "BigClass" detected as standards-based (valid letter grade: "Developing")
[TRACE] [Hybrid] Standards-based course: BigClass, percentage=64.25%, points=2.57, letterGrade=Developing (from API)
[TRACE] [Hybrid] Course BigClass: percentage=64.25, displayScore=2.57, type=points, source=DOM
[TRACE] [Hybrid] Enriched 4 courses in 150.25ms
[TRACE] [Hybrid] Total processing time: 332.00ms
[DEBUG] [Hybrid] Processed 4 courses: 3 standards-based, 1 traditional
[DEBUG] [Hybrid] Grade sources: 4 from DOM, 0 from API
[TRACE] [Hybrid] Course breakdown:
[TRACE]   [SBG] BigClass: 2.57 (Developing)
[TRACE]   [TRAD] English 10: 85.50%
[INFO] All-grades customization complete: 4 courses (3 SBG, 1 traditional)
```

---

## Getting Help

If you're still experiencing detection issues after following this guide:

1. **Capture full console output** with TRACE logging enabled
2. **Run manual API test** (see Issue 1 above) and capture output
3. **Identify the specific course** that's not being detected correctly
4. **Find its detection logs** in the console output
5. **Report findings** with all captured data

