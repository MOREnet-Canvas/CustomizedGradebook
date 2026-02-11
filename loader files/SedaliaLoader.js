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