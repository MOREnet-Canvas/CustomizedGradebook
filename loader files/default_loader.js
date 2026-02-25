/* ========== BEGIN SECTION A: EXTERNAL LOADER ========== */
////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                    DEFAULT CUSTOMIZED GRADEBOOK LOADER                     //
//                                                                            //
//         This is a minimal starter loader for schools getting started      //
//         with the Customized Gradebook Canvas extension.                   //
//                                                                            //
//         To customize this loader:                                         //
//         1. Add your existing Canvas Theme JavaScript above this section   //
//         2. Modify the configuration in Section B below                    //
//         3. Use the CG Admin Dashboard for easier configuration            //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

// Add your existing Canvas Theme JavaScript here (if any)
// This section is intentionally left empty for new installations

////////////////////////////////////////////////////////////////////////////////
//                     END EXTERNAL LOADER SECTION                            //
////////////////////////////////////////////////////////////////////////////////
/* ========== END SECTION A: EXTERNAL LOADER ========== */

/* ========== BEGIN SECTION B: MANAGED CONFIG BLOCK ========== */
/* Generated: 2026-02-25T00:00:00.000Z */
/* Account: Default */
/* Purpose: Version and configuration management for CG loader */
/* Channel: Auto-Patch (Recommended for production use) */

window.CG_MANAGED = window.CG_MANAGED || {};

// Release configuration
window.CG_MANAGED.release = {
    channel: "auto-patch",
    version: "v1.0.3",
    versionTrack: "v1.0-latest",  // Auto-updates to latest patch in this track
    source: "github_release"
};

// Configuration overrides
window.CG_MANAGED.config = {
    // Feature flags
    ENABLE_STUDENT_GRADE_CUSTOMIZATION: true,
    ENABLE_GRADE_OVERRIDE: true,
    ENFORCE_COURSE_OVERRIDE: false,

    // UI labels
    UPDATE_AVG_BUTTON_LABEL: "Update Current Score",
    AVG_OUTCOME_NAME: "Current Score",
    AVG_ASSIGNMENT_NAME: "Current Score Assignment",
    AVG_RUBRIC_NAME: "Current Score Rubric",

    // Outcome configuration
    DEFAULT_MAX_POINTS: 4,
    DEFAULT_MASTERY_THRESHOLD: 3,

    // Rating scale (0-4 point scale with half-point increments)
    OUTCOME_AND_RUBRIC_RATINGS: [
        {
            "description": "Exemplary",
            "points": 4
        },
        {
            "description": "Beyond Target",
            "points": 3.5
        },
        {
            "description": "Target",
            "points": 3
        },
        {
            "description": "Approaching Target",
            "points": 2.5
        },
        {
            "description": "Developing",
            "points": 2
        },
        {
            "description": "Beginning",
            "points": 1.5
        },
        {
            "description": "Needs Partial Support",
            "points": 1
        },
        {
            "description": "Needs Full Support",
            "points": 0.5
        },
        {
            "description": "No Evidence",
            "points": 0
        }
    ],

    // Outcome filtering
    EXCLUDED_OUTCOME_KEYWORDS: []
};

/* ========== END SECTION B: MANAGED CONFIG BLOCK ========== */

