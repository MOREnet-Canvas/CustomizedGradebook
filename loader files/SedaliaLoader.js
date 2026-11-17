/* ========== BEGIN SECTION A: EXTERNAL LOADER ========== */
////////////////////////////////////////////////////
// DESIGNPLUS CONFIG                            //
////////////////////////////////////////////////////

// Legacy
var DT_variables = {
        iframeID: '',
        // Path to the hosted USU Design Tools
        path: 'https://designtools.ciditools.com/',
        templateCourse: '2827',
        // OPTIONAL: Button will be hidden from view until launched using shortcut keys
        hideButton: false,
    	 // OPTIONAL: Limit by course format
	     limitByFormat: false, // Change to true to limit by format
	     // adjust the formats as needed. Format must be set for the course and in this array for tools to load
	     formatArray: [
            'online',
            'on-campus',
            'blended'
        ],
        // OPTIONAL: Limit tools loading by users role
        limitByRole: false, // set to true to limit to roles in the roleArray
        // adjust roles as needed
        roleArray: [
            'student',
            'teacher',
            'admin'
        ],
        // OPTIONAL: Limit tools to an array of Canvas user IDs
        limitByUser: false, // Change to true to limit by user
        // add users to array (Canvas user ID not SIS user ID)
        userArray: [
            '1234',
            '987654'
        ]
};
// New
window.DpConfig = window.DpConfig || {
	lms: 'canvas',
    templateCourse: '38739',
    hideButton: false,
    enableWizard: false,
    hideLti: false,
    extendedCourse: '', // added in sub-account theme
    sharedCourse: '', // added from localStorage
    courseFormats: [],
    canvasRoles: [],
    canvasUsers: [],
    canvasCourseIds: [],
    plugins: [],
    excludedModules: [],
    includedModules: [],
    lang: 'en',
	defaultToLegacy: false,
    enableVersionSwitching: true,
    hideSwitching: false,
}

// Merge with any extended configurations
if (window.DpExtended) {
    window.DpConfig = {...window.DpConfig, ...window.DpExtended};
}

// Minimal script loader with caching support
(function() {
    // Determine environment and base URI
    const uriPrefix = (location.href.includes('.beta.')) ? 'beta.' : '';
    const toolsUri = (window.DpConfig.toolsUri) ? window.DpConfig.toolsUri : `https://designplus.${uriPrefix}ciditools.com/`;

    // Function to load script with version
    function loadScript(version) {
        const script = document.createElement('script');
        script.src = `${toolsUri}js/controller.js?v=${version}`;
        script.crossOrigin = 'anonymous';
        script.async = true;
        script.onerror = () => console.error('DesignPlus: Failed to load main application script');

        const firstScript = document.getElementsByTagName('script')[0];
        firstScript.parentNode.insertBefore(script, firstScript);
    }

    // Try to fetch version info for cache busting
    fetch(`${toolsUri}js/version.json?t=${Date.now()}`)
        .then(response => response.ok ? response.json() : null)
        .then(versionInfo => {
            const version = (versionInfo && versionInfo.version) ? versionInfo.version : Date.now();
            window.DpConfig.version = version;
            loadScript(version);
        })
        .catch(() => {
            // Fallback to timestamp-based versioning
            const fallbackVersion = Date.now();
            window.DpConfig.version = fallbackVersion;
            loadScript(fallbackVersion);
        });
})();

////////////////////////////////////////////////////
// END DESIGNPLUS CONFIG                        //
////////////////////////////////////////////////////

//This will wait until the element is rendered before running our code
function onElementRendered(selector, cb, _attempts) {
    var el = $(selector);
    _attempts = ++_attempts || 1;
    if (el.length) return cb(el);
    if (_attempts == 60) return;
    setTimeout(function() {
        onElementRendered(selector, cb, _attempts);
    }, 250);
};


//This code will pull the Canvas IDs for users and courses and change the link for the survey
// onElementRendered('a[href*="showSurvey.aspx', function(e) {
//     var userSISID = ENV.current_user_id;
//     var courseID = window.location.pathname.split('/')[2];
//     $('a[href*="showSurvey.aspx"]').attr('href', 'http://enterprise.principals.ca/Survey/showSurvey.aspx' + '?evalID=232&userID=' + userSISID + "&eelD=" + courseID);
// });

//When element is rendered it will run api call to fill the necessary variables so the survey link changes
onElementRendered('.reset_course_content_button', function(e) {
    $('.reset_course_content_button').hide();
});
/* ========== END SECTION A: EXTERNAL LOADER ========== */

