# Canvas, Override + Submission Status + Rubric True Clear, Unified GraphQL Operation (Field Notes)

Last updated: 2026-02-23  
Instance tested: morenetlab.instructure.com

This document captures what we have **validated in production behavior** for:

- **Enrollment-level (final grade) overrides**: score + custom grade status
- **Assignment submission-level custom status**
- **Assignment “true clear” of grade via rubric (points removed)**
- A **single unified GraphQL POST** that performs all layers atomically (in one request)
- A **reliable, Gradebook-safe** method to fetch `rubricAssociationId` via REST (no SpeedGrader network inspection)

---

## Entities Used in Validation (Example IDs)

These IDs are from our confirmed test case and are safe to substitute with your own:

- Course ID: `567`
- Assignment ID (AVG Assignment): `3587`
- User ID: `642`
- Enrollment ID: `1875`
- Submission ID (numeric works): `26031`
- Rubric ID (REST rubric resource id): `1428`
- Rubric Criterion ID: `_9586`
- Rubric Assessment ID: `9771`
- Rubric Association ID (what GraphQL `saveRubricAssessment` needs): `2645`
- Custom Grade Status ID: `1` (label: “Insufficient” / “Insufficient Evidence”)

---

## Key Takeaways

### 1) Enrollment Override and Submission Custom Status Are Independent Layers

- **Enrollment override score** (`overrideScore`) can be set/cleared independently of:
    - Enrollment **override status** (`customGradeStatusId`)
    - Assignment submission’s **custom status** (`updateSubmissionGradeStatus`)
    - Assignment rubric/grade state (rubric assessment points, submission score)

### 2) “True Clear” via GraphQL Rubric Save Has a Canvas-Specific Encoding

On this instance:

- `saveRubricAssessment` accepts `assessmentDetails` as a **JSON scalar**, but the runtime payload is **a string containing JSON**.
- **Setting `points: null` causes HTTP 422 `unprocessable_content`.**
- **Setting `points: ""` causes HTTP 422 `unprocessable_content`.**
- **True-clear is achieved by OMITTING `points` entirely** for the criterion key.

This is different from REST, where `rubric_assessment[_9586].points = null` works.

### 3) GraphQL Queries for `assignment` / `course.assignment` Are Not Available on This Schema

Attempts like:

- `course(id) { assignment(id) { rubricAssociation { _id }}}`
- `assignment(id) { rubricAssociation { _id }}`

returned top-level GraphQL error:

- `unprocessable_content`

Therefore, we use REST to discover `rubricAssociationId`.

---

## Endpoints

### GraphQL
- `POST /api/graphql`

### REST (Validated / used for discovery)
- `GET /api/v1/courses/:course_id/rubrics/:rubric_id?include=associations`
    - **Reliable way to get `rubricAssociationId`** for an assignment
- `PUT /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id`
    - with body: `rubric_assessment["_9586"].points = null` (REST true-clear alternative)

---

## Reliable Way to Get `rubricAssociationId` (Gradebook-safe)

### Why we need this
GraphQL `saveRubricAssessment` requires `rubricAssociationId` (example: `2645`), but GraphQL queries to fetch it are not available on this instance.

### Working REST method
Call:

`GET /api/v1/courses/:course_id/rubrics/:rubric_id?include=associations`

Response includes:

```json
"associations": [
  {
    "id": 2645,
    "rubric_id": 1428,
    "association_type": "Assignment",
    "association_id": 3587,
    ...
  }
]
```

- Use `associations[].id` as the **GraphQL `rubricAssociationId`**
- Filter by:
    - `association_type === "Assignment"`
    - `association_id === <assignmentId>`

### Browser Console helper (given courseId + rubricId + assignmentId)
```javascript
(async () => {
  const courseId = 567;
  const rubricId = 1428;       // REST rubric resource id
  const assignmentId = 3587;

  const res = await fetch(
    `/api/v1/courses/${courseId}/rubrics/${rubricId}?include=associations`,
    {
      credentials: "same-origin",
      headers: { accept: "application/json+canvas-string-ids" }
    }
  );

  const json = await res.json();
  const assoc = (json.associations || []).find(
    (a) =>
      String(a.association_type).toLowerCase() === "assignment" &&
      String(a.association_id) === String(assignmentId)
  );

  console.log("rubricAssociationId:", assoc?.id);
  console.log("association record:", assoc);
})();
```

> Note: If you don’t already know `rubricId`, you can get it from the assignment payload under `rubric_settings.id` (on this instance, `rubric_settings.id === 1428` matched the rubric resource id).

---

## GraphQL Mutations We Validated

### Enrollment-level override score
- `setOverrideScore(input: { enrollmentId, overrideScore })`

Behavior:
- `overrideScore: null` clears override score.

### Enrollment-level override status
- `setOverrideStatus(input: { enrollmentId, customGradeStatusId })`

Behavior:
- `customGradeStatusId: null` clears override status.

### Submission-level custom status (assignment-level)
- `updateSubmissionGradeStatus(input: { submissionId, customGradeStatusId })`

Behavior:
- **Numeric submissionId `"26031"` works.**
- `customGradeStatusId: null` clears submission custom status.

