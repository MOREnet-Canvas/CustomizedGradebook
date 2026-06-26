# Canvas API Gotchas

This page documents Canvas API behaviors that are non-obvious, undocumented, or contradict what you'd expect from the API structure. Each entry includes the symptom, the cause, and how the codebase handles it.

---

## Authentication

### CSRF token — use `_csrf_token` cookie + inject into body

Canvas requires a CSRF token on all mutating requests. `CanvasApiClient` reads the `_csrf_token` cookie once at construction and:

1. Sends it as the `X-CSRF-Token` header
2. Injects it as `authenticity_token` into every JSON body

Both are required. The header alone is rejected by some endpoints; the body alone fails on others.

> **Session persistence:** Canvas accepts previously-issued CSRF tokens even after cookie rotation. The token can safely be cached for the page session rather than re-read on each request.

---

## Pagination

### `per_page` defaults to 10 — always request 100

Canvas REST endpoints default to 10 items per page. `CanvasApiClient.get()` automatically appends `per_page=100` if not already present. Always use `getAllPages()` for endpoints that can return more than 100 results (e.g. enrollments in large courses).

### Pagination via `Link` header, not response body

Canvas uses `Link: <url>; rel="next"` headers to signal the next page, not a field in the JSON body. `getAllPages()` reads the `Link` header after each response and follows `rel="next"` until it is absent.

### Some paginated endpoints return objects, not arrays

`getAllPages()` detects when a response is a JSON object (not an array) and returns it immediately without following pagination. This is intentional for endpoints like `final_grade_overrides` that return a single object.

### `outcome_rollups` does not support `user_ids[]`

Passing `user_ids[]` to `/api/v1/courses/:id/outcome_rollups` returns **HTTP 400**. Always fetch all students and filter in JavaScript.

```js
// ❌ Returns 400:
GET /api/v1/courses/123/outcome_rollups?user_ids[]=456

// ✅ Fetch all, filter in JS:
GET /api/v1/courses/123/outcome_rollups?include[]=outcomes&include[]=users
```

This affects: `masteryOutlookAvgService.js` (avg verification), `gradeCalculator.js` (avg calculation).

---

## GraphQL

### GraphQL errors in `data.*.errors`, not top-level `errors`

Canvas returns rubric-level validation errors inside the mutation result data rather than at the top-level `errors` array:

```json
{
  "data": {
    "rubric": {
      "errors": [{ "message": "..." }]
    }
  },
  "errors": null
}
```

`graphqlGradingService.js` checks `data.rubric.errors` explicitly after each mutation.

### `clearPoints: true` instead of `points: null`

Passing `points: null` inside a rubric criterion object causes **HTTP 422**. To clear a criterion score, omit `points` entirely. `submitRubricAssessment` accepts a `clearPoints: boolean` parameter that controls whether `points` is included in the criterion data.

```js
// ❌ Returns 422:
{ criterion: { id: "...", points: null } }

// ✅ Omit points field entirely:
{ criterion: { id: "..." } }
```

### GraphQL for comments, REST for comment-only updates

GraphQL rubric assessment mutations always write criterion data alongside any comment. There is no safe GraphQL path to post a comment without also setting a rubric score. For note-only updates (where the grade did not change), use the Canvas REST submissions API:

```js
PUT /api/v1/courses/:id/assignments/:id/submissions/:userId
Body: { comment: { text_comment: "..." } }
```

This is why `postNoteToAvgAssignment` uses REST instead of GraphQL even though the rest of the avg service uses GraphQL.

---

## Gradebook

### LMGB and traditional gradebook share the same URL

Both the Learning Mastery Gradebook (LMGB) and the traditional gradebook are served at `/courses/:id/gradebook`. URL-based detection cannot distinguish them. The reliable detection method is via `window.ENV.GRADEBOOK_OPTIONS`:

- `ENV.GRADEBOOK_OPTIONS.settings.gradebook_view === 'learning_mastery'` → LMGB
- `ENV.GRADEBOOK_OPTIONS.outcome_proficiency` exists → LMGB fallback

