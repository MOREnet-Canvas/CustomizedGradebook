/**
 * CustomizedGradebook - Mobile Loader
 *
 * Paste into: Account → Themes → Mobile → JavaScript
 *
 * CONFIGURATION:
 * - "auto-patch" = Auto-updates to latest patch (recommended)
 * - "mobile-dev" = Latest dev build
 * - "mobile-v1.0.0" = Specific version
 */

(function() {
    'use strict';

    // ========== CONFIGURATION ==========
    const VERSION = "auto-patch";        // or "mobile-dev" or "mobile-v1.0.0"
    const TRACK = "mobile-v1.0-latest";  // for auto-patch only
    const FALLBACK = "mobile-v1.0.0";    // if auto-patch fails

    // ========== LOADER ==========
    if (window.CG_MOBILE_LOADED) return;
    window.CG_MOBILE_LOADED = true;

    function load(version) {
        const script = document.createElement("script");
        script.src = `https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/download/${version}/mobileInit.js` +
                     (version === "mobile-dev" ? `?v=${Date.now()}` : "");
        document.head.appendChild(script);
    }

    if (VERSION === "auto-patch") {
        fetch("https://morenet-canvas.github.io/CustomizedGradebook/mobile-versions.json")
            .then(r => r.json())
            .then(m => load(m[TRACK] || FALLBACK))
            .catch(() => load(FALLBACK));
    } else {
        load(VERSION);
    }
})();