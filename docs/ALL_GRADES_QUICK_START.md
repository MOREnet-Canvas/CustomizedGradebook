# All-Grades Page Customization - Quick Start Guide

## What It Does

Automatically converts percentage grades to point values (0-4 scale) for standards-based courses on the Canvas all-grades page (`/grades`), while preserving percentages for traditional courses.

## Before & After

### Before (Canvas Default)
```
Course                          Grade
─────────────────────────────────────
Algebra I [SBG]                64.25%
English 10                     85.50%
Biology                        92.00%
```

### After (Customized)
```
Course                          Grade              Type
──────────────────────────────────────────────────────────
Algebra I [SBG]                2.57 (Developing)  Standards
English 10                     85.50%             Traditional
Biology                        92.00%             Traditional
```

## Quick Setup

### 1. Configure Course Patterns

Edit `upload_dev.js` or `upload_production.js`:

```javascript
window.CG_CONFIG = {
    // Add your course name patterns here
    STANDARDS_BASED_COURSE_PATTERNS: [
        "Standards Based",      // Matches any course with "Standards Based" in name
        "SBG",                 // Matches any course with "SBG" in name
        "Mastery",             // Matches any course with "Mastery" in name
        /\[SBG\]/i,           // Matches courses with [SBG] in name (case-insensitive)
        /^SBG[-\s]/i          // Matches courses starting with "SBG-" or "SBG "
    ],
    
    // ... other config options
};
```

### 2. Build and Deploy

```bash
npm run build:dev
```

Then inject the updated bundle into Canvas.

### 3. Test

1. Navigate to `/grades` as a student
2. Verify the table is replaced
3. Check that standards-based courses show point values
4. Check that traditional courses show percentages

## Configuration Examples

### Example 1: Simple String Matching

```javascript
STANDARDS_BASED_COURSE_PATTERNS: [
    "SBG",
    "Standards",
    "Mastery"
]
```

**Matches**:
- "Algebra I SBG"
- "Standards Based English"
- "Mastery Math"

### Example 2: Regex Patterns

```javascript
STANDARDS_BASED_COURSE_PATTERNS: [
    /\[SBG\]/i,           // [SBG] anywhere in name
    /^SBG-/,              // Starts with "SBG-"
    /\(Standards\)/i      // (Standards) anywhere in name
]
```

**Matches**:
- "Algebra I [SBG]"
- "SBG-English 10"
- "Math (Standards Based)"

### Example 3: Combined Approach

```javascript
STANDARDS_BASED_COURSE_PATTERNS: [
    // String patterns (simple)
    "SBG",
    "Mastery",
    
    // Regex patterns (advanced)
    /\[SBG\]/i,
    /^Standards[-\s]/i,
    /\bMastery\b/i
]
```

## Testing Your Configuration

### Method 1: Visual Inspection

1. Navigate to `/grades`
2. Look for the "Type" column
3. Verify courses are correctly labeled as "Standards" or "Traditional"

### Method 2: Performance Test

Open browser console and run:

```javascript
await window.CG_testAllGradesDataSources()
```

This will:
- Test both data source approaches
- Show performance metrics
- Display detailed course data
- Recommend the best approach

### Method 3: Check Console Logs

Open browser console and look for:

```
[INFO] Applying all-grades page customizations...
[DEBUG] Course "Algebra I [SBG]" matches standards-based pattern
[DEBUG] Course "English 10" has AVG Assignment
[INFO] Customization complete: 2 standards-based, 3 traditional courses
```

## Troubleshooting

### Problem: Course Not Detected as Standards-Based

**Symptoms**: Course shows percentage instead of points

**Solutions**:

1. **Check course name pattern**:
   ```javascript
   // Add pattern that matches your course name
   STANDARDS_BASED_COURSE_PATTERNS: [
       "Your Course Pattern"
   ]
   ```

2. **Verify AVG Assignment exists**:
   - Go to course gradebook
   - Check for "Current Score Assignment"
   - If missing, add pattern to config

