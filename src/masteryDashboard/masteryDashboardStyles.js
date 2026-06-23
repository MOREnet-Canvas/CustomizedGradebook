// src/masteryDashboard/masteryDashboardStyles.js
/**
 * Mastery Dashboard Viewer — injected CSS
 *
 * Static styles for the DOM built by masteryDashboardViewer.js.
 * Injected once via injectStyles(MASTERY_DASHBOARD_CSS, 'pm-dashboard-styles').
 *
 * Font family + smoothing are set on .pm-card so descendants inherit them
 * (every text node previously repeated the same LatoWeb stack inline).
 *
 * Dynamic values remain inline in masteryDashboardViewer.js:
 *   - #pm-stat-score color (avgScoreColor)
 *   - .pm-outcome-card border-left color (per-outcome mastery accent)
 *   - .pm-outcome-score color (per-outcome readable font color)
 *   - .pm-outcome-grade-bullet / .pm-assign-bullet color (mastery accent)
 *   - show/hide toggles (display) and .expand-arrow rotation
 */

export const MASTERY_DASHBOARD_CSS = `

/* Card shell — font + smoothing inherit to all descendants */
.pm-card {
  font-family: LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;
  -webkit-font-smoothing: antialiased;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 16px;
  margin: 12px 0;
}

/* Header block */
.pm-header-block { margin-bottom: 12px; }
#pm-student-name { font-size: 1.1rem; font-weight: 700; color: #333; margin-bottom: 2px; line-height: 1.4; }
#pm-subtitle     { font-size: 0.8rem; color: #666; line-height: 1.4; }

/* Stat boxes */
.pm-stats-row     { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.pm-stat-box      { flex: 1; min-width: 130px; background: #f5f6f7; border-radius: 8px; padding: 10px 12px; }
.pm-stat-box-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.pm-stat-caption  { font-size: 0.72rem; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.pm-stat-caption--mastered { margin-bottom: 4px; }
/* color set inline (dynamic avgScoreColor) */
#pm-stat-score          { font-size: 2.2rem; font-weight: 700; line-height: 1; margin-bottom: 4px; }
#pm-stat-score-label    { font-size: 0.78rem; color: #555; }
#pm-stat-mastered       { font-size: 2.2rem; font-weight: 700; line-height: 1; margin-bottom: 4px; color: #333; }
#pm-stat-mastered-label { font-size: 0.78rem; color: #555; }
.pm-mastered-count { font-size: 2.2rem; font-weight: 700; }
.pm-mastered-total { font-size: 1rem; font-weight: 400; color: #555; }

/* Missing assignments banner (hidden until populated; JS sets display:block) */
#pm-missing-banner { display: none; background: #FFF8E1; border: 1px solid #FAB901; border-left: 4px solid #FAB901; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }
.pm-banner-title   { font-size: 0.75rem; font-weight: 600; color: #795500; margin-bottom: 6px; }
.pm-banner-row     { padding: 5px 0; border-bottom: 1px solid rgba(250,185,1,0.3); }
.pm-banner-link    { font-size: 0.85rem; color: #C62828; text-decoration: underline; font-weight: 600; line-height: 1.5; }
.pm-banner-affects { font-size: 0.75rem; color: #555; margin-top: 2px; line-height: 1.4; }

/* Outcome cards */
.pm-outcome-heading { font-size: 0.9rem; font-weight: 600; color: #666; margin-bottom: 8px; margin-top: 8px; line-height: 1.5; }
/* border-left color set inline (dynamic mastery accent) */
.pm-outcome-card     { border: 1px solid #ddd; border-left: 4px solid #ddd; border-radius: 8px; padding: 10px; margin: 8px 0; background: #fff; cursor: pointer; }
.pm-outcome-card:focus { outline: 2px solid rgb(147, 154, 160); outline-offset: 2px; }
.pm-outcome-card-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
.expand-arrow        { font-size: 0.8rem; transition: transform 0.2s; margin-top: 2px; }
.pm-outcome-main     { flex: 1; }
.pm-outcome-name     { font-weight: 600; font-size: 1rem; color: #333; line-height: 1.5; }
.pm-outcome-right    { text-align: right; }
/* color set inline (dynamic readable font color) */
.pm-outcome-score    { font-size: 1.5rem; font-weight: 700; line-height: 1.5; }
.pm-outcome-grade    { font-size: 0.9rem; font-weight: 600; color: #333; margin-top: 4px; line-height: 1.5; }
/* color set inline (dynamic mastery accent) */
.pm-outcome-grade-bullet { font-size: 1.4em; line-height: 1; }
.pm-outcome-date     { font-size: 0.875rem; color: #555; margin-top: 4px; line-height: 1.5; }

/* Assignment details (lazy-loaded; initial display:none stays inline so the
   toggle's 'details.style.display === none' check keeps working) */
.assignment-details { margin-top: 12px; padding-top: 12px; border-top: 1px solid #c8c8c8; margin-left: 20px; }
.pm-details-title   { font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; color: #333; line-height: 1.5; }
.pm-assign-row      { padding: 8px 0; border-bottom: 1px solid #c8c8c8; }
.pm-assign-name     { font-weight: 400; font-size: 1rem; line-height: 1.5; }
.pm-assign-link     { color: #0374B5; text-decoration: none; }
.pm-assign-meta     { font-size: 0.875rem; color: #333; margin-top: 2px; line-height: 1.5; }
/* color set inline (dynamic mastery accent) */
.pm-assign-bullet   { font-size: 1.1em; line-height: 1; }

/* Submission status indicator (late / excused / missing) */
.pm-status              { display: inline-block; margin-left: 6px; white-space: nowrap; }
.pm-status-svg          { vertical-align: middle; margin-right: 4px; }
.pm-status-label        { color: #333; font-weight: 600; font-size: 1rem; line-height: 1.5; }
.pm-status-label--missing { font-weight: 700; }

/* Empty / error notes inside details */
.pm-empty-note { font-size: 0.9rem; color: #555; line-height: 1.5; }
.pm-error-note { font-size: 0.9rem; color: #c62828; line-height: 1.5; }
`;
