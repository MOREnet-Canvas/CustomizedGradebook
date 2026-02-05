////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                        DESIGN TOOLS CONFIGURATION                          //
//            Utah State University  https://designtools.ciditools.com/       //
//                          Copyright (C) 2017                                //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

var DT_variables = {
    iframeID: '',

    // Path to the hosted USU Design Tools
    path: 'https://designtools.ciditools.com/',
    templateCourse: '2827',

    // OPTIONAL: Button will be hidden from view until launched using shortcut keys
    hideButton: false,

    // OPTIONAL: Limit by course format
    limitByFormat: false, // Change to true to limit by format
    // Adjust the formats as needed. Format must be set for the course and in this array for tools to load
    formatArray: ['online','on-campus','blended'],

    // OPTIONAL: Limit tools loading by users role
    limitByRole: false, // Set to true to limit to roles in the roleArray
    roleArray: ['student','teacher','admin'],

    // OPTIONAL: Limit tools to an array of Canvas user IDs
    limitByUser: false, // Change to true to limit by user
    // Add users to array (Canvas user ID not SIS user ID)
    userArray: ['1234','987654']
};

// ============================================================================
// USU DESIGN TOOLS - INITIALIZATION
// ============================================================================

// Run the necessary code when a page loads
$(document).ready(function () {
    'use strict';
    // This runs code that looks at each page and determines what controls to create
    $.getScript(DT_variables.path + 'js/master_controls.js', function () {
        console.log('master_controls.js loaded');
    });
});

////////////////////////////////////////////////////////////////////////////////
//                     END USU DESIGN TOOLS CONFIGURATION                     //
////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                    CUSTOM DISTRICT MODIFICATIONS                           //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wait for an element to be rendered before executing callback
 * @param {string} selector - CSS selector to watch for
 * @param {function} cb - Callback function to execute when element is found
 * @param {number} _attempts - Internal counter for retry attempts (max 60)
 */
function onElementRendered(selector, cb, _attempts) {
    var el = $(selector);
    _attempts = ++_attempts || 1;
    if (el.length) return cb(el);
    if (_attempts == 60) return;
    setTimeout(function() {
        onElementRendered(selector, cb, _attempts);
    }, 250);
}

// ============================================================================
// Hide "Reset Course Content" Button
// ============================================================================

/**
 * Prevents instructors from accidentally resetting course content by hiding the button.
 * Remove this block if you want the reset button to be visible.
 */
onElementRendered('.reset_course_content_button', function(e) {
    $('.reset_course_content_button').hide();
});

// ============================================================================
// LEGACY CODE - Survey Link Modifier (DISABLED)
// ============================================================================

/**
 * This code was used to dynamically modify survey links with Canvas user/course IDs.
 * Currently commented out - uncomment and update if survey integration is needed.
 */
// onElementRendered('a[href*="showSurvey.aspx', function(e) {
//     var userSISID = ENV.current_user_id;
//     var courseID = window.location.pathname.split('/')[2];
//     $('a[href*="showSurvey.aspx"]').attr('href', 'http://enterprise.principals.ca/Survey/showSurvey.aspx' + '?evalID=232&userID=' + userSISID + "&eelD=" + courseID);
// });


////////////////////////////////////////////////////////////////////////////////
//                   END CUSTOM DISTRICT MODIFICATIONS                        //
////////////////////////////////////////////////////////////////////////////////

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
        version: "v1.0.3",
        source: "github_release"
    };

    const script = document.createElement("script");
    script.id = "cg_prod_bundle";
    script.defer = true;

    // Determine script URL based on source
    if (release.source === "github_release") {
        script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/download/${release.version}/customGradebookInit.js`;
    } else if (release.source === "pages") {
        const cacheBuster = release.version || Date.now();
        script.src = `https://morenet-canvas.github.io/CustomizedGradebook/dist/prod/customGradebookInit.js?v=${cacheBuster}`;
    } else {
        console.error("[CG] Unknown release source:", release.source);
        return;
    }

    script.onload = () => console.log(`[CG] Loaded customGradebookInit.js (PROD ${release.version})`);
    script.onerror = () => console.error("[CG] Failed to load customGradebookInit.js (PROD)");
    document.head.appendChild(script);
})();

/* BEGIN CG MANAGED CODE */
/* Generated: 2026-02-05T16:22:55.516Z */
/* Account: 1 */
/* Purpose: Version and configuration management for CG loader */

window.CG_MANAGED = window.CG_MANAGED || {};

// Release configuration
window.CG_MANAGED.release = {
    channel: "prod",
    version: "v1.0.3",
    source: "github_release"
};

// Configuration overrides
window.CG_MANAGED.config = {
    adminDashboard: true,
    adminDashboardLabel: "Open CG Admin Dashboard"
};

/* END CG MANAGED CODE */
