# Prompt: Add Secure, High-Performance Session Caching + Session Validation to CustomizedGradebook

I want to implement two security and performance improvements to the CustomizedGradebook codebase. These changes must improve grade caching performance while preventing cross-user data leakage in shared-computer scenarios. The design must also avoid disrupting active student assessments.

Core Principles

Never attempt to read/validate Canvas auth cookies directly (cookies are HttpOnly). Instead, validate authentication by calling GET /api/v1/users/self and handling 401 Unauthorized.

Zero tolerance for cross-user grade leakage. Any hint of user mismatch must immediately clear grade-related caches.

Canvas is an SPA. Do not rely on “page load” only. Ownership validation must occur on init AND every cache read.

1) Migrate Grade Caching from In-Memory Map to sessionStorage (Per-tab, Safer)

Target Files

Primary: src/dashboard/gradeDataService.js

Consider relocating to: src/student/gradeDataService.js if this is student-only functionality

Current State

In-memory gradeCache Map cleared on refresh/navigation

Map<courseId, { value: { score, letterGrade, source }, expiresAt }>

5-minute TTL and helper functions:

getCachedGrade(), cacheGrade(), clearGradeCache(), preCacheEnrollmentGrades()

Required Implementation

Replace Map with sessionStorage

Key format: grade_${courseId}

Value: JSON.stringify({ score, letterGrade, source, expiresAt, userId })

Add userId: ENV.current_user_id to every entry

Update Core Functions

getCachedGrade(courseId):

Call SessionValidator.validateUserOwnership() first

Parse JSON from sessionStorage

Validate userId === ENV.current_user_id

Validate expiration unless on assessment page (see section 3)

Return cached grade or null

cacheGrade(courseId, score, letterGrade, source):

Call SessionValidator.validateUserOwnership() before writing

Store entry with { userId, expiresAt }

Skip writing if on assessment page

clearGradeCache():

Remove all keys matching grade_* from sessionStorage

preCacheEnrollmentGrades(courses):

One-call preload using courses endpoint (or existing approach)

Batch-store results into sessionStorage with userId + expiresAt

Skip running on assessment pages

Maintain Existing Behavior

Preserve fallback hierarchy (AVG assignment → enrollment grade)

Preserve expiration checks (but allow “read stale during assessments”)

No changes to external API contracts

Important Note

sessionStorage is per-tab. This improves privacy (less cross-tab leakage) but means caching won’t automatically carry across tabs.

2) Add Idle Timeout Cache Clearing (Walk-away Protection)

Requirement

If a student remains inactive for 5 minutes, clear grade caches even if the tab stays open.

Implementation

Store lastActivityAt in sessionStorage

Add throttled listeners for:

mousemove, keydown, pointerdown, scroll, touchstart

Run a timer every 30–60 seconds:

If Date.now() - lastActivityAt > 5 minutes:

Clear grade-related caches (grade_*, etc.)

Log a debug message

Reset lastActivityAt on activity

3) Implement Comprehensive Session Security Module

New File

src/utils/sessionValidator.js (or under src/student/ if student-only)

Required API Surface
class SessionValidator {
constructor(options = {})
init()
validateUserOwnership()
async isSessionValid()
clearGradeCaches()
startPeriodicValidation(intervalMs = 300000) // 5 min default
stopValidation()
}

Security Requirements

User Ownership Validation (Must Run on Init AND Every Cache Read)

Store a single marker sessionUserId in sessionStorage on first init

On init() and before any cache read/write:

If sessionUserId exists and differs from ENV.current_user_id:

Clear all grade-related caches immediately

Replace sessionUserId with current user

Log the event

Session Expiration Detection (No Cookie Inspection)

Implement isSessionValid() via GET /api/v1/users/self

Detect 401 Unauthorized → clear grade caches and stop background work

Avoid excessive calls:

Validate on init

Then validate periodically (default 5 minutes), only when user is active and not on assessment pages

Comprehensive Cache Clearing

Clear these patterns:

grade_*, standardsBased_*, hasAvgAssignment_*, roleGroup_*

Preserve non-sensitive preferences keys (explicit allowlist)

Log what was cleared (counts, patterns)

4) Quiz/Assessment Protection Strategy (Critical)

Goal
Prevent API calls during active assessments to avoid disruption.

Detection

URL patterns:

/courses/*/quizzes/*/take

/courses/*/assignments/*/submissions/*

DOM indicators (examples):

body.quizzes-show

#quiz-submission

Behavior During Assessments

Suspend periodic session validation

Skip preloading grades

Skip writing/updating caches

Allow reading cached data even if expired (“stale-ok mode”)

Resume normal behavior after leaving assessment pages

5) Early Loading Strategy (Performance)

Recommendation

On first landing in Canvas (Dashboard / courses list):

Preload enrollment grades in as few calls as possible

Cache results in sessionStorage

Ensure this preload:

Does not run on assessment pages

Does not run repeatedly if already cached and not expired

6) TTL vs Validation Balance (Recommended Defaults)

Cache TTL: 10–30 minutes

Idle clear: 5 minutes

Session validation: once on init + every 5 minutes, but only if:

user has been active since last validation, and

not on an assessment page

Success Criteria & Validation
Security (Zero Tolerance)

No cross-user grade data leakage

Cache cleared immediately on user mismatch

Cache cleared on session expiration (401)

Grade data does not persist meaningfully after logout (clears on next init/validation)

Performance

60%+ reduction in redundant API calls during normal browsing

Faster SPA navigation due to sessionStorage persistence

No API activity during assessments

Validation overhead is minimal and throttled

Testing Scenarios

Student A logs in, browses, logs out → Student B logs in (no leakage)

Session expires mid-browsing (401 clears caches)

Student takes quiz (no preload/validation calls, cached reads allowed)

Multiple tabs open (expect per-tab caching; still safe)

sessionStorage unavailable/full (fallback gracefully to in-memory Map)