### Rubric save (assignment grade and criterion points)
- `saveRubricAssessment(input: { assessmentDetails, gradedAnonymously, rubricAssessmentId, rubricAssociationId, submissionId, provisional })`

Behavior:
- Works with numeric `submissionId`.
- Requires correct `rubricAssociationId` (`2645` in our case).
- Requires `assessmentDetails` encoded as SpeedGrader does (stringified JSON).
- True-clear on this instance requires **omitting `points` entirely**.

---

## Unified “All Four” GraphQL Operation (Confirmed Working)

This performs, in one POST:

1. Clear override score (`overrideScore: null`)
2. Set override status (`customGradeStatusId: 1`)
3. Set submission custom status (`customGradeStatusId: 1`)
4. True-clear rubric criterion `_9586` by **omitting points**

### Browser Console Script (Drop-in)

```javascript
(async () => {
  // Use cookie CSRF (works everywhere) with ENV/meta fallback
  const getCookie = (name) =>
    document.cookie
      .split(";")
      .map((c) => c.trim())
      .map((c) => c.split("=", 2))
      .find(([k]) => k === name)?.[1];

  const csrf =
    decodeURIComponent(getCookie("_csrf_token") || "") ||
    window.ENV?.csrfToken ||
    document.querySelector('meta[name="csrf-token"]')?.content ||
    "";

  if (!csrf) {
    console.error("No CSRF token found.");
    return;
  }

  const query = `
    mutation Unified_AllFour_OmitPointsClear(
      $enrollmentId: ID!
      $submissionId: ID!
      $customGradeStatusId: ID

      $assessmentDetails: JSON!
      $gradedAnonymously: Boolean!
      $rubricAssessmentId: ID
      $rubricAssociationId: ID!
      $provisional: Boolean!
    ) {
      a: setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: null }) {
        __typename
      }

      b: setOverrideStatus(input: { enrollmentId: $enrollmentId, customGradeStatusId: $customGradeStatusId }) {
        __typename
      }

      c: updateSubmissionGradeStatus(input: { submissionId: $submissionId, customGradeStatusId: $customGradeStatusId }) {
        submission {
          id
          customGradeStatusId
          latePolicyStatus
        }
      }

      d: saveRubricAssessment(input: {
        assessmentDetails: $assessmentDetails
        gradedAnonymously: $gradedAnonymously
        rubricAssessmentId: $rubricAssessmentId
        rubricAssociationId: $rubricAssociationId
        submissionId: $submissionId
        provisional: $provisional
      }) {
        errors { message attribute }
        rubricAssessment { id: _id score }
        submission { _id score grade customGradeStatus }
      }
    }
  `;

  // IMPORTANT: assessmentDetails must be a STRING (JSON scalar), matching SpeedGrader.
  // IMPORTANT: true-clear is achieved by OMITTING `points`.
  // IMPORTANT: criterion key format observed here: "criterion__9586" for rubric criterion "_9586".
  const assessmentDetailsString = JSON.stringify({
    assessment_type: "grading",
    criterion__9586: {
      comments: null,
      save_comment: "0"
      // points intentionally omitted (null/blank triggers 422 on this instance)
    }
  });

  const payload = {
    operationName: "Unified_AllFour_OmitPointsClear",
    query,
    variables: {
      enrollmentId: "1875",
      submissionId: "26031",
      customGradeStatusId: "1",

      assessmentDetails: assessmentDetailsString,
      gradedAnonymously: false,
      rubricAssessmentId: "9771",
      rubricAssociationId: "2645",
      provisional: false
    }
  };

  const res = await fetch("/api/graphql", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(async () => await res.text());
  console.log("HTTP", res.status, body);
})();
```

---

## “Why did we see HTTP 422 unprocessable_content?”

We observed 422 when attempting to clear rubric points in GraphQL using:

- `points: null`
- `points: ""`

The server rejected the request before resolver-level errors could be returned in `data.saveRubricAssessment.errors`.

However, sending the same `assessmentDetails` payload with the criterion present and **points omitted** succeeded, indicating the validator expects a “missing field” encoding for clears on this instance.

---

## Recommended Minimal Selection Sets

To reduce schema routing / payload volatility:

- For override mutations:
    - request only `__typename` or `clientMutationId`
- For submission status:
    - request minimal `submission { id customGradeStatusId latePolicyStatus }`
- For rubric save:
    - request `errors { message attribute }` and minimal `submission` fields needed for verification

---

## Verification Checklist

After the unified call:

### Enrollment override layer
- override score is cleared (null)
- override custom status is set (ID 1)

### Submission layer
- submission custom status is set (ID 1)

### Assignment grade layer
- rubric criterion `_9586` is cleared (criterion payload omits points)
- submission score/grade reflects expected cleared state (depending on course/assignment rules)

---

## Notes for Implementing in Customized Gradebook Theme

- Prefer cookie-derived `_csrf_token` when running in varied Canvas pages.
- Use numeric submission IDs when validated to work (this instance accepts them).
- Use REST to discover `rubricAssociationId`:
    - `GET /api/v1/courses/:course_id/rubrics/:rubric_id?include=associations`
    - filter associations for `association_type=Assignment` and `association_id=<assignmentId>`
- For “true clear” via GraphQL rubric save on this instance:
    - Use SpeedGrader’s `assessmentDetails` format and omit `points`.

---