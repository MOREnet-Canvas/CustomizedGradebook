// src/parentMastery/parentMasteryInit.js
export async function parentMasteryInit() {
    // Only run on: /courses/:id/pages/parent-mastery
    const m = location.pathname.match(/^\/courses\/(\d+)\/pages\/parent-mastery\/?$/);
    if (!m) return;

    const courseId = Number(m[1]);
    const root = document.getElementById("parent-mastery-root");
    if (!root) return;

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

        const scores = data.rollups?.[0]?.scores || [];
        statusEl.textContent = `Loaded ${scores.length} scores for student ${studentId}.`;
        outEl.textContent = JSON.stringify(scores.slice(0, 10), null, 2);
    } catch (err) {
        statusEl.textContent = "Error";
        outEl.textContent = String(err);
    }
}