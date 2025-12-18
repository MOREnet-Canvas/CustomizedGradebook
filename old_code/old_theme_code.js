// noinspection DuplicatedCode,JSUnresolvedReference,ExceptionCaughtLocallyJS


(function () {
    let VERBOSE_LOGGING = false; // Set to true when trying to troubleshoot issues.
    const ENABLE_STUDENT_GRADE_CUSTOMIZATION = true; // Set true to enable student grade page modifications
    const REMOVE_ASSIGNMENT_TAB = false;
    const SCRIPT_VERSION = '0.172s'
    const PER_STUDENT_UPDATE_THRESHOLD = 500;
    const ENABLE_GRADE_OVERRIDE = true;               // set false to disable
    const OVERRIDE_SCALE = (avg) => Number((avg * 25).toFixed(2)); // 0–4 -> 0–100


    const UPDATE_AVG_BUTTON_LABEL = 'Update Current Score';
    const AVG_OUTCOME_NAME = 'Current Score';
    const AVG_ASSIGNMENT_NAME = 'Current Score Assignment';
    const AVG_RUBRIC_NAME = 'Current Score Rubric';
    const DEFAULT_MAX_POINTS = 4;
    const DEFAULT_MASTERY_THRESHOLD = 3;
    const OUTCOME_AND_RUBRIC_RATINGS = [
        // {description: 'Exceeds Mastery', points: 4},
        // {description: 'Meets Mastery', points: 3},
        // {description: 'Approaching Mastery', points: 2},
        // {description: 'Below Mastery', points: 1}
        // {description: 'No Evidence', points: 0}
        {description: "Exemplary", points: 4},
        {description: "Beyond Target", points: 3.5},
        {description: "Target", points: 3},
        {description: "Approaching Target", points: 2.5},
        {description: "Developing", points: 2},
        {description: "Beginning", points: 1.5},
        {description: "Needs Partial Support", points: 1},
        {description: "Needs Full Support", points: 0.5},
        {description: "No Evidence", points: 0}
    ];
    const EXCLUDED_OUTCOME_KEYWORDS = ["Homework Completion"]


    //region ***********************Utility Functions********************************* //

    const BRAND_COLOR = getComputedStyle(document.documentElement)
        .getPropertyValue('--ic-brand-primary')
        .trim() || "#0c7d9d";

    const k = (name, courseId) => `${name}_${courseId}`;

    function inheritFontStylesFrom(selector, element) {
        const source = document.querySelector(selector);
        if (source) {
            const styles = getComputedStyle(source);
            element.style.fontSize = styles.fontSize;
            element.style.fontFamily = styles.fontFamily;
            element.style.fontWeight = styles.fontWeight;
            return true;
        }
        return false;
    }

    function makeButton({ label, id = null, onClick = null, type = "primary", tooltip = null }) {
        const button = document.createElement("button");

        button.textContent = label;
        if (id) button.id = id;
        if (tooltip) button.title = tooltip;

        // Try to inherit font styles from a known Canvas menu / button element (default settings are a bit too small)
        const foundFontStyles = inheritFontStylesFrom('.css-1f65ace-view-link', button);
        // If not found, fallback to default font styling
        if (!foundFontStyles) {
            button.style.fontSize = "14px";
            button.style.fontFamily = "inherit";
            button.style.fontWeight = "600";
        }

        // Basic button appearance
        button.style.marginLeft = "1rem";
        button.style.padding = "0.5rem 1rem";
        button.style.border = "none";
        button.style.borderRadius = "5px";
        button.style.cursor = "pointer";
        button.style.transition = "background 0.3s, color 0.3s";

        const rootStyles = getComputedStyle(document.documentElement);
        const primaryButtonColor = rootStyles.getPropertyValue('--ic-brand-button--primary-bgd').trim() || "#0c7d9d";
        const textColor = rootStyles.getPropertyValue('--ic-brand-button--primary-text').trim() || "#ffffff";
        const secondaryButtonColor = rootStyles.getPropertyValue('--ic-brand-button--secondary-bgd').trim() || "#e0e0e0";
        const secondaryTextColor = rootStyles.getPropertyValue('--ic-brand-button--secondary-text').trim() || "#ffffff";

        if (type === "primary") {
            button.style.background = primaryButtonColor;
            button.style.color = textColor;
        } else if (type === "secondary") {
            button.style.background = secondaryButtonColor;
            button.style.color = secondaryTextColor;
            button.style.border = "1px solid #ccc";
        }

        if (onClick) {
            button.addEventListener("click", onClick);
        }

        return button;
    }

    function createButtonColumnContainer() {
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "row";
        container.style.gap = "0.01rem"; // spacing between buttons
        container.style.marginLeft = "1rem"; // optional spacing from the rest of the toolbar
        return container;
    }

    function injectButtons() {
        waitForGradebookAndToolbar((toolbar) => {
            const courseId = getCourseId();

            // Create a vertical container for the button and the notice
            const buttonWrapper = document.createElement("div");
            buttonWrapper.style.display = "flex";
            buttonWrapper.style.flexDirection = "column";
            buttonWrapper.style.alignItems = "flex-end"; // keep button right-aligned

            const updateAveragesButton = makeButton({
                label: UPDATE_AVG_BUTTON_LABEL,
                id: "update-scores-button",
                tooltip: `v${SCRIPT_VERSION} - Update Current Score averages`,
                onClick: async () => {
                    try {
                        await startUpdateFlow();
                    } catch (error) {
                        console.error(`Error updating ${AVG_OUTCOME_NAME} scores:`, error);
                        alert(`Error updating ${AVG_OUTCOME_NAME} scores: ` + error.message);
                    }
                },
                type: "primary"
            });

            buttonWrapper.appendChild(updateAveragesButton);

            // Render last update inside the same wrapper, under the button
            renderLastUpdateNotice(buttonWrapper, courseId);

            // Add the wrapper into a column container so it stays on the right
            const buttonContainer = createButtonColumnContainer();
            buttonContainer.appendChild(buttonWrapper);
            toolbar.appendChild(buttonContainer);

            void resumeIfNeeded();
        });
    }




    function showFloatingBanner({
                                    text = "",
                                    duration = null,              // null = stays until removed; number = auto-hide after ms
                                    top = "20px",
                                    right = "20px",
                                    center = false,
                                    backgroundColor = BRAND_COLOR,
                                    textColor = "#ffffff",
                                    allowMultiple = false,         // keep existing banners?
                                    ariaLive = "polite"            // "polite" | "assertive" | "off"
                                } = {}) {
        // Remove existing banners unless explicitly allowed
        if (!allowMultiple) {
            document.querySelectorAll(".floating-banner").forEach(b => b.remove());
        }

        const baseElement =
            document.querySelector(".ic-Layout-contentMain") ||
            document.querySelector(".ic-app-header__menu-list-item__link") ||
            document.body;

        const styles = getComputedStyle(baseElement);
        const fontFamily = styles.fontFamily;
        const fontSize = styles.fontSize;
        const fontWeight = styles.fontWeight;

        // Create banner
        const banner = document.createElement("div");
        banner.className = "floating-banner";
        banner.setAttribute("role", "status");
        if (ariaLive && ariaLive !== "off") banner.setAttribute("aria-live", ariaLive);

        // Core positioning + style
        Object.assign(banner.style, {
            position: "fixed",
            top,
            background: backgroundColor,
            padding: "10px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            zIndex: "9999",
            fontSize,
            color: textColor,
            fontFamily,
            fontWeight,
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            maxWidth: "min(90vw, 720px)",
            lineHeight: "1.35",
            wordBreak: "break-word"
        });

        if (center) {
            banner.style.left = "50%";
            banner.style.transform = "translateX(-50%)";
        } else {
            banner.style.right = right;
        }

        // Message node to keep the X button separate
        const msg = document.createElement("span");
        msg.className = "floating-banner__text";
        banner.appendChild(msg);

        // Dismiss "X"
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.setAttribute("aria-label", "Dismiss message");
        closeBtn.textContent = "×";
        Object.assign(closeBtn.style, {
            cursor: "pointer",
            fontWeight: "bold",
            border: "none",
            background: "transparent",
            color: "inherit",
            fontSize,
            lineHeight: "1"
        });
        closeBtn.onclick = () => destroy();
        banner.appendChild(closeBtn);

        document.body.appendChild(banner);

        // --- Messaging control (sticky, queue, soft) ---
        let lockedUntil = 0;
        let pending = null;
        let holdTimer = null;
        let autoTimer = null;

        const now = () => Date.now();
        const isLocked = () => now() < lockedUntil;

        // const apply = (textValue) => { msg.textContent = textValue; };
        const courseId = getCourseId();
        const apply = (textValue) => {
            msg.textContent = textValue;
            if (courseId) localStorage.setItem(k('bannerLast', courseId), textValue);
        };

        const unlockAndFlush = () => {
            lockedUntil = 0;
            if (pending != null) {
                apply(pending);
                pending = null;
            }
        };


        banner.setText = (newText) => {
            if (isLocked()) {
                pending = newText; // keep only the latest
            } else {
                apply(newText);
            }
        };

        banner.hold = (newText, ms = 3000) => {
            const now = Date.now();
            // If currently locked, just queue the text; don't extend the lock
            if (now < lockedUntil) {
                pending = newText;       // will show when the current hold ends
                return;
            }

            lockedUntil = now + ms;
            apply(newText);

            if (holdTimer) clearTimeout(holdTimer);
            holdTimer = setTimeout(() => {
                lockedUntil = 0;
                if (pending != null) {
                    apply(pending);
                    pending = null;
                }
            }, ms);
        };

        // Non-sticky update ignored during a hold
        banner.soft = (newText) => {
            if (!isLocked()) apply(newText);
        };

        // Remove with fade-out
        function destroy() {
            if (holdTimer) clearTimeout(holdTimer);
            if (autoTimer) clearTimeout(autoTimer);
            banner.style.transition = "opacity 150ms";
            banner.style.opacity = "0";
            setTimeout(() => banner.remove(), 160);
        }
        banner.removeBanner = destroy; // expose a named remover

        // Initial text
        (duration === "hold")
            ? banner.hold(text, 3000) // convenience: allow duration="hold"
            : banner.setText(text);

        // Auto-dismiss if a number is provided
        if (typeof duration === "number" && isFinite(duration) && duration >= 0) {
            autoTimer = setTimeout(destroy, duration);
        }

        closeBtn.onclick = () => {
            if (courseId) localStorage.setItem(k('bannerDismissed', courseId), 'true');
            destroy();
            ensureStatusPill(courseId);
        };

        // when first shown, clear the dismissed flag and save text
        if (courseId) localStorage.setItem(k('bannerDismissed', courseId), 'false');
        (duration === "hold") ? banner.hold(text, 3000) : banner.setText(text);

        return banner;
    }

    function getCourseId() { // this is used for non-students
        const envCourseId = ENV?.COURSE_ID;
        const pathCourseId = window.location.pathname.match(/courses\/(\d+)/)?.[1] ?? null;

        const courseId = envCourseId || pathCourseId;

        if (!courseId) {
            console.error("Course ID not found on page.");
            return null;
        }

        if (VERBOSE_LOGGING) console.log("courseId:", pathCourseId);
        return courseId
    }

    async function getAssignmentId(courseId) {
        // finds the assignment id of AVG_ASSIGMENT_NAME
        // getAssignmentId is used for displaying score on student course cards and as a fallback check
        // when creating assignment
        const response = await fetch(`/api/v1/courses/${courseId}/assignments?per_page=100`);
        const assignments = await response.json();

        const avgAssignment = assignments.find(a => a.name === AVG_ASSIGNMENT_NAME);
        //if (!avgAssignment) throw new Error(`Assignment "${AVG_ASSIGNMENT_NAME}" not found.`);
        return avgAssignment ? avgAssignment.id : null;

    }

    function getTokenCookie(name) {
        const cookies = document.cookie.split(';').map(cookie => cookie.trim());
        let cookieValue = null;
        let i = 0;
        while (i < cookies.length && cookieValue === null) {
            const cookie = cookies[i].split('=', 2);
            if (cookie[0] === name) {
                cookieValue = decodeURIComponent(cookie[1]);
            }
            i++;
        }
        if (!cookieValue) {throw new Error("CSRF token / cookie not found.");}

        return cookieValue;
    }

    function getElapsedTimeSinceStart(endTime = Date.now()) {

        const start = localStorage.getItem(`startTime_${getCourseId()}`);
        if (!start) return 0;

        const startMs = new Date(start).getTime();
        const endMs = (endTime instanceof Date) ? endTime.getTime() : new Date(endTime).getTime();

        return Math.floor((endMs - startMs) / 1000); // seconds
    }

    function formatDuration(seconds) {
        if (seconds == null || isNaN(seconds)) return "N/A";
        seconds = Math.max(0, Math.floor(Number(seconds)));
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m ? `${m}m ${s}s` : `${s}s`;
    }

    function renderLastUpdateNotice(container, courseId) {
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

    function cleanUpLocalStorage() {
        let courseId = getCourseId();
        localStorage.removeItem(`verificationPending_${courseId}`);
        localStorage.removeItem(`expectedAverages_${courseId}`);
        localStorage.removeItem(`uploadFinishTime_${courseId}`);
        //localStorage.setItem("updateInProgress","false");
        localStorage.removeItem(`updateInProgress_${courseId}`);
        localStorage.removeItem(`startTime_${courseId}`);

    }

    async function resumeIfNeeded() {
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

    function safeParse(s) {
        try { return JSON.parse(s); } catch { return null; }
    }

    function startElapsedTimer(courseId, box) {
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

    function stopElapsedTimer(box) {
        if (box && box._elapsedTimerId) {
            clearInterval(box._elapsedTimerId);
            delete box._elapsedTimerId;
        }
    }

    function ensureStatusPill(courseId) {
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

    function getUserRoleGroup() {
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


    async function courseHasAvgAssignment() {
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

    function isDashboardPage() {
        const path = window.location.pathname;
        return path === "/" || path.startsWith("/dashboard");
    }

    function debounce(fn, delay) {
        let timeout;
        return function () {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(), delay);
        };
    }

    function extractCourseIdFromHref(href) {
        // expects things like "/courses/512/grades/190"
        const m = href.match(/^\/courses\/(\d+)\b/);
        return m ? m[1] : null;
    }

    // Pull the raw numeric score from the Current Score assignment row
    function extractCurrentScoreFromPage() {
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

    async function setOverrideScoreGQL(enrollmentId, overrideScore) {
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
    const __enrollmentMapCache = new Map();

    /**
     * Resolve an enrollmentId for a given user in this course.
     * Uses a cached Map when available; fetches via REST if needed.
     */
    async function getEnrollmentIdForUser(courseId, userId) {
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
    async function queueOverride(courseId, userId, average) {
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











    //endregion


    //region ***********************Ensure Outcome Setup********************************* //

    async function setupOutcomeAssignmentRubric(courseId, box) {
        let data = null;
        let assignmentId = null;
        let rubricId = null;
        let outcomeId = null;
        let rubricCriterionId = null;

        let outcomeAlignmentCorrectlySet = false;
        while (!outcomeAlignmentCorrectlySet) {
            data = await getRollup(courseId);
            if (VERBOSE_LOGGING) console.log("data: ", data);

            let outcomeObj = getOutcomeObjectByName(data);
            if (VERBOSE_LOGGING) console.log("outcome match: ", outcomeObj);
            if (VERBOSE_LOGGING) console.log("outcome id: ", outcomeObj?.id);
            outcomeId = outcomeObj?.id;

            if (!outcomeId) {
                let confirmCreate = confirm(`Outcome "${AVG_OUTCOME_NAME}" not found.\nWould you like to create:\nOutcome: "${AVG_OUTCOME_NAME}"?`);
                if (!confirmCreate) throw new Error("User declined to create missing outcome.");
                box.setText(`Creating "${AVG_OUTCOME_NAME}" Outcome...`);
                await createOutcome(courseId);
                continue; // start while loop over to make sure outcome was created and found.
            }

            // will only find assignmentObj if it has been associated with outcome
            let assignmentObj = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj);
            if (VERBOSE_LOGGING) console.log("assignment object: ", assignmentObj);

            if (!assignmentObj) { // Find the assignmentObj even if an outcome / rubric hasn't been associated yet
                const assignmentObjFromName = await getAssignmentId(courseId);
                if (assignmentObjFromName) {
                    const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentObjFromName}`);
                    assignmentObj = await res.json();
                    if (VERBOSE_LOGGING) console.log("Fallback assignment found by name, has not been associated with outcome yet:", assignmentObj);
                }
            }

            assignmentId = assignmentObj?.id; // if assigmentObj is still null even after looking by name, create it
            if (!assignmentId) {
                let confirmCreate = confirm(`Assignment "${AVG_ASSIGNMENT_NAME}" not found.\nWould you like to create:\nAssignment: "${AVG_ASSIGNMENT_NAME}"?`);
                if (!confirmCreate) throw new Error("User declined to create missing assignment.");
                box.setText(`Creating "${AVG_ASSIGNMENT_NAME}" Assignment...`);
                assignmentId = await createAssignment(courseId);
            }

            let result = await getRubricForAssignment(courseId, assignmentId);
            rubricId = result?.rubricId;
            rubricCriterionId = result?.criterionId;

            if (!rubricId) {
                let confirmCreate = confirm(`Rubric "${AVG_RUBRIC_NAME}" not found.\nWould you like to create:\nRubric: "${AVG_RUBRIC_NAME}"?`);
                if (!confirmCreate) throw new Error("User declined to create missing rubric.");
                box.setText(`Creating "${AVG_RUBRIC_NAME}" Rubric...`);
                rubricId = await createRubric(courseId, assignmentId, outcomeId);
                continue; // everything should be setup at this point, re-run while loop to make sure
            }

            outcomeAlignmentCorrectlySet = true;
        }

        return { data, assignmentId, rubricId, rubricCriterionId, outcomeId };
    }

    async function getRollup(courseId) {
        const response = await fetch(`/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`);
        if (!response.ok) throw new Error("Failed to fetch outcome results");
        const rollupData = await response.json();
        if (VERBOSE_LOGGING) console.log("rollupData: ", rollupData);
        return rollupData;
    }

    function getOutcomeObjectByName(data) {
        const outcomeTitle = AVG_OUTCOME_NAME;
        if (VERBOSE_LOGGING) console.log("Outcome Title:", outcomeTitle);
        if (VERBOSE_LOGGING) console.log("data:", data);
        const outcomes = data?.linked?.outcomes ?? [];
        if (VERBOSE_LOGGING) console.log("outcomes: ", outcomes)
        if (outcomes.length === 0) {
            console.warn("No outcomes found in rollup data.")
            return null;
        }
        const match = outcomes.find(o => o.title === outcomeTitle);
        if (VERBOSE_LOGGING) console.log("match: ", match)
        if (!match) {
            console.warn(`Outcome not found: "${outcomeTitle}"`);
        }
        return match ?? null;//match?.id ?? null;
    }

    async function createOutcome(courseId) {
        const csrfToken = getTokenCookie('_csrf_token');

        const randomSuffix = Math.random().toString(36).substring(2, 10); // 8-char alphanumeric
        const vendorGuid = `MOREnet_${randomSuffix}`;


        const ratingsCsv = OUTCOME_AND_RUBRIC_RATINGS
            .map(r => `${r.points},"${r.description}"`)
            .join(',');

        const csvContent =
            `vendor_guid,object_type,title,description,calculation_method,mastery_points\n` +
            `"${vendorGuid}",outcome,"${AVG_OUTCOME_NAME}","Auto-generated outcome: ${AVG_OUTCOME_NAME}",latest,"${DEFAULT_MASTERY_THRESHOLD}",${ratingsCsv}`;


        if (VERBOSE_LOGGING) console.log("Importing outcome via CSV...");

        const importRes = await fetch(`/api/v1/courses/${courseId}/outcome_imports?import_type=instructure_csv`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "text/csv",
                "X-CSRF-Token": csrfToken
            },
            body: csvContent
        });

        const rawText = await importRes.text();
        if (!importRes.ok) {
            console.error("Outcome import failed:", rawText);
            throw new Error(`Outcome import failed: ${rawText}`);
        }

        let importData;
        try {
            importData = JSON.parse(rawText);
        } catch (err) {
            console.error("Failed to parse outcome import response:", rawText);
            throw new Error("Import response not JSON");
        }

        const importId = importData.id;
        if (VERBOSE_LOGGING) console.log(`Outcome import started: ID ${importId}`);

        // Wait until the import completes
        let attempts = 0;
        let status = null;

        while (attempts++ < 15) { // Allow more time
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
            const pollRes = await fetch(`/api/v1/courses/${courseId}/outcome_imports/${importId}`);
            const pollData = await pollRes.json();

            const state = pollData.workflow_state;
            if (VERBOSE_LOGGING) console.log(`Poll attempt ${attempts}: ${state}`);

            if (state === "succeeded") {
                status = pollData;
                break;
            } else if (state === "failed") {
                console.error("Outcome import failure reason:", pollData);
                throw new Error("Outcome import failed");
            }
        }

        // After 30s with no result
        if (!status) {
            throw new Error("Timed out waiting for outcome import to complete");
        }

        if (VERBOSE_LOGGING) console.log("Outcome fully created");
    }

    async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject) {
        const alignments = outcomeObject.alignments ?? [];

        for (const alignment of alignments) {
            if (!alignment.startsWith("assignment_")) continue;

            const assignmentId = alignment.split("_")[1];
            const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
            if (!res.ok) continue;

            const assignment = await res.json();
            if (assignment.name === AVG_ASSIGNMENT_NAME) {
                console.log("Assignment found:", assignment);
                return assignment;
            }
        }

        // If no match found
        console.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in alignments for course ${courseId}`);
        return null;
    }

    async function createAssignment(courseId) {
        const csrfToken = getTokenCookie('_csrf_token');

        const payload = {
            authenticity_token: csrfToken,
            assignment: {
                name: AVG_ASSIGNMENT_NAME,
                position: 1,
                submission_types: ["none"], // no student submissions needed
                published: true,
                notify_of_update: true,
                points_possible: DEFAULT_MAX_POINTS,
                grading_type: "gpa_scale",
                omit_from_final_grade: true,
                // rubric_settings: {
                //     id: rubricId,
                //     title: AVG_RUBRIC_NAME,
                //     purpose: "grading",
                //     skip_updating_points_possible: false
                // }
            }
        };

        const res = await fetch(`/api/v1/courses/${courseId}/assignments`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to create assignment: ${errText}`);
        }

        const assignment = await res.json();
        console.log("Assignment created:", assignment);
        return assignment.id;
    }

    async function getRubricForAssignment(courseId, assignmentId) {
        const response = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
        const assignment = await response.json();

        const rubricSettings = assignment.rubric_settings;
        if (!rubricSettings || rubricSettings.title !== AVG_RUBRIC_NAME) {
            return null; // probably null because it hasn't been created yet, want to continue to create
        }

        const rubricCriteria = assignment.rubric;
        if (!rubricCriteria || !Array.isArray(rubricCriteria) || rubricCriteria.length === 0) {
            return null; // probably null because it hasn't been created yet, want to continue to create
        }

        const criterionId = rubricCriteria[0].id; // grab the first criterion's ID
        const rubricId = rubricSettings.id;

        if (VERBOSE_LOGGING) console.log("Found rubric and first criterion ID:", {rubricId, criterionId});

        return {rubricId, criterionId};
    }

    async function createRubric(courseId, assignmentId, outcomeId) {
        const csrfToken = getTokenCookie('_csrf_token');

        const rubricRatings = {};
        OUTCOME_AND_RUBRIC_RATINGS.forEach((rating, index) => {
            rubricRatings[index] = {
                description: rating.description,
                points: rating.points
            };
        });

        const rubricPayload = {
            'rubric': {
                'title': AVG_RUBRIC_NAME,
                'free_form_criterion_comments': false,
                'criteria': {
                    "0": {
                        'description': `${AVG_OUTCOME_NAME} criteria was used to create this rubric`,
                        'criterion_use_range': false,
                        'points': DEFAULT_MAX_POINTS,
                        'mastery_points': DEFAULT_MASTERY_THRESHOLD,
                        'learning_outcome_id': outcomeId,
                        'ratings': rubricRatings,
                    }
                }
            },
            rubric_association: {
                association_type: "Assignment",
                association_id: assignmentId,
                use_for_grading: true,
                purpose: "grading",
                hide_points: true
            }
        };


        const response = await fetch(`/api/v1/courses/${courseId}/rubrics`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify(rubricPayload)
        });

        const rawText = await response.text();

        if (!response.ok) {
            console.error("Rubric creation failed:", rawText);
            throw new Error(`Failed to create rubric: ${rawText}`);
        }

        let rubric;
        try {
            rubric = JSON.parse(rawText);
        } catch (e) {
            console.error("Rubric response not JSON:", rawText);
            throw new Error("Rubric API returned non-JSON data");
        }

        if (VERBOSE_LOGGING) console.log("Rubric created and linked to outcome:", rubric);
        return rubric.id;
    }

    //endregion


    //region ***********************Calculating & Posting Student Averages********************************* //


    injectButtons(); // adds buttons, runs startUpdateFlow on click

    async function startUpdateFlow() {
        let courseId = getCourseId();
        if (!courseId) throw new Error("Course ID not found");
        const inProgress = (localStorage.getItem(`updateInProgress_${courseId}`) || "false") === "true";
        const progressId = localStorage.getItem(`progressId_${courseId}`);
        const startTime = localStorage.getItem(`startTime_${courseId}`);

        if (inProgress && progressId && startTime) {
            // Re-show the box and resume checking
            const box = showFloatingBanner({
                text: `Update in progress.`
            });
            await waitForBulkGrading(box); // reuse existing polling function
        }
        localStorage.setItem(`updateInProgress_${courseId}`,"true");

        const box = showFloatingBanner({
            text: `Preparing to update "${AVG_OUTCOME_NAME}": checking setup...`
        });
        alert("You may minimize this browser or switch to another tab, but please keep this tab open until the process is fully complete.")
        try {

            const {data, assignmentId, rubricId, rubricCriterionId, outcomeId}
                = await setupOutcomeAssignmentRubric(courseId, box);

            if (VERBOSE_LOGGING) console.log(`assigmentId: ${assignmentId}`)
            if (VERBOSE_LOGGING) console.log(`rubricId: ${rubricId}`)

            box.setText(`Calculating "${AVG_OUTCOME_NAME}" scores...`);

            // calculating student averages is fast, it is updating them to grade book that is slow.
            const averages = calculateStudentAverages(data, outcomeId);
            localStorage.setItem(`verificationPending_${courseId}`, "true");
            localStorage.setItem(`expectedAverages_${courseId}`, JSON.stringify(averages));
            localStorage.setItem(`outcomeId_${courseId}`, String(outcomeId));
            localStorage.setItem(`startTime_${courseId}`, new Date().toISOString());

            const numberOfUpdates = averages.length;

            if (numberOfUpdates === 0) {
                alert(`No changes to ${AVG_OUTCOME_NAME} have been found. No updates performed.`);
                box.remove();
                cleanUpLocalStorage()
                return;
            }

            // check if testing parameters used
            const testPerStudentUpdate = window.__TEST_ONE_BY_ONE__;
            const testBulkUpdate = window.__TEST_BULK_UPLOAD__;

            let testing = false;

            if (testPerStudentUpdate) {
                if (VERBOSE_LOGGING) {console.log("Entering per student testing...")}
                box.hold(`TESTING: One-by-one updating "${AVG_OUTCOME_NAME}" scores for all students...`);
                testing = true;
                //await postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, testing = true);
            }

            if (testBulkUpdate) {
                if (VERBOSE_LOGGING) {console.log("Entering bulk upload test...")}
                box.hold(`TESTING: Bulk updating "${AVG_OUTCOME_NAME}" scores for all students...`);
                // await beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages);
                // await waitForBulkGrading(box);
            }

            //else { // no testing parameters used
            if (numberOfUpdates < PER_STUDENT_UPDATE_THRESHOLD || testing) {
                //box.setText(`Detected ${numberOfUpdates} changes  updating scores one at a time for quicker processing.`);
                let message = `Detected ${numberOfUpdates} changes  updating scores one at a time for quicker processing.`
                box.hold(message,3000);
                if (VERBOSE_LOGGING) {
                    console.log('Per student update...')
                }
                await postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, testing);
            } else {
                //box.setText(Detected ${numberOfUpdates} changes  updating scores all at once for error prevention`);
                let message = `Detected ${numberOfUpdates} changes using bulk update for error prevention`;
                box.hold(message,3000);

                if (VERBOSE_LOGGING) {
                    console.log(`Bulk update, Detected ${numberOfUpdates} changes`)
                }
                const progressId = await beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages);
                if (VERBOSE_LOGGING) console.log(`progressId: ${progressId}`)
                await waitForBulkGrading(box);
            }

            //}

            await verifyUIScores(courseId, averages, outcomeId, box);

            let elapsedTime = getElapsedTimeSinceStart();

            // Stop the elapsed timer to prevent duplicate elapsed time display
            stopElapsedTimer(box);

            box.setText(`${numberOfUpdates} student scores updated successfully! (elapsed time: ${elapsedTime}s)`);

            // await new Promise(resolve => setTimeout(resolve, 50));
            // setTimeout(() => box.remove(), 2500);

            localStorage.setItem(`duration_${getCourseId()}`,elapsedTime);
            localStorage.setItem(`lastUpdateAt_${getCourseId()}`, new Date().toISOString());

            const toolbar = document.querySelector('.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]');
            if (toolbar) renderLastUpdateNotice(toolbar, courseId);

            alert(`"All ${AVG_OUTCOME_NAME}" scores have been updated. (elapsed time: ${elapsedTime}s) \nYou may need to refresh the page to see the new scores.`);
        }//end of try
        catch (error) {
            // Clean up UI and localStorage when user declines or error occurs
            console.warn("Update process stopped:", error.message);
            box.setText(`Update cancelled: ${error.message}`);

            // Remove the banner after a short delay
            setTimeout(() => {
                box.remove();
            }, 3000);

            cleanUpLocalStorage();
        }
        finally
        {
            cleanUpLocalStorage()
        }
    }


    function waitForGradebookAndToolbar(callback) {
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

    function calculateStudentAverages(data, outcomeId) {
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

    async function submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, score) {
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

    async function beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages) {
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

    async function waitForBulkGrading(box, timeout = 1200000, interval = 2000) {
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

    async function postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, testing = false) {
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

    function downloadErrorSummary(retryCounts, failedUpdates) {
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

    async function verifyUIScores(courseId, averages, outcomeId, box, waitTimeMs = 5000, maxRetries = 50){
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




    //endregion


    //region ***********************Add Averages to Student Dashboard********************************* //

    if (VERBOSE_LOGGING) console.log("Dashboard region script running");

    if (window.location.pathname === '/' && document.querySelector('.ic-DashboardCard')) {
        const loadingBanner = showFloatingBanner({
            text: `Displaying ${AVG_OUTCOME_NAME} where available...`,
            center: true,
        });

        if (VERBOSE_LOGGING) console.log("On dashboard in card view injecting averages");

        let attempts = 0;
        const maxAttempts = 20; // ~5 seconds if interval is 250ms
        const dashboardInterval = setInterval(async () => {
            const courseCards = document.querySelectorAll('.ic-DashboardCard');
            if (courseCards.length > 0) {
                if (VERBOSE_LOGGING) console.log("Detected", courseCards.length, "course cards");

                clearInterval(dashboardInterval);
                await injectAveragesIntoStudentDashboard(loadingBanner);

            } else if (attempts++ >= maxAttempts) {
                clearInterval(dashboardInterval);
                console.warn("Dashboard cards not found after several attempts, giving up.");
                loadingBanner.remove();
            }
        }, 250);
    }

    async function injectAveragesIntoStudentDashboard(loadingBanner) {
        try {
            const res = await fetch(`/api/v1/users/self/favorites/courses?include[]=enrollments`);
            const courses = await res.json();

            const isStudentInAnyCourse = courses.some(c =>
                c.enrollments?.some(e => e.type === 'student')
            );
            if (!isStudentInAnyCourse) {
                if (VERBOSE_LOGGING) console.log("User is not a student in any course skipping averages injection");
                loadingBanner.remove();
                return;
            }


            const cards = document.querySelectorAll('.ic-DashboardCard');

            if (cards.length === 0) {
                console.warn("No dashboard cards found");
                return;
            }

            for (const card of cards) {
                const link = card.querySelector('.ic-DashboardCard__link');
                if (!link || !link.href.includes('/courses/')) continue;

                const courseId = parseInt(link.href.split('/courses/')[1]);
                const course = courses.find(c => c.id === courseId);
                if (!course) continue;


                const assignmentId = await getAssignmentId(courseId);
                if (!assignmentId) {
                    console.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in course ${courseId}`);
                    continue;
                }

                try {
                    const submissionRes = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`);
                    const submission = await submissionRes.json();

                    const avgScore = submission.score;
                    if (typeof avgScore === "number") {
                        // 1. Add placeholder
                        injectAverageIntoCard(card, 0, 'Loading average...');
                        // 2. Fetch and replace text
                        const label = card.querySelector('.course_average_label');

                        if (label) {
                            label.textContent = `${AVG_OUTCOME_NAME}: ${avgScore.toFixed(2)}`;
                        }
                    } else {
                        console.warn(`No average score found for course ${courseId}`);
                    }
                } catch (err) {
                    console.warn(`Failed to fetch average score for course ${courseId}:`, err);
                }

            }
        } catch (err) {
            console.error("Failed to fetch favorite courses:", err);
        }
        loadingBanner.remove();
    }

    function injectAverageIntoCard(card, score, text) {
        const existing = card.querySelector('.course_average_label');
        if (existing) return;

        const label = document.createElement('div');
        label.textContent = text ?? `${AVG_OUTCOME_NAME}: ${score.toFixed(2)}`;
        label.className = 'course_average_label';
        label.style.fontSize = '1 rem';
        label.style.color = '#fff'; // white text to contrast background
        label.style.fontWeight = 'bold';
        label.style.position = 'absolute';
        label.style.bottom = '4px';
        //label.style.top = '4px';
        label.style.right = '6px';
        label.style.zIndex = '1'; // stay above background
        label.style.background = 'rgba(0, 0, 0, 0.25)';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '4px';

        const hero = card.querySelector('.ic-DashboardCard__header_hero');
        if (hero) {
            hero.style.position = 'relative'; // ensure label positions correctly
            hero.appendChild(label);
        } else {
            card.appendChild(label); // fallback to bottom portion of card
        }
    }

    //endregion


    //region ***********************Tests via Query Param********************************* //

    // to run tests:
    // https://.../gradebook?runBulkUpload=1&trials=3
    // https://.../gradebook?runOneByOne=1&trials=3

    // Check if URL contains parameters for testing
    const urlParams = new URLSearchParams(window.location.search);

    async function runBulkAverageUpdateTimingTests(trials = 3) {
        const times = [];

        const originalConfirm = window.confirm;
        window.confirm = () => true;  // always return "OK"
        window.__TEST_BULK_UPLOAD__ = true;

        for (let i = 0; i < trials; i++) {
            const label = `Trial ${i + 1}`;
            const start = performance.now();

            try {
                console.log(`${label} Starting update`);
                await startUpdateFlow();
            } catch (e) {
                console.error(`${label} failed:`, e);
                times.push({ trial: i + 1, duration: null, error: e.message });
                continue;
            }

            const end = performance.now();
            const duration = end - start;
            console.log(`${label}  Completed in ${(duration / 1000).toFixed(2)} seconds`);
            times.push({ trial: i + 1, duration, error: null });
        }

        window.confirm = originalConfirm;
        delete window.__TEST_BULK_UPLOAD__;
        console.table(times);
        return times;
    }

    async function runOneByOneTimingTests(trials = 3) {
        const times = [];

        const originalConfirm = window.confirm;
        window.confirm = () => true;
        window.__TEST_ONE_BY_ONE__ = true;

        for (let i = 0; i < trials; i++) {
            const label = `Trial ${i + 1}`;
            const start = performance.now();

            try {
                console.log(`${label}  Starting one-by-one update`);
                await startUpdateFlow();
            } catch (e) {
                console.error(`${label} failed:`, e);
                times.push({ trial: i + 1, duration: null, error: e.message });
                continue;
            }

            const end = performance.now();
            const duration = end - start;
            console.log(`${label} Completed in ${(duration / 1000).toFixed(2)} seconds`);
            times.push({ trial: i + 1, duration, error: null });
        }

        window.confirm = originalConfirm;
        delete window.__TEST_ONE_BY_ONE__;
        console.table(times);
        return times;
    }

    function exportTimingResultsToCSV(results) {
        const headers = "Trial,Duration (ms),Error\n";
        const rows = results.map(r => `${r.trial},${r.duration ?? ""},"${r.error ?? ""}"`).join("\n");
        const blob = new Blob([headers + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "grade_update_timings.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    if (window.location.pathname.includes('/gradebook')) {
        const trials = parseInt(urlParams.get("trials")) || 3;

        if (urlParams.get("runBulkUpload") === "1") {
            window.confirm = () => true;
            window.alert = () => {};
            window.__TEST_BULK_UPLOAD__ = true;
            console.log("Starting bulk timing tests...");
            setTimeout(async () => {
                const results = await runBulkAverageUpdateTimingTests(trials);
                exportTimingResultsToCSV(results);
            }, 1500);
        }

        if (urlParams.get("runOneByOne") === "1") {
            window.confirm = () => true;
            window.alert = () => {};
            window.__TEST_ONE_BY_ONE__ = true;
            console.log("Starting one-by-one timing tests...");
            setTimeout(async () => {
                const results = await runOneByOneTimingTests(trials);
                exportTimingResultsToCSV(results);
            }, 1500);
        }

        if (urlParams.get("zeroOutAverages") === "1") {
            window.confirm = () => true;
            window.alert = () => {};
            window.__ZERO_ALL_AVERAGES__ = true;
            console.log("Starting test to zero out all average scores...");
            setTimeout(() => startUpdateFlow(), 1000);
        }

        if (urlParams.get("verbose") === "1") {
            VERBOSE_LOGGING = true;
            console.log("VERBOSE_LOGGING enabled via query string.");
        }

    }


//endregion


    //region ***********************SpeedGrader Dropdown Activation********************************* //

    // Only activate dropdown on SpeedGrader pages
    if (window.location.pathname.includes('/speed_grader')) {

        function activateGradingDropdown() {
            const gradingBox = document.getElementById('grading-box-extended');

            if (gradingBox && gradingBox.hasAttribute('disabled')) {
                gradingBox.removeAttribute('disabled');
                gradingBox.removeAttribute('readonly');
                gradingBox.removeAttribute('aria-disabled');
                gradingBox.classList.remove('ui-state-disabled');
                if (VERBOSE_LOGGING) console.log('Grading dropdown activated');
            }
        }

        // Create a MutationObserver to watch for changes in the DOM
        const gradingDropdownObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Check if new nodes were added
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        // If it's an element node
                        if (node.nodeType === 1) {
                            // Check if the added node is our target element
                            if (node.id === 'grading-box-extended') {
                                activateGradingDropdown();
                            }
                            // Or if it contains our target element
                            else if (node.querySelector && node.querySelector('#grading-box-extended')) {
                                activateGradingDropdown();
                            }
                        }
                    });
                }
                // Also check for attribute changes on the existing element
                else if (mutation.type === 'attributes' && mutation.target.id === 'grading-box-extended') {
                    activateGradingDropdown();
                }
            });
        });

        // Start observing for grading dropdown
        gradingDropdownObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'readonly', 'aria-disabled', 'class']
        });

        // Also try to activate it immediately in case it's already present
        activateGradingDropdown();

        if (VERBOSE_LOGGING) console.log('SpeedGrader dropdown auto-activator started');
    }

    //endregion


    //region ***********************Student Grade Page Customization********************************* //

// Run only on the student Grades page
    if (
        ENABLE_STUDENT_GRADE_CUSTOMIZATION &&
        getUserRoleGroup() === "student_like" &&
        window.location.href.includes('/courses/') &&
        window.location.pathname.includes('/grades')
    ) {
        let processed = false; // prevent double-runs

        // ---- DOM helpers (Grades page uses jQuery-UI tabs)
        function getAssignmentsTabLI() {
            // e.g. <li aria-controls="assignments">...</li>
            return document.querySelector('li[aria-controls="assignments"]');
        }
        function getLearningMasteryLink() {
            // e.g. <li aria-controls="outcomes"><a href="#outcomes">Learning Mastery</a></li>
            return document.querySelector('li[aria-controls="outcomes"] a[href="#outcomes"]');
        }
        function rightSideEl() {
            // Canvas variants
            return document.querySelector('#right-side-wrapper') || document.querySelector('#right-side');
        }

        // Remove the Assignments tab (retry a few times for lazy DOM)
        function ensureAssignmentsTabRemoved(retries = 20, everyMs = 250) {
            const li = getAssignmentsTabLI();
            if (li) {
                li.remove();
                if (VERBOSE_LOGGING) console.log('Assignments tab removed.');
                return true;
            }
            if (retries > 0) {
                setTimeout(() => ensureAssignmentsTabRemoved(retries - 1, everyMs), everyMs);
            } else if (VERBOSE_LOGGING) {
                console.warn('Assignments tab not found after retries.');
            }
            return false;
        }

        // Switch to Learning Mastery tab and set Canvas’ expected hash
        function goToLearningMasteryTab() {
            // Canvas wants #tab-outcomes in URL; UI tab uses #outcomes
            if (location.hash !== '#tab-outcomes') {
                history.replaceState(null, '', location.pathname + location.search + '#tab-outcomes');
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            }
            const link = getLearningMasteryLink();
            if (link) {
                link.click();
            } else {
                // Tabs mount late sometimes
                setTimeout(goToLearningMasteryTab, 300);
            }
        }



        // Do all alterations (only when score is found)
        function applyCustomizations(score) {
            if (processed) return false;


            if (REMOVE_ASSIGNMENT_TAB){
                // 1) Remove Assignments tab
                ensureAssignmentsTabRemoved();
                // 2) Switch to Learning Mastery
                goToLearningMasteryTab();
            }




            // 3) Replace the right sidebar with a lightweight readout (no % formatting)
            const rightSide = rightSideEl();
            if (!rightSide) {
                if (VERBOSE_LOGGING) console.log('Right sidebar not found; deferring...');
            } else if (!rightSide.dataset.processed) {
                rightSide.style.display = 'none';
                rightSide.dataset.processed = 'true';

                let masteryAside = document.getElementById('mastery-right-side');
                if (!masteryAside) {
                    masteryAside = document.createElement('aside');
                    masteryAside.id = 'mastery-right-side';
                    masteryAside.setAttribute('role', 'complementary');
                    masteryAside.style.cssText = `
          color: inherit; font-weight: inherit; font-size: inherit; font-family: inherit;
          margin: inherit; padding: inherit; background: inherit; border: inherit;
        `;
                    masteryAside.innerHTML = `
          <div id="student-grades-right-content">
            <div class="student_assignment mastery_total">
              ${AVG_OUTCOME_NAME}: <span class="mastery-grade">${score}</span>
            </div>
          </div>
        `;

                    // Make it typographically consistent
                    const headerEl = masteryAside.querySelector('.mastery_total');
                    if (headerEl) {
                        const ok = inheritFontStylesFrom('h1.screenreader-only, h1, .ic-app-nav-toggle-and-crumbs h1', headerEl);
                        if (!ok) {
                            headerEl.style.fontSize = '1.5em';
                            headerEl.style.fontWeight = 'bold';
                        }
                    }

                    rightSide.parentNode.insertBefore(masteryAside, rightSide.nextSibling);
                    if (VERBOSE_LOGGING) {
                        console.log(`Sidebar replaced with ${AVG_OUTCOME_NAME}: ${score}`);
                    }
                } else {
                    const span = masteryAside.querySelector('.mastery-grade');
                    if (span) span.textContent = score;
                }
            }

            processed = true;
            return true;
        }

        // Main attempt
        function runOnce() {
            if (processed) return true;
            const score = extractCurrentScoreFromPage();
            if (score === null) {
                // If not found, do nothing at all.
                return false;
            }
            return applyCustomizations(score);
        }

        // Try immediately
        let didRun = runOnce();

        // If content is lazy-loaded, observe and retry ONLY the full alteration when score appears
        if (!didRun) {
            const obs = new MutationObserver(() => {
                if (runOnce()) {
                    obs.disconnect();
                    if (VERBOSE_LOGGING) console.log('Student grade customization applied after DOM updates.');
                }
            });
            obs.observe(document.body, { childList: true, subtree: true, attributes: true });

            // Safety stop after 30s
            setTimeout(() => {
                obs.disconnect();
                if (VERBOSE_LOGGING) console.log('Student grade customization observer disconnected (timeout).');
            }, 30000);
        }
    }
//endregion

    //region ***********************Remove fractions from grades********************************* //

    if (ENABLE_STUDENT_GRADE_CUSTOMIZATION && getUserRoleGroup() === "student_like") {
        // Decide if we should allow cleanup here
        if (isDashboardPage()) {
            // DASHBOARD PATH:
            // We always allow cleanup setup on dashboard,
            // but section 7 inside removeFractionScores() will ONLY rewrite scores
            // if the card title === AVG_ASSIGNMENT_NAME.
            startCleanupObservers();
        } else {
            // COURSE PAGES:
            // Only run cleanup if this specific course actually has the avg assignment.
            courseHasAvgAssignment().then(hasAvg => {
                if (!hasAvg) {
                    if (VERBOSE_LOGGING) console.log("Skipping fraction cleanup — no Current Score Assignment in this course.");
                    return;
                }
                startCleanupObservers();
                console.log("staring cleanup")
            });
        }
    }

// shared observer / URL tracking logic
    function startCleanupObservers() {
        function isCoursePageNeedingCleanup() {
            const path = window.location.pathname;
            return (
                window.location.href.includes("/courses/") &&
                (
                    path.includes("/grades") ||
                    path.includes("/assignments") ||
                    /^\/courses\/\d+$/.test(path)
                )
            );
        }

        function shouldClean() {
            return isDashboardPage() || isCoursePageNeedingCleanup();
        }

        // make a debounced version so we don't hammer the DOM on every tiny mutation
        const debouncedClean = debounce(() => {
            if (shouldClean()) {
                removeFractionScores();
            }
        }, 100); // 100ms is fast enough to feel instant, slow enough to collapse spam

        // initial call after slight delay so Canvas can render
        setTimeout(() => {
            debouncedClean();

            const observer = new MutationObserver(() => {
                debouncedClean();
            });

            // only start observing if we're actually on a page we care about
            if (shouldClean()) {
                observer.observe(document.body, { childList: true, subtree: true });
            }

            // also handle SPA-style URL changes (tab switches, /grades → /grades#tab-outcomes, etc.)
            let lastUrl = location.href;
            setInterval(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    debouncedClean();
                }
            }, 1000);
        }, 500);
    }





    function removeFractionScores() {
        // --- 1. Course homepage / assignments list style ---
        // <span class="score-display"><b>2.74</b>/4 pts</span>
        document.querySelectorAll(".score-display").forEach(scoreEl => {
            const html = scoreEl.innerHTML;
            const cleaned = html.replace(/<\/b>\s*\/\s*\d+(\.\d+)?\s*pts/i, "</b>");
            if (html !== cleaned) scoreEl.innerHTML = cleaned;
        });

        // --- 2. The grades page table style ---
        // <span class="tooltip"><span class="grade">2.74</span><span>/ 4</span></span>
        document.querySelectorAll("span.tooltip").forEach(tooltipEl => {
            Array.from(tooltipEl.children).forEach(child => {
                if (
                    child.childNodes.length === 1 &&
                    child.childNodes[0].nodeType === Node.TEXT_NODE &&
                    /^\/\s*\d+(\.\d+)?$/.test(child.textContent.trim())
                ) {
                    child.remove();
                }
            });
        });

        // --- 3. Rubric cells like "/4 pts"
        // matches plain text nodes like "/4 pts"
        document.querySelectorAll("span, div, td").forEach(el => {
            if (
                el.childNodes.length === 1 &&
                el.childNodes[0].nodeType === Node.TEXT_NODE &&
                /\/\s*\d+(\.\d+)?\s*pts/i.test(el.textContent)
            ) {
                el.textContent = el.textContent.replace(/\/\s*\d+(\.\d+)?\s*pts/gi, "");
            }
        });

        // --- 4. Screenreader text cleanup ---
        // "Score: 2.74 out of 4 points." -> "Score: 2.74"
        document.querySelectorAll(".screenreader-only").forEach(srEl => {
            const txt = srEl.textContent;
            const cleanedTxt = txt.replace(/out of\s*\d+(\.\d+)?\s*points?\.?/i, "").trim();
            if (txt !== cleanedTxt) srEl.textContent = cleanedTxt;
        });

        // --- 5. Outcomes tab style (2.74/4) ---
        // <span class="css-1jyml41-text">2.74/4</span>
        document.querySelectorAll("span.css-1jyml41-text").forEach(scoreEl => {
            const txt = scoreEl.textContent.trim();
            const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
            if (m) scoreEl.textContent = m[1];
        });

        // --- 6. Assignment details page ---
        // a) <span class="points-value"><strong>2.74/4</strong> Points</span>
        document.querySelectorAll("span.points-value strong").forEach(strongEl => {
            const txt = strongEl.textContent.trim();
            const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
            if (m) strongEl.textContent = m[1];
        });

        // b) <span class="css-7cbhck-text">2.74/4</span>
        document.querySelectorAll("span.css-7cbhck-text").forEach(scoreEl => {
            const txt = scoreEl.textContent.trim();
            const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
            if (m) scoreEl.textContent = m[1];
        });

        // --- 7. Recent feedback / dashboard card style ---
        // Only affect dashboard cards for the Current Score Assignment
        document.querySelectorAll('a[data-track-category="dashboard"][data-track-label="recent feedback"]').forEach(cardEl => {
            const titleEl = cardEl.querySelector(".recent_feedback_title");
            const strongEl = cardEl.querySelector(".event-details strong");

            if (!titleEl || !strongEl) return;

            // normalize both strings
            const titleText = titleEl.textContent.trim().replace(/\s+/g, " ").toLowerCase();
            const targetName = AVG_ASSIGNMENT_NAME.trim().replace(/\s+/g, " ").toLowerCase();

            if (titleText !== targetName) return;

            // Example: "2.74 out of 4"
            const scoreText = strongEl.textContent.trim();
            const m = scoreText.match(/^(\d+(\.\d+)?)\s+out of\s+\d+(\.\d+)?$/i);
            if (m) {
                strongEl.textContent = m[1];
            }
        });

        // --- 8. Assignment group totals row (class="student_assignment hard_coded group_total") ---
        document.querySelectorAll("tr.student_assignment.hard_coded.group_total").forEach(row => {
            // 8a. Remove the percent entirely (leave blank)
            const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
            if (gradeEl) {
                const raw = gradeEl.textContent.trim();
                // Remove any numeric percentage or numeric-only text
                if (/^\d+(\.\d+)?%?$/.test(raw)) {
                    gradeEl.textContent = ""; // completely blank it out
                }
            }

            // 8b. Remove the denominator (keep blank if 0 or fraction)
            const possibleEl = row.querySelector(".details .possible.points_possible");
            if (possibleEl) {
                const txt = possibleEl.textContent.trim();
                // Matches "number / number" or "0.00 / 0.00"
                if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
                    possibleEl.textContent = ""; // fully blank out
                }
            }
        });

        // --- 9. Final grade row (class="student_assignment hard_coded final_grade") ---
// Replace percent with mastery average from avg_assignment_name
        document.querySelectorAll("tr.student_assignment.hard_coded.final_grade").forEach(row => {
            const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
            const possibleEl = row.querySelector(".details .possible.points_possible");

            if (gradeEl) {
                // get mastery score from the page (your avg_assignment_name value)
                const masteryScore = extractCurrentScoreFromPage(); // e.g. "2.74"

                if (masteryScore && typeof masteryScore === "string" && masteryScore.trim() !== "") {
                    // overwrite whatever Canvas put there, e.g. "67.43%"
                    gradeEl.textContent = masteryScore.trim();
                } else if (masteryScore && typeof masteryScore === "number") {
                    // if your extract function returns a number
                    gradeEl.textContent = masteryScore.toString();
                } else {
                    // if we couldn't get the mastery score, hide the percent instead
                    const raw = gradeEl.textContent.trim();
                    if (/^\d+(\.\d+)?%$/.test(raw)) {
                        gradeEl.textContent = "";
                    }
                }
            }

            if (possibleEl) {
                // Canvas shows "102.50 / 152.00". We don't want that.
                const txt = possibleEl.textContent.trim();
                if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
                    possibleEl.textContent = "";
                }
            }
        });

        // --- 10. "All Courses" Grades page (/grades) ---
        // In the table.course_details.student_grades, replace the percent cell
        // with the mastery score (AVG_ASSIGNMENT_NAME) IF that course actually
        // uses AVG_ASSIGNMENT_NAME. Otherwise leave the percent alone.
       // (function updateAllCoursesGradesPage() {
       //      // Only run on /grades (not /courses/.../grades, not dashboard /)
       //      if (window.location.pathname !== "/grades") return;
       //
       //      const rows = document.querySelectorAll("table.course_details.student_grades > tbody > tr");
       //      if (!rows.length) return;
       //
       //      rows.forEach(async row => {
       //          const linkEl = row.querySelector("td.course a[href^='/courses/']");
       //          const percentEl = row.querySelector("td.percent");
       //
       //          if (!linkEl || !percentEl) return;
       //
       //          const href = linkEl.getAttribute("href") || "";
       //          const courseId = extractCourseIdFromHref(href);
       //          if (!courseId) return;
       //
       //          // get mastery score for this course (cached or via API)
       //          const masteryScore = await getCourseMasteryScoreForCourseRow(courseId);
       //
       //          if (!masteryScore) {
       //              // This course is traditional or doesn't have AVG_ASSIGNMENT_NAME.
       //              // Leave the percent (76%, 83.33%, etc.) alone.
       //              return;
       //          }
       //
       //          // This course is standards-based. Replace 76% with masteryScore (e.g. "2.74").
       //          percentEl.textContent = masteryScore;
       //      });
       //  })();





    }

    // async function getCourseMasteryScoreForCourseRow(courseId) {
    //     if (!courseId) return null;
    //
    //     // cache to avoid spamming API
    //     const cacheKey = `allCoursesMasteryScore_${courseId}`;
    //     const cached = sessionStorage.getItem(cacheKey);
    //     if (cached !== null) {
    //         return cached === "" ? null : cached;
    //     }
    //
    //     try {
    //         // 1. Find the AVG_ASSIGNMENT_NAME in that course
    //         const assignResp = await fetch(
    //             `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(AVG_ASSIGNMENT_NAME)}`
    //         );
    //         const assignments = await assignResp.json();
    //
    //         const match = assignments.find(a => a.name === AVG_ASSIGNMENT_NAME);
    //         if (!match) {
    //             sessionStorage.setItem(cacheKey, "");
    //             return null;
    //         }
    //
    //         const assignmentId = match.id;
    //
    //         // 2. Get this student's submission/score for that assignment
    //         const subResp = await fetch(
    //             `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`
    //         );
    //         const submission = await subResp.json();
    //
    //         const masteryScore = submission?.score;
    //         if (masteryScore === null || masteryScore === undefined || masteryScore === "") {
    //             sessionStorage.setItem(cacheKey, "");
    //             return null;
    //         }
    //
    //         const scoreStr = masteryScore.toString();
    //         sessionStorage.setItem(cacheKey, scoreStr);
    //         return scoreStr;
    //     } catch (e) {
    //         console.warn("getCourseMasteryScoreForCourseRow error:", e);
    //         sessionStorage.setItem(cacheKey, "");
    //         return null;
    //     }
    // }

    window.getCourseMasteryScoreForCourseRow = async function (courseId) {
        if (!courseId) return null;

        const cacheKey = `allCoursesMasteryScore_${courseId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached !== null) {
            return cached === "" ? null : cached;
        }

        try {
            const assignResp = await fetch(
                `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent('Current Score Assignment')}`
            );
            const assignments = await assignResp.json();

            const match = assignments.find(a => a.name === 'Current Score Assignment');
            if (!match) {
                sessionStorage.setItem(cacheKey, "");
                return null;
            }

            const assignmentId = match.id;

            const subResp = await fetch(
                `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`
            );
            const submission = await subResp.json();

            const masteryScore = submission?.score;
            if (masteryScore === null || masteryScore === undefined || masteryScore === "") {
                sessionStorage.setItem(cacheKey, "");
                return null;
            }

            const scoreStr = masteryScore.toString();
            sessionStorage.setItem(cacheKey, scoreStr);
            return scoreStr;
        } catch (e) {
            console.warn("getCourseMasteryScoreForCourseRow error:", e);
            sessionStorage.setItem(cacheKey, "");
            return null;
        }
    };


    // make it global so we can debug it in console too
    window.updateAllCoursesGradesPage = async function () {
        if (window.location.pathname !== "/grades") return;

        const rows = document.querySelectorAll("table.course_details.student_grades > tbody > tr");
        if (!rows.length) return;

        for (const row of rows) {
            const linkEl = row.querySelector("td.course a[href^='/courses/']");
            const percentEl = row.querySelector("td.percent");
            if (!linkEl || !percentEl) continue;

            // href looks like "/courses/512/grades/190"
            const href = linkEl.getAttribute("href") || "";
            const match = href.match(/^\/courses\/(\d+)\b/);
            const courseId = match ? match[1] : null;
            if (!courseId) continue;

            // This calls your existing logic
            const masteryScore = await getCourseMasteryScoreForCourseRow(courseId);

            // Only update the cell if we actually got a score
            if (masteryScore !== null && masteryScore !== undefined && masteryScore !== "") {
                percentEl.textContent = masteryScore;
            }
        }
    };


// run it right away
    window.updateAllCoursesGradesPage();




//endregion








})(); // theme full script closing bracket })();

