# Dashboard Grade Display - Quick Test Guide

## 🚀 Quick Start Testing

### Step 1: Build
```bash
npm run build
```

### Step 2: Upload to Canvas
Upload `dist/main.js` to Canvas as a custom JavaScript file

### Step 3: Navigate to Dashboard
```
https://your-canvas.edu/?debug=true
```

### Step 4: Open Console (F12)
Look for these messages:

✅ **Success:**
```
[INFO] Initializing dashboard grade display
[INFO] Dashboard cards found: X
[INFO] Found X active student courses
[INFO] Updating grades for X courses
[INFO] Dashboard grade display update complete
```

❌ **Failure:**
```
[WARN] Timeout waiting for dashboard cards
[WARN] Dashboard cards not found
```

---

## 🔍 Quick Diagnostic

### Run in Console:
```javascript
window.CG.diagnosticDashboard()
```

### Expected Output:
```
=== Dashboard Card Diagnostic ===
Current URL: https://canvas.example.edu/
Is dashboard page: true
✓ Found X elements with selector: .ic-DashboardCard
Found X dashboard course links
=== End Diagnostic ===
```

---

## 🐛 Quick Fixes

### Problem: "Timeout waiting for dashboard cards"

**Quick Check:**
```javascript
// Try each selector manually
document.querySelectorAll('.ic-DashboardCard').length
document.querySelectorAll('[class*="DashboardCard"]').length
document.querySelectorAll('a[href*="/courses/"]').length
```

**If all return 0:**
- You might not be on the dashboard page
- Canvas might use a completely different structure
- Share the output of `window.CG.diagnosticDashboard()` for help

**If any return > 0:**
- The selector works! Note which one
- Check console for why it's not being detected
- May need to adjust timeout or initialization timing

---

### Problem: "Found 0 active student courses"

**Quick Check:**
```javascript
// Test the API directly
fetch('/api/v1/courses?enrollment_state=active&include[]=total_scores', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
})
.then(r => r.json())
.then(data => {
    console.log('Total courses:', data.length);
    console.log('First course:', data[0]);
    console.log('First course enrollments:', data[0]?.enrollments);
});
```

**Check the output:**
- If `enrollments` is undefined → API not including enrollments
- If `enrollments` exists → Check the `type` field
- Share the enrollment structure for help

---

### Problem: Cards found, courses found, but no grades showing

**Quick Check:**
```javascript
// Check if grade badges were created
document.querySelectorAll('.cg-dashboard-grade').length
```

**If 0:**
- Grades might not be available (no AVG assignment, no enrollment scores)
- Check console for grade fetch warnings
- Test grade fetching manually (see below)

**If > 0:**
- Badges exist! They might be hidden or positioned incorrectly
- Inspect one: `document.querySelector('.cg-dashboard-grade')`
- Check CSS/styling

---

## 🧪 Manual Grade Fetch Test

```javascript
// Replace with your actual course ID
const courseId = '12345';

// Test AVG assignment fetch
fetch(`/api/v1/courses/${courseId}/assignments?search_term=Current Score Assignment`, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
})
.then(r => r.json())
.then(data => console.log('AVG assignments:', data));

// Test enrollment score fetch
fetch(`/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment&include[]=total_scores`, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
})
.then(r => r.json())
.then(data => {
    console.log('Enrollments:', data);
    if (data[0]) {
        console.log('Scores:', {
            computed_current: data[0].computed_current_score,
            calculated_current: data[0].calculated_current_score,
            computed_final: data[0].computed_final_score,
            calculated_final: data[0].calculated_final_score
        });
    }
});
```

---

## 📊 What to Report

If you need help, provide:

1. **Output of diagnostic:**
   ```javascript
   window.CG.diagnosticDashboard()
   ```

2. **Console log with debug enabled:**
   - Navigate to `?debug=true`
   - Copy all console output

3. **Canvas version/theme:**
   - Classic Canvas vs Modern Canvas
   - Any custom themes

4. **Sample API response:**
   ```javascript
   // Run the courses API test above
   // Copy the output
   ```

5. **DOM structure:**
   - Screenshot of DevTools showing a dashboard card element
   - Or copy the HTML of one card

---

## ✅ Success Checklist

- [ ] Console shows "Dashboard cards found: X" (X > 0)
- [ ] Console shows "Found X active student courses" (X > 0)
- [ ] Console shows "Dashboard grade display update complete"
- [ ] Grade badges visible on dashboard cards
- [ ] Badges show correct values (0-4 scale or percentage)
- [ ] No errors in console
- [ ] Navigating away and back still shows grades

---

## 🔄 Force Refresh

If you make changes and need to test again:

1. **Hard refresh:** Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. **Clear cache:** DevTools → Network tab → Disable cache
3. **Rebuild:** `npm run build` and re-upload

---

## 📞 Getting Help

See [DEBUGGING.md](./DEBUGGING.md) for detailed troubleshooting.

Include the following in any bug report:
- Diagnostic output
- Console logs with `?debug=true`
- Canvas version
- Browser and version
- Sample API responses

