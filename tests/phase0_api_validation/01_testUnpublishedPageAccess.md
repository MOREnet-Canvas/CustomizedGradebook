# Test 1: Unpublished Page Access

## Purpose

Verify that teachers can access **unpublished** Canvas pages. The Outcomes Dashboard will initially be created as an unpublished page, and teachers need to be able to view it while it's hidden from students.

## Steps

### 1. Create Test Page

1. Navigate to your test course in Canvas
2. Click **Pages** in the left navigation
3. Click **+ Page** button
4. Configure the page:
   - **Title:** `Outcomes Dashboard Test`
   - **URL:** `outcomes-dashboard-test` (auto-populated)
   - **Page Content:** 
     ```html
     <div id="outcomes-dashboard-root">
       <h1>Test Successful!</h1>
       <p>If you can see this, unpublished page access works.</p>
     </div>
     ```
   - **Published:** ❌ **LEAVE UNCHECKED** (keep unpublished)
5. Click **Save**

### 2. Verify Access as Teacher

1. Navigate to the page directly:
   ```
   https://[your-canvas-domain]/courses/[course-id]/pages/outcomes-dashboard-test
   ```
2. **Expected Result:** Page loads successfully with "Test Successful!" message
3. **Failed Result:** 404 error or "Page not found"

### 3. Test DOM Access (Console)

Open browser console and run:

```javascript
// Test 1: Find the root element
const rootEl = document.querySelector('#outcomes-dashboard-root');
console.log('Root element found:', rootEl !== null);
console.log('Element:', rootEl);

// Test 2: Verify we can manipulate it
if (rootEl) {
    rootEl.style.border = '2px solid green';
    rootEl.style.padding = '20px';
    console.log('✅ DOM manipulation successful');
}
```

**Expected Output:**
```
Root element found: true
Element: <div id="outcomes-dashboard-root">...</div>
✅ DOM manipulation successful
```

### 4. Verify Students Cannot Access

1. Open an Incognito/Private browser window
2. Log in as a **student** (or use Student View)
3. Try to navigate to the same page URL
4. **Expected Result:** 404 error or "Page not found" for students
5. **Failed Result:** Student can see the page (security issue!)

## Success Criteria

- ✅ Teacher can access unpublished page
- ✅ Page content renders correctly
- ✅ DOM elements are accessible via JavaScript
- ✅ Students get 404 or access denied

## Cleanup (Optional)

After testing, you can:
- Leave the test page for later use
- OR delete it from Pages → three dots menu → Delete

## Notes

- Unpublished pages are accessible to:
  - Teachers
  - TAs
  - Course Designers
  - Admins
- This is a Canvas platform feature, not something we control in code
- If this test fails, contact Canvas admin or check course permissions
