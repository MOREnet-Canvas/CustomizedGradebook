// src/masteryDashboard/masteryDashboardViewer.js
/**
 * Mastery Dashboard Viewer - Shared Core Logic
 *
 * This module is used by BOTH:
 * - Mobile loader (Canvas Parent app) via mobileInit.js
 * - CustomGradebook main bundle (Canvas website) via masteryDashboardInit.js
 *
 * It renders mastery data for students/observers on the mastery dashboard page.
 *
 * Supports:
 * - Students viewing their own mastery data
 * - Observers (parents) viewing observed student's mastery data
 * - Teachers see an error message (future: dropdown to select student)
 */

/**
 * Rating scale for calculating letter grades
 * Hardcoded to avoid dependency on config.js (mobile bundle is standalone)
 */
const RATINGS = [
    { description: "Exemplary", points: 4 },
    { description: "Beyond Target", points: 3.5 },
    { description: "Target", points: 3 },
    { description: "Approaching Target", points: 2.5 },
    { description: "Developing", points: 2 },
    { description: "Beginning", points: 1.5 },
    { description: "Needs Partial Support", points: 1 },
    { description: "Needs Full Support", points: 0.5 },
    { description: "Insufficient Evidence", points: 0 }
];

/**
 * AVG_OUTCOME_NAME - used to identify which outcome should be displayed first
 * Hardcoded to avoid dependency on config.js
 */
const AVG_OUTCOME_NAME = "Current Score";

/**
 * Calculate letter grade from score
 * @param {number} score - Numeric score
 * @returns {string} Letter grade description
 */
function getLetterGrade(score) {
    if (score == null || isNaN(score)) return "";

    // Find the rating that matches the score
    for (const rating of RATINGS) {
        if (score >= rating.points) {
            return rating.description;
        }
    }

    // If score is below all ratings, return the lowest one
    return RATINGS[RATINGS.length - 1].description;
}

/**
 * Ensure the host container exists and is properly configured
 * @returns {HTMLElement|null} The root element, or null if not found
 */
function ensureHost() {
    const root = document.getElementById("mastery-dashboard-root");
    if (!root) return null;

    root.style.display = "block";
    root.style.width = "100%";
    root.style.maxWidth = "100%";
    root.style.boxSizing = "border-box";

    root.innerHTML = `
      <div style="border:1px solid #ddd; border-radius:10px; padding:12px; margin:12px 0;">
        <div style="font-weight:700; margin-bottom:8px;">Mastery Dashboard</div>
        <div id="pm-status">Loading…</div>
        <div id="pm-cards"></div>
      </div>
    `;
    return root;
}

/**
 * Fetch JSON from Canvas API
 * @param {string} path - API path
 * @returns {Promise<any>} JSON response
 */
