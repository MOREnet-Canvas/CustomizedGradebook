# All-Grades Page Debugging Guide

## Common Issues and Solutions

### Issue: All Grades Show "N/A"

**Symptoms**: All courses display "N/A" instead of grades

**Possible Causes**:

#### 1. Grade Data Not Being Fetched from API

**Check**:
```javascript
// Open browser console on /grades page
// Look for these log messages:
[Hybrid] Fetching grade data from Enrollments API...
[Hybrid] Fetched X enrollments from API
[Hybrid] Course XXX grade from API: XX.XX%
```

**If missing**: API call failed or returned no data

**Solution**: Test API manually:
```javascript
// Run in console
fetch('/api/v1/users/self/enrollments?type[]=StudentEnrollment&state[]=active&include[]=total_scores', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
})
.then(r => r.json())
.then(data => {
    console.log('Enrollments:', data);
    data.forEach(e => {
        console.log(`Course ${e.course_id}:`, e.grades);
    });
});
```

**Expected Output**:
```javascript
{
    course_id: 538,
    grades: {
        current_score: 64.25,
        final_score: 64.25,
        current_grade: "D",
        final_grade: "D"
    }
}
```

#### 2. DOM Extraction Failing

**Check**:
```javascript
// Look for these log messages:
[Hybrid] Found X course rows in DOM
[Hybrid] Course "Course Name": DOM grade text="XX.XX%", percentage=XX.XX
```

**If missing**: DOM selectors not matching Canvas structure

**Solution**: Inspect DOM manually:
```javascript
// Run in console
const table = document.querySelector('table.course_details.student_grades');
console.log('Table found:', !!table);

if (table) {
    const rows = table.querySelectorAll('tbody tr');
    console.log('Rows found:', rows.length);

    rows.forEach((row, i) => {
        const link = row.querySelector('a[href*="/courses/"]');
        const gradeCell = row.querySelector('.percent'); // Correct selector
        console.log(`Row ${i}:`, {
            courseName: link?.textContent.trim(),
            gradeText: gradeCell?.textContent.trim(),
            gradeCell: gradeCell?.outerHTML
        });
    });
}
```

**Expected**: Grade cells should have class `percent`:
```html
<td class="percent">64.25%</td>
```

#### 3. Percentage Extraction Regex Not Matching

**Check**:
```javascript
// Test regex pattern
const testGrades = [
    "85.50%",
    "85.5 %",
    "85%",
    "N/A",
    "--"
];

testGrades.forEach(text => {
    const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
    console.log(`"${text}" → ${match ? match[1] : 'NO MATCH'}`);
});
```

**Expected**: Should match percentage values

#### 4. Grade Data Structure Different

**Check**: Inspect actual enrollment response:
```javascript
// Run in console
fetch('/api/v1/users/self/enrollments?type[]=StudentEnrollment&state[]=active&include[]=total_scores', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
})
.then(r => r.json())
.then(data => {
    console.log('Full enrollment data:', JSON.stringify(data[0], null, 2));
});
```

**Look for**:
- `grades.current_score`
- `grades.final_score`
- `computed_current_score`
- `calculated_current_score`

---

## Debugging Steps

### Step 1: Enable Debug Logging

Add to URL: `?debug=true` or set in console:
```javascript
localStorage.setItem('CG_LOG_LEVEL', 'trace');
```

Then refresh the page.

### Step 2: Check Console Logs

Look for these key messages in order:

1. **Initialization**:
   ```
   [INFO] Initializing all-grades page customizer
   [TRACE] Injected CSS to hide original table
   ```

2. **DOM Extraction**:
   ```
   [DEBUG] [Hybrid] Step 1: Extracting course list from DOM...
   [DEBUG] [Hybrid] Found X course rows in DOM
   [TRACE] [Hybrid] Course "Course Name": DOM grade text="...", percentage=...
   [DEBUG] [Hybrid] Extracted X courses from DOM
   ```

3. **API Grade Fetch**:
   ```
   [DEBUG] [Hybrid] Step 2: Fetching grade data from Enrollments API...
   [DEBUG] [Hybrid] Fetched X enrollments from API
   [TRACE] [Hybrid] Course XXX grade from API: XX.XX%
   ```

4. **Enrichment**:
   ```
   [DEBUG] [Hybrid] Step 3: Enriching courses with grades and detection...
   [DEBUG] [Hybrid] Using API grade for "Course Name": XX.XX%
   [TRACE] [Hybrid] Course "Course Name": percentage=XX.XX, displayScore=XX.XX, type=...
   ```

5. **Completion**:
   ```
   [INFO] [Hybrid] Total processing time: XXXms
   [INFO] [Hybrid] Courses with grades: X, without grades: X
   [INFO] Replaced grades table with X courses
   ```

### Step 3: Identify Where It Fails

**If stops at Step 1**: DOM extraction issue
- Check table selector
- Check row selector
- Check grade cell selector

**If stops at Step 2**: API fetch issue
- Check network tab for failed requests
- Check API permissions
- Check enrollment data structure

**If stops at Step 3**: Enrichment issue
- Check percentage values
- Check conversion logic
- Check display score calculation

**If completes but shows N/A**: Display logic issue
- Check `displayScore` values in logs
- Check table rendering logic

---

## Manual Testing

### Test 1: Check Table Exists

```javascript
const table = document.querySelector('table.course_details.student_grades');
console.log('Table exists:', !!table);
console.log('Table HTML:', table?.outerHTML.substring(0, 500));
```

