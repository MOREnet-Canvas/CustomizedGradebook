# Dynamic Mastery Dashboard URL Resolution

**Created:** 2026-04-08  
**Issue:** Student links breaking due to Canvas auto-numbered page URLs

## Problem

When Canvas pages are deleted and recreated with the same title, Canvas automatically appends numbers to the URL slug:
- First creation: `mastery-dashboard`
- After delete + recreate: `mastery-dashboard-2`
- After delete + recreate again: `mastery-dashboard-3`

**Result:** Hardcoded student links pointing to `mastery-dashboard` return 404 errors when the actual page is `mastery-dashboard-2`.

---

## Solution

Dynamically search for the Mastery Dashboard page by title during data refresh and store the actual URL in cache metadata. All student links then use the cached URL instead of hardcoded values.

---

## Implementation

### 1. New Utility Function

**File:** `src/services/pageService.js`

```javascript
export async function findMasteryDashboardPageUrl(courseId, apiClient)
```

**What it does:**
- Searches Canvas pages by title "Mastery Dashboard"
- Filters out deleted pages (`workflow_state !== 'deleted'`)
- Returns actual URL slug (e.g., `mastery-dashboard-2`)
- Returns `null` if page not found

**API call:**
```
GET /api/v1/courses/{courseId}/pages?search_term=Mastery Dashboard&per_page=10
```

---

### 2. Integration in Refresh Flow

**File:** `src/masteryOutlook/masteryOutlookInit.js`

**When:** During "Refresh Data" operation (after computing Power Law stats, before saving cache)

**Code:**
```javascript
// Find Mastery Dashboard page URL
const masteryDashboardUrl = await findMasteryDashboardPageUrl(courseId, apiClient);

// Store in cache metadata
cache.metadata.masteryDashboardUrl = masteryDashboardUrl;
```

**Timing:** Adds ~200-500ms to refresh operation (one-time API call)

---

### 3. Usage in Student Links

**Files Modified:**
- `src/masteryOutlook/masteryOutlookHeatmap.js`
- `src/masteryOutlook/masteryOutlookHeatmapFullScreen.js`
- `src/masteryOutlook/masteryOutlookView.js`

**Pattern:**
```javascript
// Use cached URL or fallback to default
const masteryDashboardUrl = cache.meta.masteryDashboardUrl || 'mastery-dashboard';

// Build link
link.href = `/courses/${courseId}/pages/${masteryDashboardUrl}?cg_web=1&student_id=${studentId}`;
```

---

## Cache Structure

### Before:
```json
{
  "metadata": {
    "courseId": "566",
    "computedAt": "2026-04-08T15:30:00Z",
    "threshold": 2.2,
    "studentCount": 25,
    "outcomeCount": 6
  }
}
```

### After:
```json
{
  "metadata": {
    "courseId": "566",
    "computedAt": "2026-04-08T15:30:00Z",
    "threshold": 2.2,
    "studentCount": 25,
    "outcomeCount": 6,
    "masteryDashboardUrl": "mastery-dashboard-2"
  }
}
```

---

## Flow Diagram

```
User clicks "Refresh Data"
  ↓
Fetch outcome data
  ↓
Compute Power Law predictions
  ↓
✨ Search for "Mastery Dashboard" page
  ↓
✨ Store actual URL in cache.metadata.masteryDashboardUrl
  ↓
Save cache to Canvas Files
  ↓
Render views
  ↓
Student links use cache.meta.masteryDashboardUrl
  ↓
Links work correctly (even if URL is mastery-dashboard-2)
```

---

## Edge Cases Handled

### Page Not Found
- **Scenario:** Mastery Dashboard page doesn't exist yet
- **Behavior:** `masteryDashboardUrl` = `null`
- **Fallback:** Links use `'mastery-dashboard'` (may be broken until page created)
- **Log:** Warning logged to console

### Multiple Pages with Similar Names
- **Scenario:** Pages like "Mastery Dashboard Test", "Mastery Dashboard Old"
- **Behavior:** Exact title match + URL must start with `mastery-dashboard`
- **Result:** Only the correct page is matched

### Deleted Page
- **Scenario:** Page exists but is soft-deleted
- **Behavior:** Filtered out by `workflow_state !== 'deleted'` check
- **Result:** Returns `null`, doesn't link to deleted page

### API Error
- **Scenario:** Network error or permissions issue
- **Behavior:** Returns `null`, logs warning
- **Fallback:** Links use `'mastery-dashboard'`

---

## Performance Impact

**API Calls Added:**
- 1 additional call during "Refresh Data" (every few hours/days)
- No additional calls during normal browsing

**Response Time:**
- Adds ~200-500ms to refresh operation
- Negligible impact (refresh already takes 10-30 seconds)

**Caching:**
- URL cached in metadata
- Reused across all student links
- Updated on every refresh

---

## Testing Checklist

### Initial Setup
- [ ] Create Mastery Dashboard page
- [ ] Refresh Mastery Outlook data
- [ ] Verify `cache.meta.masteryDashboardUrl = 'mastery-dashboard'`
- [ ] Student links work correctly

### Auto-Numbered URL
- [ ] Delete Mastery Dashboard page
- [ ] Recreate Mastery Dashboard page (becomes `mastery-dashboard-2`)
- [ ] Refresh Mastery Outlook data
- [ ] Verify `cache.meta.masteryDashboardUrl = 'mastery-dashboard-2'`
- [ ] Student links work correctly with new URL

### Page Not Found
- [ ] Delete Mastery Dashboard page completely
- [ ] Refresh Mastery Outlook data
- [ ] Verify `cache.meta.masteryDashboardUrl = null`
- [ ] Student links fallback to `'mastery-dashboard'`
- [ ] Warning logged in console

### All Link Locations
- [ ] Heatmap view student names are clickable
- [ ] Full-screen heatmap student names are clickable
- [ ] Outcome detail table student names are clickable
- [ ] All links use correct URL from cache

---

## Files Changed

| File | Lines Added | Purpose |
|------|-------------|---------|
| `pageService.js` | +34 | New `findMasteryDashboardPageUrl()` function |
| `masteryOutlookInit.js` | +11 | Call search, store in cache |
| `masteryOutlookHeatmap.js` | +4 | Use cached URL |
| `masteryOutlookHeatmapFullScreen.js` | +3 | Use cached URL |
| `masteryOutlookView.js` | +3 | Use cached URL |
| **TOTAL** | **~55 lines** | **5 files** |

---

## Benefits

✅ **Robust:** Handles Canvas auto-numbered URLs automatically  
✅ **Accurate:** Always uses current page URL  
✅ **Cached:** One API call per refresh, reused everywhere  
✅ **Graceful:** Fallback behavior if page not found  
✅ **Logged:** Clear warnings when issues occur  
✅ **Minimal:** Small performance impact  

---

## Future Considerations

- Could also apply this pattern to Mastery Outlook page itself
- Could cache the page ID instead of URL for even more robustness
- Could add a "Recheck URL" button in UI if links break

---

**This fix ensures student links remain functional regardless of Canvas's page deletion/recreation behavior.**
