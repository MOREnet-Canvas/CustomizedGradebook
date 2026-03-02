# Development Workflows

This guide explains the development and release workflows for both the main Customized Gradebook and the Mobile Module.

## Overview

The project uses a **local build + manual deploy** workflow:

1. Build locally (faster than GitHub Actions)
2. Deploy to GitHub Releases manually
3. Trigger GitHub Pages updates manually

## Main Customized Gradebook Workflow

### Development Workflow

**For testing changes:**

```bash
# 1. Make changes to src/**/*.js files
# 2. Build locally
npm run build:dev

# 3. Deploy to dev release
npm run deploy:dev
```

**What happens:**
- Builds bundle with source maps
- Uploads to `dev` GitHub Release
- Overwrites previous dev build
- Available immediately at: `.../releases/download/dev/customGradebookInit.js`

### Production Release Workflow

**For stable releases:**

```bash
# Patch release (1.2.0 → 1.2.1)
npm run release:patch

# Minor release (1.2.0 → 1.3.0)
npm run release:minor

# Major release (1.2.0 → 2.0.0)
npm run release:major
```

**What happens:**
1. Bumps version in `package.json`
2. Creates git commit
3. Creates git tag (e.g., `v1.2.1`)
4. Pushes to GitHub with tags
5. Builds production bundle
6. Creates GitHub Release
7. Uploads bundle to release
8. Triggers `update-version-manifest.yml` workflow

### Build Process

The main CG uses **esbuild** to bundle multiple source files:

**Input:** `src/**/*.js` (many files)  
**Output:** `dist/prod/customGradebookInit.js` (single bundle)

**Build command:**
```bash
npm run build:prod
```

**What it does:**
- Bundles all source files
- Minifies code
- Generates source maps (dev only)
- Outputs to `dist/prod/`

## Mobile Module Workflow

### Development Workflow

**For testing changes:**

```bash
# 1. Edit mobile/mobile_test.js directly
# 2. Deploy to dev release
npm run deploy:mobile:dev
```

**What happens:**
- Uploads `mobile/mobile_test.js` to `mobile-dev` GitHub Release
- Overwrites previous dev build
- Available immediately at: `.../releases/download/mobile-dev/mobile_test.js`

**No build process needed** - mobile module is already production-ready vanilla JavaScript.

### Production Release Workflow

**For stable releases:**

```bash
# Patch release (0.1.1 → 0.1.2)
npm run release:mobile:patch

# Minor release (0.1.1 → 0.2.0)
npm run release:mobile:minor

# Major release (0.1.1 → 1.0.0)
npm run release:mobile:major
```

**What happens:**
1. Bumps version in `mobile/package.json`
2. Creates git commit
3. Creates git tag (e.g., `mobile-v0.1.2`)
4. Pushes to GitHub with tags
5. Creates GitHub Release
6. Uploads `mobile/mobile_test.js` to release

## GitHub Actions Workflows

### `update-version-manifest.yml`

**Trigger:** Manual (`workflow_dispatch`) or auto-triggered by release scripts

**What it does:**
1. Scans all git tags (`v*` and `mobile-v*`)
2. Generates `versions.json` with version tracks
3. Deploys to GitHub Pages with landing page and button_directions.html

**When to trigger:**
- After releasing a new version (auto-triggered)
- To update GitHub Pages content manually

**Command:**
```bash
gh workflow run update-version-manifest.yml
```

## Version Tracks

The `versions.json` file contains version tracks for auto-patch loaders:

```json
{
  "v1.2-latest": "v1.2.0",
  "v1.1-latest": "v1.1.0",
  "latest": "v1.2.0",
  "stable": "v1.2.0"
}
```

**How it works:**
- Loaders request a track (e.g., `v1.2-latest`)
- `versions.json` resolves to specific version (e.g., `v1.2.0`)
- Loader fetches that version from GitHub Releases

See [Versioning](versioning.md) for details.

## Summary

| Task | Main CG | Mobile |
|------|---------|--------|
| **Dev changes** | `npm run build:dev && npm run deploy:dev` | Edit file → `npm run deploy:mobile:dev` |
| **Prod release** | `npm run release:minor` | `npm run release:mobile:minor` |
| **Build process** | ✅ esbuild | ❌ None (vanilla JS) |
| **Tag format** | `v1.2.0` | `mobile-v0.1.1` |
| **Dev URL** | `.../dev/customGradebookInit.js` | `.../mobile-dev/mobile_test.js` |

