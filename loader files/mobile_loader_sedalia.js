////////////////////////////////////////////////////
// DESIGNPLUS MOBILE APP                          //
////////////////////////////////////////////////////
// Legacy
(function () {
    function loadScript(url, scriptID, callback) {
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.id = scriptID;
        if (script.readyState) { //IE
            script.onreadystatechange = function () {
                if (script.readyState == "loaded" || script.readyState == "complete") {
                    script.onreadystatechange = null;
                    callback();
                }
            };
        } else { //Others
            script.onload = function () {
                callback();
            };
        }
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    }
    var today = new Date(),
        appScript = document.getElementById('dt_app_script');
    if (appScript === null && window.jQuery === undefined) {
        loadScript("https://designtools.ciditools.com/js/tools_liveView_app.js?" + today.getDate(), 'dt_app_script', function () {
            console.log('DP Live View JS Ran');
        });
    }
})();

// New
DpConfig = {};
var script = document.createElement("script");
let id = Date.now();
script.src = `https://designplus.ciditools.com/js/mobile.js?${id}`;
document.body.appendChild(script);
////////////////////////////////////////////////////
// END DESIGNPLUS MOBILE APP                      //
////////////////////////////////////////////////////

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