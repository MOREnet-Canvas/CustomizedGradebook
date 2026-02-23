# Canvas Grade Status & Score Control
## Override + Assignment (Submission) – Confirmed Behaviors & Endpoints

This document summarizes everything validated so far regarding:

- Final grade override score
- Final grade override custom status
- Assignment (submission) grade
- Assignment (submission) custom status
- Clear behaviors
- REST endpoints
- GraphQL mutations
- What works reliably
- What does NOT work

---

# 1️⃣ Final Grade Override (Enrollment-Level)

This controls the **course final grade override**, not assignment grades.

## GraphQL Mutations

### Set Override Score

```graphql
mutation {
  setOverrideScore(input: {
    enrollmentId: "1875",
    overrideScore: 75
  }) {
    grades { overrideScore }
  }
}
```

### Clear Override Score (True Clear)

```graphql
mutation {
  setOverrideScore(input: {
    enrollmentId: "1875",
    overrideScore: null
  }) {
    grades { overrideScore }
  }
}
```

✔ `overrideScore: null` successfully clears.

---

### Set Override Custom Status

```graphql
mutation {
  setOverrideStatus(input: {
    enrollmentId: "1875",
    customGradeStatusId: "1"
  }) {
    __typename
  }
}
```

### Clear Override Custom Status

```graphql
mutation {
  setOverrideStatus(input: {
    enrollmentId: "1875",
    customGradeStatusId: null
  }) {
    __typename
  }
}
```

✔ Fully symmetric: set + clear works.

---

## Combined Override Mutations in One Request

This works:

```graphql
mutation {
  setOverrideScore(...) { __typename }
  setOverrideStatus(...) { __typename }
}
```

✔ Multiple override mutations in one POST are supported.

---

# 2️⃣ Assignment Grade (Submission-Level)

This controls the grade for a specific assignment.

## True Clear of Assignment Grade (Confirmed)

Using REST:

```
PUT /api/v1/courses/:courseId/assignments/:assignmentId/submissions/:userId
```

Body:

```json
{
  "rubric_assessment": {
    "_9586": { "points": null }
  }
}
```

Result:

```
score: null
grade: null
entered_score: null
```

✔ This is a true clear.

---

## Important Notes

- `_9586` is the rubric criterion id.
- Clearing via rubric points is the only confirmed true-clear method.
- `posted_grade` manipulation does NOT produce a true blank.

---

# 3️⃣ Assignment Custom Grade Status (Submission-Level)

This is separate from override status.

## REST – Set Custom Status

```
PUT /api/v1/courses/:courseId/assignments/:assignmentId/submissions/:userId
```

Body:

```json
{
  "submission": {
    "custom_grade_status_id": "1",
    "assignment_id": "3587",
    "user_id": "642"
  }
}
```

✔ Works.

---

## REST – Clear Custom Status (Indirect Method)

Setting:

```json
{
  "submission": {
    "late_policy_status": "none"
  }
}
```

Clears:

- late/missing label
- custom_grade_status_id

✔ Confirmed.

⚠ This is indirect and couples late policy with custom status.

---

# 4️⃣ GraphQL – Submission Custom Status

Mutation discovered via schema introspection:

```
updateSubmissionGradeStatus
```

Input fields:

- submissionId (required)
- customGradeStatusId
- latePolicyStatus
- checkpointTag

---

## Clear Submission Custom Status (GraphQL)

```graphql
mutation {
  updateSubmissionGradeStatus(input: {
    submissionId: "26031",
    customGradeStatusId: null
  }) {
    submission {
      customGradeStatusId
      latePolicyStatus
    }
  }
}
```

✔ Successfully clears.

---

## Set Submission Custom Status (GraphQL)

```graphql
mutation {
  updateSubmissionGradeStatus(input: {
    submissionId: "26031",
    customGradeStatusId: "1"
  }) {
    submission {
      customGradeStatusId
    }
  }
}
```

✔ Successfully sets.

---

## Important Discovery

GraphQL accepts numeric `submissionId`:

```
submissionId: "26031"
```

It returns the global ID:

```
U3VibWlzc2lvbi0yNjAzMQ==
```

So numeric submission IDs are valid input in this instance. Global IDs are likely invalid, although ChatGPT claims otherwise.

---

# 5️⃣ Combining Override + Submission Status

This works in one POST:

```graphql
mutation {
  setOverrideScore(...) { __typename }
  setOverrideStatus(...) { __typename }
  updateSubmissionGradeStatus(...) {
    submission { customGradeStatusId }
  }
}
```

✔ All three execute successfully.

---

# 6️⃣ GraphQL – Rubric Grade Clearing Attempt

Mutation:

```
saveRubricAssessment
```

Required input:

- submissionId
- rubricAssociationId
- assessmentDetails (JSON)
- gradedAnonymously

Attempting:

```json
assessmentDetails: {
  "_9586": { "points": null }
}
```

Result:

```
internal_server_error
```

⚠ GraphQL true-clear of rubric via saveRubricAssessment not yet confirmed.
⚠ REST rubric clear remains the only confirmed working method.

---

# 7️⃣ Bulk Upload Endpoint

```
POST /submissions/update_grades
```

Unconfirmed behavior:
- Whether rubric points null is respected in bulk.

Recommendation:
- Handle gated students outside bulk upload.
- Use per-student operations for:
    - true clear
    - status setting
    - override control

---

# 8️⃣ Confirmed Reliable Primitives

| Layer | Set | Clear | Recommended |
|--------|------|--------|-------------|
| Override Score | GraphQL | GraphQL | ✔ |
| Override Status | GraphQL | GraphQL | ✔ |
| Submission Status | GraphQL | GraphQL | ✔ |
| Submission Grade | REST (rubric) | REST (rubric null) | ✔ |
| Submission Status (REST indirect) | REST | REST | ⚠ fallback |

---

# 9️⃣ Clean Architecture Recommendation

For OutcomeCompletionGate:

When `zeroCount > 0`:

- Override:
    - overrideScore = null
    - customGradeStatusId = configured id

- Assignment:
    - rubric points = null
    - submission custom status = configured id

When `zeroCount === 0`:

- Override:
    - overrideScore = calculated value
    - customGradeStatusId = null

- Assignment:
    - rubric points = calculated value
    - submission custom status = null

Override and submission now fully mirror each other.

---

# 10️⃣ Key Takeaways

- Override layer is fully symmetric and stable.
- Submission custom status is fully controllable via GraphQL.
- True grade clearing requires rubric null.
- Numeric submissionId works in GraphQL.
- Multi-mutation GraphQL works when properly structured.
- saveRubricAssessment true-clear not yet confirmed.

---

This is the current validated state of score & status control across override and assignment layers.