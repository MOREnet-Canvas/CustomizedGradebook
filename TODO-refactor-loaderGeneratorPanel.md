# TODO: Refactor Loader Generator Panel

## Current Issue

The `loaderGeneratorPanel.js` module currently renders **4 separate panels** from a single function (`renderLoaderGeneratorPanel()`):

1. **📦 Customized Gradebook Version** - Version selector dropdown
2. **⚙️ Configuration Settings** - All feature flags and configuration options
3. **Grading Schemes** - Grid of available grading schemes
4. **Generate Combined Loader (A+B+C Model)** - Main loader generation panel with textareas

This creates confusion because:
- The visual panel order doesn't match the code structure
- One function call creates multiple panels
- It's harder to reorder panels independently
- The module is very large (1700+ lines)

## Proposed Refactoring

### **Split into 4 separate panel modules:**

1. **`versionSelectorPanel.js`**
   - Renders the version selector dropdown
   - Fetches available versions from GitHub Pages manifest
   - Handles version selection and highlighting

2. **`configurationSettingsPanel.js`**
   - Renders all configuration settings (feature flags, labels, ratings, etc.)
   - Fetches Final Grade Override feature flag status
   - Handles Enable Grade Override tooltip and disabled state
   - Returns controls object for use by generator panel

3. **`gradingSchemesPanel.js`** ✅ **Already separate!**
   - Already extracted to its own module
   - Just needs to be called directly from `dashboardShell.js` instead of from loader generator

4. **`loaderGeneratorPanel.js`** (refactored)
   - Only handles the "Generate Combined Loader" panel
   - Accepts version dropdown and controls as parameters
   - Manages textareas (A, B, C, output)
   - Handles auto-load, generation, download, copy

### **Benefits:**

- ✅ Each panel is independent and can be reordered easily
- ✅ Smaller, more focused modules (easier to maintain)
- ✅ Visual panel order matches code structure
- ✅ Clearer separation of concerns
- ✅ Easier to test individual panels

### **Implementation Steps:**

1. Extract `createVersionSelector()` → `versionSelectorPanel.js`
   - Export `renderVersionSelectorPanel(container)`
   - Return `{ versionDropdown }` for use by generator

2. Extract `createConfigurationPanel()` → `configurationSettingsPanel.js`
   - Export `renderConfigurationSettingsPanel(container)`
   - Return `{ controls }` for use by generator

3. Update `gradingSchemesPanel.js`
   - Already separate, just call directly from `dashboardShell.js`

4. Refactor `loaderGeneratorPanel.js`
   - Remove version selector and configuration panel code
   - Accept `versionDropdown` and `controls` as parameters
   - Focus only on loader generation logic

5. Update `dashboardShell.js`
   - Call each panel renderer separately
   - Pass dependencies between panels as needed

### **Example New Structure:**

```javascript
// dashboardShell.js
async function renderPanels(container, ctx) {
    // Panel 1: Summary
    renderSummaryPanel(container, ctx);

    // Panel 2: Custom Grade Status
    renderCustomGradeStatusPanel(container, ctx);

    // Panel 3: Account Filter
    renderAccountFilterPanel(container, ctx);

    // Panel 4: Version Selector
    const { versionDropdown } = renderVersionSelectorPanel(container);

    // Panel 5: Configuration Settings
    const { controls } = await renderConfigurationSettingsPanel(container);

    // Panel 6: Grading Schemes
    await renderGradingSchemesPanel(container);

    // Panel 7: Loader Generator (uses versionDropdown and controls)
    renderLoaderGeneratorPanel(container, versionDropdown, controls);

    // Panel 8: Theme CSS Editor
    renderThemeCssEditorPanel(container);
}
```

## Priority

**Medium** - Not urgent, but would improve code organization and maintainability.

## Notes

- This refactoring should be done carefully to avoid breaking existing functionality
- All panels should maintain their current behavior
- The sticky action panel and change notification should continue to work
- Auto-load functionality should be preserved

