# Beta Loader - Auto-Update from Latest Production Release

## Overview

The `beta_loader.js` file is a special loader that automatically uses the **most recent production release** from GitHub without requiring manual version updates. This is ideal for testing new releases before deploying them to production.

## How It Works

### GitHub's `/releases/latest/download/` URL

GitHub provides a special URL pattern that automatically redirects to the latest release:

```
https://github.com/morenet-canvas/CustomizedGradebook/releases/latest/download/customGradebookInit.js
```

This URL always points to the **most recent release** (excluding pre-releases), so you never need to update the version number manually.

### Beta Loader Configuration

**Section C (Managed Config Block):**
```javascript
window.CG_MANAGED.release = {
    channel: "beta",
    version: "latest",  // Automatically uses the most recent production release
    source: "github_release"
};
```

**Section B (CG Loader Template):**
```javascript
if (release.channel === "beta") {
    // Beta channel: use GitHub's /releases/latest/download/ redirect
    script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/latest/download/customGradebookInit.js`;
}
```

### Console Logging

When the beta loader successfully loads, you'll see:
```
[CG] Loaded customGradebookInit.js (BETA latest) - Auto-updated from latest production release
```

### Unique Bundle ID

The beta loader uses a unique bundle ID (`cg_beta_bundle`) to prevent conflicts with dev or prod loaders running on the same page.

## When to Use Beta Loader

### ✅ **Good Use Cases:**
- **Testing new releases** before deploying to production
- **QA environments** where you want to test the latest features
- **Staging environments** that should mirror production but with latest updates
- **Early adopter testing** with a small group of users

### ⚠️ **Not Recommended For:**
- **Production environments** - Use `first_loader.js` with pinned versions instead
- **Stable deployments** - Breaking changes may be introduced without notice
- **Critical systems** - No rollback control if issues occur

## Comparison: Dev vs Beta vs Prod Loaders

| Loader | Channel | Version | URL Pattern | Use Case |
|--------|---------|---------|-------------|----------|
| `dev_loader.js` | `dev` | `dev` | `/releases/download/dev/...?v=<timestamp>` | Development testing with cache-busting |
| `beta_loader.js` | `beta` | `latest` | `/releases/latest/download/...` | Testing latest production releases |
| `first_loader.js` | `prod` | `v1.0.3` | `/releases/download/v1.0.3/...` | Stable production with version pinning |

## Trade-offs

### ✅ **Advantages:**
- **No manual updates** - Automatically uses the latest release
- **Simpler testing** - No need to update loader after each release
- **Always current** - Users get the latest features and bug fixes

### ⚠️ **Disadvantages:**
- **Breaking changes risk** - New releases may introduce breaking changes
- **No rollback control** - Can't easily pin to a specific stable version
- **Harder to debug** - Users might be on different versions depending on cache
- **Cache issues** - Browsers may cache the redirect

## Deployment Workflow

### Recommended Workflow:

1. **Development** → Use `dev_loader.js` for active development
2. **Release** → Create a new GitHub Release (e.g., `v1.0.4`)
3. **Beta Testing** → Deploy `beta_loader.js` to QA/staging environment
4. **Validation** → Test the latest release with beta loader
5. **Production** → Update `first_loader.js` version to `v1.0.4` and deploy

### Example Deployment Script:

```bash
# Step 1: Create a new release
npm run release:patch  # Creates v1.0.4 and deploys to GitHub

# Step 2: Beta loader automatically picks up v1.0.4 (no action needed)

# Step 3: After testing, update production loader
# Manually update first_loader.js line 122: version: "v1.0.4"
# Or use automated script to update version
```

## Files Modified

To support the beta loader, the following files were updated:

1. **`beta_loader.js`** (NEW) - Beta loader file with auto-update configuration
2. **`src/admin/templates/cgLoaderTemplate.js`** - Added beta channel support to template
3. **`src/admin/loaderGenerator.js`** - Already supports any channel (no changes needed)

## Testing the Beta Loader

1. **Upload to Canvas Theme:**
   - Copy contents of `beta_loader.js`
   - Paste into Canvas Theme Editor → JavaScript section
   - Save changes

2. **Verify Console Logs:**
   ```
   [CG] Loaded customGradebookInit.js (BETA latest) - Auto-updated from latest production release
   ```

3. **Check Network Tab:**
   - Look for request to `/releases/latest/download/customGradebookInit.js`
   - Verify it redirects to the latest release version

## Future Enhancements

Potential improvements for the beta loader:

1. **Version Detection** - Fetch actual version number from GitHub API and display in console
2. **Update Notifications** - Alert users when a new version is available
3. **Rollback Mechanism** - Add ability to pin to previous version if issues occur
4. **Health Checks** - Verify loader integrity before executing

