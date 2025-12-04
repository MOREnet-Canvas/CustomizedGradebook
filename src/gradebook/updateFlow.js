// src/gradebook/updateFlow.js
//TODO: getCourseId not defined

import {
    VERBOSE_LOGGING,
    UPDATE_AVG_BUTTON_LABEL,
    AVG_OUTCOME_NAME,
    AVG_ASSIGNMENT_NAME,
    AVG_RUBRIC_NAME,
    DEFAULT_MAX_POINTS,
    DEFAULT_MASTERY_THRESHOLD,
    OUTCOME_AND_RUBRIC_RATINGS,
    EXCLUDED_OUTCOME_KEYWORDS,
    PER_STUDENT_UPDATE_THRESHOLD,
    ENABLE_GRADE_OVERRIDE,
    OVERRIDE_SCALE
} from "../config.js";
import { makeButton, createButtonColumnContainer } from "../ui/buttons.js";
import { k } from "../utils/keys.js";
import { showFloatingBanner } from "../ui/banner.js";
import * as extras from "../utils/extras.js"




import {
    getCourseId,
    getTokenCookie,
    courseHasAvgAssignment,
    isDashboardPage,
    getUserRoleGroup
} from "../utils/canvas.js";

import { debounce, inheritFontStylesFrom } from "../utils/dom.js";




// const BRAND_COLOR = getComputedStyle(document.documentElement)
//     .getPropertyValue('--ic-brand-primary')
//     .trim() || "#0c7d9d";

// const k = (name, courseId) => `${name}_${courseId}`;

// function makeButton({ label, id = null, onClick = null, type = "primary", tooltip = null }) {
//     const button = document.createElement("button");
//
//     button.textContent = label;
//     if (id) button.id = id;
//     if (tooltip) button.title = tooltip;
//
//     // Try to inherit font styles from a known Canvas menu / button element (default settings are a bit too small)
//     const foundFontStyles = inheritFontStylesFrom('.css-1f65ace-view-link', button);
//     // If not found, fallback to default font styling
//     if (!foundFontStyles) {
//         button.style.fontSize = "14px";
//         button.style.fontFamily = "inherit";
//         button.style.fontWeight = "600";
//     }
//
//     // Basic button appearance
//     button.style.marginLeft = "1rem";
//     button.style.padding = "0.5rem 1rem";
//     button.style.border = "none";
//     button.style.borderRadius = "5px";
//     button.style.cursor = "pointer";
//     button.style.transition = "background 0.3s, color 0.3s";
//
//     const rootStyles = getComputedStyle(document.documentElement);
//     const primaryButtonColor = rootStyles.getPropertyValue('--ic-brand-button--primary-bgd').trim() || "#0c7d9d";
//     const textColor = rootStyles.getPropertyValue('--ic-brand-button--primary-text').trim() || "#ffffff";
//     const secondaryButtonColor = rootStyles.getPropertyValue('--ic-brand-button--secondary-bgd').trim() || "#e0e0e0";
//     const secondaryTextColor = rootStyles.getPropertyValue('--ic-brand-button--secondary-text').trim() || "#ffffff";
//
//     if (type === "primary") {
//         button.style.background = primaryButtonColor;
//         button.style.color = textColor;
//     } else if (type === "secondary") {
//         button.style.background = secondaryButtonColor;
//         button.style.color = secondaryTextColor;
//         button.style.border = "1px solid #ccc";
//     }
//
//     if (onClick) {
//         button.addEventListener("click", onClick);
//     }
//
//     return button;
// }

// function createButtonColumnContainer() {
//     const container = document.createElement("div");
//     container.style.display = "flex";
//     container.style.flexDirection = "row";
//     container.style.gap = "0.01rem"; // spacing between buttons
//     container.style.marginLeft = "1rem"; // optional spacing from the rest of the toolbar
//     return container;
// }