3. **Clear cache**:
   ```javascript
   sessionStorage.clear()
   ```
   Then refresh the page.

### Problem: Table Not Replacing

**Symptoms**: Original Canvas table still visible

**Solutions**:

1. **Check user role**:
   - Must be logged in as student or observer
   - Teachers/admins won't see customization

2. **Verify feature is enabled**:
   ```javascript
   window.CG_CONFIG = {
       ENABLE_STUDENT_GRADE_CUSTOMIZATION: true
   };
   ```

3. **Check page URL**:
   - Must be on `/grades` (not `/courses/123/grades`)
   - All-grades page only

4. **Check console for errors**:
   - Open browser console
   - Look for error messages
   - Report any errors found

### Problem: Incorrect Grade Conversion

**Symptoms**: Point value doesn't match expected value

**Solutions**:

1. **Verify conversion formula**:
   ```
   Points = (Percentage / 100) * 4
   
   Example:
   64.25% → (64.25 / 100) * 4 = 2.57 points
   ```

2. **Check DEFAULT_MAX_POINTS**:
   ```javascript
   window.CG_CONFIG = {
       DEFAULT_MAX_POINTS: 4  // Should be 4 for 0-4 scale
   };
   ```

3. **Verify rating scale**:
   - Check `OUTCOME_AND_RUBRIC_RATINGS` in config
   - Ensure ratings match your grading scale

## Advanced Usage

### Custom Rating Scale

```javascript
window.CG_CONFIG = {
    OUTCOME_AND_RUBRIC_RATINGS: [
        { description: "Advanced", points: 4 },
        { description: "Proficient", points: 3 },
        { description: "Basic", points: 2 },
        { description: "Below Basic", points: 1 },
        { description: "No Evidence", points: 0 }
    ]
};
```

### Custom Max Points

```javascript
window.CG_CONFIG = {
    DEFAULT_MAX_POINTS: 5  // For 0-5 scale instead of 0-4
};
```

### Disable Feature

```javascript
window.CG_CONFIG = {
    ENABLE_STUDENT_GRADE_CUSTOMIZATION: false
};
```

## Performance Tips

### 1. Use Specific Patterns

**Good** (fast):
```javascript
STANDARDS_BASED_COURSE_PATTERNS: [
    /^SBG-/,  // Only matches courses starting with "SBG-"
]
```

**Bad** (slow):
```javascript
STANDARDS_BASED_COURSE_PATTERNS: [
    /.*/,  // Matches everything - requires API check for all courses
]
```

### 2. Order Patterns by Frequency

Put most common patterns first:

```javascript
STANDARDS_BASED_COURSE_PATTERNS: [
    "SBG",              // Most common - check first
    /\[SBG\]/i,        // Second most common
    "Standards Based"   // Least common - check last
]
```

### 3. Cache Results

The system automatically caches detection results in `sessionStorage`. To clear cache:

```javascript
sessionStorage.clear()
```

## Support

### Getting Help

1. **Check documentation**: `docs/ALL_GRADES_PAGE_CUSTOMIZATION.md`
2. **Check console logs**: Look for error messages
3. **Run performance test**: `window.CG_testAllGradesDataSources()`
4. **Check implementation summary**: `docs/ALL_GRADES_IMPLEMENTATION_SUMMARY.md`

### Reporting Issues

When reporting issues, include:

1. **Course name**: Exact name of course not being detected
2. **Console logs**: Copy any error messages
3. **Configuration**: Your `STANDARDS_BASED_COURSE_PATTERNS` setting
4. **Expected vs actual**: What you expected vs what you see

## Summary

✅ **Configure** course name patterns in loader file  
✅ **Build** bundle with `npm run build:dev`  
✅ **Deploy** to Canvas  
✅ **Test** on `/grades` page  
✅ **Verify** standards-based courses show points  
✅ **Troubleshoot** using console logs and test tool  

**That's it!** The all-grades page will automatically detect and convert grades for standards-based courses.

