# Auto-Patch Loader System

## Overview

The **Auto-Patch Loader** is a new loader channel that automatically updates to the latest patch release within a specified minor version (e.g., auto-updates from `v1.0.3` → `v1.0.4` → `v1.0.5`, but NOT to `v1.1.0`).

This provides a middle ground between:
- **Manual version pinning** (prod loader) - requires manual updates for every patch
- **Beta loader** (latest) - automatically gets ALL releases including breaking changes

## How It Works

### 1. Version Manifest (`versions.json`)

A JSON file hosted on GitHub Pages that tracks the latest patch for each minor version:

```json
{
  "v1.0-latest": "v1.0.5",
  "v1.1-latest": "v1.1.2",
  "stable": "v1.0.5",
  "latest": "v1.0.5",
  "_generated": "2026-02-06T12:00:00.000Z",
  "_totalVersions": 8
}
```

**URL**: `https://morenet-canvas.github.io/CustomizedGradebook/versions.json`

### 2. Automatic Updates

When you publish a new release (e.g., `v1.0.4`):

1. GitHub Actions workflow triggers on `release.published`
2. Script scans all git tags matching `v*.*.*`
3. Groups versions by major.minor (e.g., `v1.0`, `v1.1`)
4. Finds the highest patch number for each group
5. Updates `versions.json` with latest patches
6. Deploys to GitHub Pages

### 3. Loader Behavior

On page load, the auto-patch loader:

1. Fetches `versions.json` from GitHub Pages
2. Reads the configured version track (e.g., `v1.0-latest`)
3. Resolves to the actual version (e.g., `v1.0.5`)
4. Loads that specific release from GitHub Releases
5. Falls back to hardcoded version if manifest fetch fails

## Usage

### Option 1: Admin Dashboard (Recommended)

1. Open the CG Admin Dashboard
2. Go to "Generate Combined Loader"
3. Select **"Auto-Patch v1.0.x (Recommended)"** from the version dropdown
4. Click "Generate Loader"
5. Download and deploy to Canvas Theme Editor

### Option 2: Manual Configuration

Use the provided `auto_patch_loader.js` as a template, or configure manually:

```javascript
window.CG_MANAGED.release = {
    channel: "auto-patch",
    version: "v1.0.3",  // Fallback version if manifest fetch fails
    versionTrack: "v1.0-latest",  // Auto-updates to latest v1.0.x patch
    source: "github_release"
};
```

## Version Tracks

| Track | Behavior | Use Case |
|-------|----------|----------|
| `v1.0-latest` | Latest v1.0.x patch | Production (recommended) |
| `v1.1-latest` | Latest v1.1.x patch | Testing next minor version |
| `stable` | Latest overall release | Alias for most recent stable |
| `latest` | Latest overall release | Same as stable |

## Workflow

### Publishing a Patch Release

```bash
# Bump patch version (1.0.3 → 1.0.4)
npm run release:patch

# This automatically:
# 1. Updates package.json version
# 2. Creates git tag v1.0.4
# 3. Pushes tag to GitHub
# 4. Builds and uploads to GitHub Releases
# 5. Triggers version manifest update workflow
# 6. Updates versions.json on GitHub Pages
```

### Manual Manifest Update

If needed, you can manually trigger the manifest update:

```bash
# Run locally
node buildScripts/update-version-manifest.js

# Or trigger GitHub Actions workflow
# Go to: Actions → Update Version Manifest → Run workflow
```

## Files

### Core Components

- **`buildScripts/update-version-manifest.js`** - Script to generate versions.json
- **`.github/workflows/update-version-manifest.yml`** - GitHub Actions workflow
- **`src/admin/templates/cgLoaderTemplate.js`** - Loader template with auto-patch support
- **`auto_patch_loader.js`** - Example standalone auto-patch loader

### Admin Dashboard Updates

- **`src/admin/loaderGeneratorPanel.js`** - Version selector UI
- **`src/admin/loaderGenerator.js`** - Loader generation logic

## Benefits

✅ **Automatic patch updates** - No manual loader updates for bug fixes  
✅ **Controlled updates** - Only patches within minor version (no breaking changes)  
✅ **Fast** - Single JSON fetch (cached by GitHub Pages CDN)  
✅ **Fallback** - Uses hardcoded version if manifest fetch fails  
✅ **Flexible** - Support multiple version tracks (v1.0-latest, v1.1-latest, etc.)  

## Caching

GitHub Pages CDN caches `versions.json`, but updates propagate within minutes. The loader includes:

- **Fallback version** - Used if manifest fetch fails
- **Error handling** - Graceful degradation to fallback
- **Console logging** - Clear visibility into version resolution

## Comparison

| Channel | Updates | Stability | Use Case |
|---------|---------|-----------|----------|
| **Prod** | Manual | Highest | Production (full control) |
| **Auto-Patch** | Auto (patches only) | High | Production (recommended) |
| **Beta** | Auto (all releases) | Medium | QA/Staging |
| **Dev** | Auto (every commit) | Low | Development |

