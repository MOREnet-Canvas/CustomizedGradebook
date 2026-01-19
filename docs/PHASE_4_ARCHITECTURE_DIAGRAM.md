# Phase 4: Grade Data Service Consolidation - Architecture Diagram

## Current Architecture (Before Refactoring)

```mermaid
graph TB
    subgraph Dashboard["Dashboard Module"]
        GD[gradeDisplay.js]
        CR[cardRenderer.js]
        GDS[gradeDataService.js]
    end
    
    subgraph Student["Student Module"]
        AGP[allGradesPageCustomizer.js]
    end
    
    subgraph Utils["Utils"]
        API[canvasApiClient.js]
    end
    
    GD -->|imports| GDS
    CR -->|imports GRADE_SOURCE| GDS
    GDS -->|fetchEnrollmentScore| API
    GDS -->|preCacheEnrollmentGrades| API
    AGP -->|fetchGradeDataFromAPI| API
    
    style GDS fill:#ffcccc
    style AGP fill:#ffcccc
    
    note1[Duplicate enrollment<br/>parsing logic]
    note2[Both fetch from<br/>/api/v1/users/self/enrollments]
    
    GDS -.-> note1
    AGP -.-> note2
```

**Problems:**
- 🔴 `gradeDataService.js` in `dashboard/` but needed by student module
- 🔴 Duplicate enrollment parsing in `gradeDataService.js` (2 places)
- 🔴 Duplicate enrollment fetching in `allGradesPageCustomizer.js`
- 🔴 ~105 lines of duplicate code

---

## Proposed Architecture (After Refactoring)

```mermaid
graph TB
    subgraph Dashboard["Dashboard Module"]
        GD[gradeDisplay.js]
        CR[cardRenderer.js]
    end
    
    subgraph Student["Student Module"]
        AGP[allGradesPageCustomizer.js]
    end
    
    subgraph Services["Services (Shared)"]
        GDS[gradeDataService.js<br/>MOVED from dashboard/]
        ES[enrollmentService.js<br/>NEW]
    end
    
    subgraph Utils["Utils"]
        API[canvasApiClient.js]
    end
    
    GD -->|imports getCourseGrade| GDS
    CR -->|imports GRADE_SOURCE| GDS
    AGP -->|imports enrollment utils| ES
    
    GDS -->|uses| ES
    ES -->|fetchAllEnrollments| API
    ES -->|fetchSingleEnrollment| API
    
    style GDS fill:#ccffcc
    style ES fill:#ccffcc
    style AGP fill:#ccffcc
    
    note1[Shared enrollment<br/>parsing logic]
    note2[Single source of truth<br/>for enrollment data]
    
    ES -.-> note1
    ES -.-> note2
```

**Benefits:**
- ✅ `gradeDataService.js` in `services/` (accessible to all modules)
- ✅ Shared enrollment parsing in `enrollmentService.js`
- ✅ Both modules use same enrollment utilities
- ✅ ~105 lines of duplicate code removed

---

## Data Flow Comparison

### Before: Dashboard Grade Fetching

```mermaid
sequenceDiagram
    participant GD as gradeDisplay.js
    participant GDS as gradeDataService.js
    participant API as Canvas API
    
    GD->>GDS: getCourseGrade(courseId)
    GDS->>GDS: Check cache
    alt Cache miss
        GDS->>API: GET /courses/{id}/enrollments
        API-->>GDS: enrollment data
        GDS->>GDS: Parse enrollment (inline logic)
        Note over GDS: Lines 261-291<br/>Duplicate parsing
    end
    GDS-->>GD: {score, letterGrade, source}
```

### After: Dashboard Grade Fetching

```mermaid
sequenceDiagram
    participant GD as gradeDisplay.js
    participant GDS as gradeDataService.js
    participant ES as enrollmentService.js
    participant API as Canvas API
    
    GD->>GDS: getCourseGrade(courseId)
    GDS->>GDS: Check cache
    alt Cache miss
        GDS->>ES: fetchSingleEnrollment(courseId)
        ES->>API: GET /courses/{id}/enrollments
        API-->>ES: enrollment data
        ES->>ES: parseEnrollmentGrade()
        Note over ES: Shared parsing logic
        ES-->>GDS: {score, letterGrade}
    end
    GDS-->>GD: {score, letterGrade, source}
```

---

### Before: All-Grades Page Fetching

