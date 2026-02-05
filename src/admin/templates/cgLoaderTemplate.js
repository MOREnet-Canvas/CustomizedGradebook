// src/admin/templates/cgLoaderTemplate.js
/**
 * CG Loader Template (B)
 * 
 * This is the stable CG loader logic that gets combined with:
 * - A = External loader (district's Theme JS)
 * - C = Managed config block (generated from dashboard UI)
 * 
 * This template:
 * - Is an IIFE that loads the CG bundle
 * - Merges config safely from window.CG_MANAGED.config
 * - Determines bundle URL from window.CG_MANAGED.release
 * - Uses script ID guard to prevent duplicate loading
 */

export const CG_LOADER_TEMPLATE = `
(function () {
    // ========================================================================
    // CG LOADER - CONFIGURATION MERGE
    // ========================================================================

    // Initialize CG_CONFIG if not already present (allows pre-configuration)
    window.CG_CONFIG = window.CG_CONFIG || {};

    // Define configuration defaults
    const defaults = {
        // Feature flags
        ENABLE_STUDENT_GRADE_CUSTOMIZATION: true,

        // Grading mode configuration
        ENABLE_OUTCOME_UPDATES: true,
        ENABLE_GRADE_OVERRIDE: true,

        // UI labels and resource names
        UPDATE_AVG_BUTTON_LABEL: "Update Current Score",
        AVG_OUTCOME_NAME: "Current Score",
        AVG_ASSIGNMENT_NAME: "Current Score Assignment",
        AVG_RUBRIC_NAME: "Current Score Rubric",

        // Outcome configuration
        DEFAULT_MAX_POINTS: 4,
        DEFAULT_MASTERY_THRESHOLD: 3,

        // Rating scale for outcomes and rubrics
        OUTCOME_AND_RUBRIC_RATINGS: [
            { description: "Exemplary", points: 4 },
            { description: "Beyond Target", points: 3.5 },
            { description: "Target", points: 3 },
            { description: "Approaching Target", points: 2.5 },
            { description: "Developing", points: 2 },
            { description: "Beginning", points: 1.5 },
            { description: "Needs Partial Support", points: 1 },
            { description: "Needs Full Support", points: 0.5 },
            { description: "No Evidence", points: 0 }
        ],

        // Outcome filtering
        EXCLUDED_OUTCOME_KEYWORDS: ["Homework Completion"]
    };

    // Apply defaults only where keys are undefined
    for (const key in defaults) {
        if (window.CG_CONFIG[key] === undefined) {
            window.CG_CONFIG[key] = defaults[key];
        }
    }

    // Merge managed config if present (only for undefined keys)
    if (window.CG_MANAGED && window.CG_MANAGED.config) {
        for (const key in window.CG_MANAGED.config) {
            if (window.CG_CONFIG[key] === undefined) {
                window.CG_CONFIG[key] = window.CG_MANAGED.config[key];
            }
        }
    }

    // ========================================================================
    // CG LOADER - SCRIPT INJECTION
    // ========================================================================

    // Prevent duplicate loading
    if (document.getElementById("cg_prod_bundle")) {
        console.log("[CG] PROD bundle already loaded; skipping");
        return;
    }

    // Read release configuration from managed block
    const release = (window.CG_MANAGED && window.CG_MANAGED.release) || {
        channel: "prod",
        version: "v1.0.2",
        source: "github_release"
    };

    const script = document.createElement("script");
    script.id = "cg_prod_bundle";
    script.defer = true;

    // Determine script URL based on source
    if (release.source === "github_release") {
        script.src = \`https://github.com/morenet-canvas/CustomizedGradebook/releases/download/\${release.version}/customGradebookInit.js\`;
    } else if (release.source === "pages") {
        const cacheBuster = release.version || Date.now();
        script.src = \`https://morenet-canvas.github.io/CustomizedGradebook/dist/prod/customGradebookInit.js?v=\${cacheBuster}\`;
    } else {
        console.error("[CG] Unknown release source:", release.source);
        return;
    }

    script.onload = () => console.log(\`[CG] Loaded customGradebookInit.js (PROD \${release.version})\`);
    script.onerror = () => console.error("[CG] Failed to load customGradebookInit.js (PROD)");
    document.head.appendChild(script);
})();
`.trim();

