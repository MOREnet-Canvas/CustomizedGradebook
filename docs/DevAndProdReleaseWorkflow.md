# CustomizedGradebook – Dev & Prod Build / Release Workflow

This document describes how development and production builds are created, published, and loaded by Canvas.

---

## High-level overview

This project uses **two separate delivery paths**:

- **DEV** → rolling GitHub Release (`dev`)
- **PROD** → versioned GitHub Releases (`vX.Y.Z`)

Canvas loaders pull **directly from GitHub Releases**, not from GitHub Pages.  
This avoids long Pages build delays and allows instant updates.

---

## DEV workflow (commit-driven)

### Purpose
Fast iteration and testing in Canvas while keeping a clear commit history.

### How it works
1. Make code changes locally
2. Commit and push to `main`
3. GitHub Actions workflow (`dev-release.yml`) runs:
    - installs dependencies
    - runs `npm run build:dev`
    - uploads build artifacts to the **`dev` GitHub Release**
        - `dist/dev/customGradebookInit.js`
        - `dist/dev/customGradebookInit.js.map`
4. Canvas **DEV loader** pulls from:
https://github.com/morenet-canvas/CustomizedGradebook/releases/download/dev/customGradebookInit.js


### Triggers
The dev workflow runs on:
- `push` to `main`
- `workflow_dispatch` (manual re-run without a new commit)

### Result
- Every commit can be tested immediately in Canvas
- Dev release is a rolling channel (assets are overwritten)
- Source maps are available for debugging

---

## PROD workflow (manual, guarded)

### Purpose
Safe, traceable, versioned production releases.

### How it works
1. Ensure working tree is clean (no uncommitted changes)
2. Bump version in `package.json` (e.g. `1.0.1`)
3. Commit and push the version bump
4. Run locally: `npm run deploy:prod`
5. The script:
   - runs npm run build:prod
   - creates a GitHub Release vX.Y.Z (if it doesn’t exist)
   - uploads dist/prod/customGradebookInit.js

```bash
npm version patch     # or minor / major
git push --follow-tags
npm run deploy:prod
```

### Safety guards
- deploy:prod refuses to run if git has uncommitted changes
- Production releases are immutable and versioned

### Canvas PROD loader
Pins to a specific version tag:
https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/download/vX.Y.Z/customGradebookInit.js

- No cache-busting is used in production.

___

## Local scripts

### Build scripts
`npm run build:dev`
`npm run build:prod`

### Deploy scripts
`npm run deploy:dev    # local build + upload to dev release`
`npm run deploy:prod   # guarded production release`


Note: DEV is usually published via GitHub Actions, not deploy:dev.
deploy:dev is still available for local testing if needed.

---
## Node version alignment

- Local Node: 22.x
- GitHub Actions Node: 22.x

This guarantees:

```
local build === CI build === release build
```

## Mental model (summary)
### DEV
edit → commit → push
   → dev-release.yml runs
   → dev GitHub Release updated
   → Canvas DEV loads immediately

### PROD
version bump → commit → push
               → npm run deploy:prod
               → vX.Y.Z GitHub Release
               → Canvas PROD loads pinned version

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