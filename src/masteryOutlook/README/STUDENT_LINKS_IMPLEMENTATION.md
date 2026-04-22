# Clickable Student Links - Implementation Summary

**Created:** 2026-04-08

## Overview

All student names across the Mastery Outlook interface are now clickable links that navigate directly to that student's individual Mastery Dashboard, bypassing the student picker.

---

## URL Parameter Support

### New URL Parameter: `student_id`

**Format:**
```
/courses/{courseId}/pages/mastery-dashboard?cg_web=1&student_id={userId}
```

**Example:**
```
/courses/566/pages/mastery-dashboard?cg_web=1&student_id=642
```

**Behavior:**
- When a teacher accesses the Mastery Dashboard page with `student_id` parameter
- The student picker is bypassed
- The specified student's data loads immediately
- Works for Teachers, TAs, and Designers

---

## Files Modified

### 1. `src/masteryDashboard/masteryDashboardViewer.js`

**Change:** Added URL parameter detection for teachers

**Before:**
```javascript
if (isTeacher) {
    debugLog(`User role: Teacher. Rendering student picker.`);
    renderTeacherMasteryView({ ... });
    return;
}
```

**After:**
```javascript
if (isTeacher) {
    // Check for student_id URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedStudentId = urlParams.get('student_id');
    
    if (preselectedStudentId) {
        // Auto-load student data (skip picker)
        debugLog(`User role: Teacher (auto-loading student ${preselectedStudentId})`);
        await renderStudentData(preselectedStudentId, courseId, apiClient, statusEl, cardsEl);
        return;
    }
    
    // Show picker if no student_id
    renderTeacherMasteryView({ ... });
    return;
}
```

**Lines changed:** +13

---

### 2. `src/masteryOutlook/masteryOutlookHeatmap.js`

**Change:** Made name cells clickable links

**Before:**
```javascript
nameCell.textContent = formatStudentName(student);
nameCell.title = student.name || student.sortableName;
```

**After:**
```javascript
const link = document.createElement('a');
link.href = `/courses/${cache.meta.courseId}/pages/mastery-dashboard?cg_web=1&student_id=${student.id}`;
link.textContent = formatStudentName(student);
link.title = `View ${student.name}'s individual mastery dashboard`;
link.style.cssText = 'color:#333; text-decoration:none; font-weight:500;';
link.addEventListener('mouseenter', () => {
    link.style.textDecoration = 'underline';
    link.style.color = '#0374B5';
});
link.addEventListener('mouseleave', () => {
    link.style.textDecoration = 'none';
    link.style.color = '#333';
});
nameCell.appendChild(link);
```

**Lines changed:** +14

---

### 3. `src/masteryOutlook/masteryOutlookHeatmapFullScreen.js`

**Change:** Made name cells clickable links (opens in new tab)

**Before:**
```javascript
nameCell.textContent = formatStudentName(student);
nameCell.title = student.name || student.sortableName;
```

**After:**
```javascript
const link = document.createElement('a');
link.href = '/courses/' + cache.meta.courseId + '/pages/mastery-dashboard?cg_web=1&student_id=' + student.id;
link.textContent = formatStudentName(student);
link.title = "View " + (student.name || student.sortableName) + "'s individual mastery dashboard";
link.style.cssText = 'color:#333; text-decoration:none; font-weight:500;';
link.target = '_blank';  // Open in new tab
link.onmouseenter = function() { ... };
link.onmouseleave = function() { ... };
nameCell.appendChild(link);
```

**Lines changed:** +16

---

### 4. `src/masteryOutlook/masteryOutlookView.js`

**Change 1:** Added student ID to studentRow object

**Before:**
```javascript
const studentRow = {
    name: student.name || student.sortableName,
    sortableName: student.sortableName,
    ...outcomeData
};
```

**After:**
```javascript
const studentRow = {
    id: student.id,  // Add student ID for linking
    name: student.name || student.sortableName,
    sortableName: student.sortableName,
    ...outcomeData
};
```

**Change 2:** Made name cell clickable in outcome detail table

**Before:**
```html
<td style="font-size:13px; padding:6px 8px;">${escapeHtml(s.name)}</td>
```

**After:**
```html
<td style="font-size:13px; padding:6px 8px;">
    <a href="/courses/${cache.meta.courseId}/pages/mastery-dashboard?cg_web=1&student_id=${s.id}"
       style="color:#333; text-decoration:none;"
       onmouseenter="this.style.textDecoration='underline'; this.style.color='#0374B5';"
       onmouseleave="this.style.textDecoration='none'; this.style.color='#333';"
       title="View ${escapeHtml(s.name)}'s individual mastery dashboard">
        ${escapeHtml(s.name)}
    </a>
</td>
```

**Lines changed:** +10

---

## Total Changes

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `masteryDashboardViewer.js` | +13 | URL parameter support |
| `masteryOutlookHeatmap.js` | +14 | Heatmap links (in-dashboard) |
| `masteryOutlookHeatmapFullScreen.js` | +16 | Heatmap links (full-screen) |
| `masteryOutlookView.js` | +11 | Outcome table links |
| **TOTAL** | **~54 lines** | **4 files** |

---

## User Experience

### Before Implementation:
1. Teacher views heatmap
2. Sees "Smith J." struggling on Outcome 3
3. Navigates to Mastery Dashboard page manually
4. Selects "Smith, Jane" from student picker
5. Views individual dashboard

**Total: 5 steps**

### After Implementation:
1. Teacher views heatmap
2. Clicks "Smith J." name
3. Individual dashboard loads immediately

**Total: 2 steps (60% reduction)**

---

## Testing Checklist

### URL Parameter Support:
- [ ] `/pages/mastery-dashboard?cg_web=1&student_id=642` loads student data
- [ ] No student picker shown when student_id present
- [ ] Works for Teachers, TAs, Designers
- [ ] Invalid student_id shows error gracefully

### Heatmap (In-Dashboard):
- [ ] Student names appear as blue-on-hover links
- [ ] Click navigates to correct student dashboard
- [ ] Tooltip shows "View [Name]'s individual mastery dashboard"
- [ ] Works for all students (including NE status)

### Heatmap (Full-Screen):
- [ ] Student names appear as links
- [ ] Click opens in new tab (target="_blank")
- [ ] Correct URL with student_id parameter

### Outcomes Tab:
- [ ] Student names in all 4 tabs are links (All, Struggling, Declining, Growing)
- [ ] Works for all outcomes
- [ ] Click navigates to correct student dashboard
- [ ] Tooltip appears on hover

---

## Notes

- **No API calls added:** All data already available in cache
- **Consistent styling:** All links use same hover behavior (underline + blue)
- **Accessible:** Links have descriptive titles for screen readers
- **Full-screen behavior:** Opens in new tab to preserve full-screen window
