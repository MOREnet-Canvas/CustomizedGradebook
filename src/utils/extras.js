export function getElapsedTimeSinceStart(endTime = Date.now()) {

    const start = localStorage.getItem(`startTime_${getCourseId()}`);
    if (!start) return 0;

    const startMs = new Date(start).getTime();
    const endMs = (endTime instanceof Date) ? endTime.getTime() : new Date(endTime).getTime();

    return Math.floor((endMs - startMs) / 1000); // seconds
}

export function formatDuration(seconds) {
    if (seconds == null || isNaN(seconds)) return "N/A";
    seconds = Math.max(0, Math.floor(Number(seconds)));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
}

export function renderLastUpdateNotice(container, courseId) {
    let row = container.querySelector('#avg-last-update');
    if (!row) {
        row = document.createElement('div');
        row.id = 'avg-last-update';
        row.style.fontSize = '12px';
        row.style.marginTop = '4px';
        row.style.opacity = '0.8';
        container.appendChild(row);
    }

    const lastAt = localStorage.getItem(`lastUpdateAt_${courseId}`);
    const durSec = parseInt(localStorage.getItem(`duration_${courseId}`), 10);
    const formatDuration = (s) => Number.isFinite(s) ? `${Math.floor(s / 60)}m ${s % 60}s` : 'N/A';

    row.textContent = lastAt
        ? `Last update: ${new Date(lastAt).toLocaleString()} | Duration: ${formatDuration(durSec)}`
        : `Last update: none yet`;
}

export function cleanUpLocalStorage() {
    let courseId = getCourseId();
    localStorage.removeItem(`verificationPending_${courseId}`);
    localStorage.removeItem(`expectedAverages_${courseId}`);
    localStorage.removeItem(`uploadFinishTime_${courseId}`);
    //localStorage.setItem("updateInProgress","false");
    localStorage.removeItem(`updateInProgress_${courseId}`);
    localStorage.removeItem(`startTime_${courseId}`);

}

export async function resumeIfNeeded() {
    const courseId = getCourseId();
    const inProgress = localStorage.getItem(`updateInProgress_${courseId}`) === "true";
    const verificationPending = localStorage.getItem(`verificationPending_${courseId}`) === "true";
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    const outcomeId = localStorage.getItem(`outcomeId_${courseId}`);
    const expectedAverages = safeParse(localStorage.getItem(`expectedAverages_${courseId}`));

    if (VERBOSE_LOGGING) console.log('Checking if resume is needed');
    // If a job is still running, re-show banner and resume polling
    if (inProgress && progressId) {
        const box = showFloatingBanner({ text: "Resuming: checking upload status" });
        await waitForBulkGrading(box); // this reads progressId from localStorage
        // after this returns, we may still need to verify (next block)
    }

    // If verification was never done, run it now
    if (verificationPending && courseId && outcomeId && Array.isArray(expectedAverages)) {
        if (VERBOSE_LOGGING) console.log('verificationPending');
        const box = showFloatingBanner({ text: "Verifying updated scores" });
        try {
            await verifyUIScores(courseId, expectedAverages, outcomeId, box);
            box.setText(`All ${expectedAverages.length} scores verified!`);
        } catch (e) {
            console.warn("Verification on resume failed:", e);
            box.setText("Verification failed. You can try updating again.");
        } finally {
            // clear verification state regardless
            cleanUpLocalStorage()

            // refresh the header notice if present
            const toolbar = document.querySelector('.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]');
            if (toolbar && typeof renderLastUpdateNotice === "function") renderLastUpdateNotice(toolbar);
        }
    }
}

export function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
}

export function startElapsedTimer(courseId, box) {
    // Use the inner text node created in showFloatingBanner
    const node = box.querySelector('.floating-banner__text') || box;

    // Kill any existing timer for this banner
    stopElapsedTimer(box);

    const re = /\(Elapsed time:\s*\d+s\)/; // match your current phrasing

    const tick = () => {
        const elapsed = getElapsedTimeSinceStart(); // already per-course via startTime_${getCourseId()}
        const current = node.textContent || "";

        if (re.test(current)) {
            node.textContent = current.replace(re, `(Elapsed time: ${elapsed}s)`);
        } else {
            // If message doesn't have elapsed yet, append it once
            node.textContent = current.trim().length
                ? `${current} (Elapsed time: ${elapsed}s)`
                : `(Elapsed time: ${elapsed}s)`;
        }
    };

    tick(); // show immediately
    box._elapsedTimerId = setInterval(tick, 1000);
}

