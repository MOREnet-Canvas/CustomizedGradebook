(function () {
    // ========================================================================
    // DEV MODE DETECTION
    // ========================================================================
    var IS_DEV = (function() {
        var scripts = document.querySelectorAll('script[src*="mobile_test.js"]');
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src.includes('/mobile-dev/')) {
                return true;
            }
        }
        return false;
    })();

    // Debug logging helpers (only active in dev builds)
    function debugLog(message) {
        if (IS_DEV) {
            console.log('[CG Mobile Debug]', message);
        }
    }

    function debugStatus(statusEl, message) {
        if (IS_DEV) {
            statusEl.textContent = message;
        }
    }

    // ========================================================================
    // MAIN CODE
    // ========================================================================

    function ensureHost() {
        var root = document.getElementById("mastery-dashboard-root");
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

    async function apiJson(path) {
        var r = await fetch(path, { credentials: "include" });
        if (!r.ok) {
            var t = await r.text();
            throw new Error(r.status + " " + r.statusText + "\n" + t.slice(0, 400));
        }
        return r.json();
    }

    async function run() {
        var root = ensureHost();
        if (!root) return; // only runs on mastery-dashboard page

        var statusEl = document.getElementById("pm-status");
        var cardsEl = document.getElementById("pm-cards");

        debugLog('Mastery Dashboard initializing...');
        debugLog('Dev mode: ' + IS_DEV);

        // courseId from URL
        var m = location.pathname.match(/^\/courses\/(\d+)\//);
        if (!m) {
            statusEl.textContent = "Could not detect course.";
            debugLog('ERROR: Could not extract course ID from URL: ' + location.pathname);
            return;
        }
        var courseId = Number(m[1]);
        debugLog('Course ID: ' + courseId);

        // DEBUG: Show fetching status
        debugStatus(statusEl, "Fetching enrollments...");

        // Determine which student's data to show
        var enrollments = await apiJson("/api/v1/users/self/enrollments?per_page=100");
        debugLog('Total enrollments fetched: ' + enrollments.length);

        // DEBUG: Show enrollment count
        debugStatus(statusEl, "Found " + enrollments.length + " enrollments. Analyzing...");

        // Filter enrollments for this course
        var courseEnrollments = enrollments.filter(function(e) {
            return String(e.course_id) === String(courseId) && e.enrollment_state === "active";
        });
        debugLog('Course enrollments: ' + courseEnrollments.length);

        // DEBUG: Show course-specific enrollments
        var enrollmentTypes = courseEnrollments.map(function(e) { return e.type; }).join(", ");
        debugLog('Enrollment types for this course: ' + enrollmentTypes);
        debugStatus(statusEl, "Course enrollments: " + (enrollmentTypes || "none") + ". Determining role...");

        // Try to find observer enrollment first (parent viewing child)
        var obs = courseEnrollments.find(function (e) {
            return e.type === "ObserverEnrollment" && e.associated_user_id;
        });

        var studentId;
        var userRole;

        if (obs) {
            // Observer (parent) viewing observed student's data
            studentId = obs.associated_user_id;
            userRole = "Observer (Parent)";
            debugLog('User role: ' + userRole);
            debugLog('Observed student ID: ' + studentId);
            debugStatus(statusEl, "Role: " + userRole + ". Loading observed student's data...");
        } else {
            // Try to find student enrollment (student viewing own data)
            var studentEnrollment = courseEnrollments.find(function (e) {
                return e.type === "StudentEnrollment";
            });

            if (studentEnrollment) {
                // Student viewing their own data
                studentId = studentEnrollment.user_id;
                userRole = "Student";
                debugLog('User role: ' + userRole);
                debugLog('Student ID: ' + studentId);
                debugStatus(statusEl, "Role: " + userRole + ". Loading your mastery data...");
            } else {
                // Not an observer or student in this course
                debugLog('ERROR: No valid enrollment found');
                debugLog('Available enrollment types: ' + enrollmentTypes);

                statusEl.innerHTML =
                    '<div style="color:#c62828;">No mastery data available.</div>' +
                    (IS_DEV ?
                        '<div style="font-size:11px; color:#666; margin-top:8px;">Debug: Found enrollments: ' + enrollmentTypes + '</div>' +
                        '<div style="font-size:11px; color:#666;">You must be enrolled as a student or observer in this course.</div>'
                        : '');
                return;
            }
        }

        // Fetch mastery data
        debugLog('Fetching outcome rollups for student ' + studentId);
        var data = await apiJson(
            "/api/v1/courses/" + courseId +
            "/outcome_rollups?user_ids[]=" + studentId +
            "&include[]=outcomes&include[]=outcome_groups&per_page=100"
        );

        var rollup = data.rollups && data.rollups[0];
        if (!rollup) {
            statusEl.textContent = "No mastery data found.";
            debugLog('ERROR: No rollup data returned from API');
            return;
        }

        var outcomes = (data.linked && data.linked.outcomes) ? data.linked.outcomes : [];
        var outcomesById = new Map(outcomes.map(function (o) { return [String(o.id), o]; }));

        var scores = rollup.scores || [];
        debugLog('Loaded ' + scores.length + ' outcome scores');
        statusEl.textContent = "Loaded " + scores.length + " outcomes.";

        // render cards
        cardsEl.innerHTML = "";
        scores.forEach(function (s) {
            var outcome = outcomesById.get(String(s.links && s.links.outcome));
            if (!outcome) return;

            var mastered = (typeof s.score === "number") && (s.score >= outcome.mastery_points);

            var card = document.createElement("div");
            card.style.border = "1px solid #ddd";
            card.style.borderRadius = "8px";
            card.style.padding = "10px";
            card.style.margin = "8px 0";

            card.innerHTML =
                '<div style="font-weight:600;">' + escapeHtml(outcome.title) + '</div>' +
                '<div>Score: <b>' + escapeHtml(String(s.score)) + '</b> / Mastery: ' + escapeHtml(String(outcome.mastery_points)) + '</div>' +
                '<div style="font-weight:600; color:' + (mastered ? "#2e7d32" : "#c62828") + ';">' +
                (mastered ? "Mastered" : "Not Yet Mastered") +
                '</div>' +
                '<div style="font-size:12px; color:#666;">Last Evidence: ' + escapeHtml(String(s.title || "")) + '</div>';

            cardsEl.appendChild(card);
        });

        debugLog('Rendering complete');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c];
        });
    }

    // Run after DOM is ready
    debugLog('Script loaded, waiting for DOM...');
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            debugLog('DOM ready, starting run()');
            run().catch(function(err) {
                console.error('[CG Mobile] Error:', err);
                debugLog('ERROR: ' + err.message);
            });
        });
    } else {
        debugLog('DOM already ready, starting run()');
        run().catch(function(err) {
            console.error('[CG Mobile] Error:', err);
            debugLog('ERROR: ' + err.message);
        });
    }
})();