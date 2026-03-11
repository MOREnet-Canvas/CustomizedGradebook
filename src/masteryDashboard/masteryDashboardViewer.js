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

    // Fetch outcome results with alignments for the student
    debugStatus(statusEl, `Fetching mastery data for student ${studentId}...`);

    const data = await apiJson(
        `/api/v1/courses/${courseId}/outcome_results?user_ids[]=${studentId}&include[]=outcomes&include[]=outcomes.alignments&per_page=100`
    );

    debugLog(`Outcome results fetched`);
    debugStatus(statusEl, `Processing outcome data...`);

    if (!data.outcome_results || data.outcome_results.length === 0) {
        statusEl.textContent = "No mastery data available for this course.";
        debugLog("No outcome results found");
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

    // Build alignment map (assignment names)
    const alignmentMap = {};
    if (data.linked && data.linked["outcomes.alignments"]) {
        data.linked["outcomes.alignments"].forEach(alignment => {
            alignmentMap[alignment.id] = alignment;
        });
    }
    debugLog(`Alignments mapped: ${Object.keys(alignmentMap).length}`);

    // Group outcome results by outcome ID
    const grouped = {};
    data.outcome_results.forEach(result => {
        const outcomeId = result.links.learning_outcome;
        if (!grouped[outcomeId]) {
            grouped[outcomeId] = [];
        }
        grouped[outcomeId].push(result);
    });
    debugLog(`Outcomes with results: ${Object.keys(grouped).length}`);

    // Clear status in production, keep in dev
    if (!ENV_DEV) {
        statusEl.textContent = "";
    } else {
        statusEl.textContent = `✓ Loaded ${Object.keys(grouped).length} outcomes`;
    }

    // Sort outcomes: AVG_OUTCOME first, then by most recent submission
    const sortedOutcomeIds = Object.keys(grouped).sort((oidA, oidB) => {
        const outcomeA = outcomeMap[oidA];
        const outcomeB = outcomeMap[oidB];

        // AVG_OUTCOME always first
        if (outcomeA?.title === AVG_OUTCOME_NAME) return -1;
        if (outcomeB?.title === AVG_OUTCOME_NAME) return 1;

        // Sort by most recent submission
        const latestA = grouped[oidA].reduce((a, b) =>
            (new Date(a.submitted_or_assessed_at) > new Date(b.submitted_or_assessed_at)) ? a : b
        );
        const latestB = grouped[oidB].reduce((a, b) =>
            (new Date(a.submitted_or_assessed_at) > new Date(b.submitted_or_assessed_at)) ? a : b
        );

        const dateA = new Date(latestA.submitted_or_assessed_at);
        const dateB = new Date(latestB.submitted_or_assessed_at);

        return dateB - dateA; // Most recent first
    });

    // Render cards
    const cards = [];
    for (const oid of sortedOutcomeIds) {
        const outcome = outcomeMap[oid];
        if (!outcome) continue;

        const outcomeResults = grouped[oid];

        // Get the latest result for the card display
        const latest = outcomeResults.reduce((a, b) =>
            (new Date(a.submitted_or_assessed_at) > new Date(b.submitted_or_assessed_at)) ? a : b
        );

        const score = latest.score != null ? latest.score : "—";

        // Calculate percentage based on points_possible
        const possible = outcome.points_possible || 4;
        const percent = latest.score != null ? Math.round((latest.score / possible) * 100) : null;

        let masteryColor = "#999";
        if (percent != null) {
            if (percent >= 80) masteryColor = "#0c6";
            else if (percent >= 60) masteryColor = "#fc3";
            else masteryColor = "#f66";
        }

        // Pre-build assignment list from outcome results and alignments
        const assignmentListData = [];

        // Get aligned assignments from outcome.alignments
        if (outcome.alignments && outcome.alignments.length > 0) {
            const assignmentAlignments = outcome.alignments.filter(id => id.startsWith("assignment_"));

            assignmentAlignments.forEach(alignmentId => {
                const alignment = alignmentMap[alignmentId];
                if (!alignment) return;

                // Find the result for this alignment
                const result = outcomeResults.find(r => {
                    const resultAlignmentId = r.links?.alignment;
                    return resultAlignmentId && String(resultAlignmentId) === alignmentId;
                });

                assignmentListData.push({
                    name: alignment.name || "Unnamed Assignment",
                    score: result?.score,
                    submitted_at: result?.submitted_or_assessed_at,
                    html_url: alignment.html_url
                });
            });
        }

        // Store assignment data in dataset for lazy rendering
        const assignmentDataJson = JSON.stringify(assignmentListData);

        // Get letter grade for display
        const letterGrade = latest.score != null ? getLetterGrade(latest.score) : "";

        // Format date for display
        const latestDate = latest.submitted_or_assessed_at ? new Date(latest.submitted_or_assessed_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) : "";

        cards.push(`
            <div data-outcome-id="${oid}" data-assignment-data="${escapeHtml(assignmentDataJson)}" style="border:1px solid #ddd; border-radius:8px; padding:10px; margin:8px 0; background:#fff; cursor:pointer;">
                <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:4px;">
                    <span class="expand-arrow" style="font-size:0.8em; transition:transform 0.2s; margin-top:2px;">▶</span>
                    <div style="flex:1;">
                        <div style="font-weight:600;">${escapeHtml(outcome.title)}</div>
                        <div style="font-size:0.9em; color:#666; margin-top:4px;">${escapeHtml(outcome.description || "")}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.2em; font-weight:700; color:${masteryColor};">
                            ${score}
                        </div>
                        ${letterGrade ? `<div style="font-size:0.9em; color:#666; margin-top:2px;">${escapeHtml(letterGrade)}</div>` : ""}
                        ${latestDate ? `<div style="font-size:0.85em; color:#999; margin-top:2px;">${latestDate}</div>` : ""}
                    </div>
                </div>
                <div class="assignment-details" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid #ddd; margin-left:20px;">
                    <div style="font-weight:600; font-size:0.9em; margin-bottom:8px; color:#333;">Loading assignments...</div>
                </div>
            </div>
        `);
    }

    cardsEl.innerHTML = cards.join("");

    // Add click handlers to toggle expansion and render pre-loaded assignment data
    cardsEl.querySelectorAll('[data-outcome-id]').forEach(card => {
        card.addEventListener('click', async (e) => {
            // Don't toggle if clicking on a link (future-proofing)
            if (e.target.tagName === 'A') return;

            const details = card.querySelector('.assignment-details');
            const arrow = card.querySelector('.expand-arrow');
            const outcomeId = card.dataset.outcomeId;

            if (details.style.display === 'none') {
                // Expanding - render assignment list from pre-loaded data
                if (!card.dataset.loaded) {
                    try {
                        const assignmentDataJson = card.dataset.assignmentData;
                        const assignmentList = assignmentDataJson ? JSON.parse(assignmentDataJson) : [];

                        // Filter out unscored assignments
                        const scoredAssignments = assignmentList.filter(a => a.score != null);

                        debugLog(`Rendering ${scoredAssignments.length} scored assignments for outcome ${outcomeId}`);

                        if (scoredAssignments.length > 0) {
                            // Sort by most recent first
                            const sortedAssignments = scoredAssignments.sort((a, b) => {
                                const dateA = new Date(a.submitted_at || 0);
                                const dateB = new Date(b.submitted_at || 0);
                                return dateB - dateA;
                            });

                            const assignmentListHtml = sortedAssignments.map(assignment => {
                                const assignmentScore = assignment.score;
                                const letterGrade = getLetterGrade(assignment.score);

                                // Format date
                                const date = assignment.submitted_at ? new Date(assignment.submitted_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                }) : "";

                                return `
                                    <div style="padding:6px 0; border-bottom:1px solid #eee;">
                                        <div style="font-weight:500; font-size:0.9em;">
                                            <a href="${assignment.html_url}" target="_blank" style="color:#0374B5; text-decoration:none;">
                                                ${escapeHtml(assignment.name)}
                                            </a>
                                        </div>
                                        <div style="font-size:0.85em; color:#666; margin-top:2px;">
                                            ${assignmentScore} - ${escapeHtml(letterGrade)}${date ? ` - ${date}` : ""}
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
                        console.error('[MasteryDashboard] Failed to render assignments:', err);
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