export function stopElapsedTimer(box) {
    if (box && box._elapsedTimerId) {
        clearInterval(box._elapsedTimerId);
        delete box._elapsedTimerId;
    }
}

export function ensureStatusPill(courseId) {
    if (document.getElementById('avg-status-pill')) return;

    // Find the button wrapper where the main button is located
    const buttonWrapper = document.querySelector('#update-scores-button')?.parentElement;
    if (!buttonWrapper) {
        // Fallback to old behavior if button wrapper not found
        const pill = document.createElement('button');
        pill.id = 'avg-status-pill';
        pill.textContent = 'Show status';
        Object.assign(pill.style, {
            position: 'fixed', bottom: '16px', right: '16px',
            padding: '6px 10px', borderRadius: '16px', border: '1px solid #ccc',
            background: '#fff', cursor: 'pointer', zIndex: 10000
        });

        pill.onclick = () => {
            pill.remove();
            localStorage.setItem(k('bannerDismissed', getCourseId()), 'false');
            const text = localStorage.getItem(k('bannerLast', getCourseId())) || 'Working';
            showFloatingBanner({ courseId: getCourseId(), text });
        };

        document.body.appendChild(pill);
        return;
    }

    // Create the status pill button to match existing UI
    const pill = makeButton({
        label: 'Show Status',
        id: 'avg-status-pill',
        tooltip: 'Show last update status',
        onClick: async () => {
            pill.remove();
            localStorage.setItem(k('bannerDismissed', getCourseId()), 'false');

            // Check if there's an active process that needs dynamic updating
            const courseId = getCourseId();
            const inProgress = localStorage.getItem(`updateInProgress_${courseId}`) === "true";
            const verificationPending = localStorage.getItem(`verificationPending_${courseId}`) === "true";
            const progressId = localStorage.getItem(`progressId_${courseId}`);
            const outcomeId = localStorage.getItem(`outcomeId_${courseId}`);
            const expectedAverages = safeParse(localStorage.getItem(`expectedAverages_${courseId}`));

            // If there's an active process, resume with dynamic updating
            if (inProgress && progressId) {
                const box = showFloatingBanner({ text: "Resuming: checking upload status" });
                await waitForBulkGrading(box);
                return;
            }

            if (verificationPending && courseId && outcomeId && Array.isArray(expectedAverages)) {
                const box = showFloatingBanner({ text: "Verifying updated scores" });
                try {
                    await verifyUIScores(courseId, expectedAverages, outcomeId, box);
                    box.setText(`All ${expectedAverages.length} scores verified!`);
                } catch (e) {
                    console.warn("Verification on resume failed:", e);
                    box.setText("Verification failed. You can try updating again.");
                }
                return;
            }

            // Otherwise, just show the last static message
            const text = localStorage.getItem(k('bannerLast', getCourseId())) || 'Working';
            showFloatingBanner({ text });
        },
        type: "secondary"
    });

    // Style the pill to be smaller and positioned above the main button
    pill.style.fontSize = '11px';
    pill.style.padding = '4px 8px';
    pill.style.marginBottom = '4px';
    pill.style.marginLeft = '0';

    // Insert the pill at the top of the button wrapper (above the main button)
    buttonWrapper.insertBefore(pill, buttonWrapper.firstChild);
}

