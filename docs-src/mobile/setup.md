# Mobile Module Setup Guide

This guide explains how to configure courses to display the Parent Mastery Dashboard in the Canvas Parent app.

## Prerequisites

- Mobile loader installed (see [Installation Guide](installation.md))
- Canvas Admin or Teacher access to the course
- Course using standards-based grading (outcomes)

## Overview

To enable the Parent Mastery Dashboard for a course, you need to:

1. Create a "Mastery Dashboard" page in the course
2. Add a button to the course Front Page (or use the loader)

If you installed the mobile loader, the button will appear automatically once the Mastery Dashboard page exists.

## Step 1: Get the Course ID

1. Open the course in Canvas
2. Look at the URL in your browser:
   ```
   https://canvas.example.com/courses/38297
   ```
3. The number after `/courses/` is the **Course ID** (e.g., `38297`)

## Step 2: Create the Mastery Dashboard Page

1. In the course, go to **Pages**
2. Click **+ Page**
3. Set the page title: **Mastery Dashboard**
4. Click **HTML Editor** (top right)
5. Paste this code:
   ```html
   <div id="parent-mastery-root"></div>
   ```
6. Click **Save & Publish**

!!! note "Page Title Must Match"
    The page must be titled exactly **"Mastery Dashboard"** for the mobile module to find it.

## Step 3: Verify the Button Appears

If you installed the mobile loader:

1. Open the Canvas Parent app
2. Log in as a parent/observer
3. Navigate to the course
4. Open the **Front Page**
5. You should see a **"View Mastery Dashboard"** button at the top

## Alternative: Manual Button Code

If you prefer not to use the loader, you can add the button manually to each course:

### Generate Button Code

1. Go to [Button Setup Tool](https://morenet-canvas.github.io/CustomizedGradebook/button_directions.html)
2. Enter the Course ID
3. Copy the generated code

### Add to Front Page

1. Go to **Pages → Front Page**
2. Click **Edit**
3. Switch to **HTML Editor**
4. Paste the generated code at the very top
5. Click **Save & Publish**

## How It Works

### The Button

The button is injected into the Front Page and:

- Only appears for parent/observer accounts
- Links to the Mastery Dashboard page with `?cg_web=1` parameter
- Uses relative URLs (works in test, beta, and production)

### The Dashboard

When a parent clicks the button:

1. Canvas loads the Mastery Dashboard page
2. The mobile module detects the `#parent-mastery-root` div
3. The module fetches student mastery data from Canvas API
4. The dashboard renders with color-coded mastery indicators

## Customization

### Button Text

To change the button text, edit the Front Page HTML:

```html
<a href="..." class="btn">Custom Button Text</a>
```

### Button Styling

The button uses Canvas's default `.btn` class. You can add custom CSS in the Mobile Theme.

### Conditional Display

The button automatically hides for:

- Students
- Teachers
- Admins

It only shows for parent/observer accounts.

## Troubleshooting

### Button Not Appearing

**Check:**
- Mobile loader is installed correctly
- "Mastery Dashboard" page exists in the course
- You're logged in as a parent/observer (not student/teacher)
- Front Page exists and is published

**Console errors:**
- Open mobile browser console
- Look for `[CG Mobile]` messages
- Check for JavaScript errors

### Dashboard Not Loading

**Check:**
- The Mastery Dashboard page has `<div id="parent-mastery-root"></div>`
- The URL includes `?cg_web=1` parameter
- The course has outcomes/standards configured
- The student is enrolled in the course

### No Data Showing

**Check:**
- Course uses standards-based grading (outcomes)
- Student has submitted assignments with outcome scores
- Observer is linked to the student account
- Outcomes are published and visible

## Next Steps

- [Workflows](../development/workflows.md) - Learn about dev/prod release workflows
- [Versioning](../development/versioning.md) - Understand version tracks and updates