### Test 2: Check API Response

```javascript
const apiClient = new (await import('./utils/canvasApiClient.js')).CanvasApiClient();
const enrollments = await apiClient.get(
    '/api/v1/users/self/enrollments',
    {
        'type[]': 'StudentEnrollment',
        'state[]': 'active',
        'include[]': 'total_scores'
    },
    'testFetch'
);
console.log('Enrollments:', enrollments);
console.log('First course grades:', enrollments[0]?.grades);
```

### Test 3: Check Grade Extraction

```javascript
// Simulate the extraction logic
const table = document.querySelector('table.course_details.student_grades');
const rows = table.querySelectorAll('tbody tr');

Array.from(rows).forEach((row, i) => {
    const link = row.querySelector('a[href*="/courses/"]');
    const gradeCell = row.querySelector('.percent'); // Correct selector
    const gradeText = gradeCell?.textContent.trim() || '';
    const percentageMatch = gradeText.match(/(\d+(?:\.\d+)?)\s*%/);
    const percentage = percentageMatch ? parseFloat(percentageMatch[1]) : null;

    console.log(`Row ${i}:`, {
        courseName: link?.textContent.trim(),
        gradeText,
        percentage,
        cellHTML: gradeCell?.outerHTML
    });
});
```

**Expected output**:
```
Row 0: {
    courseName: "BigClass",
    gradeText: "64.25%",
    percentage: 64.25,
    cellHTML: '<td class="percent">64.25%</td>'
}
```

### Test 4: Check Conversion Logic

```javascript
// Test percentage to points conversion
function percentageToPoints(percentage) {
    const DEFAULT_MAX_POINTS = 4;
    return (percentage / 100) * DEFAULT_MAX_POINTS;
}

const testPercentages = [64.25, 85.5, 92.0, 50.0];
testPercentages.forEach(p => {
    const points = percentageToPoints(p);
    console.log(`${p}% → ${points.toFixed(2)} points`);
});
```

---

## Common Fixes

### Fix 1: Verify Grade Cell Selector

The correct selector for Canvas grade cells is `.percent`:
```javascript
// In extractCoursesFromDOM()
const gradeCell = row.querySelector('.percent'); // ✅ CORRECT
```

**Canvas HTML structure**:
```html
<table class="course_details student_grades">
    <tr>
        <td class="course">
            <a href="/courses/538/grades/642">BigClass</a>
        </td>
        <td class="percent">64.25%</td>  <!-- ✅ This is the grade cell -->
        <td style="display: none;">...</td>
        <td class="grading_period_dropdown"></td>
    </tr>
</table>
```

### Fix 2: Handle Different API Response Structure

If `grades.current_score` doesn't exist, try:
```javascript
// In fetchGradeDataFromAPI()
const percentage = grades.current_score 
    ?? grades.final_score
    ?? enrollment.computed_current_score
    ?? enrollment.calculated_current_score
    ?? null;
```

### Fix 3: Add Fallback for Missing Grades

```javascript
// In enrichCoursesWithAPI()
if (percentage === null) {
    logger.warn(`[Hybrid] No grade data for course ${courseName}`);
    // Could try individual course API call here as last resort
}
```

---

## Expected Behavior

### Successful Flow

1. ✅ Table found in DOM
2. ✅ Courses extracted from DOM (names and IDs)
3. ✅ Grades fetched from API (percentages)
4. ✅ Courses enriched with grades
5. ✅ Standards-based courses detected
6. ✅ Grades converted to points
7. ✅ Table rendered with correct values

### Console Output Example

```
[INFO] Initializing all-grades page customizer
[DEBUG] [Hybrid] Step 1: Extracting course list from DOM...
[DEBUG] [Hybrid] Found 5 course rows in DOM
[TRACE] [Hybrid] Course "Algebra I [SBG]": DOM grade text="64.25%", percentage=64.25
[TRACE] [Hybrid] Course "English 10": DOM grade text="85.50%", percentage=85.5
[DEBUG] [Hybrid] Extracted 5 courses from DOM
[DEBUG] [Hybrid] Step 2: Fetching grade data from Enrollments API...
[DEBUG] [Hybrid] Fetched 5 enrollments from API
[TRACE] [Hybrid] Course 538 grade from API: 64.25%
[TRACE] [Hybrid] Course 539 grade from API: 85.5%
[DEBUG] [Hybrid] Fetched grade data for 5 courses from API
[DEBUG] [Hybrid] Step 3: Enriching courses with grades and detection...
[DEBUG] [Course Detection] Course "Algebra I [SBG]" matches standards-based pattern
[TRACE] [Hybrid] Course Algebra I [SBG]: percentage=64.25, displayScore=2.57, type=points
[TRACE] [Hybrid] Course English 10: percentage=85.5, displayScore=85.5, type=percentage
[INFO] [Hybrid] Enriched 5 courses in 150.25ms
[INFO] [Hybrid] Total processing time: 310.50ms
[INFO] [Hybrid] Courses with grades: 5, without grades: 0
[INFO] Replaced grades table with 5 courses
```

---

## Getting Help

If you're still seeing "N/A" for all grades:

1. **Capture console logs** with debug enabled
2. **Run manual tests** above and capture output
3. **Check network tab** for failed API requests
4. **Inspect DOM** to verify table structure
5. **Report findings** with all captured data

