import { logger } from '../utils/logger.js';
// src/parentMastery/parentMasteryInit.js
export async function parentMasteryInit() {
    // Only run on: /courses/:id/pages/parent-mastery
    const root = document.getElementById("parent-mastery-root");
    if (!root) return;

    const m = location.pathname.match(/^\/courses\/(\d+)\//);
    if (!m) return;

    const courseId = Number(m[1]);

    root.innerHTML = `
    <div style="border:1px solid #ddd; border-radius:10px; padding:12px; margin:12px 0;">
      <div style="font-weight:700; margin-bottom:8px;">Mastery (Observer)</div>
      <div id="pm-status">Loading…</div>
      <pre id="pm-out" style="white-space:pre-wrap; margin:8px 0 0;"></pre>
    </div>
  `;

    const statusEl = document.getElementById("pm-status");
    const outEl = document.getElementById("pm-out");

    try {
        const enrRes = await fetch(`/api/v1/users/self/enrollments?per_page=100`, { credentials: "include" });
        const enrollments = await enrRes.json();

        const obs = enrollments.find(e =>
            e.type === "ObserverEnrollment" &&
            String(e.course_id) === String(courseId) &&
            e.enrollment_state === "active" &&
            e.associated_user_id
        );

        if (!obs) {
            statusEl.textContent = "No observed student found for this course (not an observer here).";
            return;
        }

        const studentId = obs.associated_user_id;

        const url =
            `/api/v1/courses/${courseId}/outcome_rollups?user_ids[]=${studentId}` +
            `&include[]=outcomes&include[]=outcome_groups&per_page=100`;

        const r = await fetch(url, { credentials: "include" });
        const data = await r.json();

        const rollup = data.rollups?.[0];
        if (!rollup) {
            statusEl.textContent = "No mastery data found.";
            return;
        }

        const outcomesById = new Map(
            (data.linked?.outcomes || []).map(o => [String(o.id), o])
        );

        const scores = rollup.scores || [];

        statusEl.textContent = `Loaded ${scores.length} outcomes.`;
        outEl.innerHTML = "";

        scores.forEach(s => {
            const outcome = outcomesById.get(String(s.links?.outcome));
            if (!outcome) return;

            const mastered = s.score >= outcome.mastery_points;

            const card = document.createElement("div");
            card.style.border = "1px solid #ddd";
            card.style.borderRadius = "8px";
            card.style.padding = "10px";
            card.style.margin = "8px 0";

            card.innerHTML = `
    <div style="font-weight:600;">${outcome.title}</div>
    <div>Score: <b>${s.score}</b> / Mastery: ${outcome.mastery_points}</div>
    <div style="color:${mastered ? "#2e7d32" : "#c62828"}; font-weight:600;">
      ${mastered ? "Mastered" : "Not Yet Mastered"}
    </div>
    <div style="font-size:12px; color:#666;">
      Last Evidence: ${s.title}
    </div>
  `;

            outEl.appendChild(card);
        });
    } catch (err) {
        statusEl.textContent = "Error";
        outEl.textContent = String(err);
    }
}