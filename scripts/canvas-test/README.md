# Canvas test harness — morenetlab only

Standalone Node scripts that independently verify **Canvas platform behavior**
(file `visibility_level`/`locked` interaction) against `morenetlab.instructure.com`,
using a scoped API token. This is a one-off verification tool, not part of the
application.

## Hard separation from application code

**This is the only place in the repo that uses `Authorization: Bearer` auth.**
Every other file — `src/services/districtConfigService.js`,
`src/utils/canvasApiClient.js`, `districtSettings/districtSettings.html`, and
everything else — authenticates exclusively via session cookie + CSRF token.
If a `Bearer` header ever shows up in application code, something has gone
wrong; it belongs only in `scripts/canvas-test/`.

These scripts also don't call the application's own functions
(`districtConfigService.js` etc.) — those are built for in-browser cookie auth
and can't run standalone in Node. Instead, this harness re-verifies the same
Canvas-side assumptions those functions rely on, using a different auth path.

## Setup

Required environment variables (never hardcode these, never commit them):

| Variable | Required | Description |
|---|---|---|
| `CANVAS_TEST_TOKEN` | yes | Canvas API token, scoped to an admin account on `morenetlab.instructure.com` **only**. Never a production token. |
| `CANVAS_TEST_COURSE_ID` | yes | Course ID to create test fixtures in (e.g. `581`). |
| `CANVAS_TEST_STUDENT_ID` | for `verifyVisibility.js` | Numeric Canvas user ID of a student test account **not enrolled** in the test course, used via `as_user_id` masquerade. |
| `CANVAS_TEST_HOST` | no | Defaults to `morenetlab.instructure.com`. The client refuses to run against any host that doesn't contain `morenetlab` — this cannot be bypassed by pointing it at production. |

Node 22+ has native `fetch`; no dependencies needed. Set env vars in your shell,
or via `node --env-file=.env.canvas-test scripts/canvas-test/setupTestFixtures.js`
(`.env.canvas-test` is covered by the repo's existing `.env` gitignore pattern
if named with a `.env` prefix — double-check before creating it).

## Scripts

- **`setupTestFixtures.js`** — creates the folder/file fixtures needed for verification. **Writes to Canvas.** Defaults to a dry run that only prints the requests it would make; pass `--confirm` to actually execute. Per project policy, show the dry-run output to the project owner before ever passing `--confirm`.
- **`verifyVisibility.js`** — read-only. Checks each fixture's student-visibility behavior via `as_user_id`. Safe to run any time, no confirmation needed.

## What this verifies

1. A file with `visibility_level: 'institution'`, unlocked → expect **200** for a non-enrolled student via `as_user_id`.
2. The same file with `locked: true` → expect **401/403** for that student, regardless of `visibility_level` (Canvas checks `locked` first).
3. **New coverage:** an unlocked, institution-visible file inside a **locked folder** → previously untested; resolves the open question in `districtConfigService.js`'s `ensureFolder()` about whether folder-level lock cascades the same way file-level lock does.

## Scope and hygiene

- `morenetlab.instructure.com` only. Never `morenet.instructure.com` (production).
- Read-only calls (GET) run without asking first. Any write/lock/unlock/upload/delete call — i.e. anything `setupTestFixtures.js` does with `--confirm` — must be shown to the project owner (exact request + effect) before running.
- The token is project-scoped and will be rotated/revoked once this verification round is done. Don't treat it as a permanent fixture.
- If you write example calls anywhere for reference (this README, `task.md`, commit messages), use `<CANVAS_TEST_TOKEN>` as a placeholder — never the real value.
- Not every Canvas endpoint honors `as_user_id` identically. If a result looks unexpected, report what actually happened rather than assuming the parameter silently failed.

## Cleanup

The `CG_Test_Fixtures` folder created by `setupTestFixtures.js` is disposable —
delete it from the test course's Files once verification is done. These
scripts don't auto-delete anything (deletion is a write action too, subject to
the same confirm-before-running rule).
