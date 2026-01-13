/**
 * ============================================================================
 * CustomizedGradebook - DEV Loader
 * ============================================================================
 * This loader snippet injects the CustomizedGradebook script into Canvas.
 */

(function () {
    // ========================================================================
    // GLOBAL CONFIGURATION CONSTANTS
    // ========================================================================
    // ⚠️  Last synced: 2026-01-07
    // ========================================================================

    window.CG_CONFIG = {
        // Feature flags
        ENABLE_STUDENT_GRADE_CUSTOMIZATION: true,
        REMOVE_ASSIGNMENT_TAB: false,

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

    console.log("[CG] Configuration loaded:", window.CG_CONFIG);

    // ========================================================================
    // SCRIPT LOADER
    // ========================================================================

    if (document.getElementById("cg_dev_bundle")) {
        console.log("[CG] Dev bundle already loaded; skipping");
        return;
    }

    const script = document.createElement("script");
    script.id = "cg_dev_bundle";
    const cacheBuster = Date.now(); // new number every load

    script.src = `https://morenet-canvas/CustomizedGradebook/releases/download/dev/main.js?v=${cacheBuster}`;
    //script.src = `https://morenet-canvas.github.io/CustomizedGradebook/dist/dev/main.js?v=${cacheBuster}`;
    script.onload = () => console.log("[CG] Loaded DEV bundle from GitHub (no cache)");
    script.onerror = () => console.error("[CG] Failed to load DEV bundle from GitHub");
    document.head.appendChild(script);
})();
