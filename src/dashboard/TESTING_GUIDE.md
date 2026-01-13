# Dashboard Grade Badge - Testing Guide

## Quick Visual Test

After deploying the updated code, navigate to your Canvas dashboard and verify the following:

### ✅ Expected Appearance

**Grade badges should:**
1. Appear as **small, rounded pills** next to course metadata (term name, subtitle)
2. Use your institution's **Canvas brand color** (typically blue)
3. Have **white text** on colored background
4. Be **inline** with other header text (not on a separate line)
5. Look similar to Canvas's native notification badges

**Example:**
```
Course Name
Fall 2024 [3.5]
```

NOT like this:
```
Course Name
Fall 2024

┌─────────────┐
│    3.5      │
│CURRENT SCORE│
└─────────────┘
```

---

## Detailed Testing Steps

### 1. Build and Deploy

```bash
# Build the updated code
npm run build

# Upload dist/main.js to Canvas
# (Follow your institution's deployment process)
```

### 2. Navigate to Dashboard

```
https://your-canvas.edu/?debug=true
```

The `?debug=true` parameter enables detailed logging.

### 3. Open Browser Console (F12)

Look for initialization messages:
```
[INFO] Initializing dashboard grade display
[INFO] Dashboard cards found: X
[INFO] Found X active student courses
[DEBUG] Grade badge rendered (value: 3.5, source: assignment)
[DEBUG] Badge placed in: ic-DashboardCard__header-subtitle
```

### 4. Visual Inspection

For each course card on your dashboard:

**Check badge appearance:**
- [ ] Badge is small and compact (not large and prominent)
- [ ] Badge has rounded corners (pill shape)
- [ ] Badge uses Canvas brand color
- [ ] Badge text is white and readable
- [ ] Badge shows correct grade value

**Check badge position:**
- [ ] Badge is in the header area (top portion of card)
- [ ] Badge is inline with term/subtitle text
- [ ] Badge doesn't overlap course title
- [ ] Badge doesn't overlap settings button
- [ ] Badge has appropriate spacing from adjacent text

**Check grade values:**
- [ ] Courses with AVG assignment show 0-4 scale (e.g., "3.5")
- [ ] Courses without AVG show percentage (e.g., "87.5%")
- [ ] Values are accurate (compare with gradebook)

---

## Browser Console Tests

### Test 1: Count Badges

```javascript
const badges = document.querySelectorAll('.cg-dashboard-grade');
console.log(`Found ${badges.length} grade badges`);
```

**Expected:** Number should match your active courses with grades.

### Test 2: Inspect Badge Styling

```javascript
const badge = document.querySelector('.cg-dashboard-grade');
console.log('Badge element:', badge);
console.log('Badge text:', badge.textContent);
console.log('Badge classes:', badge.className);
console.log('Badge styles:', badge.style.cssText);
```

**Expected output:**
```
Badge element: <span class="cg-dashboard-grade ic-badge">...</span>
Badge text: 3.5
Badge classes: cg-dashboard-grade ic-badge
Badge styles: font-size: 0.6875rem; min-width: 20px; ...
```

### Test 3: Check Badge Placement

```javascript
const badges = document.querySelectorAll('.cg-dashboard-grade');
badges.forEach((badge, index) => {
    console.log(`Badge ${index + 1}:`);
    console.log('  Text:', badge.textContent);
    console.log('  Parent:', badge.parentElement.className);
    console.log('  ARIA label:', badge.getAttribute('aria-label'));
});
```

**Expected:** Parent should be one of:
- `ic-DashboardCard__header-subtitle`
- `ic-DashboardCard__header-term`
- `cg-dashboard-grade-container`
- Other header-related class

### Test 4: Accessibility Check

```javascript
const badge = document.querySelector('.cg-dashboard-grade');
console.log('Role:', badge.getAttribute('role'));
console.log('ARIA label:', badge.getAttribute('aria-label'));
```

**Expected:**
```
Role: status
ARIA label: Current score: 3.5 out of 4
```
or
```
Role: status
ARIA label: Grade: 87.5%
```

---

## Common Issues and Solutions

### Issue 1: Badges Not Appearing

**Symptoms:** No badges visible on dashboard cards

**Diagnosis:**
```javascript
window.CG.diagnosticDashboard()
```

**Check:**
1. Are dashboard cards detected?
2. Are courses fetched?
3. Are grades available?

**See:** `DEBUGGING.md` for detailed troubleshooting

---

### Issue 2: Badges in Wrong Position

