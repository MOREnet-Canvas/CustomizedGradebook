# Course Snapshot Security

## Overview

The course snapshot service implements comprehensive security controls including user ownership validation, TTL expiration, role-based access control, and page-based authorization to prevent data leakage and ensure secure caching.

## Security Features

### 1. User Ownership Validation

**Implementation**: `validateUserOwnership()` in `courseSnapshotService.js`

**How it works**:
- Stores current user ID in sessionStorage (`cg_userId`)
- Validates user ID on every snapshot read/write operation
- Automatically clears all snapshots if user changes
- Each snapshot stores `userId` field for per-snapshot validation

**Validation Points**:
- `getCourseSnapshot()` - validates before reading + checks snapshot.userId
- `populateCourseSnapshot()` - validates before writing + stores userId
- `refreshCourseSnapshot()` - validates before refreshing
- `validateAllSnapshots()` - validates all snapshots on script initialization

### 2. TTL (Time-To-Live) Expiration

**Implementation**: 10-minute TTL on all snapshots

**How it works**:
- Each snapshot stores `expiresAt: Date.now() + 600000` (10 minutes)
- `getCourseSnapshot()` checks TTL and returns null if expired
- Expired snapshots are automatically removed from sessionStorage
- `validateAllSnapshots()` clears expired snapshots on initialization

**Benefits**:
- Prevents stale grade data from being displayed
- Automatic cleanup of old snapshots
- Reduces sessionStorage usage over time

### 3. Role-Based Access Control

**Implementation**: Student-only snapshot creation

**How it works**:
- `populateCourseSnapshot()` checks `getUserRoleGroup() === 'student_like'`
- Only student-like users can create/populate snapshots
- Teacher-like and other users are silently skipped

**Rationale**:
- Snapshots are designed for student grade display
- Prevents unnecessary caching for teachers/admins
- Reduces security surface area

### 4. Page-Based Authorization

**Implementation**: `isAuthorizedPage()` function

**Authorized pages**:
- Dashboard: `/`, `/dashboard`, `/dashboard/*`
- All grades: `/grades` (exact path)
- Course grades: `/courses/*/grades`

**How it works**:
- `populateCourseSnapshot()` checks page authorization before writing
- `refreshCourseSnapshot()` checks page authorization before refreshing
- `shouldRefreshGrade()` returns false for unauthorized pages
- Unauthorized pages can still read existing snapshots but cannot create/refresh

**Rationale**:
- Limits snapshot operations to pages where grades are displayed
- Prevents unnecessary API calls on other pages
- Reduces attack surface for potential exploits

### 5. Initialization Validation

**Implementation**: `validateAllSnapshots()` called on script load

**How it works**:
- Runs immediately when CustomizedGradebook initializes
- Validates all existing snapshots in sessionStorage
- Clears snapshots with mismatched userId
- Clears expired snapshots (past expiresAt)
- Clears malformed snapshots (parse errors)

**Benefits**:
- Ensures clean state on page load
- Catches stale data from previous sessions
- Prevents data leakage from previous users

### 6. Automatic Cleanup on User Change

When a user change is detected (e.g., logout → login as different user):
1. All snapshots are cleared (`cg_*` keys)
2. New user ID is stored
3. Operation continues with clean state

**Log output**:
```
[Snapshot] User changed from 12345 to 67890 - clearing all snapshots
[Snapshot] Cleared 15 snapshots due to user change
```

### 7. Manual Cleanup

**Function**: `window.CG.clearAllSnapshots()`

**Usage**:
```javascript
// Clear all snapshots manually
const count = window.CG.clearAllSnapshots();
console.log(`Cleared ${count} snapshots`);
```

**When to use**:
- Manual logout cleanup
- Testing/debugging
- Clearing stale data

## Security Guarantees

