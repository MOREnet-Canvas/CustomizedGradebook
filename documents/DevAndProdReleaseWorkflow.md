# CustomizedGradebook – Dev & Prod Build / Release Workflow

This document describes how development and production builds are created, published, and loaded by Canvas.

---

## High-level overview

This project uses **two separate delivery paths**:

- **DEV** → rolling GitHub Releases (`dev`, `mobile-dev`)
- **PROD** → versioned GitHub Releases (`vX.Y.Z`, `mobile-vX.Y.Z`)

Canvas loaders pull **directly from GitHub Releases**, not from GitHub Pages.
This avoids long Pages build delays and allows instant updates.

All builds run **locally** via scripts in `buildScripts/`. Each script bundles with esbuild
itself and then uploads through the `gh` CLI — there is no standalone `build` npm script.

---

## DEV workflow

### Purpose
Fast iteration and testing in Canvas.

### How it works
1. Make code changes locally
2. Run `npm run deploy:dev`
3. The script (`buildScripts/deploy-dev.js`):
   - builds `src/customGradebookInit.js` → `dist/dev/customGradebookInit.js` (unminified, with source map)
   - uploads the bundle and map to the **`dev`** release (`--clobber`)
   - builds `src/masteryDashboard/mobileInit.js` → `dist/mobile/dev/mobileInit.js` (unminified, no map)
   - uploads it to the **`mobile-dev`** release (`--clobber`)
4. Canvas **DEV loaders** pull from:

```
https://github.com/morenet-canvas/CustomizedGradebook/releases/download/dev/customGradebookInit.js
https://github.com/morenet-canvas/CustomizedGradebook/releases/download/mobile-dev/mobileInit.js
```

Both desktop and mobile dev bundles ship together — one command covers both.

### Result
- Any working-tree state can be tested immediately in Canvas (no clean-tree check on dev)
- Dev releases are rolling channels (assets are overwritten)
- Source maps are available for desktop debugging

### CI status

`.github/workflows/dev-release.yml` exists but is **not currently active**:

- its `push: branches: [main]` trigger is commented out — it only runs on `workflow_dispatch`
- it calls `npm run build:dev`, which is not a defined script, so a manual dispatch fails

Dev publishing is therefore local-only via `npm run deploy:dev`. Reactivating CI would require
adding a `build:dev` script (or changing the workflow to run `deploy:dev`) and uncommenting the trigger.

---

## PROD workflow (manual, guarded)

### Purpose
Safe, traceable, versioned production releases.

### New version

```bash
npm run release:patch    # or release:minor / release:major
```

`buildScripts/release.js` does the whole sequence:

1. Refuses to run if the working tree is dirty; warns if you are not on `main`
2. Bumps `package.json` (`npm version <type> --no-git-tag-version`)
3. Commits with the bare version number as the message (e.g. `1.3.8`)
4. Creates an annotated tag `vX.Y.Z`
5. `git push --follow-tags`
6. Builds `dist/prod/customGradebookInit.js` (minified, no source map)
7. `gh release create vX.Y.Z` (skipped if it exists) and uploads the bundle

### Re-deploy an existing version

```bash
npm run redeploy:prod
```

`buildScripts/deploy-prod.js` rebuilds the current `package.json` version and re-uploads to the
existing `vX.Y.Z` release. No version bump, no commit, no tag. Also refuses to run on a dirty tree.

### Canvas PROD loader
Pins to a specific version tag:

```
https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/download/vX.Y.Z/customGradebookInit.js
```

No cache-busting is used in production.

---

## Mobile module

The mobile bundle (Parent Mastery) is versioned independently in `mobile/package.json`.
It is **an esbuild bundle**, not a hand-maintained standalone file — entry point
`src/masteryDashboard/mobileInit.js`.

| Task | Command |
|------|---------|
| Dev build + upload | `npm run deploy:dev` (builds mobile alongside desktop) |
| Re-deploy current version | `npm run redeploy:mobile` |
| New version | `npm run release:mobile:patch` \| `:minor` \| `:major` |

`release-mobile.js` bumps `mobile/package.json`, commits `Bump mobile version to X.Y.Z`, creates
annotated tag `mobile-vX.Y.Z`, pushes, builds `dist/mobile/prod/mobileInit.js` (minified), and
creates/uploads the release.

---

## Local scripts

| Script | Effect |
|--------|--------|
| `npm run deploy:dev` | Build + upload desktop **and** mobile dev bundles |
| `npm run redeploy:prod` | Rebuild + re-upload current desktop version |
| `npm run redeploy:mobile` | Rebuild + re-upload current mobile version |
| `npm run release:patch\|minor\|major` | Version bump → commit → tag → push → build → release |
| `npm run release:mobile:patch\|minor\|major` | Same, for the mobile module |
| `npm test` | Vitest |
| `npm run export:all` | Re-render mermaid diagrams |

There is no `npm run build:dev` or `npm run build:prod`. Building is always a step inside a
deploy or release script.

---

## Version manifests

After a release, GitHub Actions regenerates the version tracks consumed by auto-patch loaders:

- `update-version-manifest.yml` — scans `v*` tags → `versions.json`
- `update-mobile-version-manifest.yml` — scans `mobile-v*` tags

---

## Node version alignment

- Local Node: 22.x
- GitHub Actions Node: 22.x

This guarantees:

```
local build === CI build === release build
```

---

## Mental model (summary)

### DEV
```
edit → npm run deploy:dev
     → dev + mobile-dev GitHub Releases updated
     → Canvas DEV loads immediately
```

### PROD
```
npm run release:patch
     → bump → commit → tag → push
     → build → vX.Y.Z GitHub Release
     → Canvas PROD loads pinned version
```

---

## Why this setup
- No GitHub Pages delays
- Clear separation between dev and prod
- Fast Canvas testing
- Easy rollback (change version tag)
- Strong traceability between code and release

## This setup intentionally decouples:
- source control
- build
- runtime delivery