export function getUserRoleGroup() {
    // ----- caching keys are per-user -----
    const userId = ENV?.current_user_id ? String(ENV.current_user_id) : "unknown_user";
    const cacheKeyGroup = `roleGroup_${userId}`;
    const cacheKeyDebug = `roleGroup_debug_${userId}`; // optional: helpful for testing

    // Try cache first
    const cachedGroup = sessionStorage.getItem(cacheKeyGroup);
    if (cachedGroup) {
        return cachedGroup;
    }

    // No cache (or new user) -> compute fresh

    // Collect all possible role indicators
    const collected = new Set();

    // Array-based roles (Canvas lists)
    if (Array.isArray(ENV?.current_user_roles)) {
        ENV.current_user_roles.forEach(r => collected.add(String(r)));
    }
    if (Array.isArray(ENV?.current_user_types)) {
        ENV.current_user_types.forEach(r => collected.add(String(r)));
    }

    // Boolean flags -> treat them like role labels
    if (ENV?.current_user_is_admin) collected.add("admin");
    if (ENV?.current_user_is_student) collected.add("student");
    if (ENV?.current_user_is_teacher) collected.add("teacher");
    if (ENV?.current_user_is_observer) collected.add("observer");

    // Normalize everything to lowercase for comparison
    const normRoles = Array.from(collected).map(r => r.toLowerCase());

    if (VERBOSE_LOGGING) {
        console.log("[role debug] userId:", userId);
        console.log("[role debug] raw ENV.current_user_roles:", ENV?.current_user_roles);
        console.log("[role debug] raw ENV.current_user_types:", ENV?.current_user_types);
        console.log("[role debug] booleans:", {
            current_user_is_admin: ENV?.current_user_is_admin,
            current_user_is_student: ENV?.current_user_is_student,
            current_user_is_teacher: ENV?.current_user_is_teacher,
            current_user_is_observer: ENV?.current_user_is_observer
        });
        console.log("[role debug] normalized roles:", normRoles);
    }

    // Buckets
    const teacherLike = ["teacher", "admin", "root_admin", "designer", "ta", "accountadmin"];
    const studentLike = ["student", "observer"];

    // Decide group.
    // IMPORTANT: check student_like first so students don't accidentally
    // get treated as teacher_like just because of weird inherited roles.
    let group = "other";
    if (normRoles.some(r => studentLike.includes(r))) {
        group = "student_like";
    } else if (normRoles.some(r => teacherLike.includes(r))) {
        group = "teacher_like";
    }

    // Cache it for this user in THIS tab/session only
    sessionStorage.setItem(cacheKeyGroup, group);

    // Optional: helpful during testing so you can inspect what we saw
    sessionStorage.setItem(
        cacheKeyDebug,
        JSON.stringify({
            userId,
            normRoles,
            decided: group
        })
    );

    return group;
}


export async function courseHasAvgAssignment() {
    const courseId = getCourseId();
    if (!courseId) return false;

    // check sessionStorage first
    const cacheKey = `hasAvgAssignment_${courseId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
        return cached === "true";
    }

    try {
        const response = await fetch(
            `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`
        );
        const assignments = await response.json();

        const hasAvg = assignments.some(a => a.name === AVG_ASSIGNMENT_NAME);
        // save result for the session
        sessionStorage.setItem(cacheKey, hasAvg ? "true" : "false");

        return hasAvg;
    } catch (e) {
        console.warn("Could not verify assignment existence:", e);
        return false;
    }
}

export function isDashboardPage() {
    const path = window.location.pathname;
    return path === "/" || path.startsWith("/dashboard");
}

export function debounce(fn, delay) {
    let timeout;
    return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(), delay);
    };
}

export function extractCourseIdFromHref(href) {
    // expects things like "/courses/512/grades/190"
    const m = href.match(/^\/courses\/(\d+)\b/);
    return m ? m[1] : null;
}

// Pull the raw numeric score from the Current Score assignment row
export function extractCurrentScoreFromPage() {
    const assignmentLinks = document.querySelectorAll('a[href*="/assignments/"]');
    for (const link of assignmentLinks) {
        if (link.textContent.trim() === AVG_ASSIGNMENT_NAME) {
            const row = link.closest('tr');
            if (!row) continue;
            const candidates = [
                row.querySelector('.original_score'),
                row.querySelector('.original_points'),
                row.querySelector('.assignment_score .grade')
            ];
            for (const el of candidates) {
                const txt = el?.textContent?.trim();
                if (!txt) continue;
                const m = txt.match(/(\d+(?:\.\d+)?)/);
                if (m) {
                    if (VERBOSE_LOGGING) {
                        console.log(`Found Current Score Assignment in table: ${m[1]} (from ${el.className})`);
                    }
                    return m[1]; // raw numeric, not a %
                }
            }
        }
    }
    if (VERBOSE_LOGGING) console.log('No Current Score Assignment found');
    return null;
}

export async function setOverrideScoreGQL(enrollmentId, overrideScore) {
    const csrfToken = getTokenCookie('_csrf_token'); // reuse your helper
    if (!csrfToken) throw new Error("No CSRF token found.");

    const query = `
    mutation SetOverride($enrollmentId: ID!, $overrideScore: Float!) {
      setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        grades { customGradeStatusId overrideScore __typename }
        __typename
      }
    }`;

    const res = await fetch("/api/graphql", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
            "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({
            query,
            variables: {
                enrollmentId: String(enrollmentId),
                overrideScore: Number(overrideScore)
            }
        })
    });

    if (!res.ok) throw new Error(`GQL HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(`GQL error: ${JSON.stringify(json.errors)}`);
    return json.data?.setOverrideScore?.grades?.[0]?.overrideScore ?? null;
}

