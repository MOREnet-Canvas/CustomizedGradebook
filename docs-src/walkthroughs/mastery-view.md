# Mastery View (Mastery Dashboard)

**URL:** `/courses/:id/pages/mastery-dashboard?cg_web=1`
**Audience:** Teachers, parents/observers, students
**Entry point:** `src/masteryDashboard/masteryDashboardInit.js`

---

## Purpose

The Mastery View displays outcome mastery progress for students. It serves three audiences:

- **Teachers** — see a full roster and can select any student
- **Parents/observers** — see their observed student's outcomes automatically
- **Students** — TBD (extension primarily targets teacher and observer roles)

---

## First-time setup (teacher)

1. Navigate to **Course Settings** (`/courses/:id/settings`)
2. Click **"🎯 Create Mastery Dashboard Button"** in the right sidebar
3. The module (`masteryDashboardCreation/buttonInjection.js`) creates:
   - A wiki page at `/courses/:id/pages/mastery-dashboard` containing `<div id="parent-mastery-root">`
   - A navigation button on the course front page linking to the dashboard
4. Share the dashboard URL (with `?cg_web=1`) with parents and observers

The setup is **idempotent** — clicking the button again will not create duplicate pages or buttons.

---

## Accessing the Mastery View

The viewer only activates when `?cg_web=1` is present in the URL:

```
https://your-canvas/courses/123/pages/mastery-dashboard?cg_web=1
```

Without the query parameter, the page is treated as a plain Canvas wiki page and the extension does nothing. This design prevents the viewer from running on unrelated wiki pages.

---

## Teacher workflow

1. Open the Mastery View URL
2. The **Student Picker** (`studentPickerView.js`) shows a roster of enrolled students
3. Select a student to view their outcome mastery breakdown
4. Each outcome row shows the student's current Canvas mastery level
5. The **Average Comment Panel** (`avgCommentPanel.js`) allows posting a comment on the Current Score assignment

---

## Observer (parent) workflow

1. Open the Mastery View URL (shared by teacher)
2. The extension detects the observer enrollment and reads `ENV.OBSERVER_OPTIONS.OBSERVED_USERS_LIST` (stored in `sessionStorage` at init time)
3. The observer view (`observerMasteryView.js`) automatically loads the observed student's outcomes — no student picker needed
4. If an observer has multiple observed students, they can switch between them

---

## Mobile / Canvas Parent app

`mobileInit.js` provides a mobile-optimized view for the Canvas Parent app. The Parent app renders wiki page content in a WebView; `mobileInit.js` detects the mobile context and adjusts the layout accordingly.

---

## Module map

| Concern | Module |
|---------|--------|
| Page creation button (settings) | `masteryDashboardCreation/buttonInjection.js` |
| Viewer initialization | `masteryDashboard/masteryDashboardInit.js` |
| Teacher roster view | `masteryDashboard/teacherMasteryView.js` |
| Student picker | `masteryDashboard/studentPickerView.js` |
| Observer view | `masteryDashboard/observerMasteryView.js` |
| Mobile / Parent app | `masteryDashboard/mobileInit.js` |
| Average comment panel | `masteryDashboard/avgCommentPanel.js` |

---

## How pages are detected

| File | Detection |
|------|-----------|
| `masteryDashboardCreationInit.js` | `isCourseSettingsPage()` |
| `masteryDashboardInit.js` | `URLSearchParams.get('cg_web') === '1'` AND `/courses/:id/pages/` in pathname |

Both checks must pass for the viewer to initialize. This prevents the viewer from activating on non-wiki pages or wiki pages that happen to contain `?cg_web=1`.