// function showFloatingBanner({
//                                 text = "",
//                                 duration = null,              // null = stays until removed; number = auto-hide after ms
//                                 top = "20px",
//                                 right = "20px",
//                                 center = false,
//                                 backgroundColor = BRAND_COLOR,
//                                 textColor = "#ffffff",
//                                 allowMultiple = false,         // keep existing banners?
//                                 ariaLive = "polite"            // "polite" | "assertive" | "off"
//                             } = {}) {
//     // Remove existing banners unless explicitly allowed
//     if (!allowMultiple) {
//         document.querySelectorAll(".floating-banner").forEach(b => b.remove());
//     }
//
//     const baseElement =
//         document.querySelector(".ic-Layout-contentMain") ||
//         document.querySelector(".ic-app-header__menu-list-item__link") ||
//         document.body;
//
//     const styles = getComputedStyle(baseElement);
//     const fontFamily = styles.fontFamily;
//     const fontSize = styles.fontSize;
//     const fontWeight = styles.fontWeight;
//
//     // Create banner
//     const banner = document.createElement("div");
//     banner.className = "floating-banner";
//     banner.setAttribute("role", "status");
//     if (ariaLive && ariaLive !== "off") banner.setAttribute("aria-live", ariaLive);
//
//     // Core positioning + style
//     Object.assign(banner.style, {
//         position: "fixed",
//         top,
//         background: backgroundColor,
//         padding: "10px 20px",
//         borderRadius: "8px",
//         boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
//         zIndex: "9999",
//         fontSize,
//         color: textColor,
//         fontFamily,
//         fontWeight,
//         display: "inline-flex",
//         alignItems: "center",
//         gap: "12px",
//         maxWidth: "min(90vw, 720px)",
//         lineHeight: "1.35",
//         wordBreak: "break-word"
//     });
//
//     if (center) {
//         banner.style.left = "50%";
//         banner.style.transform = "translateX(-50%)";
//     } else {
//         banner.style.right = right;
//     }
//
//     // Message node to keep the X button separate
//     const msg = document.createElement("span");
//     msg.className = "floating-banner__text";
//     banner.appendChild(msg);
//
//     // Dismiss "X"
//     const closeBtn = document.createElement("button");
//     closeBtn.type = "button";
//     closeBtn.setAttribute("aria-label", "Dismiss message");
//     closeBtn.textContent = "×";
//     Object.assign(closeBtn.style, {
//         cursor: "pointer",
//         fontWeight: "bold",
//         border: "none",
//         background: "transparent",
//         color: "inherit",
//         fontSize,
//         lineHeight: "1"
//     });
//     closeBtn.onclick = () => destroy();
//     banner.appendChild(closeBtn);
//
//     document.body.appendChild(banner);
//
//     // --- Messaging control (sticky, queue, soft) ---
//     let lockedUntil = 0;
//     let pending = null;
//     let holdTimer = null;
//     let autoTimer = null;
//
//     const now = () => Date.now();
//     const isLocked = () => now() < lockedUntil;
//
//     // const apply = (textValue) => { msg.textContent = textValue; };
//     const courseId = getCourseId();
//     const apply = (textValue) => {
//         msg.textContent = textValue;
//         if (courseId) localStorage.setItem(k('bannerLast', courseId), textValue);
//     };
//
//     const unlockAndFlush = () => {
//         lockedUntil = 0;
//         if (pending != null) {
//             apply(pending);
//             pending = null;
//         }
//     };
//
//
//     banner.setText = (newText) => {
//         if (isLocked()) {
//             pending = newText; // keep only the latest
//         } else {
//             apply(newText);
//         }
//     };
//
//     banner.hold = (newText, ms = 3000) => {
//         const now = Date.now();
//         // If currently locked, just queue the text; don't extend the lock
//         if (now < lockedUntil) {
//             pending = newText;       // will show when the current hold ends
//             return;
//         }
//
//         lockedUntil = now + ms;
//         apply(newText);
//
//         if (holdTimer) clearTimeout(holdTimer);
//         holdTimer = setTimeout(() => {
//             lockedUntil = 0;
//             if (pending != null) {
//                 apply(pending);
//                 pending = null;
//             }
//         }, ms);
//     };
//
//     // Non-sticky update ignored during a hold
//     banner.soft = (newText) => {
//         if (!isLocked()) apply(newText);
//     };
//
//     // Remove with fade-out
//     function destroy() {
//         if (holdTimer) clearTimeout(holdTimer);
//         if (autoTimer) clearTimeout(autoTimer);
//         banner.style.transition = "opacity 150ms";
//         banner.style.opacity = "0";
//         setTimeout(() => banner.remove(), 160);
//     }
//     banner.removeBanner = destroy; // expose a named remover
//
//     // Initial text
//     (duration === "hold")
//         ? banner.hold(text, 3000) // convenience: allow duration="hold"
//         : banner.setText(text);
//
//     // Auto-dismiss if a number is provided
//     if (typeof duration === "number" && isFinite(duration) && duration >= 0) {
//         autoTimer = setTimeout(destroy, duration);
//     }
//
//     closeBtn.onclick = () => {
//         if (courseId) localStorage.setItem(k('bannerDismissed', courseId), 'true');
//         destroy();
//         ensureStatusPill(courseId);
//     };
//
//     // when first shown, clear the dismissed flag and save text
//     if (courseId) localStorage.setItem(k('bannerDismissed', courseId), 'false');
//     (duration === "hold") ? banner.hold(text, 3000) : banner.setText(text);
//
//     return banner;
// }

