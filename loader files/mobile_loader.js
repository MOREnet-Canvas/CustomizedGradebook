/**
 * CustomizedGradebook - Mobile Loader
 * 
 * This loader should be pasted into the Canvas Mobile Theme (Account → Themes → Mobile)
 * It loads the Parent Mastery module for the Canvas Parent mobile app.
 * 
 * CONFIGURATION:
 * - Change MOBILE_VERSION to switch between dev and stable versions
 * - "mobile-dev" = Latest development build (auto-updated)
 * - "mobile-v0.1.1" = Specific stable release
 * 
 * INSTALLATION:
 * 1. Go to Account → Themes → Mobile
 * 2. Click "Edit" on your mobile theme
 * 3. Paste this entire file into the JavaScript section
 * 4. Click "Save"
 */

(function() {
    'use strict';
    
    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    
    // Change this to switch between dev and stable versions
    const MOBILE_VERSION = "mobile-dev"; // or "mobile-v0.1.1" for stable
    
    // ========================================================================
    // LOADER
    // ========================================================================
    
    // Prevent duplicate loading
    if (window.CG_MOBILE_LOADED) {
        console.log("[CG Mobile] Already loaded; skipping");
        return;
    }
    window.CG_MOBILE_LOADED = true;
    
    console.log(`[CG Mobile] Loading version: ${MOBILE_VERSION}`);

    // Create and inject script tag
    const script = document.createElement("script");
    script.id = "cg-mobile-bundle";

    // Add cache busting for dev builds to ensure latest version is always loaded
    const cacheBuster = MOBILE_VERSION === "mobile-dev" ? `?v=${Date.now()}` : "";
    script.src = `https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/download/${MOBILE_VERSION}/mobile_test.js${cacheBuster}`;

    script.onload = function() {
        console.log(`[CG Mobile] Loaded successfully (${MOBILE_VERSION})`);
    };
    
    script.onerror = function() {
        console.error(`[CG Mobile] Failed to load from GitHub Release: ${MOBILE_VERSION}`);
        console.error("[CG Mobile] Check that the release exists and the file is uploaded");
    };
    
    document.head.appendChild(script);
    
})();