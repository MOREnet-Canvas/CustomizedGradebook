# Mobile Module Overview

The **Customized Gradebook Mobile Module** adds Parent Mastery functionality to the Canvas Parent mobile app.

## What is the Mobile Module?

The mobile module is a lightweight JavaScript component that:

- Adds a **"View Mastery Dashboard"** button to course Front Pages in the Canvas Parent app
- Displays student mastery data for standards-based grading courses
- Works exclusively in the Canvas Parent mobile app (iOS/Android)
- Operates independently from the main Customized Gradebook bundle

## Key Features

### Parent Mastery Dashboard

- **Visual mastery tracking** - Color-coded indicators for student progress on learning standards
- **Standards-based grading** - Shows mastery levels for each outcome/standard
- **Mobile-optimized** - Designed specifically for the Canvas Parent app interface
- **Observer-only** - Only displays for parent/observer accounts

### Easy Installation

- **Loader-based** - Install once in Canvas Mobile Theme, works for all courses
- **Version control** - Switch between dev and stable versions easily
- **Auto-updates** - Dev version updates automatically when you deploy changes

## Use Cases

### For Parents/Observers

- Check student progress on learning standards from mobile device
- View mastery levels for all outcomes in a course
- Monitor student achievement on standards-based assignments

### For Administrators

- Provide parents with mobile access to mastery data
- Enable standards-based grading visibility in Parent app
- Customize which courses show the mastery dashboard

## Architecture

The mobile module is:

- **Standalone** - Single JavaScript file, no dependencies
- **IIFE format** - Self-contained, doesn't pollute global scope
- **No build process** - Edit and deploy directly, no compilation needed
- **Lightweight** - Minimal footprint for mobile performance

## Versioning

The mobile module uses **independent versioning** from the main Customized Gradebook:

- **Main CG**: Currently v1.2.0
- **Mobile Module**: Currently v0.1.1

This allows the mobile module to evolve at its own pace without affecting the main bundle.

## Next Steps

- [Installation Guide](installation.md) - Install the mobile loader
- [Setup Guide](setup.md) - Configure courses for Parent Mastery