---

## Canvas Files

### Three-step upload protocol for file creation

Canvas Files does not accept direct PUT/POST with file body. The upload requires three steps:

1. `POST /api/v1/courses/:id/files` — request a presigned upload URL and parameters
2. `POST <upload_url>` — multipart upload to the presigned URL (S3-style)
3. `PUT /api/v1/files/:id` — confirm the upload and lock the file

`on_duplicate: 'overwrite'` in step 1 replaces an existing file. Without it, Canvas creates a duplicate with an incremented name.

### Folder memo invalidation on write failure

If the Canvas folder for the cache file is deleted during a session, the in-memory folder ID memo becomes stale. `writeMasteryOutlookCache` calls `invalidateFolderCache(courseId)` on error so the next attempt re-discovers the folder rather than retrying with a dead ID.

### File locking — `locked: true, hidden: false`

`locked: true` marks a file as **unpublished** (students cannot access it). `hidden: false` keeps it visible to teachers in the Files UI. Setting both is required to prevent student access while allowing teacher review. The `visibility_level: 'inherit'` field is also passed to ensure the value doesn't inherit an override from a parent folder.

---

## Outcomes

### Outcome import via CSV, not JSON

Creating a new outcome requires a CSV import:

```
POST /api/v1/courses/:id/outcome_imports?import_type=instructure_csv
Content-Type: text/csv
```

Canvas returns an import ID immediately and processes asynchronously. Poll `GET /api/v1/courses/:id/outcome_imports/:id` for `workflow_state === 'succeeded'`.

### Outcome ordering requires `X-Requested-With: XMLHttpRequest`

```
POST /api/v1/courses/:id/assign_outcome_order
X-Requested-With: XMLHttpRequest
```

Without this header, Canvas returns a 404 or 422 depending on the Canvas version. The header signals that the request is an XHR (not a form submission), which is required by Canvas's routing for this endpoint.

---

## Wiki Pages

### Canvas auto-increments wiki page slugs on name conflict

If a page with the slug `mastery-outlook` already exists, creating another page with the same title results in `mastery-outlook-2`, `mastery-outlook-3`, etc. `findMasteryDashboardPageUrl` handles this by searching by title and accepting any slug that starts with `mastery-dashboard`.

### Canvas soft-deletes pages — check `workflow_state`

`GET /api/v1/courses/:id/pages/:slug` returns a deleted page with `workflow_state: 'deleted'` rather than a 404. `getPage()` in `pageService.js` checks for this and returns `null` for deleted pages.

---

## Error handling

### `CanvasApiError` carries status code and response text

`safeFetch` wraps all HTTP errors and network failures in `CanvasApiError`:

| Property | Description |
|----------|-------------|
| `statusCode` | HTTP status (`0` for network errors) |
| `responseText` | Raw response body (useful for 422 debugging) |

Network errors (fetch threw before a response) get `statusCode: 0`.

### `retryWithBackoff` does not retry `UserCancelledError`

`retryWithBackoff` has a built-in exception: if the inner function throws a `UserCancelledError`, the error is re-thrown immediately without any retry. This prevents retry loops when the user intentionally cancels.

### Custom error types

| Class | Extra properties | When thrown |
|-------|----------------|------------|
| `CanvasApiError` | `statusCode`, `responseText` | HTTP errors, network failures, JSON parse failures |
| `TimeoutError` | `timeoutMs` | Async operations that exceed a time limit (e.g. outcome import polling) |
| `ValidationError` | `field` | Input validation failures |
| `UserCancelledError` | — | User explicitly cancels an operation |

---

## Mastery refresh

### Canvas requires a timing workaround for `points_possible` changes

After changing `points_possible` on a rubric or assignment, Canvas needs time to propagate the change before the mastery refresh calculation is correct. If the refresh runs too quickly, Canvas may still compute mastery against the old `points_possible`. `MASTERY_REFRESH_DELAY_MS` (default 5 s) controls this wait. Set it higher in slow Canvas environments.
