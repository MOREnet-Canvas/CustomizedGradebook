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

import { logger } from '../utils/logger.js';

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
        logger.debug(`[MasteryDashboard] ${message}`);
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

    // Fetch outcome results for the student
    debugStatus(statusEl, `Fetching mastery data for student ${studentId}...`);

    const results = await apiJson(
        `/api/v1/courses/${courseId}/outcome_results?user_ids[]=${studentId}&per_page=100&include[]=outcomes&include[]=alignments`
    );

    debugLog(`Outcome results fetched: ${results.outcome_results?.length || 0}`);
    debugStatus(statusEl, `Processing ${results.outcome_results?.length || 0} outcome results...`);

    if (!results.outcome_results || results.outcome_results.length === 0) {
        statusEl.textContent = "No mastery data available for this course.";
        debugLog("No outcome results found");
        return;
    }

    // Build outcome map
    const outcomeMap = {};
    if (results.linked?.outcomes) {
        results.linked.outcomes.forEach(o => {
            outcomeMap[o.id] = o;
        });
    }
    debugLog(`Outcomes mapped: ${Object.keys(outcomeMap).length}`);

    // Group results by outcome
    const grouped = {};
    results.outcome_results.forEach(r => {
        const oid = r.links.learning_outcome;
        if (!grouped[oid]) grouped[oid] = [];
        grouped[oid].push(r);
    });
    debugLog(`Outcomes with results: ${Object.keys(grouped).length}`);

    // Clear status in production, keep in dev
    if (!ENV_DEV) {
        statusEl.textContent = "";
    } else {
        statusEl.textContent = `✓ Loaded ${Object.keys(grouped).length} outcomes`;
    }

    // Render cards
    const cards = [];
    for (const oid in grouped) {
        const outcome = outcomeMap[oid];
        if (!outcome) continue;

        const outcomeResults = grouped[oid];
        const latest = outcomeResults.reduce((a, b) =>
            (new Date(a.submitted_or_assessed_at) > new Date(b.submitted_or_assessed_at)) ? a : b
        );

        const score = latest.score != null ? latest.score : "—";
        const possible = latest.possible != null ? latest.possible : "—";
        const percent = latest.percent != null ? Math.round(latest.percent * 100) : null;

        let masteryColor = "#999";
        if (percent != null) {
            if (percent >= 80) masteryColor = "#0c6";
            else if (percent >= 60) masteryColor = "#fc3";
            else masteryColor = "#f66";
        }

        cards.push(`
            <div style="border:1px solid #ddd; border-radius:8px; padding:10px; margin:8px 0; background:#fff;">
                <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(outcome.title)}</div>
                <div style="font-size:0.9em; color:#666; margin-bottom:6px;">${escapeHtml(outcome.description || "")}</div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-size:1.2em; font-weight:700; color:${masteryColor};">
                        ${score} / ${possible}
                    </div>
                    ${percent != null ? `<div style="font-size:0.9em; color:#666;">(${percent}%)</div>` : ""}
                </div>
            </div>
        `);
    }

    cardsEl.innerHTML = cards.join("");
    debugLog(`Rendered ${cards.length} outcome cards`);
}