/* ========== BEGIN SECTION C: CG LOADER TEMPLATE ========== */
(function () {
    // ========================================================================
    // CG LOADER - CONFIGURATION MERGE
    // ========================================================================

    // Initialize CG_CONFIG if not already present (allows pre-configuration)
    window.CG_CONFIG = window.CG_CONFIG || {};

    // Merge managed config if present (only for undefined keys)
    if (window.CG_MANAGED && window.CG_MANAGED.config) {
        for (const key in window.CG_MANAGED.config) {
            if (window.CG_CONFIG[key] === undefined) {
                window.CG_CONFIG[key] = window.CG_MANAGED.config[key];
            }
        }
    }

    // ========================================================================
    // CG LOADER - GRADES GATE (PREVENT FLASH)
    // ========================================================================

    // Hide the Canvas /grades table ASAP to prevent flash (Theme CSS uses this gate)
    const addGradesGate = () => {
        if (document.body
            && window.location.pathname === '/grades'
            && document.body.classList.contains('responsive_student_grades_page')) {
            document.body.classList.add('cg_processing_grades');
        }
    };

    addGradesGate();
    document.addEventListener('DOMContentLoaded', addGradesGate, { once: true });

    // ========================================================================
    // CG LOADER - SCRIPT INJECTION
    // ========================================================================

    // Read release configuration from managed block
    const release = (window.CG_MANAGED && window.CG_MANAGED.release) || {
        channel: "auto-patch",
        version: "v1.0.3",
        versionTrack: "v1.0-latest",
        source: "github_release"
    };

    // Prevent duplicate loading
    const bundleId = "cg_" + release.channel + "_bundle";
    if (document.getElementById(bundleId)) {
        console.log(`[CG] ${release.channel.toUpperCase()} bundle already loaded; skipping`);
        return;
    }

    // Auto-patch channel: fetch version from manifest
    if (release.channel === "auto-patch" && release.versionTrack) {
        const manifestUrl = "https://morenet-canvas.github.io/CustomizedGradebook/versions.json";
        const fallbackVersion = release.version || "v1.0.3";

        fetch(manifestUrl)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(manifest => {
                const resolvedVersion = manifest[release.versionTrack];
                if (!resolvedVersion) {
                    console.warn(`[CG] Version track "${release.versionTrack}" not found in manifest, using fallback: ${fallbackVersion}`);
                    loadScript(fallbackVersion);
                } else {
                    console.log(`[CG] Resolved ${release.versionTrack} → ${resolvedVersion}`);
                    loadScript(resolvedVersion);
                }
            })
            .catch(error => {
                console.warn(`[CG] Failed to fetch version manifest: ${error.message}, using fallback: ${fallbackVersion}`);
                loadScript(fallbackVersion);
            });
        return;
    }

    // Helper function to load script
    function loadScript(version) {
        const script = document.createElement("script");
        script.id = bundleId;
        script.defer = true;
        script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/download/${version}/customGradebookInit.js`;
        script.onload = () => console.log(`[CG] Loaded customGradebookInit.js (AUTO-PATCH ${version})`);
        script.onerror = () => console.error(`[CG] Failed to load customGradebookInit.js (AUTO-PATCH ${version})`);
        document.head.appendChild(script);
    }

    // Standard channels (dev, beta, prod)
    const script = document.createElement("script");
    script.id = bundleId;
    script.defer = true;

    // Determine script URL based on source and channel
    if (release.source === "github_release") {
        if (release.channel === "dev") {
            // Dev channel: use cache-busting query parameter
            const cacheBuster = Date.now();
            script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/download/dev/customGradebookInit.js?v=${cacheBuster}`;
        } else if (release.channel === "beta") {
            // Beta channel: use GitHub's /releases/latest/download/ redirect
            // This automatically fetches the most recent production release without version pinning
            // WARNING: May receive breaking changes without notice - use for testing only
            script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/latest/download/customGradebookInit.js`;
        } else {
            // Prod channel: use version tag
            script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/download/${release.version}/customGradebookInit.js`;
        }
    } else if (release.source === "pages") {
        const cacheBuster = release.version || Date.now();
        script.src = `https://morenet-canvas.github.io/CustomizedGradebook/dist/${release.channel}/customGradebookInit.js?v=${cacheBuster}`;
    } else {
        console.error("[CG] Unknown release source:", release.source);
        return;
    }

    script.onload = () => console.log(`[CG] Loaded customGradebookInit.js (${release.channel.toUpperCase()} ${release.version})`);
    script.onerror = () => console.error(`[CG] Failed to load customGradebookInit.js (${release.channel.toUpperCase()})`);
    document.head.appendChild(script);
})();
/* ========== END SECTION C: CG LOADER TEMPLATE ========== */