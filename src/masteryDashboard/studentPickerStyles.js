// src/masteryDashboard/studentPickerStyles.js
/**
 * Student Picker — injected CSS
 *
 * Static styles for the UI built by studentPickerView.js: the picker shell,
 * the section/search inputs, the persistent "Viewing:" header, and the
 * body-level results dropdown. Injected once via
 * injectStyles(STUDENT_PICKER_CSS, 'pm-student-picker-styles').
 *
 * font-family is repeated on the three roots (.pm-picker, #pm-teacher-header,
 * #pm-student-dropdown) because the dropdown is appended to document.body and
 * cannot inherit the LatoWeb stack from the dashboard card.
 *
 * Dynamic values remain inline in studentPickerView.js:
 *   - #pm-student-dropdown top/left/width (positionDropdown) + display toggle
 *   - #pm-teacher-header display toggle (none / flex), also read by the viewer
 *   - keyboard-highlight background on the active option (highlightItem)
 */

const FONT = `font-family: LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;`;

export const STUDENT_PICKER_CSS = `

/* Picker shell */
.pm-picker       { ${FONT} padding: 4px 0 12px; }
.pm-picker-title { font-size: 1rem; font-weight: 700; color: #333; margin-bottom: 12px; }
.pm-section-row  { margin-bottom: 10px; }
.pm-picker-label { font-size: 0.85rem; color: #555; display: block; margin-bottom: 4px; }
.pm-picker-select,
.pm-picker-input { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.95rem; color: #333; }
.pm-picker-select { background: #fff; }
.pm-picker-input  { box-sizing: border-box; }

/* Persistent "Viewing:" header (display toggled inline: none / flex) */
#pm-teacher-header { ${FONT} justify-content: space-between; align-items: center; padding: 8px 4px 12px; border-bottom: 1px solid #e0e0e0; margin-bottom: 10px; }
.pm-header-label   { font-size: 0.9rem; color: #555; }
.pm-header-name    { font-size: 1rem; font-weight: 700; color: #333; margin-left: 6px; }
.pm-change-student-btn { font-size: 0.85rem; color: #0374B5; background: none; border: none; cursor: pointer; padding: 4px 12px; margin-left: 12px; text-decoration: underline; }

/* Body-level results dropdown (position/size/display set inline) */
#pm-student-dropdown { ${FONT} display: none; position: absolute; background: #fff; border: 1px solid #ccc; border-top: none; border-radius: 0 0 6px 6px; max-height: 320px; overflow-y: auto; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); box-sizing: border-box; }
.pm-dropdown-empty   { padding: 10px 12px; font-size: 0.9rem; color: #888; }
.pm-dropdown-item    { padding: 8px 12px; cursor: pointer; font-size: 0.95rem; color: #333; border-bottom: 1px solid #f0f0f0; line-height: 1.4; }
.pm-dropdown-item:hover { background: #f5f5f5; }
.pm-dropdown-section { color: #888; font-size: 0.8rem; margin-left: 6px; }
`;
