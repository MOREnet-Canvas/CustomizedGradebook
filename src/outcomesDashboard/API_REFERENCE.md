# Canvas Outcomes API Reference

**Purpose:** AI-friendly reference for Canvas Outcomes API patterns and data structures used in Outcomes Dashboard.

**Based on:** Existing implementation in `masteryDashboard/masteryDashboardViewer.js` (lines 303-670)

---

## Core API Endpoints

### 1. Outcome Rollups (Metadata Only)

**Endpoint:**
```
GET /api/v1/courses/{courseId}/outcome_rollups
  ?include[]=outcomes
  &include[]=outcomes.alignments
  &include[]=users
  &per_page=100
```

**Purpose:** Get outcome metadata, alignment information, and aggregated scores.

**Response Structure:**
```javascript
{
  rollups: [
    {
      links: { user: "642" },
      scores: [
        {
          score: 4,
          count: 1,
          links: { outcome: "598" }
        }
      ]
    }
  ],
  linked: {
    outcomes: [
      {
        id: 598,
        title: "Outcome 1",
        display_name: "Outcome 1",
        points_possible: 4,
        mastery_points: 3,
        calculation_method: "standard_decaying_average",
        calculation_int: 65,
        alignments: ["assignment_123", "assignment_456"]  // ← Assignment IDs aligned to this outcome
      }
    ],
    "outcomes.alignments": [
      {
        id: "assignment_123",
        name: "Assignment Name",
        html_url: "https://canvas.../assignments/123"
      }
    ],
    users: [
      {
        id: 642,
        name: "Student Name",
        display_name: "Student Name"
      }
    ]
  },
  meta: { pagination: {...} }
}
```

**Key Fields:**
- `rollups[].scores[]` - **ONLY shows latest/aggregated score per outcome** (NOT chronological history)
- `linked.outcomes[].alignments[]` - Array of `"assignment_{id}"` strings showing which assignments align to this outcome
- `linked["outcomes.alignments"][]` - Full alignment metadata (assignment names, URLs)

**⚠️ LIMITATION:** Does NOT provide chronological submission history. Use Outcome Results API for that.

---

### 2. Outcome Results (Chronological Attempts)

**Endpoint:**
```
GET /api/v1/courses/{courseId}/outcome_results
  ?include[]=outcomes.alignments
  &per_page=100
```

**Optional Filters:**
- `&user_ids[]={studentId}` - Filter to specific student(s)
- `&outcome_ids[]={outcomeId}` - Filter to specific outcome(s)

**Purpose:** Get ALL individual assessment attempts with timestamps and scores.

**Response Structure:**
```javascript
{
  outcome_results: [
    {
      id: 12345,
      score: 4,
      percent: 1.0,
      submitted_at: "2026-03-30T14:29:51Z",           // ← Timestamp for chronological sorting
      submitted_or_assessed_at: "2026-03-30T14:29:51Z",
      links: {
        user: "642",                                   // ← Student ID
        learning_outcome: "598",                       // ← Outcome ID
        alignment: "assignment_123",                   // ← Which assignment this score is from
        assignment: "123"                              // ← Assignment ID (for deduplication)
      }
    },
    {
      id: 12346,
      score: 3.5,
      submitted_or_assessed_at: "2026-03-30T14:29:51Z",
      links: {
        user: "642",
        learning_outcome: "599",
        alignment: "assignment_124"
      }
    }
    // ... more results
  ],
  linked: {
    "outcomes.alignments": [
      {
        id: "assignment_123",
        name: "Assignment Name"
      }
    ]
  }
}
```

**Key Fields:**
- `outcome_results[]` - **Array of ALL individual attempts** (one per submission)
- `outcome_results[].score` - The rubric criteria score for this attempt
- `outcome_results[].submitted_or_assessed_at` - **USE THIS for chronological sorting**
- `outcome_results[].links.user` - Student ID
- `outcome_results[].links.learning_outcome` - Outcome ID
- `outcome_results[].links.alignment` - Assignment identifier (format: `"assignment_{id}"`)

**✅ USE THIS API FOR:** Building chronological score sequences for Power Law regression.