async function apiJson(path) {
    const response = await fetch(path, { credentials: "include" });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${response.statusText}\n${text.slice(0, 400)}`);
    }
    return response.json();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
        return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c];
    });
}

/**
 * Debug logging helper (only active in dev builds)
 * @param {string} message - Message to log
 */
function debugLog(message) {
    if (ENV_DEV) {
        console.log(`[MasteryDashboard] ${message}`);
    }
}

/**
 * Debug status helper (only active in dev builds)
 * Updates status element with debug message
 * @param {HTMLElement} statusEl - Status element
 * @param {string} message - Message to display
 */
function debugStatus(statusEl, message) {
    if (ENV_DEV) {
        statusEl.textContent = message;
    }
}

/**
 * Main render function
 * Fetches and displays mastery data for the current user
 */
export async function renderMasteryDashboard() {
    const root = ensureHost();
    if (!root) {
        debugLog('No mastery-dashboard-root element found, exiting');
        return; // Only runs on mastery-dashboard page
    }

    const statusEl = document.getElementById("pm-status");
    const cardsEl = document.getElementById("pm-cards");

    debugLog('Mastery Dashboard initializing...');
    debugLog(`Dev mode: ${ENV_DEV}`);

    // Get course ID from URL
    const match = location.pathname.match(/^\/courses\/(\d+)\//);
    if (!match) {
        statusEl.textContent = "Could not detect course.";
        debugLog(`ERROR: Could not extract course ID from URL: ${location.pathname}`);
        return;
    }
    const courseId = Number(match[1]);
    debugLog(`Course ID: ${courseId}`);

    // DEBUG: Show fetching status
    debugStatus(statusEl, "Fetching enrollments...");

    // Determine which student's data to show
    const enrollments = await apiJson("/api/v1/users/self/enrollments?per_page=100");
    debugLog(`Total enrollments fetched: ${enrollments.length}`);

    // DEBUG: Show enrollment count
    debugStatus(statusEl, `Found ${enrollments.length} enrollments. Analyzing...`);

    // Filter enrollments for this course
    const courseEnrollments = enrollments.filter(e => 
        String(e.course_id) === String(courseId) && e.enrollment_state === "active"
    );
    debugLog(`Course enrollments: ${courseEnrollments.length}`);

    // DEBUG: Show course-specific enrollments
    const enrollmentTypes = courseEnrollments.map(e => e.type).join(", ");
    debugLog(`Enrollment types for this course: ${enrollmentTypes}`);
    debugStatus(statusEl, `Course enrollments: ${enrollmentTypes || "none"}. Determining role...`);

    // Try to find observer enrollment first (parent viewing child)
    const obs = courseEnrollments.find(e => 
        e.type === "ObserverEnrollment" && e.associated_user_id
    );

    let studentId;
    let userRole;

    if (obs) {
        // Observer (parent) viewing observed student's data
        studentId = obs.associated_user_id;
        userRole = "Observer (Parent)";
        debugLog(`User role: ${userRole}`);
        debugLog(`Observed student ID: ${studentId}`);
        debugStatus(statusEl, `Role: ${userRole}. Loading observed student's data...`);
    } else {
        // Try to find student enrollment (student viewing own data)
        const stu = courseEnrollments.find(e => e.type === "StudentEnrollment");

        if (stu) {
            // Student viewing their own data
            studentId = stu.user_id;
            userRole = "Student";
            debugLog(`User role: ${userRole}`);
            debugLog(`Student ID: ${studentId}`);
            debugStatus(statusEl, `Role: ${userRole}. Loading your mastery data...`);
        } else {
            // Teacher or other role - not supported yet
            const roleTypes = courseEnrollments.map(e => e.type).join(", ");
            statusEl.textContent = `Mastery Dashboard is only available for students and observers. Your role(s): ${roleTypes || "none"}`;
            debugLog(`ERROR: No student or observer enrollment found. Roles: ${roleTypes}`);
            return;
        }
    }

    // Fetch outcome rollups for the student
    debugStatus(statusEl, `Fetching mastery data for student ${studentId}...`);

    const data = await apiJson(
        `/api/v1/courses/${courseId}/outcome_rollups?user_ids[]=${studentId}&include[]=outcomes&per_page=100`
    );

    debugLog(`Rollup data fetched`);
    debugStatus(statusEl, `Processing rollup data...`);

    const rollup = data.rollups && data.rollups[0];
    if (!rollup || !rollup.scores || rollup.scores.length === 0) {
        statusEl.textContent = "No mastery data available for this course.";
        debugLog("No rollup scores found");
        return;
    }

    // Build outcome map
    const outcomeMap = {};
    if (data.linked?.outcomes) {
        data.linked.outcomes.forEach(o => {
            outcomeMap[o.id] = o;
        });
    }
    debugLog(`Outcomes mapped: ${Object.keys(outcomeMap).length}`);

    const scores = rollup.scores;
    debugLog(`Outcome scores: ${scores.length}`);

    // Clear status in production, keep in dev
    if (!ENV_DEV) {
        statusEl.textContent = "";
    } else {
        statusEl.textContent = `✓ Loaded ${scores.length} outcomes`;
    }

    // Sort scores: AVG_OUTCOME first, then by most recent submission
    const sortedScores = scores.sort((a, b) => {
        const outcomeA = outcomeMap[a.links.outcome];
        const outcomeB = outcomeMap[b.links.outcome];

        // AVG_OUTCOME always first
        if (outcomeA?.title === AVG_OUTCOME_NAME) return -1;
        if (outcomeB?.title === AVG_OUTCOME_NAME) return 1;

        // Sort by most recent submission
        const dateA = new Date(a.submitted_at || 0);
        const dateB = new Date(b.submitted_at || 0);

        return dateB - dateA; // Most recent first
    });

    // Render cards
    const cards = [];
    for (const scoreData of sortedScores) {
        const oid = scoreData.links.outcome;
        const outcome = outcomeMap[oid];
        if (!outcome) continue;

        const score = scoreData.score != null ? scoreData.score : "—";
        const assignmentName = scoreData.title || "No assignment data";

        // Calculate percentage based on points_possible
        const possible = outcome.points_possible || 4;
        const percent = scoreData.score != null ? Math.round((scoreData.score / possible) * 100) : null;

        let masteryColor = "#999";
        if (percent != null) {
            if (percent >= 80) masteryColor = "#0c6";
            else if (percent >= 60) masteryColor = "#fc3";
            else masteryColor = "#f66";
        }

        cards.push(`
            <div data-outcome-id="${oid}" data-student-id="${studentId}" data-course-id="${courseId}" style="border:1px solid #ddd; border-radius:8px; padding:10px; margin:8px 0; background:#fff; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span class="expand-arrow" style="font-size:0.8em; transition:transform 0.2s;">▶</span>
                    <div style="font-weight:600; flex:1;">${escapeHtml(outcome.title)}</div>
                </div>
                <div style="font-size:0.9em; color:#666; margin-bottom:6px; margin-left:20px;">${escapeHtml(outcome.description || "")}</div>
                <div style="font-size:0.85em; color:#888; margin-bottom:4px; margin-left:20px;">Latest: ${escapeHtml(assignmentName)}</div>
                <div style="display:flex; align-items:center; gap:8px; margin-left:20px;">
                    <div style="font-size:1.2em; font-weight:700; color:${masteryColor};">
                        ${score} / ${possible}
                    </div>
                    ${percent != null ? `<div style="font-size:0.9em; color:#666;">(${percent}%)</div>` : ""}
                </div>
                <div class="assignment-details" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid #ddd; margin-left:20px;">
                    <div style="font-weight:600; font-size:0.9em; margin-bottom:8px; color:#333;">Loading assignments...</div>
                </div>
            </div>
        `);
    }

    cardsEl.innerHTML = cards.join("");

    // Add click handlers to toggle expansion and lazy-load contributing scores
    cardsEl.querySelectorAll('[data-outcome-id]').forEach(card => {
        card.addEventListener('click', async (e) => {
            // Don't toggle if clicking on a link (future-proofing)
            if (e.target.tagName === 'A') return;

            const details = card.querySelector('.assignment-details');
            const arrow = card.querySelector('.expand-arrow');
            const outcomeId = card.dataset.outcomeId;
            const studentIdForCard = card.dataset.studentId;
            const courseIdForCard = card.dataset.courseId;

            if (details.style.display === 'none') {
                // Expanding - load contributing scores if not already loaded
                if (!card.dataset.loaded) {
                    details.innerHTML = '<div style="font-weight:600; font-size:0.9em; margin-bottom:8px; color:#333;">Loading assignments...</div>';

                    try {
                        const contributingData = await apiJson(
                            `/api/v1/courses/${courseIdForCard}/outcome_results/${outcomeId}/rollups?user_ids[]=${studentIdForCard}&include[]=outcomes`
                        );

                        debugLog(`Contributing scores loaded for outcome ${outcomeId}`);

                        // Parse contributing scores
                        const rollupData = contributingData.rollups && contributingData.rollups[0];
                        if (rollupData && rollupData.scores && rollupData.scores.length > 0) {
                            // Sort by most recent first
                            const sortedContributing = rollupData.scores.sort((a, b) => {
                                const dateA = new Date(a.submitted_at || 0);
                                const dateB = new Date(b.submitted_at || 0);
                                return dateB - dateA;
                            });

                            const assignmentListHtml = sortedContributing.map(result => {
                                const assignmentScore = result.score != null ? result.score : "—";
                                const assignmentPossible = outcomeMap[outcomeId]?.points_possible || 4;
                                const letterGrade = result.score != null ? getLetterGrade(result.score) : "";
                                const assignmentName = result.title || "Unnamed Assignment";

                                return `
                                    <div style="padding:6px 0; border-bottom:1px solid #eee;">
                                        <div style="font-weight:500; font-size:0.9em;">${escapeHtml(assignmentName)}</div>
                                        <div style="font-size:0.85em; color:#666; margin-top:2px;">
                                            ${assignmentScore} / ${assignmentPossible}${letterGrade ? ` - ${escapeHtml(letterGrade)}` : ""}
                                        </div>
                                    </div>
                                `;
                            }).join("");

                            details.innerHTML = `
                                <div style="font-weight:600; font-size:0.9em; margin-bottom:8px; color:#333;">Aligned Assignments:</div>
                                ${assignmentListHtml}
                            `;
                        } else {
                            details.innerHTML = '<div style="font-size:0.9em; color:#666;">No assignment data available.</div>';
                        }

                        card.dataset.loaded = 'true';
                    } catch (err) {
                        console.error('[MasteryDashboard] Failed to load contributing scores:', err);
                        details.innerHTML = '<div style="font-size:0.9em; color:#c62828;">Failed to load assignments.</div>';
                    }
                }

                details.style.display = 'block';
                arrow.style.transform = 'rotate(90deg)';
                arrow.textContent = '▼';
            } else {
                details.style.display = 'none';
                arrow.style.transform = 'rotate(0deg)';
                arrow.textContent = '▶';
            }
        });
    });

    debugLog(`Rendered ${cards.length} outcome cards with lazy-loaded assignment lists`);
}