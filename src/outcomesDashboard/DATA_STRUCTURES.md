# Outcomes Dashboard Data Structures

**Purpose:** AI-friendly reference for data structures used throughout the Outcomes Dashboard module.

**Related:** See `API_REFERENCE.md` for Canvas API response formats.

---

## 1. Outcome Metadata

**Source:** `fetchOutcomeNames()` in `outcomesDataService.js`

**Structure:**
```javascript
[
  {
    id: 598,                          // Canvas outcome ID
    title: "Outcome 1",               // Display name
    displayOrder: 1,                  // Sort order for UI
    alignments: [                     // Optional: Assignment IDs aligned to this outcome
      "assignment_123",
      "assignment_456"
    ]
  },
  {
    id: 599,
    title: "Outcome 2",
    displayOrder: 2,
    alignments: ["assignment_789"]
  }
]
```

**Usage:** Default dashboard state (before cache loaded), outcome row headers.

---

## 2. Raw Outcome Results

**Source:** Canvas API `/outcome_results` response

**Structure:**
```javascript
[
  {
    id: 12345,
    score: 4,
    percent: 1.0,
    submitted_or_assessed_at: "2026-03-30T14:29:51Z",
    links: {
      user: "642",                    // Student ID
      learning_outcome: "598",        // Outcome ID
      alignment: "assignment_123",    // Assignment identifier
      assignment: "123"               // Assignment ID (for deduplication)
    }
  },
  {
    id: 12346,
    score: 3.5,
    submitted_or_assessed_at: "2026-03-13T15:05:55Z",
    links: {
      user: "642",
      learning_outcome: "599",
      alignment: "assignment_124"
    }
  }
]
```

**Processing:** Pass to `extractAttempts()` for grouping and sorting.

---

## 3. Grouped Attempts (After extractAttempts)

**Source:** `extractAttempts()` in `outcomesDataService.js`

**Structure:**
```javascript
{
  "642_598": [                        // Key format: "{studentId}_{outcomeId}"
    {
      score: 2,
      timestamp: "2026-02-19T17:14:31Z",
      assignmentId: "123"
    },
    {
      score: 3.5,
      timestamp: "2026-03-13T15:05:55Z",
      assignmentId: "124"
    },
    {
      score: 4,
      timestamp: "2026-03-30T14:29:51Z",
      assignmentId: "125"
    }
  ],
  "642_599": [
    {
      score: 1.5,
      timestamp: "2026-03-13T15:05:55Z",
      assignmentId: "124"
    }
  ],
  "643_598": [
    // ... student 643's attempts for outcome 598
  ]
}
```

**Key Points:**
- ✅ Sorted chronologically (oldest first)
- ✅ Deduplicated by submissionId
- ✅ One array per student+outcome combination

**Usage:** Pass each array to Power Law functions.

---

## 4. Score Sequences (Power Law Input)

**Source:** Extract from grouped attempts

**Structure:**
```javascript
// Simple array of scores in chronological order (oldest first)
[2, 3.5, 4]  // Student 642, Outcome 598
```

**Validation:**
```javascript
if (scores.length < MIN_SCORES) {
    // Not enough data → status: "NE"
} else {
    // Run Power Law regression
}
```

**Usage:** Input to `powerLawPredict(scores)` and `computeStudentOutcome(scores)`.

---

## 5. Student Outcome Stats (Power Law Output)

**Source:** `computeStudentOutcome(scores)` from `powerLaw.js`

**Structure:**
```javascript
{
  status: 'ok',                      // 'ok' or 'NE' (Not Enough data)
  plPrediction: 4.2,                 // Power Law predicted next score
  slope: 0.35,                       // Power Law slope (positive = improving)
  mean: 3.17,                        // Average of all scores
  mostRecent: 4,                     // Last score in sequence
  decayingAvg: 3.8,                  // Decaying average (weights recent higher)
  attemptCount: 3                    // Number of attempts
}
```

**If Insufficient Data:**
```javascript
{
  status: 'NE',
  plPrediction: null,
  slope: null,
  mean: 2.5,                         // Still calculated
  mostRecent: 2.5,
  decayingAvg: 2.5,
  attemptCount: 2                    // < MIN_SCORES
}
```

**Usage:** Cached per student+outcome, displayed in student table rows.

---