/* ========== BEGIN SECTION B: MANAGED CONFIG BLOCK ========== */
/* Generated: 2026-09-25T00:00:00.000Z */
/* Account: 1 */
/* Purpose: Version and configuration management for CG loader */

/* Auto-Patch Track: v1.3-latest (auto-updates to latest patch) */

window.CG_MANAGED = window.CG_MANAGED || {};

// Release configuration
window.CG_MANAGED.release = {
    channel: "auto-patch",
    version: "v1.3.9",
    versionTrack: "v1.3-latest",  // Auto-updates to latest patch in this track
    source: "github_release",
    pilotCourseIds: ["40053","40038", "39499", "39837", "40256", "40748", "39749", "40355", "40709", "40007", "40015", "40017", "40021", "39962", "40026", "40721", "40391", "40110", "39391", "40081", "39437", "39468", "40802", "39724", "39873", "39948", "39643", "40085", "39755", "39943", "39259", "40216", "40725", "40709", "39286", "40153", "39721", "39417", "39604", "40404", "39261", "39282", "39774", "40187", "40081"],  // Courses whose teachers load the PILOT build
};

// Configuration overrides
window.CG_MANAGED.config = {
    // Feature flags
    ENABLE_STUDENT_GRADE_CUSTOMIZATION: true,
    ENABLE_GRADE_OVERRIDE: true,
    ENFORCE_COURSE_OVERRIDE: true,
    ENFORCE_COURSE_GRADING_SCHEME: true,

    // UI labels
    UPDATE_AVG_BUTTON_LABEL: "Update Current Score",
    AVG_OUTCOME_NAME: "Current Score",
    AVG_ASSIGNMENT_NAME: "Current Score Assignment",
    AVG_RUBRIC_NAME: "Current Score Rubric",

    // Outcome configuration
    DEFAULT_MAX_POINTS: 4,
    DEFAULT_MASTERY_THRESHOLD: 3,

    // Rating scale
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
    EXCLUDED_OUTCOME_KEYWORDS: ["Homework Completion"],

    // Grading scheme and type
    DEFAULT_GRADING_SCHEME_ID: 21106,
    DEFAULT_GRADING_SCHEME: {
            "id": 21106,
            "title": "SSD CBE",
            "scaling_factor": 4,
            "points_based": true,
            "grading_scheme": [
                    {
                            "name": "Beyond Target",
                            "value": 0.7525,
                            "calculated_value": 3.01
                    },
                    {
                            "name": "Target",
                            "value": 0.75,
                            "calculated_value": 3
                    },
                    {
                            "name": "Foundational",
                            "value": 0.5,
                            "calculated_value": 2
                    },
                    {
                            "name": "Needs Support",
                            "value": 0.125,
                            "calculated_value": 0.5
                    },
                    {
                            "name": "Insufficient Evidence",
                            "value": 0,
                            "calculated_value": 0
                    }
            ],
            "context_type": "Account"
    },
    DEFAULT_GRADING_TYPE: "gpa_scale",

    // Account filtering
    ENABLE_ACCOUNT_FILTER: true,
    ALLOWED_ACCOUNT_IDS: ["1","11","12"],

    // Custom grade status
    DEFAULT_CUSTOM_STATUS_ID: "1",

    // Custom grade status gate
    ENABLE_GRADE_CUSTOM_STATUS: false,
    ENABLE_NEGATIVE_ZERO_COUNT: false
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
    // CG LOADER - ACCOUNT FILTER (EARLY EXIT)
    // ========================================================================

    // Check if account filtering is enabled
    if (window.CG_CONFIG.ENABLE_ACCOUNT_FILTER) {
        const allowedAccounts = window.CG_CONFIG.ALLOWED_ACCOUNT_IDS || [];

        // Get current account ID from Canvas ENV
        const currentAccountId = window.ENV?.ACCOUNT_ID ? String(window.ENV.ACCOUNT_ID) : null;

        // If we can determine the account and it's not in the allowed list, stop execution
        if (currentAccountId && !allowedAccounts.includes(currentAccountId)) {
            console.log(`[CG] Script disabled for account ${currentAccountId} (not in allowed list: ${allowedAccounts.join(', ')})`);
            return; // Exit IIFE - prevent rest of loader from running
        }

        // If filtering is enabled but we can't determine account, log warning but continue
        if (!currentAccountId) {
            console.warn('[CG] Account filtering enabled but cannot determine current account ID - allowing script to run');
        } else {
            console.log(`[CG] Account ${currentAccountId} is allowed, continuing...`);
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
    let release = (window.CG_MANAGED && window.CG_MANAGED.release) || {
        channel: "prod",
        version: "v1.0.3",
        source: "github_release"
    };

    // ========================================================================
    // CG LOADER - PILOT COURSES
    // ========================================================================

    // Teacher-like users inside a pilot course load the pilot build; students,
    // observers, and all non-pilot pages keep the configured channel.
    // Role list mirrors getUserRoleGroup() in src/utils/canvas.js.
    const pilotCourseIds = (release.pilotCourseIds || []).map(String);
    if (pilotCourseIds.length && release.channel !== "dev") {
        const courseMatch = window.location.pathname.match(/^\/courses\/(\d+)/);
        const courseId = courseMatch ? courseMatch[1]
            : (window.ENV && window.ENV.COURSE_ID ? String(window.ENV.COURSE_ID) : null);
        const roles = new Set(
            [...((window.ENV && window.ENV.current_user_roles) || []),
             ...((window.ENV && window.ENV.current_user_types) || [])].map(r => String(r).toLowerCase())
        );
        if (window.ENV && window.ENV.current_user_is_admin) roles.add("admin");
        const teacherLike = ["teacher", "admin", "root_admin", "designer", "ta", "accountadmin"].some(r => roles.has(r));
        if (courseId && pilotCourseIds.includes(courseId) && teacherLike) {
            console.log(`[CG] Pilot course ${courseId} - loading PILOT build instead of ${release.channel.toUpperCase()} ${release.version}`);
            release = Object.assign({}, release, { channel: "pilot", version: "pilot" });
        }
    }

    // Prevent duplicate loading
    const bundleId = "cg_" + release.channel + "_bundle";
    if (document.getElementById(bundleId)) {
        console.log(`[CG] ${release.channel.toUpperCase()} bundle already loaded; skipping`);
        return;
    }

    // ========================================================================
    // HELPER FUNCTIONS (defined before use)
    // ========================================================================

    function loadScriptSync() {
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
            } else if (release.channel === "pilot") {
                // Pilot channel: rolling "pilot" release (minified, no cache-buster - like prod)
                script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/download/pilot/customGradebookInit.js`;
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
    }

    function loadScript(version) {
        console.log(`[CG] Loading auto-patch version: ${version}`);
        const script = document.createElement("script");
        script.id = bundleId;
        script.defer = true;
        script.src = `https://github.com/morenet-canvas/CustomizedGradebook/releases/download/${version}/customGradebookInit.js`;
        script.onload = () => console.log(`[CG] Loaded customGradebookInit.js (AUTO-PATCH ${version})`);
        script.onerror = () => console.error(`[CG] Failed to load customGradebookInit.js (AUTO-PATCH ${version})`);
        document.head.appendChild(script);
    }

    // ========================================================================
    // CHANNEL-SPECIFIC LOADING LOGIC
    // ========================================================================

    // Auto-patch channel: fetch version from manifest
    if (release.channel === "auto-patch" && release.versionTrack) {
        console.log(`[CG] Auto-patch mode: fetching version manifest for track "${release.versionTrack}"`);
        const manifestUrl = "https://morenet-canvas.github.io/CustomizedGradebook/versions.json";
        const fallbackVersion = release.version || "v1.0.3";
        const cacheBuster = Date.now();

        fetch(`${manifestUrl}?t=${cacheBuster}`)
            .then(response => {
                console.log(`[CG] Manifest fetch response: ${response.status} ${response.statusText}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(manifest => {
                console.log(`[CG] Manifest loaded:`, manifest);
                const resolvedVersion = manifest[release.versionTrack];
                if (!resolvedVersion) {
                    console.warn(`[CG] Version track "${release.versionTrack}" not found in manifest, using fallback: ${fallbackVersion}`);
                    loadScript(fallbackVersion);
                } else {
                    console.log(`[CG] Resolved ${release.versionTrack} -> ${resolvedVersion}`);
                    loadScript(resolvedVersion);
                }
            })
            .catch(error => {
                console.warn(`[CG] Failed to fetch version manifest: ${error.message}, using fallback: ${fallbackVersion}`);
                loadScript(fallbackVersion);
            });
        return;
    }

    // Standard channels: load immediately
    loadScriptSync();
})();
/* ========== END SECTION C: CG LOADER TEMPLATE ========== */
