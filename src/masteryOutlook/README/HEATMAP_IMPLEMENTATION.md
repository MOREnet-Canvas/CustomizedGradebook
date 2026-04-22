# Mastery Outlook Heatmap Feature

## Implementation Summary

**Created:** 2026-04-08

### Overview

The heatmap feature visualizes student proficiency across all outcomes in a grid format:
- **Rows:** Students (formatted as "Smith J.")
- **Columns:** Outcomes (excluding Current Score and excluded outcomes)
- **Cells:** Color-coded by PL prediction level

### Files Created

1. **`masteryOutlookHeatmap.js`** (14,138 bytes)
   - Main grid builder
   - Handles sort state, details toggle
   - Returns DOM element (no appendChild)
   - Used by both in-dashboard and full-screen views

2. **`masteryOutlookHeatmapFullScreen.js`** (16,860 bytes)
   - Full-screen window generator
   - Uses `document.write()` for self-contained HTML
   - All CSS, JS, and data embedded inline
   - No external dependencies

### Files Modified

3. **`masteryOutlookView.js`** (45,964 bytes)
   - Added tab bar: "Outcomes" | "🔥 Heatmap"
   - Added view switching logic
   - Hides sidebar when heatmap active
   - Imports heatmap modules

### Features

#### In-Dashboard Heatmap

- **Location:** New "🔥 Heatmap" tab in Mastery Outlook page
- **Cell size:** 80px × 28px
- **Layout:** Full content width (sidebar hidden)
- **Controls:**
  - "Show details" toggle (color-only vs. PL values)
  - "Open full screen ↗" link (top right)
- **Sorting:** Click column headers to sort
  - Name column: A→Z / Z→A
  - Outcome columns: PL prediction ascending/descending
  - NE students always sort to bottom

#### Full-Screen Heatmap

- **Opens in:** New browser window
- **Cell size:** 90px × 32px
- **Header includes:**
  - Course name + "Mastery Outlook: Class Heatmap"
  - Last updated timestamp
  - Threshold value (read-only)
  - "Show details" toggle
  - Color legend (5 proficiency levels)
- **Independent sort state:** Separate from in-dashboard view
- **Self-contained:** Works offline after initial load

### Color Scheme

```javascript
PL >= 3.5 → #C0DD97 (Advanced)    text: #27500A
PL >= 3.0 → #9FE1CB (Proficient)  text: #085041
PL >= 2.0 → #FAC775 (Developing)  text: #633806
PL <  2.0 → #F7C1C1 (Beginning)   text: #791F1F
NE        → #f0f0f0 (gray)        text: #999
```

### Data Flow

1. **No new API calls:** Reads from existing `cache.outcomes` and `cache.students`
2. **Outcome filtering:** Excludes `AVG_OUTCOME_NAME` and `EXCLUDED_OUTCOME_KEYWORDS`
3. **Student names:** Uses `student.sortableName` from cache
4. **Sort order:** Canvas `displayOrder` for outcomes, alphabetical for students

### UI Behavior

#### Details Toggle

- **OFF (default):** Cells show color only, no text
- **ON:** Cells show PL prediction value (e.g. "3.42") or "NE"
- **Tooltip (always on):** Full student name + outcome title + PL value or "NE — fewer than 3 attempts"

#### Column Sorting

- **Active column:** Darker text, blue underline, sort indicator (▲/▼)
- **Click name column:** Toggles A→Z / Z→A
- **Click outcome column:** Starts ascending, toggles to descending
- **Clicking different column:** Resets previous column indicator
- **NE handling:** Always sorts to bottom regardless of direction

### No Data State

When heatmap tab is active but no cache exists:

```
🔥

No heatmap data yet

Hit Refresh Data to calculate Power Law
predictions and generate the class heatmap.
```

### Integration with Existing Code

- **Uses existing:** `FONT`, `escapeHtml()`, `logger`, config constants
- **Respects:** Same threshold from slider
- **Filters:** Same outcome exclusion logic as main view
- **Consistent:** Same color scheme as proficiency badges

### Technical Details

#### Rotated Headers (45°)

```css
transform: translateX(-50%) rotate(-45deg);
transform-origin: left bottom;
max-width: 120px;
text-overflow: ellipsis;
```

#### Sticky Name Column

```css
position: sticky;
left: 0;
z-index: 1; /* tbody cells */
z-index: 2; /* thead cells */
```

#### Student Name Format

```javascript
"Smith, Jane" → "Smith J."
```

#### Sort State (Local to Each Instance)

```javascript
let sortState = {
    column: 'name',     // 'name' or outcome id (string)
    direction: 'asc'    // 'asc' or 'desc'
};
```

### Testing Checklist

- [ ] Tab switches between Outcomes and Heatmap
- [ ] Sidebar hides when heatmap active
- [ ] Grid displays all students and outcomes
- [ ] Student names formatted correctly
- [ ] Cells colored correctly by PL level
- [ ] Details toggle shows/hides PL values
- [ ] Tooltips show full information
- [ ] Name column sorts A→Z and Z→A
- [ ] Outcome columns sort ascending/descending
- [ ] NE students always at bottom
- [ ] Sort indicators (▲/▼) display correctly
- [ ] Active column highlighted
- [ ] Full screen link opens new window
- [ ] Full screen has all controls
- [ ] Full screen sorts independently
- [ ] Full screen legend displays
- [ ] No data message shows when appropriate
- [ ] No excluded outcomes displayed
- [ ] Outcome headers rotated 45°

### Known Limitations

None identified. Feature is complete as specified.