## 6. Outcome Class Stats (Aggregate)

**Source:** `computeOutcomeStats()` in `outcomesDataService.js`

**Structure:**
```javascript
{
  outcomeId: 598,
  outcomeName: "Outcome 1",
  classMean: 3.2,                    // Average PL prediction across all students
  classMedian: 3.5,
  threshold_2_2: 2.8,                // 22nd percentile (default threshold)
  threshold_3_0: 3.1,                // 30th percentile (alternative threshold)
  studentsAtRisk: 5,                 // Count below threshold
  studentsNE: 3,                     // Count with "NE" status
  totalStudents: 25
}
```

**Usage:** Displayed in outcome row headers, used for intervention sidebar filtering.

---

## 7. Complete Outcomes Cache (Final Output)

**Source:** Output of `fetchAllOutcomeData()` → Written to `outcomes_cache.json`

**Structure:**
```javascript
{
  metadata: {
    schemaVersion: "1.0",            // SCHEMA_VERSION constant - must match or cache is discarded
    courseId: "566",
    generatedAt: "2026-04-06T15:30:00Z",
    minScoresThreshold: 3,           // MIN_SCORES constant value
    studentCount: 25,
    outcomeCount: 6
  },
  outcomes: [
    {
      id: 598,
      title: "Outcome 1",
      displayOrder: 1,
      classStats: {
        classMean: 3.2,
        classMedian: 3.5,
        threshold_2_2: 2.8,
        studentsAtRisk: 5,
        studentsNE: 3,
        totalStudents: 25
      }
    },
    // ... more outcomes
  ],
  students: [
    {
      id: "642",
      name: "Student Name",
      outcomes: [
        {
          outcomeId: 598,
          status: 'ok',
          plPrediction: 4.2,
          slope: 0.35,
          mean: 3.17,
          mostRecent: 4,
          decayingAvg: 3.8,
          attemptCount: 3,
          attempts: [                // Full history for expandable rows
            {
              score: 2,
              timestamp: "2026-02-19T17:14:31Z",
              assignmentId: "123",
              assignmentName: "Quiz 1"
            },
            {
              score: 3.5,
              timestamp: "2026-03-13T15:05:55Z",
              assignmentId: "124",
              assignmentName: "Lab 2"
            },
            {
              score: 4,
              timestamp: "2026-03-30T14:29:51Z",
              assignmentId: "125",
              assignmentName: "Project"
            }
          ]
        },
        // ... more outcomes for this student
      ]
    },
    // ... more students
  ]
}
```

**Storage:** Saved to Canvas Files API at `MOREnet_CustomizedGradebook/outcomes_cache/outcomes_cache.json`

**Permissions:** `locked: true, hidden: false` (teachers can access, students blocked)

---

## 8. Intervention List (UI Component)

**Source:** Filtered from cache based on threshold slider value

**Structure:**
```javascript
[
  {
    studentId: "642",
    studentName: "Student Name",
    outcomeId: 598,
    outcomeName: "Outcome 1",
    plPrediction: 1.8,               // Below threshold
    attemptCount: 4,
    status: 'ok'
  },
  {
    studentId: "643",
    studentName: "Another Student",
    outcomeId: 599,
    outcomeName: "Outcome 2",
    plPrediction: null,
    attemptCount: 2,
    status: 'NE'                     // Also flagged for intervention
  }
]
```

**Filter Logic:**
```javascript
students.filter(s =>
  s.status === 'NE' ||               // Not enough data
  (s.plPrediction !== null && s.plPrediction < currentThreshold)
);
```

**Usage:** Rendered in intervention sidebar, sorted by plPrediction ascending.

---

## Summary for AI

**Data Flow:**
1. **Fetch** → Raw outcome results from API
2. **Extract** → Grouped attempts per student+outcome (chronological)
3. **Compute** → Power Law stats per student+outcome
4. **Aggregate** → Class stats per outcome
5. **Cache** → Save complete structure to Canvas Files
6. **Render** → Display in UI with threshold filtering

**Key Validation Points:**
- ✅ Check `scores.length >= MIN_SCORES` before Power Law
- ✅ Sort by `submitted_or_assessed_at` ascending (oldest first)
- ✅ Use composite key `studentId_outcomeId` for grouping
- ✅ Handle `status: 'NE'` throughout UI (show "NE" badge)