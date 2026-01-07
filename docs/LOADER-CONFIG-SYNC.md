# Loader Configuration Synchronization Guide

## Overview

The loader files (`upload_dev.js` and `upload_production.js`) contain **duplicated configuration constants** from `src/config.js`. This document explains why this duplication exists and how to maintain synchronization.

---

## Why Duplication Exists

### Problem
- Loader files are injected directly into Canvas (not bundled by esbuild)
- Configuration constants need to be available **before** the main bundle loads
- Allows runtime inspection and override via `window.CG_CONFIG`

### Solution
- Inline all configuration constants directly in both loader files
- Expose them globally on `window.CG_CONFIG`
- Accept the maintenance burden of manual synchronization

---

## Files That Must Be Kept in Sync

When you update configuration constants, you **MUST** update all three files:

1. **`src/config.js`** - Source of truth (ES6 module exports)
2. **`upload_dev.js`** - DEV loader (inlined constants)
3. **`upload_production.js`** - PROD loader (inlined constants)

---

## How to Update Configuration

### Step 1: Update src/config.js
Make your changes to the configuration constants in `src/config.js`.

### Step 2: Update upload_dev.js
1. Open `upload_dev.js`
2. Find the `window.CG_CONFIG` object (around line 34)
3. Update the corresponding constant(s) to match `src/config.js`
4. Update the "Last synced" date comment

### Step 3: Update upload_production.js
1. Open `upload_production.js`
2. Find the `window.CG_CONFIG` object (around line 34)
3. Update the corresponding constant(s) to match `src/config.js`
4. Update the "Last synced" date comment

### Step 4: Verify Synchronization
Run the verification checklist below to ensure all files are in sync.

---

## Verification Checklist

After updating configuration, verify synchronization:

- [ ] All boolean flags match across all 3 files
- [ ] All numeric thresholds match across all 3 files
- [ ] All string labels match across all 3 files
- [ ] `OVERRIDE_SCALE` function is identical in all 3 files
- [ ] `OUTCOME_AND_RUBRIC_RATINGS` array is identical in all 3 files
- [ ] `EXCLUDED_OUTCOME_KEYWORDS` array is identical in all 3 files
- [ ] "Last synced" date is updated in both loader files

---

## Configuration Constants Reference

### Feature Flags
- `ENABLE_STUDENT_GRADE_CUSTOMIZATION` (boolean)
- `REMOVE_ASSIGNMENT_TAB` (boolean)
- `ENABLE_OUTCOME_UPDATES` (boolean)
- `ENABLE_GRADE_OVERRIDE` (boolean)

### Performance
- `PER_STUDENT_UPDATE_THRESHOLD` (number)

### Functions
- `OVERRIDE_SCALE` (function: avg => scaled value)

### UI Labels
- `UPDATE_AVG_BUTTON_LABEL` (string)
- `AVG_OUTCOME_NAME` (string)
- `AVG_ASSIGNMENT_NAME` (string)
- `AVG_RUBRIC_NAME` (string)

### Outcome Configuration
- `DEFAULT_MAX_POINTS` (number)
- `DEFAULT_MASTERY_THRESHOLD` (number)
- `OUTCOME_AND_RUBRIC_RATINGS` (array of objects)

### Filters
- `EXCLUDED_OUTCOME_KEYWORDS` (array of strings)

---

## Testing After Updates

### 1. Build the bundles
```bash
npm run build:dev
npm run build:prod
```

### 2. Test in Canvas (DEV)
1. Inject `upload_dev.js` into Canvas
2. Open browser console
3. Verify: `window.CG_CONFIG` shows updated values
4. Verify: Main bundle loads successfully
5. Verify: Application behavior reflects new configuration

### 3. Test in Canvas (PROD)
1. Inject `upload_production.js` into Canvas
2. Open browser console
3. Verify: `window.CG_CONFIG` shows updated values
4. Verify: Main bundle loads successfully
5. Verify: Application behavior reflects new configuration

---

## Common Mistakes to Avoid

❌ **Updating only src/config.js** - Loader files will have stale values  
❌ **Updating only one loader file** - DEV and PROD will be out of sync  
❌ **Forgetting to update the "Last synced" date** - Makes it hard to track when sync occurred  
❌ **Typos in constant names** - Will cause runtime errors  
❌ **Mismatched data types** - Will cause unexpected behavior  

---

## Future Improvements

Potential solutions to eliminate manual synchronization:

1. **Build-time injection**: Modify esbuild config to generate loader files from src/config.js
2. **Separate config endpoint**: Host config.json on GitHub and fetch it dynamically
3. **Template-based generation**: Use a template + script to generate loader files automatically

For now, manual synchronization is the simplest and most reliable approach.

---

## Last Updated
2026-01-07

