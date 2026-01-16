# Hybrid Data Loading Flow

## Overview

The hybrid data loading strategy combines DOM parsing (fast) with API verification (thorough) to provide the best user experience.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User navigates to /grades page                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ initAllGradesPageCustomizer()                                   │
│ ├─ Inject CSS to hide original table (prevent flash)            │
│ └─ Call applyCustomizations()                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ fetchCourseGrades() - HYBRID APPROACH                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: extractCoursesFromDOM()                                 │
│ ├─ Parse table.course_details.student_grades                    │
│ ├─ Extract: courseId, courseName, percentage                    │
│ └─ Check: matchesCourseNamePattern(courseName)                  │
│                                                                  │
│ Result: Array of courses with basic info                        │
│ Time: ~10ms (no API calls)                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: enrichCoursesWithAPI()                                  │
│                                                                  │
│ For each course (in parallel):                                  │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ Course matches pattern?                                 │  │
│   └───────┬─────────────────────────────────┬───────────────┘  │
│           │ YES                              │ NO               │
│           ▼                                  ▼                  │
│   ┌───────────────────┐            ┌────────────────────────┐  │
│   │ FAST PATH         │            │ THOROUGH PATH          │  │
│   │                   │            │                        │  │
│   │ ✓ Mark as SBG     │            │ Call API to verify:    │  │
│   │ ✓ Cache result    │            │ ├─ Check cache        │  │
│   │ ✓ Convert grade   │            │ ├─ Check AVG Assign   │  │
│   │ ✓ Calculate letter│            │ └─ Cache result       │  │
│   │                   │            │                        │  │
│   │ Time: ~0ms        │            │ Time: ~100ms/course    │  │
│   └───────────────────┘            └────────────────────────┘  │
│                                                                  │
│ Result: Enriched courses with display values                    │
│ Time: ~200ms (for 2 non-matching courses in parallel)           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ replaceGradesTable()                                            │
│ ├─ Remove existing custom table (prevent duplicates)            │
│ ├─ Hide original table                                          │
│ ├─ Create new table with converted grades                       │
│ └─ Insert after original table                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ User sees customized table                                      │
│ ├─ Standards-based: 2.57 (Developing) [green]                   │
│ └─ Traditional: 85.50% [default color]                          │
│                                                                  │
│ Total time: ~210ms (vs ~700ms with old approach)                │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Comparison

### Example: 5 Courses (3 matching patterns, 2 not matching)

#### Old API-First Approach
```
1. Fetch enrollments API          : 200ms
2. Process course 1 (SBG)          : 100ms (API check)
3. Process course 2 (SBG)          : 100ms (API check)
4. Process course 3 (SBG)          : 100ms (API check)
5. Process course 4 (Traditional)  : 100ms (API check)
6. Process course 5 (Traditional)  : 100ms (API check)
─────────────────────────────────────────────
Total: ~700ms
```

#### New Hybrid Approach
```
1. Extract from DOM                : 10ms
2. Pattern match (3 courses)       : 0ms (instant)
3. API verify (2 courses parallel) : 200ms
─────────────────────────────────────────────
Total: ~210ms (70% faster!)
```

## Key Benefits

### 1. **Faster Initial Display**
- DOM extraction is instant (~10ms)
- Pattern-matching courses show immediately
- No waiting for API calls for obvious SBG courses

### 2. **No Flash of Percentages**
- CSS injected immediately on page load
- Original table hidden before it renders
- Custom table shown only when ready

### 3. **Thorough Verification**
- Non-matching courses still verified with API
- Catches edge cases (courses without pattern in name)
- Maintains reliability of detection

### 4. **Parallel Processing**
- All API calls run concurrently
- No sequential bottleneck
- Scales well with more courses

### 5. **Cached Results**
- Detection results cached in sessionStorage
- Subsequent page loads even faster (~50ms)
- Cache persists for entire session

## Detection Strategy

### Course Name Pattern Matching (Fast Path)

**Patterns** (from `STANDARDS_BASED_COURSE_PATTERNS`):
- `"Standards Based"` - String matching
- `"SBG"` - Acronym
- `"Mastery"` - Keyword
- `/\[SBG\]/i` - Regex: [SBG] in name
- `/^SBG[-\s]/i` - Regex: Starts with "SBG-" or "SBG "

**Examples**:
- ✅ "Algebra I [SBG]" → Matches `/\[SBG\]/i` → **Fast path**
- ✅ "SBG-English 10" → Matches `/^SBG[-\s]/i` → **Fast path**
- ✅ "Mastery Math" → Matches `"Mastery"` → **Fast path**
- ❌ "Biology 101" → No match → **Thorough path (API check)**

### API Verification (Thorough Path)

**For courses not matching patterns**:

1. **Check cache** - `sessionStorage.getItem('standardsBased_538')`
   - If cached: Return immediately
   - If not cached: Continue to step 2

2. **Check AVG Assignment** - API call to `/api/v1/courses/538/assignments`
   - Search for "Current Score Assignment"
   - If found: Mark as standards-based
   - If not found: Mark as traditional

3. **Cache result** - `sessionStorage.setItem('standardsBased_538', 'true')`
   - Prevents redundant API calls
   - Persists for session

## Error Handling

### Graceful Degradation

```
extractCoursesFromDOM() fails
    ↓
Log error, throw exception
    ↓
applyCustomizations() catches error
    ↓
Original table remains visible
    ↓
User sees standard Canvas grades
```

### Partial Failures

```
Individual course API check fails
    ↓
Log warning, treat as traditional
    ↓
Continue processing other courses
    ↓
User sees mixed results (some converted, some not)
```

## Code Example

### Simplified Implementation

```javascript
async function fetchCourseGrades() {
    // Step 1: Extract from DOM (fast)
    const courses = extractCoursesFromDOM();
    // Returns: [
    //   { courseId: '538', courseName: 'Algebra [SBG]', percentage: 64.25, matchesPattern: true },
    //   { courseId: '539', courseName: 'Biology', percentage: 85.5, matchesPattern: false }
    // ]

    // Step 2: Enrich with API (parallel)
    const enriched = await enrichCoursesWithAPI(courses, apiClient);
    // Returns: [
    //   { ...course1, isStandardsBased: true, displayScore: 2.57, displayType: 'points' },
    //   { ...course2, isStandardsBased: false, displayScore: 85.5, displayType: 'percentage' }
    // ]

    return enriched;
}
```

## Future Optimizations

### Potential Improvements

1. **Progressive Rendering**
   - Show pattern-matching courses immediately
   - Update non-matching courses as API calls complete
   - Requires more complex state management

2. **Predictive Caching**
   - Pre-fetch course data on dashboard
   - Cache results before user navigates to /grades
   - Instant display on /grades page

3. **Batch API Calls**
   - Single API call for all non-matching courses
   - Requires custom Canvas API endpoint
   - Further reduces total time

4. **Service Worker Caching**
   - Cache API responses in service worker
   - Persist across sessions
   - Offline support

## Related Documentation

- [All-Grades Page Customization](./ALL_GRADES_PAGE_CUSTOMIZATION.md)
- [Improvements Summary](./ALL_GRADES_IMPROVEMENTS.md)
- [Course Detection Utilities](../src/utils/courseDetection.js)

