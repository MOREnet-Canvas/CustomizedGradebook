# Bundle Filename Change Fix - main.js → customGradebookInit.js

## Problem Summary

After renaming the output bundle from `main.js` to `customGradebookInit.js`, the dev loader failed with:
```
[CG] Failed to load customGradebookInit.js (DEV) from GitHub
```

## Root Cause

The GitHub Actions workflow (`.github/workflows/dev-release.yml`) was still configured to upload `main.js` to the GitHub release, but the loader was trying to fetch `customGradebookInit.js`.

## Files Changed

### 1. ✅ esbuild.config.js
**Status**: Already updated
- Output filename changed from `main.js` to `customGradebookInit.js`

### 2. ✅ upload_dev.js
**Status**: Already updated
- Script URL changed to fetch `customGradebookInit.js`
- Console messages updated

### 3. ✅ upload_production.js
**Status**: Already updated
- Script URL changed to fetch `customGradebookInit.js`
- Console messages updated

### 4. ✅ .github/workflows/dev-release.yml
**Status**: JUST FIXED
- Changed artifact from `dist/dev/main.js` to `dist/dev/customGradebookInit.js`

### 5. ✅ .github/workflows/deploy-pages.yml
**Status**: No change needed
- Copies entire `dist` directory, so will automatically include renamed file

## Next Steps to Fix the Issue

### Step 1: Commit and Push Changes

The workflow file has been updated. You need to commit and push to trigger a new build:

```bash
git add .github/workflows/dev-release.yml
git commit -m "Fix: Update GitHub Actions to upload customGradebookInit.js instead of main.js"
git push origin main
```

### Step 2: Wait for GitHub Actions

Once you push to `main`, GitHub Actions will automatically:
1. Build the dev bundle (`npm run build:dev`)
2. Upload `dist/dev/customGradebookInit.js` to the "dev" release
3. Replace the old `main.js` artifact

You can monitor the workflow at:
https://github.com/MOREnet-Canvas/CustomizedGradebook/actions

### Step 3: Verify the Release

After the workflow completes, verify the release has the new file:
1. Go to: https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/tag/dev
2. Check that `customGradebookInit.js` is listed as an asset
3. The old `main.js` should be replaced

### Step 4: Test in Canvas

1. Inject `upload_dev.js` into Canvas
2. Open browser console
3. You should see: `[CG] Loaded customGradebookInit.js (DEV) from GitHub`
4. Verify the application works correctly

## Current Release Status

**Before Fix:**
- Release asset: `main.js` (uploaded 2026-01-15T22:29:36Z)
- Loader trying to fetch: `customGradebookInit.js`
- Result: ❌ 404 Not Found

**After Fix (once workflow runs):**
- Release asset: `customGradebookInit.js`
- Loader trying to fetch: `customGradebookInit.js`
- Result: ✅ Success

## Production Deployment

For production, you'll need to:

1. **Build production bundle:**
   ```bash
   npm run build:prod
   ```

2. **Deploy to GitHub Pages:**
   - Trigger the "Build dev only and Deploy to GitHub Pages" workflow manually
   - Or uncomment the push trigger in `.github/workflows/deploy-pages.yml`

3. **Verify production loader:**
   - Check: https://morenet-canvas.github.io/CustomizedGradebook/dist/prod/customGradebookInit.js
   - Should return the bundled JavaScript file

## Verification Checklist

After pushing the fix:

- [ ] GitHub Actions workflow completes successfully
- [ ] Dev release shows `customGradebookInit.js` asset
- [ ] Old `main.js` asset is removed/replaced
- [ ] Dev loader works in Canvas (console shows success message)
- [ ] Application functionality works correctly
- [ ] Production bundle is built and deployed (if needed)
- [ ] Production loader works in Canvas (if needed)

## Rollback Plan

If issues occur, you can quickly rollback by:

1. **Revert the filename change:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or manually update loader to use old filename:**
   - Change `customGradebookInit.js` back to `main.js` in loader files
   - This is a quick fix but not recommended long-term

## Summary

The fix is simple: update the GitHub Actions workflow to upload the renamed file. Once you commit and push this change, the next build will upload `customGradebookInit.js` to the release, and your loader will work correctly.

**Action Required:** Commit and push the workflow file change to fix the issue.