// Cache: courseId -> Map(userIdStr -> enrollmentId)
export const __enrollmentMapCache = new Map();

/**
 * Resolve an enrollmentId for a given user in this course.
 * Uses a cached Map when available; fetches via REST if needed.
 */
export async function getEnrollmentIdForUser(courseId, userId) {
    const courseKey = String(courseId);
    const userKey = String(userId);

    // Use cache if present
    if (__enrollmentMapCache.has(courseKey)) {
        const cachedMap = __enrollmentMapCache.get(courseKey);
        return cachedMap.get(userKey) || null;
    }

    // Build the map (paginated)
    const map = new Map();
    let url = `/api/v1/courses/${courseKey}/enrollments?type[]=StudentEnrollment&per_page=100`;

    while (url) {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`Enrollments ${res.status}`);
        const data = await res.json();
        for (const e of data) {
            if (e?.user_id && e?.id) map.set(String(e.user_id), e.id);
        }
        // pagination
        const link = res.headers.get("Link");
        const next = link?.split(",").find(s => s.includes('rel="next"'));
        url = next ? next.match(/<([^>]+)>/)?.[1] ?? null : null;
    }

    __enrollmentMapCache.set(courseKey, map);
    return map.get(userKey) || null;
}

// Apply overrides concurrently as bulk updates run
export async function queueOverride(courseId, userId, average) {
    if (!ENABLE_GRADE_OVERRIDE) return;

    try {
        const enrollmentId = await getEnrollmentIdForUser(courseId, userId);
        if (!enrollmentId) {
            if (VERBOSE_LOGGING) console.warn(`[override/concurrent] no enrollmentId for user ${userId}`);
            return;
        }

        const override = OVERRIDE_SCALE(average);
        await setOverrideScoreGQL(enrollmentId, override);
        if (VERBOSE_LOGGING) console.log(`[override/concurrent] user ${userId} → enrollment ${enrollmentId}: ${override}`);
    } catch (e) {
        console.warn(`[override/concurrent] failed for user ${userId}:`, e?.message || e);
    }
}

export function waitForGradebookAndToolbar(callback) {
    let attempts = 0;
    const intervalId = setInterval(() => {
        const onGradebookPage = window.location.pathname.includes('/gradebook');
        const documentReady = document.readyState === 'complete';
        const toolbar = document.querySelector(
            '.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]'
        );

        if (onGradebookPage && documentReady && toolbar) {
            clearInterval(intervalId);
            if (VERBOSE_LOGGING) console.log("Gradebook page and toolbar found.");
            callback(toolbar);
        } else if (attempts++ > 33) {
            clearInterval(intervalId);
            console.warn("Gradebook toolbar not found after 10 seconds, UI not injected.");
        }
    }, 300);
}

