# Dashboard Grade Display - Debugging Guide

## Common Issues and Solutions

### Issue 1: "Timeout waiting for dashboard cards"

**Symptoms:**
- Console shows: `Timeout waiting for dashboard cards`
- Console shows: `Dashboard cards not found, grade display may not work`

**Diagnosis:**
Run the diagnostic function in browser console:
```javascript
window.CG.diagnosticDashboard()
```

This will show:
- Which CSS selectors are being tried
- How many elements each selector finds
- Course links found on the page
- DOM structure of dashboard elements

**Common Causes:**

1. **Wrong page**: Not actually on the dashboard
   - Check URL is `/` or `/dashboard`
   - Some Canvas instances use different dashboard URLs

2. **Canvas uses different card structure**: Canvas versions vary
   - Check diagnostic output for which selectors work
   - Look at the DOM structure in browser DevTools

3. **Dashboard loads slowly**: Cards not yet rendered
   - Check if cards appear after the 5-second timeout
   - May need to increase timeout in `waitForDashboardCards()`

**Solutions:**

1. **Verify you're on the dashboard page:**
   ```javascript
   console.log(window.location.pathname);
   // Should be "/" or start with "/dashboard"
   ```

2. **Manually check for dashboard cards:**
   ```javascript
   // Try each selector manually
   document.querySelectorAll('.ic-DashboardCard');
   document.querySelectorAll('[class*="DashboardCard"]');
   document.querySelectorAll('a[href*="/courses/"]');
   ```

3. **Inspect the DOM:**
   - Open DevTools (F12)
   - Look for course cards in the Elements tab
   - Note the class names and structure
   - Add new selectors to `getDashboardCardSelectors()` if needed

---

### Issue 2: "Found 0 active student courses"

**Symptoms:**
- Console shows: `Found 0 active student courses out of X total courses`
- Or: `Found 0 active student courses`

**Diagnosis:**
Check the raw API response:
```javascript
// In browser console
const apiClient = new (await import('./utils/canvasApiClient.js')).CanvasApiClient();
const courses = await apiClient.get('/api/v1/courses?enrollment_state=active&include[]=total_scores');
console.log('Courses:', courses);
console.log('First course:', courses[0]);
console.log('First course enrollments:', courses[0]?.enrollments);
```

**Common Causes:**

1. **Enrollments not included in response**
   - API might not return enrollments array
   - Need to verify `include[]=total_scores` works

2. **Enrollment type mismatch**
   - Canvas might use "student" instead of "StudentEnrollment"
   - Or use a different field like `role`

3. **User has no active enrollments**
   - Test user might not be enrolled in any courses
   - Or enrollments are not in "active" state

**Solutions:**

1. **Check enrollment structure:**
   ```javascript
   // After fetching courses
   courses.forEach(c => {
       console.log(`Course ${c.id}:`, c.name);
       console.log('  Enrollments:', c.enrollments);
       if (c.enrollments) {
           c.enrollments.forEach(e => {
               console.log('    Type:', e.type, 'Role:', e.role);
           });
       }
   });
   ```

2. **Verify the API includes enrollments:**
   - The code now checks for both `type === 'student'` and `type === 'StudentEnrollment'`
   - Also checks `role === 'StudentEnrollment'`
   - If Canvas uses a different field, update `fetchActiveCourses()`

3. **Test with a different user:**
   - Make sure test user is actually enrolled as a student
   - Check enrollment state is "active"

---

### Issue 3: Grades not displaying on cards

**Symptoms:**
- Cards are found
- Courses are fetched
- But no grade badges appear

**Diagnosis:**

1. **Check if grades are being fetched:**
   ```javascript
   // Enable debug logging
   // Add ?debug=true to URL, then reload
   ```

2. **Check console for grade fetch errors:**
   - Look for warnings about AVG assignment not found
   - Look for enrollment score fetch failures

3. **Manually test grade fetching:**
   ```javascript
   const apiClient = new (await import('./utils/canvasApiClient.js')).CanvasApiClient();
   const courseId = 'YOUR_COURSE_ID'; // Replace with actual ID
   
   // Test AVG assignment fetch
   const assignments = await apiClient.get(
       `/api/v1/courses/${courseId}/assignments?search_term=Current Score Assignment`
   );
   console.log('AVG assignments:', assignments);
   
   // Test enrollment score fetch
   const enrollments = await apiClient.get(
       `/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment&include[]=total_scores`
   );
   console.log('Enrollments:', enrollments);
   ```

**Common Causes:**

1. **No grades available**
   - Course has no AVG assignment
   - Course has no enrollment scores
   - Both fallbacks failed

2. **Card element not found**
   - `findCourseCard()` can't locate the card for the course
   - Card structure doesn't match expected patterns

3. **DOM insertion failing**
   - Grade badge created but can't find container
   - Container selector in `findGradeContainer()` doesn't match

**Solutions:**

1. **Verify at least one grade source exists:**
   - Check if course has "Current Score Assignment"
   - Or check if enrollment has computed_current_score

2. **Test card finding manually:**
   ```javascript
   const courseId = 'YOUR_COURSE_ID';
   const card = document.querySelector(`a[href*="/courses/${courseId}"]`)?.closest('.ic-DashboardCard');
   console.log('Found card:', card);
   ```

3. **Check grade badge insertion:**
   - Look for elements with class `cg-dashboard-grade`
   - Check if they're being created but not visible (CSS issue)

---

## Debug Logging Levels

Enable different logging levels via URL parameters:

- **Normal**: No parameter (INFO, WARN, ERROR only)
- **Debug**: `?debug=true` (includes DEBUG messages)
- **Trace**: `?debug=trace` (includes TRACE messages - very verbose)

Example:
```
https://canvas.example.com/?debug=true
```

---

## Useful Console Commands

### Check initialization status
```javascript
console.log(window.CG);
```

### Run diagnostic
```javascript
window.CG.diagnosticDashboard();
```

### Manually trigger grade update
```javascript
// This will be available after implementation
// window.CG.refreshDashboardGrades();
```

### Check for grade badges
```javascript
document.querySelectorAll('.cg-dashboard-grade');
```

### Inspect first dashboard card
```javascript
const cards = document.querySelectorAll('.ic-DashboardCard');
console.log('First card:', cards[0]);
console.log('Card classes:', cards[0]?.className);
console.log('Card attributes:', Array.from(cards[0]?.attributes || []));
```

---

## Reporting Issues

When reporting issues, please include:

1. **Console output** with `?debug=true` enabled
2. **Output of** `window.CG.diagnosticDashboard()`
3. **Canvas version** (if known)
4. **Browser and version**
5. **URL structure** (e.g., `/` vs `/dashboard` vs other)
6. **Sample course data** from API (if possible)

---

## Advanced Debugging

### Modify selectors at runtime

If you find a selector that works, you can test it:

```javascript
// Test a new selector
const newSelector = '.your-new-selector';
const cards = document.querySelectorAll(newSelector);
console.log(`Found ${cards.length} cards with ${newSelector}`);
```

Then update `getDashboardCardSelectors()` in `src/dashboard/gradeDisplay.js` to include it.

### Monitor MutationObserver

```javascript
// Check if observer is running
console.log('Observer active:', window.CG.observerActive);
```

### Force re-initialization

```javascript
// Not recommended, but useful for testing
// Will be available after adding to window.CG
// window.CG.reinitDashboard();
```

