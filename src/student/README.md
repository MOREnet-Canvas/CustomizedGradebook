# Student Grade Customization Module

## Overview

The Student Grade Customization module provides a standards-based grading experience for students by normalizing grade displays across Canvas. It removes traditional point-based displays (e.g., "2.74 / 4 pts") and replaces them with clean mastery scores (e.g., "2.74").

## Features

### 1. Grade Page Customization
- **Optional Assignment Tab Removal**: Hides the Assignments tab on the grades page (controlled by `REMOVE_ASSIGNMENT_TAB` config)
- **Learning Mastery Focus**: Automatically switches to the Learning Mastery tab
- **Clean Sidebar Display**: Replaces the traditional grade sidebar with a simple mastery score display

### 2. Grade Normalization
Removes fraction denominators and "out of X" text from grade displays across multiple Canvas UI patterns:
- Course homepage assignment lists
- Grades page tables
- Rubric cells
- Screenreader text
- Outcomes tab
- Assignment details pages
- Dashboard feedback cards
- Assignment group totals
- Final grade row

### 3. Continuous Cleanup
Uses MutationObserver to maintain clean grade displays even as Canvas dynamically updates the DOM.

## Architecture

### Module Structure

```
src/student/
├── studentGradeCustomization.js  # Main entry point
├── gradePageCustomizer.js        # Grades page customization
├── gradeNormalizer.js            # Grade display cleanup
├── gradeExtractor.js             # Extract Current Score from page
├── cleanupObserver.js            # MutationObserver setup
└── README.md                     # This file
```

### Module Flow

```
customGradebookInit.js
    ↓
studentGradeCustomization.js (main entry)
    ↓
    ├─→ gradePageCustomizer.js (if on grades page)
    │       ↓
    │       └─→ gradeExtractor.js
    │
    └─→ cleanupObserver.js (dashboard & course pages)
            ↓
            └─→ gradeNormalizer.js
                    ↓
                    └─→ gradeExtractor.js
```

## Configuration

### Feature Flag
```javascript
ENABLE_STUDENT_GRADE_CUSTOMIZATION: true  // Enable/disable all student customizations
```

### Assignment Tab Control
```javascript
REMOVE_ASSIGNMENT_TAB: false  // Set true to hide Assignments tab on grades page
```

## User Detection

The module only runs for users with `student_like` role group, which includes:
- Students
- Observers (parents viewing student grades)

Role detection is handled by `getUserRoleGroup()` from `utils/canvas.js`.

## Page Detection

### Grade Page Customization
Runs on: `/courses/{id}/grades`

Conditions:
- User is student-like
- ENABLE_STUDENT_GRADE_CUSTOMIZATION is true
- Current Score Assignment exists on page

### Grade Normalization
Runs on:
- Dashboard (`/` or `/dashboard`)
- Course pages (`/courses/{id}`)
- Grades pages (`/courses/{id}/grades`)
- Assignment pages (`/courses/{id}/assignments`)

Conditions:
- User is student-like
- ENABLE_STUDENT_GRADE_CUSTOMIZATION is true
- For course pages: Course has Current Score Assignment

## Implementation Details

### Grade Extraction
The `extractCurrentScoreFromPage()` function searches for the Current Score Assignment row in the grades table and extracts the numeric score. This score is used to:
1. Display in the custom sidebar
2. Replace the final grade percentage

### Grade Normalization Patterns
The module handles multiple Canvas UI patterns for displaying grades:

1. **Score Display**: `<b>2.74</b>/4 pts` → `<b>2.74</b>`
2. **Tooltip**: `<span class="grade">2.74</span><span>/ 4</span>` → `<span class="grade">2.74</span>`
3. **Rubric**: `/4 pts` → (removed)
4. **Screenreader**: `Score: 2.74 out of 4 points.` → `Score: 2.74`
5. **Outcomes**: `2.74/4` → `2.74`
6. **Assignment Details**: `2.74/4 Points` → `2.74 Points`
7. **Dashboard Cards**: `2.74 out of 4` → `2.74`
8. **Group Totals**: Percentage removed, denominator removed
9. **Final Grade**: Percentage replaced with mastery score

### MutationObserver Strategy
The cleanup observer uses a debounced MutationObserver to:
- Watch for DOM changes (Canvas is a SPA with dynamic content)
- Apply grade normalization continuously
- Avoid excessive DOM manipulation (100ms debounce)
- Handle URL changes (tab switches, navigation)

### Performance Considerations
- **Debouncing**: 100ms debounce prevents excessive DOM manipulation
- **Selective Observation**: Only observes on relevant pages
- **Caching**: Course assignment checks are cached in sessionStorage
- **Lazy Initialization**: Observers start after 500ms delay to let Canvas render

## Testing

### Manual Testing Checklist
- [ ] Dashboard: Grades display without fractions
- [ ] Grades page: Assignments tab removed (if configured)
- [ ] Grades page: Learning Mastery tab is active
- [ ] Grades page: Right sidebar shows mastery score
- [ ] Grades page: Final grade shows mastery score instead of percentage
- [ ] Course page: Assignment scores show without fractions
- [ ] Assignment details: Scores show without fractions
- [ ] Tab switching: Normalization persists after tab changes
- [ ] Page navigation: Normalization persists after navigation

### Edge Cases
- Course without Current Score Assignment: Normalization skipped
- Teacher viewing as student: Should work (role-based)
- Observer viewing student grades: Should work (student_like role)
- Lazy-loaded content: MutationObserver handles it
- SPA navigation: URL change detection handles it

## Dependencies

### Internal Dependencies
- `config.js`: Feature flags and configuration
- `utils/canvas.js`: Role detection, course ID, assignment checking
- `utils/dom.js`: Font style inheritance
- `utils/logger.js`: Logging

### External Dependencies
- Canvas ENV object: User role information
- Canvas DOM structure: Grade display elements

## Future Enhancements

Potential improvements:
1. Support for multiple grading scales
2. Configurable grade display formats
3. Support for weighted grade calculations
4. Integration with Canvas gradebook settings
5. Support for custom grade labels