✅ **User Isolation**: Each user's snapshots are isolated by user ID validation
✅ **Automatic Cleanup**: Snapshots are automatically cleared on user change
✅ **TTL Expiration**: Snapshots expire after 10 minutes
✅ **Role-Based Access**: Only student-like users can create snapshots
✅ **Page-Based Access**: Only authorized pages can create/refresh snapshots
✅ **Initialization Validation**: All snapshots validated on script load
✅ **Session-Scoped**: sessionStorage is per-tab, preventing cross-tab leakage
✅ **No Persistence**: Data is cleared when tab/browser closes

## Implementation Details

### Snapshot Structure

```javascript
{
  courseId: string,
  courseName: string,
  isStandardsBased: boolean,
  score: number,
  letterGrade: string|null,
  gradeSource: 'assignment' | 'enrollment',
  timestamp: number,
  userId: string,        // NEW: For user ownership validation
  expiresAt: number      // NEW: TTL expiration timestamp
}
```

### Storage Keys

- **User ID**: `cg_userId` - Current user ID for global validation
- **Snapshots**: `cg_courseSnapshot_<courseId>` - Individual course snapshots
- **Cleanup**: All keys with `cg_` prefix are cleared on user change

### Validation Flow

```
Script Initialization
  ↓
validateAllSnapshots()
  ↓
Check cg_userId vs ENV.current_user_id
  ↓
If different: clearAllSnapshots() + set new userId
  ↓
Validate each snapshot: userId match + TTL check
  ↓
Remove invalid/expired snapshots

---

getCourseSnapshot(courseId)
  ↓
validateUserOwnership() - Check global user ID
  ↓
Parse snapshot from sessionStorage
  ↓
Validate snapshot.userId === current user
  ↓
Check snapshot.expiresAt > Date.now()
  ↓
Return snapshot or null (remove if invalid/expired)

---

populateCourseSnapshot(courseId, courseName, apiClient)
  ↓
validateUserOwnership() - Check global user ID
  ↓
Check getUserRoleGroup() === 'student_like'
  ↓
Check isAuthorizedPage()
  ↓
Fetch grade data + detect course type
  ↓
Create snapshot with userId + expiresAt
  ↓
Write to sessionStorage
```

## Testing

### Verify User Ownership Validation
1. Login as User A
2. Load dashboard (snapshots created)
3. Call `window.CG.debugSnapshots()` - should show User A's data with userId field
4. Logout and login as User B
5. Load dashboard - snapshots should be automatically cleared
6. Call `window.CG.debugSnapshots()` - should show User B's data only

### Verify TTL Expiration
1. Load dashboard (snapshots created)
2. Call `window.CG.debugSnapshots()` - note expiresAt timestamps
3. Wait 10+ minutes
4. Reload page
5. Call `window.CG.debugSnapshots()` - expired snapshots should be removed

### Verify Role-Based Access
1. Login as teacher/admin
2. Load dashboard
3. Call `window.CG.debugSnapshots()` - should show empty object (no snapshots created)
4. Login as student
5. Load dashboard
6. Call `window.CG.debugSnapshots()` - should show snapshots

### Verify Page-Based Authorization
1. Login as student
2. Navigate to unauthorized page (e.g., `/courses/123/modules`)
3. Call `window.CG.debugSnapshots()` - existing snapshots visible but no new ones created
4. Navigate to authorized page (e.g., `/dashboard`)
5. Call `window.CG.debugSnapshots()` - new snapshots should be created

### Verify Initialization Validation
1. Manually create invalid snapshot in console:
   ```javascript
   sessionStorage.setItem('cg_courseSnapshot_999', JSON.stringify({
     courseId: '999',
     userId: 'wrong_user',
     expiresAt: Date.now() - 1000
   }));
   ```
2. Reload page
3. Call `window.CG.debugSnapshots()` - invalid snapshot should be removed

### Verify Manual Cleanup
1. Load dashboard (snapshots created)
2. Call `window.CG.clearAllSnapshots()`
3. Call `window.CG.debugSnapshots()` - should show empty object