---

## Data Processing Pattern (from masteryDashboard)

### Step 1: Fetch All Outcome Results

```javascript
const resultsData = await apiClient.get(
    `/api/v1/courses/${courseId}/outcome_results?include[]=outcomes.alignments&per_page=100`
);
```

### Step 2: Group by Student + Outcome

```javascript
const byStudentOutcome = {};

resultsData.outcome_results.forEach(result => {
    const studentId = result.links?.user;
    const outcomeId = result.links?.learning_outcome;
    const key = `${studentId}_${outcomeId}`;
    
    if (!byStudentOutcome[key]) {
        byStudentOutcome[key] = [];
    }
    
    byStudentOutcome[key].push(result);
});
```

### Step 3: Sort Chronologically (Oldest First)

```javascript
for (const key in byStudentOutcome) {
    byStudentOutcome[key].sort((a, b) =>
        new Date(a.submitted_or_assessed_at || 0) - new Date(b.submitted_or_assessed_at || 0)
    );
}
```

### Step 4: Extract Score Arrays

```javascript
const scoreSequences = {};

for (const key in byStudentOutcome) {
    scoreSequences[key] = byStudentOutcome[key].map(r => r.score);
}
```

### Step 5: Apply Minimum Threshold & Power Law

```javascript
import { powerLawPredict, MIN_SCORES } from './powerLaw.js';

for (const key in scoreSequences) {
    const scores = scoreSequences[key];
    
    if (scores.length < MIN_SCORES) {
        // Status: "NE" (Not Enough data)
        prediction = null;
    } else {
        // Run Power Law regression
        prediction = powerLawPredict(scores);
    }
}
```

---

## Configuration Constants

### Minimum Attempts Threshold

**Location:** `src/outcomesDashboard/powerLaw.js`

```javascript
const MIN_SCORES = 3;
```

**Purpose:** Minimum number of graded submissions required before Power Law can predict.

**Usage:**
- If `scores.length < MIN_SCORES` → Show "NE" (Not Enough data)
- If `scores.length >= MIN_SCORES` → Calculate Power Law prediction

**⚠️ IMPORTANT:** Change this constant if threshold needs adjustment (e.g., to 4).

---

## Key Differences: Rollups vs Results

| Feature | Outcome Rollups | Outcome Results |
|---------|----------------|-----------------|
| **Chronology** | ❌ No (only latest/aggregate) | ✅ Yes (all attempts) |
| **Timestamps** | ❌ No | ✅ Yes (`submitted_or_assessed_at`) |
| **Use Case** | Outcome metadata, alignments | Power Law regression |
| **Response Size** | Small (1 per student per outcome) | Large (all attempts) |
| **Sorting** | N/A | Sort by `submitted_or_assessed_at` |

**Rule of Thumb:**
- Use **Rollups** for outcome names, alignment metadata, and "who has what outcomes"
- Use **Results** for chronological score sequences and Power Law calculations

---

## Example Workflow (Outcomes Dashboard)

1. **Fetch outcome metadata:**
   ```javascript
   const rollupData = await apiClient.get(
       `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=outcomes.alignments`
   );
   const outcomes = rollupData.linked.outcomes; // Outcome names and IDs
   ```

2. **Fetch ALL attempts:**
   ```javascript
   const resultsData = await apiClient.get(
       `/api/v1/courses/${courseId}/outcome_results?include[]=outcomes.alignments&per_page=100`
   );
   ```

3. **Group by student + outcome, sort chronologically**
4. **Apply MIN_SCORES threshold**
5. **Calculate Power Law predictions**
6. **Cache results in Canvas Files API** (`outcomes_cache.json`)

---

## Summary for AI

**When building Outcomes Dashboard:**
- ✅ Use `/outcome_results` (NOT `/outcome_rollups`) for chronological data
- ✅ Sort by `submitted_or_assessed_at` ascending (oldest first)
- ✅ Group by `studentId_outcomeId` composite key
- ✅ Check `scores.length >= MIN_SCORES` before Power Law
- ✅ Reuse pattern from `masteryDashboard/masteryDashboardViewer.js` lines 638-660