export function calculateStudentAverages(data, outcomeId) {
    const averages = [];
    console.log("Calculating student averages...");

    const excludedOutcomeIds = new Set([String(outcomeId)]);

    // Map outcome IDs to titles for lookup (NOTE: likely not needed)
    const outcomeMap = {};
    (data?.linked?.outcomes ?? []).forEach(o => outcomeMap[o.id] = o.title);

    function getCurrentOutcomeScore(scores) {
        if(VERBOSE_LOGGING){console.log('Scores: ', scores);}
        const match = scores.find(s => String(s.links?.outcome) === String(outcomeId));
        return match?.score ?? null;  // return null if not found
    }

    if (VERBOSE_LOGGING) console.log("data: data being sent to calculateStudentAverages", data);

    for (const rollup of data.rollups) {
        const userId = rollup.links?.user;


        const oldAverage = getCurrentOutcomeScore(rollup.scores)

        // see if url specifies to zero out scores for testing
        if(window.__ZERO_ALL_AVERAGES__){
            averages.push({userId, average: 0});
            continue;
        }


        const relevantScores = rollup.scores.filter(s => {
            const id = String(s.links?.outcome);
            const title = (outcomeMap[id] || "").toLowerCase();

            return (
                typeof s.score === 'number' && // must have a numeric score
                !excludedOutcomeIds.has(id) &&        // not in the excluded IDs set
                !EXCLUDED_OUTCOME_KEYWORDS.some(keyword =>
                    title.includes(keyword.toLowerCase()) // title doesn't contain any keyword
                )
            );
        });

        if (relevantScores.length === 0) continue;

        const total = relevantScores.reduce((sum, s) => sum + s.score, 0);
        let newAverage = total / (relevantScores.length);
        newAverage = parseFloat(newAverage.toFixed(2));


        if (VERBOSE_LOGGING) console.log(`User ${userId}  total: ${total}, count: ${relevantScores.length}, average: ${newAverage}`);
        if (VERBOSE_LOGGING) console.log(`Old average: ${oldAverage} New average: ${newAverage}`);
        if (oldAverage === newAverage) {
            if(VERBOSE_LOGGING){console.log("old average matches new average")}
            continue} // no update needed

        averages.push({userId, average: newAverage});
    }


    if (VERBOSE_LOGGING){console.log("averages after calculations:", averages);}
    return averages;
}

export async function submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, score) {
    const csrfToken = getTokenCookie('_csrf_token');
    if (VERBOSE_LOGGING) console.log("csrfToken:", csrfToken);
    const timeStamp = new Date().toLocaleString();

    if(VERBOSE_LOGGING) console.log("Submitting rubric score for student", userId);
    const payload = {
        authenticity_token: csrfToken,
        rubric_assessment: {  // updates the rubric score.
            [rubricCriterionId.toString()]: {
                points: score,
                //comments: "Score: "+ score +"  Updated: " + timeStamp,
            }
        },
        submission: { //updates assignment score to match rubric score.
            posted_grade: score.toString(),
            score: score
        },
        comment: {
            text_comment:"Score: "+ score +"  Updated: " + timeStamp,
        }
    };

    if (VERBOSE_LOGGING) console.log("Submitting rubric score for student", userId, payload);

    const response = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Submission failed for user", userId, ":", errorText);
        throw new Error(`Failed to update user ${userId}: ${errorText}`);
    }

    if (VERBOSE_LOGGING) console.log("Score submitted successfully for user", userId);
}

