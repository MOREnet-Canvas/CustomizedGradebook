# Outcomes Cache Files API Tests

Two versions of the Canvas Files API test for different workflows.

---

## Quick Reference

| Version | File | Use Case | How to Run |
|---------|------|----------|------------|
| **Console** | `outcomesCacheFileTest.console.js` | Quick testing, no build needed | Copy-paste into browser console |
| **Module** | `outcomesCacheFileTest.js` | Integration testing, bundled app | Import and call, or use `window.CG_testOutcomesCacheFiles()` |

---

## Version 1: Console-Ready (RECOMMENDED FOR INITIAL TESTING)

**File:** `outcomesCacheFileTest.console.js`

### Features
- ✅ **Zero setup** - just copy-paste into console
- ✅ **Auto-detects course ID** from URL
- ✅ **No imports** - self-contained IIFE
- ✅ **Works immediately** on any Canvas course page
- ✅ **Color-coded output** for easy debugging

### How to Run

1. **Navigate to any Canvas course page**
   ```
   https://canvas.beta.instructure.com/courses/12345/assignments
   (any page with /courses/{id}/ in the URL works)
   ```

2. **Open browser console**
   - Chrome/Edge: `F12` or `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
   - Firefox: `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

3. **Copy entire file contents and paste into console**
   - Open `tests/outcomesCacheFileTest.console.js`
   - Select all (`Ctrl+A` / `Cmd+A`)
   - Copy (`Ctrl+C` / `Cmd+C`)
   - Paste into console (`Ctrl+V` / `Cmd+V`)
   - Press `Enter`

4. **Watch the test run**
   ```
   📦 Canvas Files API Test
   Auto-detected course ID: 12345
   Target file: _mastery_cache/outcomes_cache.json
   ────────────────────────────────────────────────────────────
   
   Step 1: Creating/verifying _mastery_cache folder...
   ✓ Folder created (id: 67890)
   
   Step 2 (initial write): Uploading outcomes_cache.json...
   ✓ File uploaded and confirmed (initial write) — file id: 11111
   
   Step 3: Reading file back from Canvas...
   ✓ File read back successfully
   ✓ Contents verified — computedBy matches (console_test_v1)
   
   Step 2 (overwrite): Uploading outcomes_cache.json...
   ✓ File uploaded and confirmed (overwrite) — file id: 11111
   
   Step 3: Reading file back from Canvas...
   ✓ File read back successfully
   ✓ Overwrite verified — computedBy reflects new value (console_test_v2_overwrite)
   
   ────────────────────────────────────────────────────────────
   ✅ All file tests complete!
   ```

5. **Verify in Canvas Files UI**
   - Go to Files in your course
   - Look for `_mastery_cache` folder (may need to show hidden files)
   - Find `outcomes_cache.json`

### When to Use
- ✅ First-time testing on beta environment
- ✅ Quick validation after Canvas updates
- ✅ Debugging Files API issues
- ✅ Testing on different courses quickly

---

## Version 2: ES Module (FOR INTEGRATION TESTING)

**File:** `outcomesCacheFileTest.js`

### Features
- ✅ **ES module imports** - integrates with codebase
- ✅ **Auto-detects course ID** from URL (or accepts override)
- ✅ **Proper apiClient** - uses `CanvasApiClient` from codebase
- ✅ **Context strings** - better logging for debugging
- ✅ **Window attachment** - accessible from console if bundled

### How to Run

**Option A: From bundled application (if included in build)**
```javascript
// In browser console, if test module is bundled:
window.CG_testOutcomesCacheFiles();

// Or with course ID override:
window.CG_testOutcomesCacheFiles('12345');
```

**Option B: Import in your code**
```javascript
import { runFileSaveTest } from './tests/outcomesCacheFileTest.js';
import { CanvasApiClient } from './src/utils/canvasApiClient.js';

const apiClient = new CanvasApiClient();
await runFileSaveTest(apiClient);

// Or with course ID override:
await runFileSaveTest(apiClient, '12345');
```

**Option C: Add to init for testing**
```javascript
// In customGradebookInit.js (temporary, for testing only)
import { runFileSaveTest } from '../tests/outcomesCacheFileTest.js';

// At bottom of init function:
if (window.location.search.includes('cg_test_files=1')) {
    const apiClient = new CanvasApiClient();
    runFileSaveTest(apiClient);
}

// Then navigate to: /courses/12345?cg_test_files=1
```

### When to Use
- ✅ After console version passes
- ✅ Testing integration with `outcomesCacheService.js`
- ✅ Automated testing workflows
- ✅ Verifying bundled code works correctly

---

## What the Tests Do

Both versions test the same 5 operations:

### 1. **Folder Creation**
- Check if `_mastery_cache` folder exists
- Create it if missing (with `hidden: true` flag)
- Verify folder ID returned

### 2. **Initial File Upload (3-step Canvas Files API)**
- **Step 1:** POST to `/api/v1/courses/{id}/files` - get upload URL
- **Step 2:** POST to S3 with FormData - upload actual file
- **Step 3:** POST to confirmation URL - finalize upload
- Verify file ID returned

### 3. **Read File Back**
- Search for file by name
- Fetch file contents from download URL
- Parse JSON and verify structure

### 4. **File Overwrite**
- Same 3-step upload with `on_duplicate: 'overwrite'`
- Uses same filename to test overwrite behavior
- Should replace existing file, not create duplicate

### 5. **Verify Overwrite**
- Read file again
- Verify contents changed to new payload
- Confirm `computedBy` field updated

---

## Troubleshooting

### ❌ "Not on a course page"
- Navigate to any URL with `/courses/{id}/` pattern
- Examples: `/courses/123/assignments`, `/courses/123/pages`

### ❌ "CSRF token not found"
- Make sure you're logged into Canvas
- Refresh the page and try again
- Clear cookies and log in again

### ❌ "404 - Folder not found" is OK
- First run creates the folder
- Error means folder doesn't exist yet (expected)

### ❌ "403 - Permission denied"
- Make sure you're a teacher or admin in the course
- Student accounts cannot create folders

### ❌ "S3 upload failed"
- Check network tab for CORS errors
- Verify Canvas Files API is enabled for your institution
- Try again (S3 can be intermittent)

### ❌ "File not found after upload"
- Wait a few seconds and try reading manually:
  ```javascript
  const apiClient = new CanvasApiClient(); // if using module version
  const files = await apiClient.get('/api/v1/courses/12345/files?search_term=outcomes_cache');
  console.log(files);
  ```

---

## Next Steps After Tests Pass

1. ✅ Tests pass → Canvas Files API is working
2. ✅ Implement `outcomesCacheService.js` using patterns from test
3. ✅ Test unpublished page accessibility
4. ✅ Begin building other modules

---

## Files in This Folder

```
tests/
├── README_OutcomesCacheTests.md          ← This file
├── outcomesCacheFileTest.console.js      ← Console-ready IIFE version
└── outcomesCacheFileTest.js              ← ES module version
```
