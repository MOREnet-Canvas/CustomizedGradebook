# Development Workflows

This guide explains the development and release workflows for both the main Customized Gradebook and the Mobile Module.

## Overview

The project uses a **local build + manual deploy** workflow:

1. Build and deploy locally with a single npm script
2. Assets land on GitHub Releases
3. Canvas loaders pull straight from those releases

Every script in `buildScripts/` runs esbuild itself and then uploads via the `gh` CLI. There is
**no standalone `build` script** — building only happens as a step inside a deploy or release script.

!!! note "Node version"
    Local and CI both run Node 22.x, so `local build === CI build === release build`.

## Main Customized Gradebook Workflow

### Development Workflow

**For testing changes:**

```bash
# 1. Make changes to src/**/*.js files
# 2. Build and deploy to the dev release
npm run deploy:dev
```

**What happens:**

- Builds `src/customGradebookInit.js` → `dist/dev/customGradebookInit.js`, unminified with source maps
- Uploads the bundle and its `.map` to the `dev` GitHub Release, overwriting the previous build
- Also builds and uploads the **mobile** dev bundle in the same run (see [Mobile Module](#mobile-module-workflow))
- Available immediately at `.../releases/download/dev/customGradebookInit.js`

No clean-tree check runs on dev — you can deploy uncommitted work for testing.

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

1. Refuses to run if the working tree is dirty; warns if you are not on `main`
2. Bumps the version in `package.json`
3. Commits with the bare version number as the message (e.g. `1.2.1`)
4. Creates an annotated git tag (e.g. `v1.2.1`)
5. Pushes commits and tags (`git push --follow-tags`)
6. Builds the production bundle — minified, no source maps
7. Creates the GitHub Release and uploads the bundle
8. `update-version-manifest.yml` regenerates `versions.json`

**To re-publish the current version without bumping:**

```bash
npm run redeploy:prod
```

This rebuilds and re-uploads to the existing `vX.Y.Z` release. It also refuses to run on a dirty tree.

### Build Process

The main CG uses **esbuild** to bundle multiple source files:

**Input:** `src/customGradebookInit.js` (entry point, bundles `src/**/*.js`)
**Output:** `dist/dev/customGradebookInit.js` or `dist/prod/customGradebookInit.js`

| | Dev | Prod |
|---|---|---|
| Minified | No | Yes |
| Source map | Yes | No |
| Format / target | IIFE / es2017 | IIFE / es2017 |

Each build injects `ENV_NAME`, `ENV_DEV`, `ENV_PROD`, and a `BUILD_VERSION` string (timestamp + short git hash) via esbuild `define`.

## Mobile Module Workflow

The Mobile Module (Parent Mastery) is an esbuild bundle from `src/masteryDashboard/mobileInit.js`,
versioned independently in `mobile/package.json`.

### Development Workflow

```bash
npm run deploy:dev
```

The mobile dev bundle is built and uploaded as part of the standard dev deploy — desktop and mobile
ship together. Output goes to `dist/mobile/dev/mobileInit.js` and uploads to the `mobile-dev`
release, available at `.../releases/download/mobile-dev/mobileInit.js`.

To re-publish the current mobile version without bumping:

```bash
npm run redeploy:mobile
```

### Production Release Workflow

```bash
# Patch release (0.1.1 → 0.1.2)
npm run release:mobile:patch

# Minor release (0.1.1 → 0.2.0)
npm run release:mobile:minor

# Major release (0.1.1 → 1.0.0)
npm run release:mobile:major
```

**What happens:**

1. Refuses to run if the working tree is dirty
2. Bumps the version in `mobile/package.json`
3. Commits `Bump mobile version to X.Y.Z`
4. Creates an annotated git tag (e.g. `mobile-v0.1.2`)
5. Pushes commits and tags
6. Builds `dist/mobile/prod/mobileInit.js` — minified
7. Creates the GitHub Release and uploads the bundle
8. `update-mobile-version-manifest.yml` regenerates the mobile version tracks

## GitHub Actions Workflows

### `update-version-manifest.yml` / `update-mobile-version-manifest.yml`

**Trigger:** Manual (`workflow_dispatch`) or auto-triggered after a release

**What they do:**

1. Scan git tags (`v*` and `mobile-v*`)
2. Generate `versions.json` with version tracks
3. Deploy to GitHub Pages with the landing page and `button_directions.html`

**Command:**

```bash
gh workflow run update-version-manifest.yml
```

### `dev-release.yml` — currently inactive

!!! warning "Not wired up"
    This workflow's `push: branches: [main]` trigger is commented out, so it only runs on manual
    dispatch — and a dispatch fails, because it calls `npm run build:dev`, which is not a defined
    script. Dev publishing is local-only via `npm run deploy:dev`.

    To reactivate: add a `build:dev` script (or change the step to run `deploy:dev`) and uncomment
    the `push` trigger.

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

- Loaders request a track (e.g. `v1.2-latest`)
- `versions.json` resolves to a specific version (e.g. `v1.2.0`)
- The loader fetches that version from GitHub Releases

See [Versioning](versioning.md) for details.

## Summary

| Task | Main CG | Mobile |
|------|---------|--------|
| **Dev changes** | `npm run deploy:dev` | Covered by `npm run deploy:dev` |
| **Re-deploy current version** | `npm run redeploy:prod` | `npm run redeploy:mobile` |
| **Prod release** | `npm run release:minor` | `npm run release:mobile:minor` |
| **Build process** | esbuild (inside deploy/release scripts) | esbuild (inside deploy/release scripts) |
| **Entry point** | `src/customGradebookInit.js` | `src/masteryDashboard/mobileInit.js` |
| **Tag format** | `v1.2.0` | `mobile-v0.1.1` |
| **Dev URL** | `.../dev/customGradebookInit.js` | `.../mobile-dev/mobileInit.js` |