export async function beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages) {
    const csrfToken = getTokenCookie('_csrf_token');
    if (!csrfToken) throw new Error("CSRF token not found.");
    const timeStamp = new Date().toLocaleString();


    // Build grade_data object
    const gradeData = {};
    if (VERBOSE_LOGGING) console.log("averages:", averages);
    for (const { userId, average } of averages) {
        if (VERBOSE_LOGGING) console.log("userId:", userId, "score:", average);
        gradeData[userId] = {
            posted_grade: average,
            text_comment: "Score: "+ average +"  Updated: " + timeStamp,
            rubric_assessment: {
                [rubricCriterionId.toString()]: {
                    points: average,
                    //comments: "Score: "+ average +"  Updated: " + timeStamp,
                }
            }
        };
        // Fire override in parallel (do not await)
        if (ENABLE_GRADE_OVERRIDE) {
            queueOverride(courseId, userId, average);
        }
    }
    if (VERBOSE_LOGGING) console.log("bulk gradeData payload:", gradeData);

    const response = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/update_grades`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            authenticity_token: csrfToken,
            grade_data: gradeData
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Bulk grade update failed:", errorText);
        throw new Error(`Failed to bulk update grades: ${errorText}`);
    }


    const result = await response.json();  // contains progress object
    const progressId = result.id;
    localStorage.setItem(`progressId_${getCourseId()}`, progressId);

    console.log("Waiting for grading to complete progress ID:", progressId);
    return progressId;
}

export async function waitForBulkGrading(box, timeout = 1200000, interval = 2000) {
    const loopStartTime = Date.now();
    let state = "beginning upload";
    const courseId= getCourseId();
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    // let leaveAlertShown = false
    startElapsedTimer(courseId, box); // makes elapsed time tick each second


    while (Date.now() - loopStartTime < timeout) {
        const res = await fetch(`/api/v1/progress/${progressId}`);
        const progress = await res.json();
        let elapsed =   getElapsedTimeSinceStart();

        state = progress.workflow_state;

        if (VERBOSE_LOGGING){console.log(`Bulk Uploading Status: ${state} (elapsed: ${elapsed}s)`);}

        // Don't show "COMPLETED" status to avoid user confusion
        if (state !== "completed") {
            box.soft(`Bulk uploading status: ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
        }


        switch(state){

            case "queued":
                // if (!leaveAlertShown) {
                //     alert(leaveMessage(elapsed));
                //     leaveAlertShown = true;
                // }
                break;

            case "running":
                // if (!leaveAlertShown) {
                //     alert(leaveMessage(elapsed));
                //     leaveAlertShown = true;
                // }
                break;

            case "failed":
                if (VERBOSE_LOGGING){console.error("Bulk update job failed.");}
                throw new Error("Bulk update failed.");

            case "completed":
                if (VERBOSE_LOGGING){ console.log("Bulk upload completed: " + progress.updated_at);}
                localStorage.setItem(`uploadFinishTime_${getCourseId()}`, progress.updated_at);
                // Clear the updateInProgress flag so status restoration can move to verification
                localStorage.removeItem(`updateInProgress_${getCourseId()}`);
                return;

            default:
                break;
        }

        await new Promise(r => setTimeout(r, interval));
    }

    throw new Error(`Bulk update is taking longer than expected. In a few minutes try updating again. 
                        If there are no changes to be made the update completed`);

}

// noinspection JSUnusedLocalSymbols

export async function postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, testing = false) {
    const updateInterval = 1 // Math.max(1, Math.floor(numberOfUpdates / 20));
    const numberOfUpdates = averages.length;

    box.setText(`Updating "${AVG_OUTCOME_NAME}" scores for ${numberOfUpdates} students...`);

    const failedUpdates = [];
    const retryCounts = {};  // userId - number of attempts
    const retriedStudents = new Set();  // tracks students who needed >1 attempt

    async function tryUpdateStudent(student, maxAttempts = 3) {
        const { userId, average } = student;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, average);
                // --- also set course override (non-blocking) ---
                if (ENABLE_GRADE_OVERRIDE) {
                    try {
                        const enrollmentId = await getEnrollmentIdForUser(courseId, userId);
                        if (enrollmentId) {
                            const override = OVERRIDE_SCALE(average);
                            await setOverrideScoreGQL(enrollmentId, override);
                            if (VERBOSE_LOGGING) console.log(`[override] user ${userId} → enrollment ${enrollmentId}: ${override}`);
                        } else if (VERBOSE_LOGGING) {
                            console.warn(`[override] no enrollmentId for user ${userId}`);
                        }
                    } catch (e) {
                        console.warn(`[override] failed for user ${userId}:`, e?.message || e);
                        // don’t fail the grade update on override issues
                    }
                }
// --- end override block ---

                retryCounts[userId] = attempt;
                if (attempt > 1) retriedStudents.add(userId);
                return true;
            } catch (err) {
                lastError = err;
                if (attempt === 1) retryCounts[userId] = 1;
                else retryCounts[userId]++;
                console.warn(`Attempt ${attempt} failed for student ${userId}:`, err.message);
            }
        }

        return lastError;
    }


    // First pass
    const deferred = [];

    for (let i = 0; i < numberOfUpdates; i++) {
        const student = averages[i];
        const result = await tryUpdateStudent(student, 3);
        if (result !== true) {
            deferred.push({ ...student, error: result.message });
        }

        if (i % updateInterval === 0 || i === numberOfUpdates - 1) {
            box.setText(`Updating "${AVG_OUTCOME_NAME}"  ${i + 1} of ${numberOfUpdates} students processed`);
        }
    }

    console.log(`Retrying ${deferred.length} students...`);

    // Retry failed students
    for (const student of deferred) {
        const retryResult = await tryUpdateStudent(student, 3);
        if (retryResult !== true) {
            failedUpdates.push({
                userId: student.userId,
                average: student.average,
                error: retryResult.message
            });
        }
    }

    const totalRetried = retriedStudents.size;
    const retrySummary = Object.entries(retryCounts)
        .filter(([_, count]) => count > 1)
        .map(([userId, count]) => ({ userId, attempts: count }));

    console.log(`${totalRetried} students needed more than one attempt.`);
    console.table(retrySummary);

    let confirmSummaryDownload = false

    if (testing) {confirmSummaryDownload = true}

    if (failedUpdates.length > 0) {
        console.warn("Scores of the following students failed to update:", failedUpdates);
    }

    if ((failedUpdates.length > 0 || retrySummary.length > 0) && !testing) {
        confirmSummaryDownload = confirm(`Export grade update attempt counts and failure logs to a file? \n\n 
           Note: Your browser settings or extensions may block automatic file downloads.\n
           If nothing downloads, please check your pop-up or download permissions.`);
    }

    if (confirmSummaryDownload) {
        downloadErrorSummary(retrySummary, failedUpdates)
    }


    return getElapsedTimeSinceStart();



}