export function injectButtons() {
    waitForGradebookAndToolbar((toolbar) => {
        const courseId = getCourseId();

        // Create a vertical container for the button and the notice
        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.flexDirection = "column";
        buttonWrapper.style.alignItems = "flex-end"; // keep button right-aligned

        const updateAveragesButton = makeButton({
            label: UPDATE_AVG_BUTTON_LABEL,
            id: "update-scores-button",
            //tooltip: `v${SCRIPT_VERSION} - Update Current Score averages`,
            onClick: async () => {
                try {
                   await startUpdateFlow();
                } catch (error) {
                    console.error(`Error updating ${AVG_OUTCOME_NAME} scores:`, error);
                    alert(`Error updating ${AVG_OUTCOME_NAME} scores: ` + error.message);
                }
            },
            type: "primary"
        });

        buttonWrapper.appendChild(updateAveragesButton);

        // Render last update inside the same wrapper, under the button
        //renderLastUpdateNotice(buttonWrapper, courseId);

        // Add the wrapper into a column container so it stays on the right
        const buttonContainer = createButtonColumnContainer();
        buttonContainer.appendChild(buttonWrapper);
        toolbar.appendChild(buttonContainer);

        //void resumeIfNeeded();
    });
}

function waitForGradebookAndToolbar(callback) {
    let attempts = 0;
    const intervalId = setInterval(() => {
        const onGradebookPage = window.location.pathname.includes('/gradebook');
        const documentReady = document.readyState === 'complete';
        const toolbar = document.querySelector(
            '.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]'
        );

        if (onGradebookPage && documentReady && toolbar) {
            clearInterval(intervalId);
            if (VERBOSE_LOGGING) console.log("Gradebook page and toolbar found.");
            callback(toolbar);
        } else if (attempts++ > 33) {
            clearInterval(intervalId);
            console.warn("Gradebook toolbar not found after 10 seconds, UI not injected.");
        }
    }, 300);
}

