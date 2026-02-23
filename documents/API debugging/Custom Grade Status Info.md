# Canvas Custom Grade Status, Override, and Assignment Grade API Reference

This document captures all validated API behaviors discovered while testing:

- Custom Grade Status creation
- Applying status to grade overrides
- Clearing override scores
- Clearing assignment grades
- Submission status behavior
- Independence between score and status systems

All examples assume execution from the browser while authenticated in Canvas.

---

# Endpoints Used

### GraphQL
`POST /api/graphql`

### Submission Updates (REST)
`PUT /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id`

For REST calls:
- Include `credentials: "same-origin"`
- Include `X-CSRF-Token`
- Include `authenticity_token` in JSON body

---

# 1️⃣ Create or Update a Custom Grade Status

## Operation
`upsertCustomGradeStatus`

## Purpose
Creates a new Custom Grade Status or updates an existing one.

This **does NOT** apply the status to a student. It only defines the status option.

---

## Create New Status

```json
{
  "operationName": "UpsertCustomGradingStatusMutation",
  "variables": {
    "color": "#FFE8E5",
    "name": "IE"
  },
  "query": "mutation UpsertCustomGradingStatusMutation($id: ID, $color: String!, $name: String!) {\n  upsertCustomGradeStatus(input: {id: $id, color: $color, name: $name}) {\n    customGradeStatus {\n      id: _id\n      name\n      color\n      __typename\n    }\n    errors {\n      attribute\n      message\n      __typename\n    }\n    __typename\n  }\n}"
}
```

---

## Update Existing Status

```json
{
  "operationName": "UpsertCustomGradingStatusMutation",
  "variables": {
    "id": "1",
    "color": "#FF6F61",
    "name": "IE"
  },
  "query": "mutation UpsertCustomGradingStatusMutation($id: ID, $color: String!, $name: String!) {\n  upsertCustomGradeStatus(input: {id: $id, color: $color, name: $name}) {\n    customGradeStatus {\n      id: _id\n      name\n      color\n      __typename\n    }\n    errors {\n      attribute\n      message\n      __typename\n    }\n    __typename\n  }\n}"
}
```

### Notes
- `color` is required (`String!`)
- Returned `id` is accessed via `_id`
- This only defines the status globally

---

# 2️⃣ Apply Custom Grade Status to a Student Override

## Operation
`setOverrideStatus`

## Purpose
Attach a Custom Grade Status to a student's override record.

---

```json
{
  "operationName": "SetOverrideStatusMutation",
  "variables": {
    "customGradeStatusId": "1",
    "enrollmentId": "1875",
    "gradingPeriodId": null
  },
  "query": "mutation SetOverrideStatusMutation($customGradeStatusId: ID, $enrollmentId: ID!, $gradingPeriodId: ID) {\n  setOverrideStatus(input: {customGradeStatusId: $customGradeStatusId, enrollmentId: $enrollmentId, gradingPeriodId: $gradingPeriodId}) {\n    errors { attribute message __typename }\n    __typename\n  }\n}"
}
```

---

# 3️⃣ Clear Custom Grade Status from Override

```json
{
  "operationName": "SetOverrideStatusMutation",
  "variables": {
    "customGradeStatusId": null,
    "enrollmentId": "1875",
    "gradingPeriodId": null
  },
  "query": "mutation SetOverrideStatusMutation($customGradeStatusId: ID, $enrollmentId: ID!, $gradingPeriodId: ID) {\n  setOverrideStatus(input: {customGradeStatusId: $customGradeStatusId, enrollmentId: $enrollmentId, gradingPeriodId: $gradingPeriodId}) {\n    errors { attribute message __typename }\n    __typename\n  }\n}"
}
```

---

# 4️⃣ Set Numeric Override Score

## Operation
`setOverrideScore`

```json
{
  "query": "mutation {\n  setOverrideScore(input: {enrollmentId: 1875, overrideScore: 55.55}) {\n    grades { overrideScore customGradeStatusId __typename }\n    __typename\n  }\n}"
}
```

---

# 5️⃣ Clear Numeric Override Score

```json
{
  "query": "mutation {\n  setOverrideScore(input: {enrollmentId: 1875, overrideScore: null}) {\n    grades { overrideScore customGradeStatusId __typename }\n    __typename\n  }\n}"
}
```

### Important

If using variables:
- `overrideScore` must NOT be declared as `Float!`
- Use `Float` or inline `null`

---

# Override Independence Behavior (Confirmed)

- `overrideScore` and `customGradeStatusId` are fully independent.
- Clearing `overrideScore` does NOT clear status.
- Clearing status does NOT change overrideScore.
- When overrideScore is null and status is cleared, Canvas falls back to computed grade.

---

# 6️⃣ Set Assignment Grade (Submission)

## Endpoint
`PUT /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id`

```json
{
  "submission": {
    "posted_grade": "3"
  },
  "authenticity_token": "<csrf>"
}
```

---

# 7️⃣ Clear Assignment Grade (Validated Method)

The only confirmed method that truly clears:

- score
- grade
- entered_score

```json
{
  "rubric_assessment": {
    "_9586": {
      "points": null
    }
  },
  "authenticity_token": "<csrf>"
}
```

Result:
```
score: null
grade: null
entered_score: null
```

---

# 8️⃣ Set Submission Status (Independent of Grade)

```json
{
  "submission": {
    "late_policy_status": "missing"
  },
  "authenticity_token": "<csrf>"
}
```

Confirmed:
- Does NOT modify score
- Works even when score is null

---

# 9️⃣ Clear Submission Status

```json
{
  "submission": {
    "late_policy_status": null
  },
  "authenticity_token": "<csrf>"
}
```

Confirmed:
- Removes label
- Does NOT restore grade
- Score remains null

---

# Assignment Independence Behavior (Confirmed)

- Submission grade and submission status are independent.
- Clearing grade does not affect status.
- Clearing status does not affect grade.
- A no-op PUT does not restore a cleared grade.

---

# Recommended Pattern for “Insufficient Evidence”

## Final Grade (Course Level)

To represent IE cleanly:

1. `setOverrideScore(... overrideScore: null)`
2. `setOverrideStatus(... customGradeStatusId: "IE")`

Result:
- No numeric override
- IE label visible
- Clearing status reverts to computed grade

---

## Assignment Level

Canvas does not support custom submission statuses.

To simulate IE:

1. Clear assignment grade via rubric points = null
2. Optionally apply a submission status (e.g., "missing") for visual indicator

Assignment score and submission status remain independent.

---

# IDs Used During Testing

- Course: 567
- Student: 642
- Enrollment: 1875
- Assignment: 3587
- Rubric criterion: _9586
- Custom Grade Status “IE”: 1

---

# Final Summary

Canvas uses independent state channels:

- Override Score
- Custom Grade Status
- Submission Grade
- Submission Status

These systems do not automatically cascade into one another.

This independence allows a clean, non-hacky implementation of “Insufficient Evidence” without coercing numeric values.

# To Get Custom Grade Statuses
```javascript
  const payload = {
    operationName: "GetCustomGradeStatuses",
    variables: { accountId: ACCOUNT_ID },
    query: `
      query GetCustomGradeStatuses($accountId: ID!) {
        account(id: $accountId) {
          id
          _id
          name

          customGradeStatusesConnection {
            nodes {
              id
              _id
              name
              color
              __typename
            }
            __typename
          }
        }
      }
    `,
};

const res = await fetch("/api/graphql", {
    method: "POST",
    credentials: "same-origin",
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
    },
    body: JSON.stringify(payload),
});
```