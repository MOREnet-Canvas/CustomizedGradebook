# SpeedGrader Module

## Overview

The SpeedGrader module provides automatic activation of the grading dropdown in Canvas SpeedGrader. This allows teachers to manually override grades even when Canvas disables the dropdown due to various conditions (e.g., assignment settings, grading schemes, etc.).

## Purpose

Canvas SpeedGrader sometimes disables the grading dropdown (`#grading-box-extended`) based on assignment configuration or grading state. This module automatically removes the `disabled`, `readonly`, and `aria-disabled` attributes to enable manual grade entry.

## Architecture

### Module Structure

```
src/speedgrader/
├── gradingDropdown.js    # Main module - auto-activates grading dropdown
└── README.md            # This file
```

### Key Features

- **Always Active**: No configuration flag needed - feature is always enabled on SpeedGrader pages
- **Automatic Activation**: Removes disabled/readonly attributes on page load
- **Dynamic Monitoring**: MutationObserver watches for DOM changes and re-activates dropdown
- **SPA Support**: Handles Canvas SPA navigation and dynamic content updates
- **Graceful Handling**: Fails silently if dropdown element not found

## How It Works

### Initialization Flow

1. `main.js` detects SpeedGrader page (`/speed_grader` in URL)
2. Calls `initSpeedGraderDropdown()`
3. Attempts initial activation of grading dropdown
4. Sets up MutationObserver to watch for changes
5. Re-activates dropdown whenever it's added or modified

### Activation Process

The module removes these attributes from `#grading-box-extended`:
- `disabled` - HTML disabled attribute
- `readonly` - HTML readonly attribute
- `aria-disabled` - ARIA accessibility attribute
- `ui-state-disabled` - jQuery UI disabled class

### MutationObserver Monitoring

The observer watches for:
- **New nodes added**: Activates dropdown when it appears in DOM
- **Attribute changes**: Re-activates if Canvas re-disables the dropdown
- **Subtree changes**: Handles nested DOM updates

## Integration

### Main Entry Point

The module is integrated in `src/main.js`:

```javascript
import { initSpeedGraderDropdown } from "./speedgrader/gradingDropdown.js";

// SpeedGrader functionality
if (isSpeedGraderPage()) {
    initSpeedGraderDropdown();
}
```

### Page Detection

SpeedGrader pages are detected using:
```javascript
function isSpeedGraderPage() {
    return window.location.pathname.includes('/speed_grader');
}
```

## Logging

The module uses the project's standard logging system:

- **INFO**: Initialization and major events
- **DEBUG**: Activation events
- **TRACE**: Detailed observer activity

Enable debug logging with URL parameter:
```
https://canvas.example.com/courses/123/gradebook/speed_grader?debug=true
```

## Use Cases

### When This Module Helps

1. **Assignment with rubric**: Canvas may disable dropdown when rubric grading is active
2. **Complete/Incomplete grading**: Dropdown disabled for pass/fail assignments
3. **External tool assignments**: LTI assignments may disable manual grading
4. **Grading scheme conflicts**: Certain grading schemes disable the dropdown

### What Teachers Can Do

With this module active, teachers can:
- Manually override grades even when Canvas disables the dropdown
- Enter custom grades regardless of assignment configuration
- Work around Canvas limitations for special grading scenarios

## Technical Details

### Target Element

- **Element ID**: `grading-box-extended`
- **Element Type**: `<select>` dropdown
- **Location**: SpeedGrader right sidebar, grading section

### Attributes Removed

```javascript
gradingBox.removeAttribute('disabled');
gradingBox.removeAttribute('readonly');
gradingBox.removeAttribute('aria-disabled');
gradingBox.classList.remove('ui-state-disabled');
```

### Observer Configuration

```javascript
observer.observe(document.body, {
    childList: true,      // Watch for nodes being added/removed
    subtree: true,        // Watch all descendants
    attributes: true,     // Watch for attribute changes
    attributeFilter: ['disabled', 'readonly', 'aria-disabled', 'class']
});
```

## Cleanup

The module provides a cleanup function for testing:

```javascript
import { cleanupSpeedGraderDropdown } from './speedgrader/gradingDropdown.js';

// Cleanup (disconnects observer, resets state)
cleanupSpeedGraderDropdown();
```

## Future Enhancements

Potential improvements:
- Add configuration flag to enable/disable this feature
- Support additional SpeedGrader UI elements
- Add diagnostic function similar to dashboard module
- Expose activation status on `window.CG` for debugging

## Related Modules

- **Dashboard Module** (`src/dashboard/`) - Similar MutationObserver pattern
- **Gradebook Module** (`src/gradebook/`) - Teacher-side grading functionality
- **Logger** (`src/utils/logger.js`) - Logging system used by this module

