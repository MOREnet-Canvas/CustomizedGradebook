# Mastery Dashboard Creation Module

## Overview

The Mastery Dashboard Creation module provides a button in course settings that allows teachers to quickly set up the Mastery Dashboard for parent/observer mobile access.

## Purpose

This module creates:
1. **Mastery Dashboard page** (`/courses/:id/pages/mastery-dashboard`) with `<div id="parent-mastery-root"></div>`
2. **Front page button** that links to the Mastery Dashboard (for mobile parent app)

## Architecture

### Module Structure

```
src/masteryDashboardCreation/
├── masteryDashboardCreationInit.js    # Main entry point
├── buttonInjection.js                 # Button injection logic
└── README.md                          # This file
```

### Integration

The module is initialized in `src/customGradebookInit.js` when on course settings pages.

### Button Injection

The button is injected into the course settings right sidebar (`#right-side`) using a polling strategy similar to the gradebook button injection.

## Features

- **Automatic page creation**: Creates mastery dashboard page if it doesn't exist
- **Front page handling**: Updates existing front page or creates new one
- **Idempotent**: Safe to run multiple times (won't duplicate content)
- **Theme-aware**: Button uses Canvas theme colors via `makeButton()` utility
- **Error handling**: Graceful error handling with user-friendly alerts

## Usage

1. Navigate to course settings (`/courses/:id/settings`)
2. Look for "🎯 Create Mastery Dashboard Button" in the right sidebar
3. Click the button
4. Refresh the course home page to see the new button

## Technical Details

### Page Detection

Uses `isCourseSettingsPage()` from `src/utils/pageDetection.js`:
- Matches: `/courses/:id/settings`

### API Service

Uses `src/services/pageService.js` for Canvas Pages API operations:
- `getFrontPage()` - Get course front page
- `createPage()` - Create new wiki page
- `updatePage()` - Update existing wiki page

### Button Styling

Uses `makeButton()` from `src/ui/buttons.js` with `type: 'primary'` to match Canvas theme colors.

## Dependencies

- `src/utils/logger.js` - Logging
- `src/ui/buttons.js` - Button creation
- `src/utils/canvas.js` - Course ID extraction
- `src/utils/canvasApiClient.js` - Canvas API client
- `src/services/pageService.js` - Page API operations
- `src/utils/errorHandler.js` - Error handling
- `src/utils/pageDetection.js` - Page detection

## Mobile Integration

This module sets up the infrastructure for the mobile parent mastery dashboard. The actual mastery dashboard rendering is handled by a separate mobile module that runs in the Canvas Parent app.

## Error Handling

The module handles common errors gracefully:
- **Page already exists**: Logs info message and continues
- **Front page not found**: Creates new front page
- **API errors**: Shows user-friendly alert with error details
- **Missing course ID**: Shows alert and aborts operation

