// src/student/allGradesStyles.js
/**
 * All-Grades Page — injected CSS
 *
 * Static styles for the custom grades table built by allGradesPageCustomizer.js.
 * Injected once via injectStyles(ALL_GRADES_CSS, 'cg-all-grades-styles').
 *
 * Dynamic values remain inline in allGradesPageCustomizer.js:
 *   - gradeCell.style.color (data-driven: SBG green, traditional dark, N/A gray)
 *   - originalTable.style.display = 'none' (hide-on-replace toggle)
 */

export const ALL_GRADES_CSS = `

/* Custom grades table layout */
.customized-grades-table {
    width: 100%;
    margin-top: 1rem;
}

/* Table header cells */
.customized-grades-table .ic-Table-header--course {
    text-align: left;
    padding: 0.75rem;
}
.customized-grades-table .ic-Table-header--grade {
    text-align: right;
    padding: 0.75rem;
}

/* Body cells */
.customized-grades-table .ic-Table-cell {
    padding: 0.75rem;
}
.customized-grades-table .ic-Table-cell--grade {
    text-align: right;
    padding: 0.75rem;
    font-weight: bold;
}

/* Course link */
.cg-grades-course-link {
    color: #0374B5;
    text-decoration: none;
}
.cg-grades-course-link:hover {
    text-decoration: underline;
}
`;