async function setupOutcomeAssignmentRubric(courseId, box) {
    let data = null;
    let assignmentId = null;
    let rubricId = null;
    let outcomeId = null;
    let rubricCriterionId = null;

    let outcomeAlignmentCorrectlySet = false;
    while (!outcomeAlignmentCorrectlySet) {
        data = await getRollup(courseId);
        if (VERBOSE_LOGGING) console.log("data: ", data);

        let outcomeObj = getOutcomeObjectByName(data);
        if (VERBOSE_LOGGING) console.log("outcome match: ", outcomeObj);
        if (VERBOSE_LOGGING) console.log("outcome id: ", outcomeObj?.id);
        outcomeId = outcomeObj?.id;

        if (!outcomeId) {
            let confirmCreate = confirm(`Outcome "${AVG_OUTCOME_NAME}" not found.\nWould you like to create:\nOutcome: "${AVG_OUTCOME_NAME}"?`);
            if (!confirmCreate) throw new Error("User declined to create missing outcome.");
            box.setText(`Creating "${AVG_OUTCOME_NAME}" Outcome...`);
            await createOutcome(courseId);
            continue; // start while loop over to make sure outcome was created and found.
        }

        // will only find assignmentObj if it has been associated with outcome
        let assignmentObj = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj);
        if (VERBOSE_LOGGING) console.log("assignment object: ", assignmentObj);

        if (!assignmentObj) { // Find the assignmentObj even if an outcome / rubric hasn't been associated yet
            const assignmentObjFromName = await getAssignmentId(courseId);
            if (assignmentObjFromName) {
                const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentObjFromName}`);
                assignmentObj = await res.json();
                if (VERBOSE_LOGGING) console.log("Fallback assignment found by name, has not been associated with outcome yet:", assignmentObj);
            }
        }

        assignmentId = assignmentObj?.id; // if assigmentObj is still null even after looking by name, create it
        if (!assignmentId) {
            let confirmCreate = confirm(`Assignment "${AVG_ASSIGNMENT_NAME}" not found.\nWould you like to create:\nAssignment: "${AVG_ASSIGNMENT_NAME}"?`);
            if (!confirmCreate) throw new Error("User declined to create missing assignment.");
            box.setText(`Creating "${AVG_ASSIGNMENT_NAME}" Assignment...`);
            assignmentId = await createAssignment(courseId);
        }

        let result = await getRubricForAssignment(courseId, assignmentId);
        rubricId = result?.rubricId;
        rubricCriterionId = result?.criterionId;

        if (!rubricId) {
            let confirmCreate = confirm(`Rubric "${AVG_RUBRIC_NAME}" not found.\nWould you like to create:\nRubric: "${AVG_RUBRIC_NAME}"?`);
            if (!confirmCreate) throw new Error("User declined to create missing rubric.");
            box.setText(`Creating "${AVG_RUBRIC_NAME}" Rubric...`);
            rubricId = await createRubric(courseId, assignmentId, outcomeId);
            continue; // everything should be setup at this point, re-run while loop to make sure
        }

        outcomeAlignmentCorrectlySet = true;
    }

    return { data, assignmentId, rubricId, rubricCriterionId, outcomeId };
}

async function getRollup(courseId) {
    const response = await fetch(`/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`);
    if (!response.ok) throw new Error("Failed to fetch outcome results");
    const rollupData = await response.json();
    if (VERBOSE_LOGGING) console.log("rollupData: ", rollupData);
    return rollupData;
}

function getOutcomeObjectByName(data) {
    const outcomeTitle = AVG_OUTCOME_NAME;
    if (VERBOSE_LOGGING) console.log("Outcome Title:", outcomeTitle);
    if (VERBOSE_LOGGING) console.log("data:", data);
    const outcomes = data?.linked?.outcomes ?? [];
    if (VERBOSE_LOGGING) console.log("outcomes: ", outcomes)
    if (outcomes.length === 0) {
        console.warn("No outcomes found in rollup data.")
        return null;
    }
    const match = outcomes.find(o => o.title === outcomeTitle);
    if (VERBOSE_LOGGING) console.log("match: ", match)
    if (!match) {
        console.warn(`Outcome not found: "${outcomeTitle}"`);
    }
    return match ?? null;//match?.id ?? null;
}

async function createOutcome(courseId) {
    const csrfToken = getTokenCookie('_csrf_token');

    const randomSuffix = Math.random().toString(36).substring(2, 10); // 8-char alphanumeric
    const vendorGuid = `MOREnet_${randomSuffix}`;


    const ratingsCsv = OUTCOME_AND_RUBRIC_RATINGS
        .map(r => `${r.points},"${r.description}"`)
        .join(',');

    const csvContent =
        `vendor_guid,object_type,title,description,calculation_method,mastery_points\n` +
        `"${vendorGuid}",outcome,"${AVG_OUTCOME_NAME}","Auto-generated outcome: ${AVG_OUTCOME_NAME}",latest,"${DEFAULT_MASTERY_THRESHOLD}",${ratingsCsv}`;


    if (VERBOSE_LOGGING) console.log("Importing outcome via CSV...");

    const importRes = await fetch(`/api/v1/courses/${courseId}/outcome_imports?import_type=instructure_csv`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "text/csv",
            "X-CSRF-Token": csrfToken
        },
        body: csvContent
    });

    const rawText = await importRes.text();
    if (!importRes.ok) {
        console.error("Outcome import failed:", rawText);
        throw new Error(`Outcome import failed: ${rawText}`);
    }

    let importData;
    try {
        importData = JSON.parse(rawText);
    } catch (err) {
        console.error("Failed to parse outcome import response:", rawText);
        throw new Error("Import response not JSON");
    }

    const importId = importData.id;
    if (VERBOSE_LOGGING) console.log(`Outcome import started: ID ${importId}`);

    // Wait until the import completes
    let attempts = 0;
    let status = null;

    while (attempts++ < 15) { // Allow more time
        await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
        const pollRes = await fetch(`/api/v1/courses/${courseId}/outcome_imports/${importId}`);
        const pollData = await pollRes.json();

        const state = pollData.workflow_state;
        if (VERBOSE_LOGGING) console.log(`Poll attempt ${attempts}: ${state}`);

        if (state === "succeeded") {
            status = pollData;
            break;
        } else if (state === "failed") {
            console.error("Outcome import failure reason:", pollData);
            throw new Error("Outcome import failed");
        }
    }

    // After 30s with no result
    if (!status) {
        throw new Error("Timed out waiting for outcome import to complete");
    }

    if (VERBOSE_LOGGING) console.log("Outcome fully created");
}

async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject) {
    const alignments = outcomeObject.alignments ?? [];

    for (const alignment of alignments) {
        if (!alignment.startsWith("assignment_")) continue;

        const assignmentId = alignment.split("_")[1];
        const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
        if (!res.ok) continue;

        const assignment = await res.json();
        if (assignment.name === AVG_ASSIGNMENT_NAME) {
            console.log("Assignment found:", assignment);
            return assignment;
        }
    }

    // If no match found
    console.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in alignments for course ${courseId}`);
    return null;
}

