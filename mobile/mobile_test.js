(function () {
    function ensureHost() {
        var root = document.getElementById("parent-mastery-root");
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

        // courseId from URL
        var m = location.pathname.match(/^\/courses\/(\d+)\//);
        if (!m) {
            statusEl.textContent = "Could not detect course.";
            return;
        }
        var courseId = Number(m[1]);

        // find observed student for this course
        var enrollments = await apiJson("/api/v1/users/self/enrollments?per_page=100");
        var obs = enrollments.find(function (e) {
            return e.type === "ObserverEnrollment" &&
                String(e.course_id) === String(courseId) &&
                e.enrollment_state === "active" &&
                e.associated_user_id;
        });

        if (!obs) {
            statusEl.textContent = "No observed student found for this course.";
            return;
        }

        var studentId = obs.associated_user_id;

        var data = await apiJson(
            "/api/v1/courses/" + courseId +
            "/outcome_rollups?user_ids[]=" + studentId +
            "&include[]=outcomes&include[]=outcome_groups&per_page=100"
        );

        var rollup = data.rollups && data.rollups[0];
        if (!rollup) {
            statusEl.textContent = "No mastery data found.";
            return;
        }

        var outcomes = (data.linked && data.linked.outcomes) ? data.linked.outcomes : [];
        var outcomesById = new Map(outcomes.map(function (o) { return [String(o.id), o]; }));

        var scores = rollup.scores || [];
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
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c];
        });
    }

    // Run after DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { run().catch(console.error); });
    } else {
        run().catch(console.error);
    }
})();