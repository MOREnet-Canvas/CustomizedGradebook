# Canvas Outcome Rollups -- Technical Documentation

## Overview

The **Outcome Rollups API** in Canvas returns aggregated mastery data
for students within a course.\
It provides per‑student outcome scores along with metadata about the
outcomes and users.

Primary endpoint format:

    GET /api/v1/courses/:course_id/outcome_rollups?include[]=outcomes&include[]=users

This response contains three major sections:

-   `rollups` → Per-student outcome score data
-   `linked` → Full definitions of outcomes and users
-   `meta` → Pagination metadata

------------------------------------------------------------------------

# Top-Level Structure

``` json
{
  "rollups": [...],
  "meta": {...},
  "linked": {...}
}
```

------------------------------------------------------------------------

# 1. Rollups Section

The `rollups` array contains one object per student.

## Structure

``` json
{
  "scores": [...],
  "links": {
    "user": "642",
    "section": "515",
    "status": "active"
  }
}
```

### Fields

  Field             Description
  ----------------- ------------------------------------------------
  `scores`          Array of outcome score objects for the student
  `links.user`      Canvas user ID
  `links.section`   Section ID
  `links.status`    Enrollment status

------------------------------------------------------------------------

## 1.1 Score Objects

Each `scores` entry represents a student's calculated score for a
specific outcome.

Example:

``` json
{
  "score": 3.5,
  "title": "Assignment 010 (LO=3)",
  "submitted_at": "2026-02-11T21:08:04Z",
  "count": 1,
  "hide_points": false,
  "links": {
    "outcome": "605"
  }
}
```

### Score Fields

  Field             Description
  ----------------- -----------------------------------------
  `score`           Numeric mastery value
  `title`           Assignment name contributing to outcome
  `submitted_at`    Timestamp of submission
  `count`           Number of assessments contributing
  `hide_points`     Whether points are hidden
  `links.outcome`   Outcome ID reference

------------------------------------------------------------------------

# 2. Linked Section

The `linked` object contains related data so you do not need additional
API calls.

## 2.1 Linked Outcomes

Each outcome includes:

``` json
{
  "id": 605,
  "title": "Outcome 2",
  "points_possible": 4,
  "mastery_points": 3,
  "ratings": [...],
  "calculation_method": "standard_decaying_average",
  "calculation_int": 65
}
```

### Key Fields

  Field                  Description
  ---------------------- ----------------------------------------
  `id`                   Outcome ID
  `title`                Outcome title
  `points_possible`      Maximum points
  `mastery_points`       Threshold for mastery
  `ratings`              Performance level scale
  `calculation_method`   Aggregation method
  `calculation_int`      Weight percentage for decaying average

------------------------------------------------------------------------

### Calculation Methods

Common values:

  Method                        Meaning
  ----------------------------- -----------------------------
  `latest`                      Most recent score only
  `highest`                     Highest score
  `standard_decaying_average`   Weighted recent performance

For `standard_decaying_average`, `calculation_int` represents the
percent weight of the most recent score.

Example:\
65 = 65% most recent, 35% historical average.

------------------------------------------------------------------------

## 2.2 Linked Users

Each user object contains identity metadata:

``` json
{
  "id": "642",
  "name": "Test Student001",
  "sortable_name": "Student001, Test",
  "login_id": "teststudent001@example.com",
  "sis_id": "teststudent001"
}
```

This allows mapping:

    rollup.links.user → linked.users[].id

------------------------------------------------------------------------

# 3. Meta Section

Pagination information:

``` json
"meta": {
  "pagination": {
    "per_page": 100,
    "page": 1,
    "count": 5,
    "page_count": 1
  }
}
```

Used for multi-page result handling.

------------------------------------------------------------------------

# 4. Understanding the "Current Score" Outcome

In your data:

    "title": "Current Score",
    "calculation_method": "latest"

This is typically an auto-generated outcome used to store computed
averages.\
It is often excluded from calculations to prevent circular aggregation.

------------------------------------------------------------------------

# 5. How Rollups Are Typically Used

Common use cases:

-   Calculate overall student mastery average
-   Update a synthetic outcome (e.g., "Current Score")
-   Push grade overrides
-   Identify insufficient evidence conditions
-   Perform custom aggregation outside Canvas rules

------------------------------------------------------------------------

# 6. Example Aggregation Logic

Typical average calculation:

    Average = sum(scores) / count(scores)

With exclusions:

-   Exclude synthetic outcomes
-   Exclude keyword-matched outcomes (e.g., Attendance)
-   Ignore null scores

------------------------------------------------------------------------

# 7. Important Technical Notes

-   Scores are already aggregated by Canvas using the outcome's
    calculation method.
-   The API does NOT return raw rubric ratings per assignment --- only
    calculated mastery values.
-   Missing outcome entries for a student mean no evidence exists.
-   `count` reflects how many assessments contributed to the outcome
    score.

------------------------------------------------------------------------

# 8. Data Relationships

    rollups[].links.user  → linked.users[].id
    scores[].links.outcome → linked.outcomes[].id

This design avoids nested duplication and reduces payload size.

------------------------------------------------------------------------

# 9. Practical Implementation Pattern

1.  Build an outcome ID → title map
2.  Iterate rollups
3.  Filter relevant scores
4.  Apply business rules
5.  Update outcome or override grade

------------------------------------------------------------------------

# 10. Summary

Outcome Rollups provide:

-   Per-student mastery results
-   Outcome configuration metadata
-   User metadata
-   Pagination support

They are ideal for standards-based grading automation and custom
aggregation workflows.