```mermaid
sequenceDiagram
    participant AGP as allGradesPageCustomizer.js
    participant API as Canvas API
    
    AGP->>AGP: fetchGradeDataFromAPI()
    AGP->>API: GET /users/self/enrollments
    API-->>AGP: enrollments array
    AGP->>AGP: Parse enrollments (inline logic)
    Note over AGP: Lines 106-120<br/>Duplicate parsing
    AGP->>AGP: Build gradeMap
    AGP-->>AGP: Map<courseId, grade>
```

### After: All-Grades Page Fetching

```mermaid
sequenceDiagram
    participant AGP as allGradesPageCustomizer.js
    participant ES as enrollmentService.js
    participant API as Canvas API
    
    AGP->>ES: fetchAllEnrollments(options)
    ES->>API: GET /users/self/enrollments
    API-->>ES: enrollments array
    AGP->>ES: extractEnrollmentData(enrollments)
    ES->>ES: parseEnrollmentGrade() for each
    Note over ES: Shared parsing logic
    ES-->>AGP: Map<courseId, grade>
```

---

## Module Dependencies

### Before

```
src/dashboard/gradeDataService.js
├── Imports: canvasApiClient.js, logger.js, config.js
├── Exports: getCourseGrade, preCacheEnrollmentGrades, GRADE_SOURCE
└── Used by: gradeDisplay.js, cardRenderer.js

src/student/allGradesPageCustomizer.js
├── Imports: canvasApiClient.js, logger.js, courseDetection.js
├── Internal: fetchGradeDataFromAPI() - duplicate logic
└── Used by: studentGradeCustomization.js
```

### After

```
src/services/enrollmentService.js (NEW)
├── Imports: canvasApiClient.js, logger.js
├── Exports: parseEnrollmentGrade, fetchAllEnrollments, 
│            fetchSingleEnrollment, extractEnrollmentData
└── Used by: gradeDataService.js, allGradesPageCustomizer.js

src/services/gradeDataService.js (MOVED)
├── Imports: enrollmentService.js, canvasApiClient.js, logger.js, config.js
├── Exports: getCourseGrade, preCacheEnrollmentGrades, GRADE_SOURCE
└── Used by: gradeDisplay.js, cardRenderer.js

src/student/allGradesPageCustomizer.js
├── Imports: enrollmentService.js, canvasApiClient.js, logger.js
├── Removed: fetchGradeDataFromAPI() - uses shared service
└── Used by: studentGradeCustomization.js
```

---

## Code Reduction Visualization

### Enrollment Parsing Logic

**Before**: Duplicated in 3 places
```
gradeDataService.js (lines 108-132)    ████████████████████ 25 lines
gradeDataService.js (lines 261-291)    ██████████████████████████████ 31 lines
allGradesPageCustomizer.js (106-120)   ███████████████ 15 lines
                                       ─────────────────────────────────
                                       Total: 71 lines
```

**After**: Centralized in 1 place
```
enrollmentService.js::parseEnrollmentGrade()  ████████████████████ 25 lines
                                              ─────────────────────────────────
                                              Total: 25 lines
                                              Saved: 46 lines (65% reduction)
```

### Enrollment Fetching Logic

**Before**: Separate implementations
```
gradeDataService.js::fetchEnrollmentScore()   ████████████████████████ 30 lines
allGradesPageCustomizer.js::fetchGradeData()  ████████████████████████ 30 lines
                                              ─────────────────────────────────
                                              Total: 60 lines
```

**After**: Shared utilities
```
enrollmentService.js::fetchSingleEnrollment() ████████████ 15 lines
enrollmentService.js::fetchAllEnrollments()   ████████████ 15 lines
enrollmentService.js::extractEnrollmentData() ████████████ 15 lines
                                              ─────────────────────────────────
                                              Total: 45 lines
                                              Saved: 15 lines (25% reduction)
```

**Total Code Reduction**: ~105 lines removed (~58% reduction in enrollment-related code)

---

## File Structure Changes

### Before
```
src/
├── dashboard/
│   ├── gradeDataService.js ← Located here (dashboard-specific)
│   ├── gradeDisplay.js
│   └── cardRenderer.js
├── student/
│   └── allGradesPageCustomizer.js ← Duplicate enrollment logic
└── services/
    ├── assignmentService.js
    ├── outcomeService.js
    └── rubricService.js
```

### After
```
src/
├── dashboard/
│   ├── gradeDisplay.js
│   └── cardRenderer.js
├── student/
│   └── allGradesPageCustomizer.js ← Uses shared service
└── services/
    ├── assignmentService.js
    ├── outcomeService.js
    ├── rubricService.js
    ├── enrollmentService.js ← NEW: Shared enrollment utilities
    └── gradeDataService.js  ← MOVED: Now accessible to all modules
```

