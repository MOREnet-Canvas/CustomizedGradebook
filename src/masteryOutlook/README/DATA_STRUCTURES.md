# Outcomes Dashboard Data Structures

**Purpose:** AI-friendly reference for data structures used throughout the Outcomes Dashboard module.

**Related:** See `API_REFERENCE.md` for Canvas API response formats.

> **Student names are never stored in the cache.** `cache.students[n]` only contains `{ id, sectionId, outcomes[] }`. Names are attached in-memory at load time by `enrichCache()` in `masteryOutlookView.js`, which calls `fetchCourseStudents()` (sessionStorage-cached, 30-min TTL). See Section 9.

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
      assignmentId: "123",
      assignmentName: "Quiz 1"        // Assignment title from outcome result
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
  ],
  "642_599": [
    {
      score: 1.5,
      timestamp: "2026-03-13T15:05:55Z",
      assignmentId: "124",
      assignmentName: "Lab 2"
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

**Source:** `computeOutcomeStats()` in `outcomesDataService.js` — stored under `outcome.classStats`

**Structure:**
```javascript
{
  plAvg: 3.2,                        // Average PL prediction (primary field)
  classMean: 3.2,                    // Alias for plAvg (compatibility)
  classMedian: null,                 // Not computed — always null
  computedThreshold: 2.8,            // Threshold used for this compute run
  threshold_2_2: 2.8,                // Alias for computedThreshold (compatibility)
  belowThresholdCount: 5,            // Count of students below threshold
  studentsAtRisk: 5,                 // Alias for belowThresholdCount (compatibility)
  studentsNE: 3,                     // Count with "NE" status
  neCount: 3,                        // Alias for studentsNE (compatibility)
  totalStudents: 25,
  distribution: {                    // Percentage of students per score band
    hi: 20,                          // >= 3.25
    good: 30,                        // >= 2.5
    dev: 30,                         // >= 1.75
    low: 20                          // < 1.75
  },
  avgSlope: 0.12                     // Average Power Law slope across students
}
```

**Usage:** Displayed in outcome row headers, used for intervention sidebar filtering.

---

## 7. Complete Outcomes Cache (On-Disk)

**Source:** Written by `writeMasteryOutlookCache()` in `masteryOutlookCacheService.js`

**Storage:** Canvas Files API — `MOREnet_CustomizedGradebook/outcomes_cache/outcomes_cache.json`

**Permissions:** `locked: true, hidden: false` (teachers can access, students blocked)

> ⚠️ Student names are **not** in this file. See Section 9 for in-memory enrichment.

```javascript
{
  metadata: {
    schemaVersion: "1.0",            // SCHEMA_VERSION constant — cache discarded on mismatch
    courseId: "566",
    generatedAt: "2026-04-06T15:30:00Z",  // Set by computeOutcomeStats()
    computedAt: "2026-04-06T15:30:00Z",   // Set by masteryOutlookInit.js (same value)
    minScoresThreshold: 3,           // MIN_SCORES constant value at time of compute
    studentCount: 25,
    outcomeCount: 6,
    threshold: 2.2,                  // Teacher's threshold setting at time of compute
    masteryDashboardUrl: "/courses/566/pages/mastery-dashboard"  // null if not found
  },
  outcomes: [
    {
      id: 598,
      title: "Outcome 1",
      displayOrder: 1,
      classStats: {                  // See Section 6 for full classStats shape
        plAvg: 3.2,
        belowThresholdCount: 5,
        studentsNE: 3,
        totalStudents: 25,
        distribution: { hi: 20, good: 30, dev: 30, low: 20 },
        avgSlope: 0.12,
        computedThreshold: 2.2
      }
    }
    // ... more outcomes
  ],
  students: [
    {
      id: "642",                     // Canvas userId string — NO name field
      sectionId: "55",
      outcomes: [
        {
          outcomeId: 598,
          status: 'ok',              // 'ok' | 'NE'
          plPrediction: 4.2,
          slope: 0.35,
          mean: 3.17,
          mostRecent: 4,
          decayingAvg: 3.8,
          attemptCount: 3,
          canvasScore: 4.0,          // Canvas official rollup score (null if not set)
          attempts: [                // Full history — used for alignment dot UI
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
        }
        // ... more outcomes for this student
      ]
    }
    // ... more students
  ]
}
```

---

## 8. PL Sync State Cache (On-Disk)

**Source:** Written by `writeSyncState()` in `masteryOutlookCacheService.js`

**Storage:** Same Canvas file as outcomes cache — `outcomes_cache.json`, under a top-level `sync_state` key. Preserved across Refresh Data (read-before-write merge).

```javascript
{
  sync_state: {
    "598": {                              // outcomeId (string key)
      "642": {                            // studentId (string key)
        status: "synced",                 // "synced" | "needs_sync" | "possible_override" | "manual_override"
        last_synced_score: 3.5,           // Score last pushed to Canvas via PL sync
        last_synced_at: "2026-04-06T15:30:00Z",  // ISO timestamp of last push
        manual_override: false,           // true = teacher confirmed Canvas score should win

        // Will Post fields (PL_WILL_POST_AND_EXCEPTIONS_ADDENDUM)
        will_post: 3.5,                   // Score to post to Canvas (null = track plPrediction)
        will_post_lock: "none",           // "none" | "unlocked" | "locked"
        will_post_note: null              // Teacher's note for this override (string | null)
      },
      "643": {
        status: "needs_sync",
        last_synced_score: null,
        last_synced_at: null,
        manual_override: false,
        will_post: null,
        will_post_lock: "none",
        will_post_note: null
      }
    },
    "599": {
      // ... students for outcome 599
    }
  }
}
```

**Status Meanings:**
| Status | Meaning |
|---|---|
| `synced` | Canvas score matches last PL sync push |
| `needs_sync` | PL prediction changed since last push — Canvas is stale |
| `possible_override` | Canvas score changed AFTER the last PL push — teacher may have overridden |
| `manual_override` | Teacher confirmed Canvas score should be kept — skip this student during sync |

**Sync Skip Rules (handleCalculatingChanges):**
- Skip student if `manual_override === true`
- Skip student if `will_post_lock === "locked"`
- Use `will_post` as the score to push (if non-null), else use `plPrediction`

---

## 9. In-Memory Enriched Cache (Runtime Only)

**Source:** `enrichCache()` in `masteryOutlookView.js` — called by `tryLoadCache()` on every page load/re-render. **Never written to disk.**

`enrichCache()` calls `fetchCourseStudents(courseId, apiClient)` (which is sessionStorage-cached for 30 min) and staples `.name` and `.sortableName` onto each student object in memory:

```javascript
// What tryLoadCache() returns — shape in memory, NOT on disk
{
  meta: { ...cache.metadata },       // Remapped from metadata → meta
  outcomes: [ ...cache.outcomes ],
  students: [
    {
      id: "642",
      sectionId: "55",
      name: "Jane Smith",            // ← attached by enrichCache(), NOT from disk
      sortableName: "Smith, Jane",   // ← attached by enrichCache(), NOT from disk
      outcomes: [ ... ]
    }
  ]
}
```

`enrichCache()` also resolves `masteryDashboardUrl` and applies a custom outcome display order from the Mastery Dashboard Canvas page.

---

## 10. Intervention List (UI Component)

**Source:** Filtered from in-memory cache based on threshold slider value

**Structure:**
```javascript
[
  {
    studentId: "642",
    // student name is resolved at render time from the in-memory enriched cache
    outcomeId: 598,
    outcomeName: "Outcome 1",
    plPrediction: 1.8,               // Below threshold
    attemptCount: 4,
    status: 'ok'
  },
  {
    studentId: "643",
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
2. **Extract** → Grouped attempts per student+outcome (chronological, with assignmentName + timestamp)
3. **Compute** → Power Law stats per student+outcome
4. **Aggregate** → Class stats per outcome
5. **Cache** → Save outcomes + metadata (no names) to Canvas Files; merge-preserve `sync_state`
6. **Enrich** → `enrichCache()` attaches names in-memory from `fetchCourseStudents()` (session-cached)
7. **Render** → Display in UI with threshold filtering; read `sync_state` for sync badges + Will Post

**Key Validation Points:**
- ✅ Check `scores.length >= MIN_SCORES` before Power Law
- ✅ Sort by `submitted_or_assessed_at` ascending (oldest first)
- ✅ Use composite key `studentId_outcomeId` for grouping
- ✅ Handle `status: 'NE'` throughout UI (show "NE" badge)
- ✅ Student names come from `enrichCache()` — never from the file cache
- ✅ `sync_state` is preserved across Refresh Data via read-before-write merge