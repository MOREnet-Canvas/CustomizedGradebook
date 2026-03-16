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
 * - Teachers: student picker via teacherMasteryView.js
 */

import { AVG_OUTCOME_NAME, EXCLUDED_OUTCOME_KEYWORDS, OUTCOME_AND_RUBRIC_RATINGS } from '../config.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { renderTeacherMasteryView } from './teacherMasteryView.js';

/**
 * Rating scale for calculating letter grades
 * Uses imported OUTCOME_AND_RUBRIC_RATINGS from config.js
 */
const RATINGS = OUTCOME_AND_RUBRIC_RATINGS;

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
 * @param {string} courseName - The name of the course to display
 * @returns {HTMLElement|null} The root element, or null if not found
 */
function ensureHost(courseName = "Mastery Dashboard") {
    const root = document.getElementById("mastery-dashboard-root");
    if (!root) return null;

    // Inject course name as a page-level heading before the root div (once only).
    // This works for all existing pages regardless of whether they have the <h2> in their body.
    let heading = document.getElementById('pm-course-heading');
    if (!heading) {
        heading = document.createElement('h2');
        heading.id = 'pm-course-heading';
        root.parentNode.insertBefore(heading, root);
    }
    heading.innerHTML = `<strong>${escapeHtml(courseName)}</strong>`;

    root.style.display = "block";
    root.style.width = "100%";
    root.style.maxWidth = "100%";
    root.style.boxSizing = "border-box";

    root.innerHTML = `
      <div style="border:1px solid #ddd; border-radius:10px; padding:12px; margin:12px 0;">
        <div style="font-weight:700; margin-bottom:8px;">${escapeHtml(courseName)}</div>
        <div id="pm-status">Loading…</div>
        <div id="pm-cards"></div>
      </div>
    `;
    return root;
}

/**
 * Fetch course name from Canvas API
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<string>} Course name
 */
async function fetchCourseName(courseId, apiClient) {
    try {
        const course = await apiClient.get(`/api/v1/courses/${courseId}`, {}, 'fetchCourseName');
        return course.name || "Mastery Dashboard";
    } catch (error) {
        debugLog(`Error fetching course name: ${error.message}`);
        return "Mastery Dashboard";
    }
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
    // Get course ID from URL first (needed for enrollment filtering)
    const match = location.pathname.match(/^\/courses\/(\d+)\//);
    if (!match) {
        console.error('[MasteryDashboard] Could not extract course ID from URL:', location.pathname);
        return;
    }
    const courseId = Number(match[1]);
    debugLog(`Course ID: ${courseId}`);

    // Initialize Canvas API client
    const apiClient = new CanvasApiClient();

    // Fetch course name from Canvas API
    const courseName = await fetchCourseName(courseId, apiClient);
    debugLog(`Course name: ${courseName}`);

    // Initialize host with course name
    const root = ensureHost(courseName);
    if (!root) {
        debugLog('No mastery-dashboard-root element found, exiting');
        return; // Only runs on mastery-dashboard page
    }

    const statusEl = document.getElementById("pm-status");
    const cardsEl = document.getElementById("pm-cards");

    debugLog('Mastery Dashboard initializing...');
    debugLog(`Dev mode: ${ENV_DEV}`);

    // Fetch enrollments for role detection
    debugStatus(statusEl, "Fetching enrollments...");
    const enrollments = await apiClient.get("/api/v1/users/self/enrollments", {}, 'fetchEnrollments');
    debugLog(`Total enrollments fetched: ${enrollments.length}`);

    // Filter enrollments for this course
    const courseEnrollments = enrollments.filter(e =>
        String(e.course_id) === String(courseId) && e.enrollment_state === "active"
    );

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
            // Check for teacher enrollment
            const isTeacher = courseEnrollments.some(e =>
                e.type === "TeacherEnrollment" || e.type === "TaEnrollment" || e.type === "DesignerEnrollment"
            );

            if (isTeacher) {
                debugLog(`User role: Teacher. Rendering student picker.`);
                statusEl.textContent = "";
                renderTeacherMasteryView({
                    courseId,
                    apiClient,
                    statusEl,
                    cardsEl,
                    onStudentSelected: (selectedStudentId, selectedStudentName) => {
                        renderStudentData(selectedStudentId, courseId, apiClient, statusEl, cardsEl);
                    }
                });
                return;
            }

            // Unknown role
            const roleTypes = courseEnrollments.map(e => e.type).join(", ");
            statusEl.textContent = `Mastery Dashboard is not available for your role. Role(s): ${roleTypes || "none"}`;
            debugLog(`ERROR: No supported enrollment found. Roles: ${roleTypes}`);
            return;
        }
    }

    await renderStudentData(studentId, courseId, apiClient, statusEl, cardsEl);
}

