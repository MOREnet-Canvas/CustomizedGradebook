# Mobile Module Installation

This guide explains how to install the Customized Gradebook Mobile Module using the loader file.

## Prerequisites

- Canvas Admin access
- Access to Account → Themes → Mobile
- GitHub access to download the loader file

## Installation Methods

There are two ways to use the mobile module:

1. **Loader File (Recommended)** - Install once, works for all courses
2. **Manual Button Code** - Add button code to each course individually

This guide covers the **loader file method**.

## Step 1: Download the Loader

Download the mobile loader file from GitHub:

**URL:** [mobile_loader.js](https://github.com/MOREnet-Canvas/CustomizedGradebook/blob/main/loader%20files/mobile_loader.js)

1. Click the link above
2. Click **Raw** button
3. Right-click → **Save As** → `mobile_loader.js`

Or copy the entire file contents directly from GitHub.

## Step 2: Install in Canvas Mobile Theme

1. Log in to Canvas as an admin
2. Go to **Account → Themes → Mobile**
3. Click **Edit** on your mobile theme
4. Scroll to the **JavaScript** section
5. Paste the entire contents of `mobile_loader.js`
6. Click **Save**

## Step 3: Choose Version

The loader file has a configuration variable at the top:

```javascript
const MOBILE_VERSION = "mobile-dev"; // or "mobile-v0.1.1" for stable
```

### Version Options

| Version | Description | When to Use |
|---------|-------------|-------------|
| `mobile-dev` | Latest development build | Testing new features, rapid iteration |
| `mobile-v0.1.1` | Specific stable release | Production use, stable environment |

**For production:** Change to a specific version like `"mobile-v0.1.1"`

**For testing:** Use `"mobile-dev"` to get automatic updates

## Step 4: Verify Installation

1. Open the Canvas Parent app on a mobile device
2. Log in as a parent/observer
3. Navigate to a course Front Page
4. Open browser console (if testing in mobile browser)
5. Look for: `[CG Mobile] Loaded successfully`

## Switching Versions

To switch between dev and stable versions:

1. Go to **Account → Themes → Mobile**
2. Click **Edit**
3. Find the `MOBILE_VERSION` line
4. Change the value:
   - `"mobile-dev"` for latest dev build
   - `"mobile-v0.1.1"` for stable release
5. Click **Save**

The change takes effect immediately (may need to refresh the app).

## Troubleshooting

### Loader Not Working

**Check console for errors:**
- `[CG Mobile] Failed to load` - GitHub Release may not exist
- `[CG Mobile] Already loaded` - Loader is running multiple times (check for duplicates)

**Verify the release exists:**
- Go to [GitHub Releases](https://github.com/MOREnet-Canvas/CustomizedGradebook/releases)
- Check that `mobile-dev` or `mobile-v0.1.1` release exists
- Verify `mobile_test.js` is attached to the release

### Button Not Appearing

The button only appears when:
- User is logged in as a parent/observer
- Course has a Front Page
- Course has a "Mastery Dashboard" page (see [Setup Guide](setup.md))

## Next Steps

- [Setup Guide](setup.md) - Configure courses to show the mastery dashboard
- [Versioning](../development/versioning.md) - Learn about version tracks and auto-patch system