async function createAssignment(courseId) {
    const csrfToken = getTokenCookie('_csrf_token');

    const payload = {
        authenticity_token: csrfToken,
        assignment: {
            name: AVG_ASSIGNMENT_NAME,
            position: 1,
            submission_types: ["none"], // no student submissions needed
            published: true,
            notify_of_update: true,
            points_possible: DEFAULT_MAX_POINTS,
            grading_type: "gpa_scale",
            omit_from_final_grade: true,
            // rubric_settings: {
            //     id: rubricId,
            //     title: AVG_RUBRIC_NAME,
            //     purpose: "grading",
            //     skip_updating_points_possible: false
            // }
        }
    };

    const res = await fetch(`/api/v1/courses/${courseId}/assignments`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create assignment: ${errText}`);
    }

    const assignment = await res.json();
    console.log("Assignment created:", assignment);
    return assignment.id;
}

async function getRubricForAssignment(courseId, assignmentId) {
    const response = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
    const assignment = await response.json();

    const rubricSettings = assignment.rubric_settings;
    if (!rubricSettings || rubricSettings.title !== AVG_RUBRIC_NAME) {
        return null; // probably null because it hasn't been created yet, want to continue to create
    }

    const rubricCriteria = assignment.rubric;
    if (!rubricCriteria || !Array.isArray(rubricCriteria) || rubricCriteria.length === 0) {
        return null; // probably null because it hasn't been created yet, want to continue to create
    }

    const criterionId = rubricCriteria[0].id; // grab the first criterion's ID
    const rubricId = rubricSettings.id;

    if (VERBOSE_LOGGING) console.log("Found rubric and first criterion ID:", {rubricId, criterionId});

    return {rubricId, criterionId};
}

async function createRubric(courseId, assignmentId, outcomeId) {
    const csrfToken = getTokenCookie('_csrf_token');

    const rubricRatings = {};
    OUTCOME_AND_RUBRIC_RATINGS.forEach((rating, index) => {
        rubricRatings[index] = {
            description: rating.description,
            points: rating.points
        };
    });

    const rubricPayload = {
        'rubric': {
            'title': AVG_RUBRIC_NAME,
            'free_form_criterion_comments': false,
            'criteria': {
                "0": {
                    'description': `${AVG_OUTCOME_NAME} criteria was used to create this rubric`,
                    'criterion_use_range': false,
                    'points': DEFAULT_MAX_POINTS,
                    'mastery_points': DEFAULT_MASTERY_THRESHOLD,
                    'learning_outcome_id': outcomeId,
                    'ratings': rubricRatings,
                }
            }
        },
        rubric_association: {
            association_type: "Assignment",
            association_id: assignmentId,
            use_for_grading: true,
            purpose: "grading",
            hide_points: true
        }
    };


    const response = await fetch(`/api/v1/courses/${courseId}/rubrics`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify(rubricPayload)
    });

    const rawText = await response.text();

    if (!response.ok) {
        console.error("Rubric creation failed:", rawText);
        throw new Error(`Failed to create rubric: ${rawText}`);
    }

    let rubric;
    try {
        rubric = JSON.parse(rawText);
    } catch (e) {
        console.error("Rubric response not JSON:", rawText);
        throw new Error("Rubric API returned non-JSON data");
    }

    if (VERBOSE_LOGGING) console.log("Rubric created and linked to outcome:", rubric);
    return rubric.id;
}

async function startUpdateFlow() {
    let courseId = getCourseId();
    if (!courseId) throw new Error("Course ID not found");
    const inProgress = (localStorage.getItem(`updateInProgress_${courseId}`) || "false") === "true";
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    const startTime = localStorage.getItem(`startTime_${courseId}`);

    if (inProgress && progressId && startTime) {
        // Re-show the box and resume checking
        const box = showFloatingBanner({
            text: `Update in progress.`
        });
        await extras.waitForBulkGrading(box); // reuse existing polling function
    }
    localStorage.setItem(`updateInProgress_${courseId}`,"true");

    const box = showFloatingBanner({
        text: `Preparing to update "${AVG_OUTCOME_NAME}": checking setup...`
    });
    alert("You may minimize this browser or switch to another tab, but please keep this tab open until the process is fully complete.")
    try {

        const {data, assignmentId, rubricId, rubricCriterionId, outcomeId}
            = await setupOutcomeAssignmentRubric(courseId, box);

        if (VERBOSE_LOGGING) console.log(`assigmentId: ${assignmentId}`)
        if (VERBOSE_LOGGING) console.log(`rubricId: ${rubricId}`)

        box.setText(`Calculating "${AVG_OUTCOME_NAME}" scores...`);

        // calculating student averages is fast, it is updating them to grade book that is slow.
        const averages = extras.calculateStudentAverages(data, outcomeId);
        localStorage.setItem(`verificationPending_${courseId}`, "true");
        localStorage.setItem(`expectedAverages_${courseId}`, JSON.stringify(averages));
        localStorage.setItem(`outcomeId_${courseId}`, String(outcomeId));
        localStorage.setItem(`startTime_${courseId}`, new Date().toISOString());

        const numberOfUpdates = averages.length;

        if (numberOfUpdates === 0) {
            alert(`No changes to ${AVG_OUTCOME_NAME} have been found. No updates performed.`);
            box.remove();
            extras.cleanUpLocalStorage()
            return;
        }

        // check if testing parameters used
        const testPerStudentUpdate = window.__TEST_ONE_BY_ONE__;
        const testBulkUpdate = window.__TEST_BULK_UPLOAD__;

        let testing = false;

        if (testPerStudentUpdate) {
            if (VERBOSE_LOGGING) {console.log("Entering per student testing...")}
            box.hold(`TESTING: One-by-one updating "${AVG_OUTCOME_NAME}" scores for all students...`);
            testing = true;
            //await postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, testing = true);
        }

        if (testBulkUpdate) {
            if (VERBOSE_LOGGING) {console.log("Entering bulk upload test...")}
            box.hold(`TESTING: Bulk updating "${AVG_OUTCOME_NAME}" scores for all students...`);
            // await beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages);
            // await waitForBulkGrading(box);
        }

        //else { // no testing parameters used
        if (numberOfUpdates < PER_STUDENT_UPDATE_THRESHOLD || testing) {
            //box.setText(`Detected ${numberOfUpdates} changes  updating scores one at a time for quicker processing.`);
            let message = `Detected ${numberOfUpdates} changes  updating scores one at a time for quicker processing.`
            box.hold(message,3000);
            if (VERBOSE_LOGGING) {
                console.log('Per student update...')
            }
            await extras.postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, testing);
        } else {
            //box.setText(Detected ${numberOfUpdates} changes  updating scores all at once for error prevention`);
            let message = `Detected ${numberOfUpdates} changes using bulk update for error prevention`;
            box.hold(message,3000);

            if (VERBOSE_LOGGING) {
                console.log(`Bulk update, Detected ${numberOfUpdates} changes`)
            }
            const progressId = await extras.beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages);
            if (VERBOSE_LOGGING) console.log(`progressId: ${progressId}`)
            await extras.waitForBulkGrading(box);
        }

        //}

        await extras.verifyUIScores(courseId, averages, outcomeId, box);

        let elapsedTime = extras.getElapsedTimeSinceStart();

        // Stop the elapsed timer to prevent duplicate elapsed time display
        extras.stopElapsedTimer(box);

        box.setText(`${numberOfUpdates} student scores updated successfully! (elapsed time: ${elapsedTime}s)`);

        // await new Promise(resolve => setTimeout(resolve, 50));
        // setTimeout(() => box.remove(), 2500);

        localStorage.setItem(`duration_${getCourseId()}`,elapsedTime);
        localStorage.setItem(`lastUpdateAt_${getCourseId()}`, new Date().toISOString());

        const toolbar = document.querySelector('.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]');
        if (toolbar) extras.renderLastUpdateNotice(toolbar, courseId);

        alert(`"All ${AVG_OUTCOME_NAME}" scores have been updated. (elapsed time: ${elapsedTime}s) \nYou may need to refresh the page to see the new scores.`);
    }//end of try
    catch (error) {
        // Clean up UI and localStorage when user declines or error occurs
        console.warn("Update process stopped:", error.message);
        box.setText(`Update cancelled: ${error.message}`);

        // Remove the banner after a short delay
        setTimeout(() => {
            box.remove();
        }, 3000);

        extras.cleanUpLocalStorage();
    }
    finally
    {
        extras.cleanUpLocalStorage()
    }
}