export function downloadErrorSummary(retryCounts, failedUpdates) {
    const note = 'Unless marked "UPDATE FAILED", the students score was successfully updated but took multiple attempts.\n';
    const headers = "User ID,Average Score,Attempts,Status,Error\n";

    const failedById = Object.fromEntries(
        failedUpdates.map(d => [d.userId, d])
    );

    const allUserIds = new Set([
        ...Object.keys(retryCounts),
        ...Object.keys(failedById)
    ]);

    const rows = Array.from(allUserIds).map(userId => {
        const attempts = retryCounts[userId] ?? "";
        const failed = failedById[userId];
        const average = failed?.average ?? "";
        const status = failed ? "UPDATE FAILED" : "";
        const error = failed?.error ? `"${failed.error.replace(/"/g, '""')}"` : "";
        return `${userId},${average},${attempts},${status},${error}`;
    });

    const content = note + headers + rows.join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "canvas_upload_error_summary.csv";
    link.click();
    URL.revokeObjectURL(url);
}

export async function verifyUIScores(courseId, averages, outcomeId, box, waitTimeMs = 5000, maxRetries = 50){
    let state = "verifying"
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let elapsed = getElapsedTimeSinceStart();
        box.soft(`Bulk uploading status: ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
        startElapsedTimer(courseId, box);

        const response = await fetch(`/api/v1/courses/${courseId}/outcome_rollups?` +
            `&outcome_ids[]=${outcomeId}&include[]=outcomes&include[]=users&per_page=100`);

        if (!response.ok) throw new Error("Failed to fetch outcome results for update verification");
        const newRollupData = await response.json();
        if (VERBOSE_LOGGING) console.log('newRollupData: ', newRollupData);
        const mismatches = [];

        for (const {userId, average} of averages) {

            const matchingRollup = newRollupData.rollups.find(
                r => r.links.user.toString() === userId.toString());


            if (!matchingRollup) {
                mismatches.push({userId, reason: "No rollup found."})
                continue
            }

            const scoreObj = matchingRollup.scores[0];

            if (!scoreObj) {
                mismatches.push({userId, reason: "No score found."})
                continue;
            }

            const score = scoreObj.score;
            const matches = Math.abs(score - average) < 0.001;

            if (!matches) {
                mismatches.push({userId, expected: average, actual: score});
            }
        }


        if (mismatches.length === 0) {
            console.log("All averages match backend scores.");
            localStorage.setItem(`lastUpdateAt_${getCourseId()}`, new Date().toISOString());
            const durationSeconds = getElapsedTimeSinceStart()
            localStorage.setItem(`duration_${getCourseId()}`, durationSeconds);


            return;
        } else {
            if(VERBOSE_LOGGING)console.warn("Mismatches found:", mismatches);
            console.log(`Waiting ${waitTimeMs / 1000} seconds before retrying...`);
            await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        }
    }

}