# Testing the Single Source of Truth Refactoring

## Pre-Test Setup

1. **Clear session storage** to force fresh snapshots:
   ```javascript
   // In browser console
   window.CG_clearAllSnapshots()
   ```

2. **Open browser console** to see logging output

3. **Have both a standards-based and traditional course** in your Canvas account

## Test 1: Dashboard Grade Display

### Steps:
1. Navigate to Canvas dashboard
2. Wait for grades to load
3. Observe grade badges on course cards

### Expected Results:
- **Standards-based courses**: Show points format (e.g., "2.74 (Developing)")
- **Traditional courses**: Show percentage format (e.g., "85.00% (B)")
- **Console logs**: Should show `[Snapshot] Display values: displayScore=X, displayType=Y`

### Verify in Console:
```javascript
// Check a specific course snapshot
const snapshot = window.CG_getCourseSnapshot('YOUR_COURSE_ID');
console.log('Display values:', {
  displayScore: snapshot.displayScore,
  displayLetterGrade: snapshot.displayLetterGrade,
  displayType: snapshot.displayType
});
```

## Test 2: All-Grades Page Display

### Steps:
1. Navigate to `/grades` (all-grades page)
2. Wait for table to load
3. Observe grades in the table

### Expected Results:
- **Standards-based courses**: Show points format (e.g., "2.74 Developing")
- **Traditional courses**: Show percentage format (e.g., "85.00%")
- **Same grades as dashboard**: Verify identical values

### Verify Consistency:
```javascript
// Compare dashboard and all-grades display
const courseId = 'YOUR_COURSE_ID';
const snapshot = window.CG_getCourseSnapshot(courseId);

console.log('Snapshot display values:', {
  score: snapshot.displayScore,
  letterGrade: snapshot.displayLetterGrade,
  type: snapshot.displayType
});

// Check what's shown on the page
const gradeCell = document.querySelector(`tr[data-course-id="${courseId}"] .grade-cell`);
console.log('Page display:', gradeCell?.textContent);
```

## Test 3: Grade Page Display

### Steps:
1. Navigate to a standards-based course's grades page (`/courses/XXX/grades`)
2. Observe the final grade display

### Expected Results:
- **Standards-based courses**: Show mastery score (e.g., "2.74 (Developing)")
- **Traditional courses**: No customization applied
- **Console logs**: Should show `Using display grade data from snapshot`

## Test 4: Session Storage Caching

### Steps:
1. Clear session storage: `window.CG_clearAllSnapshots()`
2. Navigate to dashboard
3. Check console for `[Snapshot] Populated snapshot` messages
4. Refresh the page
5. Check console for `[Snapshot] Cache HIT` messages

### Expected Results:
- **First load**: Should see "Populated snapshot" for each course
- **Refresh**: Should see "Cache HIT" for each course
- **No duplicate API calls**: Grades should load from cache

### Verify Cache:
```javascript
// List all cached snapshots
const keys = Object.keys(sessionStorage).filter(k => k.startsWith('cg_courseSnapshot_'));
console.log(`Cached snapshots: ${keys.length}`);

keys.forEach(key => {
  const snapshot = JSON.parse(sessionStorage.getItem(key));
  console.log(`Course ${snapshot.courseId}:`, {
    displayScore: snapshot.displayScore,
    displayType: snapshot.displayType,
    expiresAt: new Date(snapshot.expiresAt).toLocaleString()
  });
});
```

## Test 5: Consistency Across Pages

### Steps:
1. Pick a standards-based course
2. Note the grade on the dashboard
3. Navigate to `/grades` and note the grade
4. Navigate to the course's grades page and note the grade

### Expected Results:
- **All three pages show identical grades**
- **Same format** (points for SBG, percentage for traditional)
- **Same values** (no rounding differences)

### Automated Check:
```javascript
// Run this on any page after grades have loaded
const courseId = 'YOUR_COURSE_ID';
const snapshot = window.CG_getCourseSnapshot(courseId);

console.log('=== Consistency Check ===');
console.log('Course ID:', courseId);
console.log('Display Score:', snapshot.displayScore);
console.log('Display Letter Grade:', snapshot.displayLetterGrade);
console.log('Display Type:', snapshot.displayType);
console.log('Expected Display:', 
  snapshot.displayType === 'points'
    ? `${snapshot.displayScore.toFixed(2)} (${snapshot.displayLetterGrade})`
    : `${snapshot.displayScore.toFixed(2)}%`
);
```

## Test 6: Refresh Logic

### Steps:
1. Navigate to dashboard (should use cached grades)
2. Navigate to `/grades` (should refresh standards-based courses)
3. Check console logs

### Expected Results:
- **Dashboard**: Uses cached grades (no API calls)
- **All-Grades Page**: Refreshes non-standards-based courses
- **Console logs**: Should show refresh decisions

## Common Issues

### Issue: Grades not showing
**Check:**
- Console for errors
- Session storage for snapshots
- Network tab for API calls

### Issue: Different grades on different pages
**Check:**
- Clear session storage and reload
- Verify all files were updated correctly
- Check console for conversion logic

### Issue: Wrong format (points vs percentage)
**Check:**
- `snapshot.displayType` value
- Course model classification
- Letter grade validity

## Debug Commands

```javascript
// Clear all snapshots
window.CG_clearAllSnapshots()

// Get specific snapshot
window.CG_getCourseSnapshot('COURSE_ID')

// List all snapshots
Object.keys(sessionStorage)
  .filter(k => k.startsWith('cg_courseSnapshot_'))
  .map(k => JSON.parse(sessionStorage.getItem(k)))

// Check current user
sessionStorage.getItem('cg_userId')
```

## Success Criteria

✅ All grades display correctly on all pages
✅ Standards-based courses show points format
✅ Traditional courses show percentage format
✅ Same course shows identical grade on all pages
✅ Session storage caching works
✅ Refresh logic works correctly
✅ No console errors
✅ No duplicate API calls