**Symptoms:** Badges appear below card content or in unexpected location

**Diagnosis:**
```javascript
const badges = document.querySelectorAll('.cg-dashboard-grade');
badges.forEach(badge => {
    console.log('Parent:', badge.parentElement);
    console.log('Parent class:', badge.parentElement.className);
});
```

**Possible causes:**
1. Canvas card structure is different than expected
2. Header elements not found
3. Fallback to card element itself

**Solution:**
- Check console for positioning strategy messages
- Inspect card DOM structure in DevTools
- May need to add new selectors to `findGradeContainer()`

---

### Issue 3: Badges Too Large/Small

**Symptoms:** Badge size doesn't match Canvas design

**Diagnosis:**
```javascript
const badge = document.querySelector('.cg-dashboard-grade');
const styles = window.getComputedStyle(badge);
console.log('Font size:', styles.fontSize);
console.log('Line height:', styles.lineHeight);
console.log('Padding:', styles.padding);
```

**Expected:**
- Font size: ~11px (0.6875rem)
- Line height: 20px
- Padding: 0 8px

**Solution:**
- Check if Canvas theme overrides styles
- Verify inline styles are applied
- May need to add `!important` to critical styles

---

### Issue 4: Wrong Color

**Symptoms:** Badge color doesn't match Canvas brand

**Diagnosis:**
```javascript
const badge = document.querySelector('.cg-dashboard-grade');
const styles = window.getComputedStyle(badge);
console.log('Background:', styles.backgroundColor);

// Check Canvas brand color
const rootStyles = getComputedStyle(document.documentElement);
console.log('Canvas brand primary:', rootStyles.getPropertyValue('--ic-brand-primary'));
```

**Solution:**
- Badge should use `var(--ic-brand-primary)`
- Fallback to `#0374B5` if variable not set
- Check if theme defines the CSS variable

---

## Accessibility Testing

### Screen Reader Test

1. **Enable screen reader** (NVDA, JAWS, VoiceOver, etc.)
2. **Navigate to dashboard**
3. **Tab through course cards**
4. **Listen for grade announcements**

**Expected:** Screen reader should announce:
- "Current score: 3.5 out of 4" (for assignment grades)
- "Grade: 87.5%" (for enrollment grades)

### Keyboard Navigation

1. **Tab through dashboard**
2. **Verify focus indicators**
3. **Check badge doesn't interfere with keyboard navigation**

---

## Cross-Browser Testing

Test in multiple browsers:

- [ ] **Chrome** - Latest version
- [ ] **Firefox** - Latest version
- [ ] **Safari** - Latest version (Mac)
- [ ] **Edge** - Latest version

**Check:**
- Badge appearance consistent
- Positioning consistent
- Colors render correctly
- No layout issues

---

## Mobile/Responsive Testing

Test on different screen sizes:

- [ ] **Desktop** - Full width
- [ ] **Tablet** - Medium width
- [ ] **Mobile** - Small width

**Check:**
- Badges don't overflow card
- Badges remain readable
- Positioning adapts appropriately

---

## Performance Testing

### Check for Performance Issues

```javascript
// Monitor badge rendering time
console.time('badge-render');
// Trigger grade update
console.timeEnd('badge-render');
```

**Expected:** Should complete in < 100ms per course

### Check for Memory Leaks

1. Navigate to dashboard
2. Navigate away
3. Return to dashboard
4. Repeat several times
5. Check browser memory usage

**Expected:** Memory should not continuously increase

---

## Regression Testing

Verify existing functionality still works:

- [ ] Dashboard loads normally
- [ ] Course cards are clickable
- [ ] Settings menu works
- [ ] Favorites/starring works
- [ ] Card colors/images display
- [ ] Other Canvas features unaffected

---

## Success Criteria

All of the following should be true:

✅ Badges appear on all courses with grades  
✅ Badges are small, compact, and inline  
✅ Badges use Canvas brand color  
✅ Badges are positioned in header area  
✅ Badges don't interfere with other elements  
✅ Badges show correct grade values  
✅ Badges are accessible to screen readers  
✅ No console errors  
✅ No layout issues  
✅ Works across browsers  

---

## Reporting Issues

If you encounter issues, please provide:

1. **Screenshots** showing the issue
2. **Console output** with `?debug=true` enabled
3. **Browser and version**
4. **Canvas version/theme**
5. **Output of:**
   ```javascript
   window.CG.diagnosticDashboard()
   ```

See `DEBUGGING.md` for more detailed troubleshooting steps.