/**
 * Render mastery data for a specific student.
 * Called directly for students/observers, and by teacherMasteryView after student selection.
 *
 * @param {string|number} studentId - Canvas user ID of the student to display
 * @param {string|number} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Authenticated API client
 * @param {HTMLElement} statusEl - Status message element (#pm-status)
 * @param {HTMLElement} cardsEl - Cards container element (#pm-cards)
 */
export async function renderStudentData(studentId, courseId, apiClient, statusEl, cardsEl) {
    // Fetch outcome rollups and submissions in parallel for the student
    debugStatus(statusEl, `Fetching mastery data for student ${studentId}...`);

    const [rollupData, submissions] = await Promise.all([
        apiClient.get(
            `/api/v1/courses/${courseId}/outcome_rollups?user_ids[]=${studentId}&include[]=outcomes&include[]=outcomes.alignments`,
            {},
            'fetchOutcomeRollups'
        ),
        apiClient.get(
            `/api/v1/courses/${courseId}/students/submissions?student_ids[]=${studentId}&per_page=100`,
            {},
            'fetchStudentSubmissions'
        )
    ]);

    debugLog(`Outcome rollups and submissions fetched`);
    debugStatus(statusEl, `Processing outcome data...`);

    // Build submission map: assignment_id → submission data
    const submissionMap = {};
    submissions.forEach(sub => {
        submissionMap[sub.assignment_id] = {
            late_policy_status: sub.late_policy_status,
            excused: sub.excused,
            workflow_state: sub.workflow_state
        };
    });
    debugLog(`Submissions mapped: ${Object.keys(submissionMap).length}`);

    // Extract rollup scores (one entry per outcome)
    const rollupScores = rollupData.rollups?.[0]?.scores ?? [];

    if (rollupScores.length === 0) {
        statusEl.textContent = "No mastery data available for this course.";
        debugLog("No rollup scores found");
        return;
    }

    // Build outcome map from rollup linked data
    const outcomeMap = {};
    if (rollupData.linked?.outcomes) {
        rollupData.linked.outcomes.forEach(o => {
            outcomeMap[o.id] = o;
        });
    }
    debugLog(`Outcomes mapped: ${Object.keys(outcomeMap).length}`);

    // Build alignment map (assignment names/URLs) from rollup linked data
    const alignmentMap = {};
    if (rollupData.linked?.["outcomes.alignments"]) {
        rollupData.linked["outcomes.alignments"].forEach(alignment => {
            alignmentMap[alignment.id] = alignment;
        });
    }
    debugLog(`Alignments mapped: ${Object.keys(alignmentMap).length}`);
    debugLog(`Rollup scores: ${rollupScores.length}`);

    // Sort outcomes: AVG_OUTCOME first, then by most recent submission
    const sortedScores = [...rollupScores].sort((a, b) => {
        const outcomeA = outcomeMap[a.links.outcome];
        const outcomeB = outcomeMap[b.links.outcome];

        // AVG_OUTCOME always first
        if (outcomeA?.title === AVG_OUTCOME_NAME) return -1;
        if (outcomeB?.title === AVG_OUTCOME_NAME) return 1;

        // Sort by most recent submission (submitted_at is already the latest for each outcome)
        const dateA = new Date(a.submitted_at || 0);
        const dateB = new Date(b.submitted_at || 0);

        return dateB - dateA; // Most recent first
    });

    // Calculate mastery count (score >= 3 is considered mastered)
    // Exclude AVG_OUTCOME and any outcomes matching EXCLUDED_OUTCOME_KEYWORDS
    let masteredCount = 0;
    let totalCount = 0;

    for (const rollupScore of sortedScores) {
        const oid = String(rollupScore.links.outcome);
        const outcome = outcomeMap[oid];
        if (!outcome) continue;

        // Skip AVG_OUTCOME (Current Score) - it's not a learning outcome
        if (outcome.title === AVG_OUTCOME_NAME) continue;

        // Skip excluded outcomes
        const isExcluded = EXCLUDED_OUTCOME_KEYWORDS.some(keyword =>
            outcome.title.includes(keyword)
        );
        if (isExcluded) continue;

        // Count this as a valid learning outcome
        totalCount++;

        // Rollup score IS the decaying average - use it directly
        if (rollupScore.score != null && rollupScore.score >= 3) {
            masteredCount++;
        }
    }

    // Update status with mastery count
    statusEl.textContent = `${masteredCount} of ${totalCount} Mastered`;
    debugLog(`Mastery count: ${masteredCount} of ${totalCount}`);

    // Separate AVG_OUTCOME from regular outcomes
    let avgOutcomeHtml = null;
    const regularCards = [];

    for (const rollupScore of sortedScores) {
        const oid = String(rollupScore.links.outcome);
        const outcome = outcomeMap[oid];
        if (!outcome) continue;

        // Use raw rollup score (server-calculated decaying average) - no rounding
        const score = rollupScore.score != null ? rollupScore.score : "—";

        // Determine mastery color based on actual score value
        let masteryColor = "#E62429"; // Red - Insufficient Evidence (null/no score)

        if (rollupScore.score != null) {
            const scoreValue = rollupScore.score;

            // Map score directly to color ranges (inclusive of whole number)
            if (scoreValue >= 4) masteryColor = "#02672D";      // 4.0+ - Exceeds Mastery (dark green)
            else if (scoreValue >= 3) masteryColor = "#03893D"; // 3.0-3.99 - Mastery (medium green)
            else if (scoreValue >= 2) masteryColor = "#FAB901"; // 2.0-2.99 - Near Mastery (yellow/gold)
            else if (scoreValue >= 1) masteryColor = "#FD5D10"; // 1.0-1.99 - Below Mastery (orange)
            else masteryColor = "#E62429";                       // 0.0-0.99 - Well Below Mastery (red)
        }

        // Use display_name if present, fall back to title
        const outcomeName = outcome.display_name || outcome.title;

        // Check if this is the AVG_OUTCOME (Course Grade)
        if (outcome.title === AVG_OUTCOME_NAME) {
            // Get AVG assignment URL from alignments
            let avgAssignmentUrl = "#";
            if (outcome.alignments && outcome.alignments.length > 0) {
                const avgAssignmentAlignment = outcome.alignments.find(id => id.startsWith("assignment_"));
                if (avgAssignmentAlignment && alignmentMap[avgAssignmentAlignment]) {
                    avgAssignmentUrl = alignmentMap[avgAssignmentAlignment].html_url || "#";
                }
            }

            // Format the last updated date
            const lastUpdated = rollupScore.submitted_at
                ? new Date(rollupScore.submitted_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : null;

            // Build native-like course grade display (matches Canvas Parent app)
            if (rollupScore.score != null) {
                // Has score - show score with letter grade and colored dot
                const letterGrade = getLetterGrade(rollupScore.score);
                avgOutcomeHtml = `
                    <a href="${avgAssignmentUrl}" target="_blank"
                       style="display:flex; flex-direction:column; padding:12px 0; text-decoration:none; margin-bottom:12px; border-bottom:1px solid #e0e0e0;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.9rem; color:#666; font-weight:400; line-height:1.5; -webkit-font-smoothing:antialiased;">Total</span>
                            <span style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:1.2rem; font-weight:600; color:#333; line-height:1.5; -webkit-font-smoothing:antialiased;">
                                <span style="color:${masteryColor}; font-size:1.3em; line-height:1;">●</span> ${score} (${escapeHtml(letterGrade)})
                            </span>
                        </div>
                        ${lastUpdated ? `<div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.8rem; color:#555; margin-top:4px; line-height:1.5; -webkit-font-smoothing:antialiased;">Last Updated: ${lastUpdated}</div>` : ''}
                    </a>
                `;
            } else {
                // No score - show "Insufficient Evidence" with red dot
                avgOutcomeHtml = `
                    <a href="${avgAssignmentUrl}" target="_blank"
                       style="display:flex; flex-direction:column; padding:12px 0; text-decoration:none; margin-bottom:12px; border-bottom:1px solid #e0e0e0;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.9rem; color:#666; font-weight:400; line-height:1.5; -webkit-font-smoothing:antialiased;">Total</span>
                            <span style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:1.2rem; font-weight:600; color:#333; line-height:1.5; -webkit-font-smoothing:antialiased;">
                                <span style="color:#E62429; font-size:1.3em; line-height:1;">●</span> Insufficient Evidence
                            </span>
                        </div>
                        ${lastUpdated ? `<div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.8rem; color:#555; margin-top:4px; line-height:1.5; -webkit-font-smoothing:antialiased;">Last Updated: ${lastUpdated}</div>` : ''}
                    </a>
                `;
            }

            // Skip adding to regular cards
            continue;
        }

        // Get letter grade for display
        const letterGrade = rollupScore.score != null ? getLetterGrade(rollupScore.score) : "";

        // Format date for display (rollup submitted_at = date of most recent assessment)
        const latestDate = rollupScore.submitted_at ? new Date(rollupScore.submitted_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) : "";

        regularCards.push(`
            <div data-outcome-id="${oid}"
                 tabindex="0"
                 role="button"
                 aria-expanded="false"
                 style="border:1px solid #ddd; border-left:4px solid ${masteryColor}; border-radius:8px; padding:10px; margin:8px 0; background:#fff; cursor:pointer;"
                 onfocus="this.style.outline='2px solid rgb(147, 154, 160)'; this.style.outlineOffset='2px';"
                 onblur="this.style.outline='none';">
                <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:4px;">
                    <span class="expand-arrow" style="font-size:0.8rem; transition:transform 0.2s; margin-top:2px;">▶</span>
                    <div style="flex:1;">
                        <div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-weight:600; font-size:1rem; color:#333; line-height:1.5; -webkit-font-smoothing:antialiased;">${escapeHtml(outcomeName)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:1.5rem; font-weight:700; color:${masteryColor}; line-height:1.5; -webkit-font-smoothing:antialiased;">
                            ${score}
                        </div>
                        ${letterGrade ? `<div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.9rem; font-weight:600; color:#333; margin-top:4px; line-height:1.5; -webkit-font-smoothing:antialiased;"><span style="color:${masteryColor}; font-size:1.4em; line-height:1;">●</span> ${escapeHtml(letterGrade)}</div>` : ""}
                        ${latestDate ? `<div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.875rem; color:#555; margin-top:4px; line-height:1.5; -webkit-font-smoothing:antialiased;">${latestDate}</div>` : ""}
                    </div>
                </div>
                <div class="assignment-details" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid #c8c8c8; margin-left:20px;">
                    <div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-weight:600; font-size:0.9rem; margin-bottom:8px; color:#333; line-height:1.5; -webkit-font-smoothing:antialiased;">Loading assignments...</div>
                </div>
            </div>
        `);
    }

    // Render: Course grade section first, then regular outcomes
    cardsEl.innerHTML = `
        ${avgOutcomeHtml || ""}
        ${regularCards.length > 0 ? `
            <div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.9rem; font-weight:600; color:#666; margin-bottom:8px; margin-top:8px; line-height:1.5; -webkit-font-smoothing:antialiased;">Learning Outcomes</div>
            ${regularCards.join("")}
        ` : ""}
    `;

    // Add click and keyboard handlers to toggle expansion and lazy-load outcome_results
    cardsEl.querySelectorAll('[data-outcome-id]').forEach(card => {
        const toggleCard = async (e) => {
            // Don't toggle if clicking on a link
            if (e.target.tagName === 'A') return;

            const details = card.querySelector('.assignment-details');
            const arrow = card.querySelector('.expand-arrow');
            const outcomeId = card.dataset.outcomeId;

            if (details.style.display === 'none') {
                // Expanding - fetch outcome_results for this outcome if not yet loaded
                if (!card.dataset.loaded) {
                    try {
                        debugLog(`Fetching outcome_results for outcome ${outcomeId}`);

                        const resultsData = await apiClient.get(
                            `/api/v1/courses/${courseId}/outcome_results?user_ids[]=${studentId}&outcome_ids[]=${outcomeId}&include[]=outcomes.alignments&per_page=100`,
                            {},
                            'fetchOutcomeResultsLazy'
                        );

                        // Build alignment lookup from this response (may include alignments not in rollup)
                        const lazyAlignmentMap = { ...alignmentMap };
                        if (resultsData.linked?.["outcomes.alignments"]) {
                            resultsData.linked["outcomes.alignments"].forEach(a => {
                                lazyAlignmentMap[a.id] = a;
                            });
                        }

                        // Build assignment rows from individual results
                        const scoredResults = (resultsData.outcome_results ?? []).filter(r => r.score != null);
                        debugLog(`Received ${scoredResults.length} scored results for outcome ${outcomeId}`);

                        if (scoredResults.length > 0) {
                            // Sort by most recent first
                            const sortedResults = scoredResults.sort((a, b) =>
                                new Date(b.submitted_or_assessed_at || 0) - new Date(a.submitted_or_assessed_at || 0)
                            );

                            const assignmentListHtml = sortedResults.map(result => {
                                const alignmentId = result.links?.alignment;
                                const alignment = lazyAlignmentMap[alignmentId];
                                const assignmentId = alignmentId?.split("_")[1];
                                const submission = submissionMap[assignmentId];

                                const assignmentScore = result.score;
                                const letterGrade = getLetterGrade(result.score);

                                // Calculate mastery color for this result
                                let assignmentMasteryColor = "#E62429";
                                if (result.score >= 4) assignmentMasteryColor = "#02672D";
                                else if (result.score >= 3) assignmentMasteryColor = "#03893D";
                                else if (result.score >= 2) assignmentMasteryColor = "#FAB901";
                                else if (result.score >= 1) assignmentMasteryColor = "#FD5D10";

                                // Format date
                                const date = result.submitted_or_assessed_at
                                    ? new Date(result.submitted_or_assessed_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric'
                                    })
                                    : "";

                                // Build status indicator from submission map (late/excused/missing)
                                let statusIndicator = "";
                                if (submission?.excused) {
                                    statusIndicator = `<span style="display:inline-block; margin-left:6px; white-space:nowrap;"><svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle; margin-right:4px;"><circle cx="8" cy="8" r="6.5" fill="#EE0612" stroke="none"/><path d="M 5 8 L 7 10 L 11 6" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; color:#333; font-weight:600; font-size:1rem; line-height:1.5; -webkit-font-smoothing:antialiased;">Excused</span></span>`;
                                } else if (submission?.late_policy_status === 'late') {
                                    statusIndicator = `<span style="display:inline-block; margin-left:6px; white-space:nowrap;"><svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle; margin-right:4px;"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#FC5E13" stroke-width="1.5"/><line x1="8" y1="8" x2="8" y2="4.5" stroke="#FC5E13" stroke-width="1.5"/><line x1="8" y1="8" x2="11" y2="8" stroke="#FC5E13" stroke-width="1.5"/></svg><span style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; color:#333; font-weight:600; font-size:1rem; line-height:1.5; -webkit-font-smoothing:antialiased;">Late</span></span>`;
                                } else if (submission?.late_policy_status === 'missing') {
                                    statusIndicator = `<span style="display:inline-block; margin-left:6px; white-space:nowrap;"><svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle; margin-right:4px;"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#EE0612" stroke-width="2"/><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke="#EE0612" stroke-width="2"/></svg><span style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; color:#333; font-weight:700; font-size:1rem; line-height:1.5; -webkit-font-smoothing:antialiased;">Missing</span></span>`;
                                }

                                const assignmentName = alignment?.name ?? "Unnamed Assignment";
                                const assignmentUrl = alignment?.html_url ?? "#";

                                return `
                                    <div style="padding:8px 0; border-bottom:1px solid #c8c8c8;">
                                        <div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-weight:400; font-size:1rem; line-height:1.5; -webkit-font-smoothing:antialiased;">
                                            <a href="${assignmentUrl}" target="_blank" style="color:#0374B5; text-decoration:none;">
                                                ${escapeHtml(assignmentName)}
                                            </a>${statusIndicator}
                                        </div>
                                        <div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:0.875rem; color:#333; margin-top:2px; line-height:1.5; -webkit-font-smoothing:antialiased;">
                                            <span style="color:${assignmentMasteryColor}; font-size:1.1em; line-height:1;">●</span>
                                            ${assignmentScore} (${escapeHtml(letterGrade)})${date ? ` – ${date}` : ""}
                                        </div>
                                    </div>
                                `;
                            }).join("");

                            details.innerHTML = `
                                <div style="font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif; font-weight:600; font-size:0.9rem; margin-bottom:8px; color:#333; line-height:1.5; -webkit-font-smoothing:antialiased;">Assignments for this outcome:</div>
                                ${assignmentListHtml}
                            `;
                        } else {
                            details.innerHTML = '<div style="font-family:LatoWeb,\'Lato Extended\',Lato,\'Helvetica Neue\',Helvetica,Arial,sans-serif; font-size:0.9rem; color:#555; line-height:1.5; -webkit-font-smoothing:antialiased;">No assignment data available.</div>';
                        }

                        card.dataset.loaded = 'true';
                    } catch (err) {
                        console.error('[MasteryDashboard] Failed to load assignments:', err);
                        details.innerHTML = '<div style="font-family:LatoWeb,\'Lato Extended\',Lato,\'Helvetica Neue\',Helvetica,Arial,sans-serif; font-size:0.9rem; color:#c62828; line-height:1.5; -webkit-font-smoothing:antialiased;">Failed to load assignments.</div>';
                    }
                }

                details.style.display = 'block';
                arrow.style.transform = 'rotate(90deg)';
                arrow.textContent = '▼';
                card.setAttribute('aria-expanded', 'true');
            } else {
                details.style.display = 'none';
                arrow.style.transform = 'rotate(0deg)';
                arrow.textContent = '▶';
                card.setAttribute('aria-expanded', 'false');
            }
        };

        // Add click handler
        card.addEventListener('click', toggleCard);

        // Add keyboard handler (Enter or Space)
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCard(e);
            }
        });
    });

    debugLog(`Rendered ${avgOutcomeHtml ? '1 course grade + ' : ''}${regularCards.length} outcome cards`);
}