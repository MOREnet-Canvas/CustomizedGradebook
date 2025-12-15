// src/gradebook/updateFlow.js

import {
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
import { getAssignmentId } from "../utils/canvasHelpers.js";
import { calculateStudentAverages } from "../services/gradeCalculator.js";
import { beginBulkUpdate, waitForBulkGrading, postPerStudentGrades } from "../services/gradeSubmission.js";
import { verifyUIScores } from "../services/verification.js";
import { cleanUpLocalStorage } from "../utils/stateManagement.js";
import { getElapsedTimeSinceStart, stopElapsedTimer, renderLastUpdateNotice } from "../utils/uiHelpers.js";
import {
    handleError,
    getUserFriendlyMessage,
    safeFetch,
    safeJsonParse,
    UserCancelledError,
    TimeoutError,
    ValidationError
} from "../utils/errorHandler.js";
import { UpdateFlowStateMachine, STATES } from "./stateMachine.js";
import { STATE_HANDLERS } from "./stateHandlers.js";

import {
    getCourseId,
    getTokenCookie,
    courseHasAvgAssignment,
    isDashboardPage,
    getUserRoleGroup
} from "../utils/canvas.js";

import { debounce, inheritFontStylesFrom } from "../utils/dom.js";
import { logger } from "../utils/logger.js";

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
                    handleError(error, "updateScores", { showAlert: true });
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
            logger.debug("Gradebook page and toolbar found.");
            callback(toolbar);
        } else if (attempts++ > 33) {
            clearInterval(intervalId);
            logger.warn("Gradebook toolbar not found after 10 seconds, UI not injected.");
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
        logger.debug("data: ", data);

        let outcomeObj = getOutcomeObjectByName(data);
        logger.debug("outcome match: ", outcomeObj);
        logger.debug("outcome id: ", outcomeObj?.id);
        outcomeId = outcomeObj?.id;

        if (!outcomeId) {
            let confirmCreate = confirm(`Outcome "${AVG_OUTCOME_NAME}" not found.\nWould you like to create:\nOutcome: "${AVG_OUTCOME_NAME}"?`);
            if (!confirmCreate) throw new UserCancelledError("User declined to create missing outcome.");
            box.setText(`Creating "${AVG_OUTCOME_NAME}" Outcome...`);
            await createOutcome(courseId);
            continue; // start while loop over to make sure outcome was created and found.
        }

        // will only find assignmentObj if it has been associated with outcome
        let assignmentObj = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj);
        logger.debug("assignment object: ", assignmentObj);

        if (!assignmentObj) { // Find the assignmentObj even if an outcome / rubric hasn't been associated yet
            const assignmentObjFromName = await getAssignmentId(courseId);
            if (assignmentObjFromName) {
                const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentObjFromName}`);
                assignmentObj = await res.json();
                logger.debug("Fallback assignment found by name, has not been associated with outcome yet:", assignmentObj);
            }
        }

        assignmentId = assignmentObj?.id; // if assigmentObj is still null even after looking by name, create it
        if (!assignmentId) {
            let confirmCreate = confirm(`Assignment "${AVG_ASSIGNMENT_NAME}" not found.\nWould you like to create:\nAssignment: "${AVG_ASSIGNMENT_NAME}"?`);
            if (!confirmCreate) throw new UserCancelledError("User declined to create missing assignment.");
            box.setText(`Creating "${AVG_ASSIGNMENT_NAME}" Assignment...`);
            assignmentId = await createAssignment(courseId);
        }

        let result = await getRubricForAssignment(courseId, assignmentId);
        rubricId = result?.rubricId;
        rubricCriterionId = result?.criterionId;

        if (!rubricId) {
            let confirmCreate = confirm(`Rubric "${AVG_RUBRIC_NAME}" not found.\nWould you like to create:\nRubric: "${AVG_RUBRIC_NAME}"?`);
            if (!confirmCreate) throw new UserCancelledError("User declined to create missing rubric.");
            box.setText(`Creating "${AVG_RUBRIC_NAME}" Rubric...`);
            rubricId = await createRubric(courseId, assignmentId, outcomeId);
            continue; // everything should be setup at this point, re-run while loop to make sure
        }

        outcomeAlignmentCorrectlySet = true;
    }

    return { data, assignmentId, rubricId, rubricCriterionId, outcomeId };
}

export async function getRollup(courseId) {
    const response = await safeFetch(
        `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
        {},
        "getRollup"
    );
    const rollupData = await safeJsonParse(response, "getRollup");
    logger.debug("rollupData: ", rollupData);
    return rollupData;
}

export function getOutcomeObjectByName(data) {
    const outcomeTitle = AVG_OUTCOME_NAME;
    logger.debug("Outcome Title:", outcomeTitle);
    logger.debug("data:", data);
    const outcomes = data?.linked?.outcomes ?? [];
    logger.debug("outcomes: ", outcomes);
    if (outcomes.length === 0) {
        logger.warn("No outcomes found in rollup data.");
        return null;
    }
    const match = outcomes.find(o => o.title === outcomeTitle);
    logger.debug("match: ", match);
    if (!match) {
        logger.warn(`Outcome not found: "${outcomeTitle}"`);
    }
    return match ?? null;//match?.id ?? null;
}

export async function createOutcome(courseId) {
    const csrfToken = getTokenCookie('_csrf_token');

    const randomSuffix = Math.random().toString(36).substring(2, 10); // 8-char alphanumeric
    const vendorGuid = `MOREnet_${randomSuffix}`;


    const ratingsCsv = OUTCOME_AND_RUBRIC_RATINGS
        .map(r => `${r.points},"${r.description}"`)
        .join(',');

    const csvContent =
        `vendor_guid,object_type,title,description,calculation_method,mastery_points\n` +
        `"${vendorGuid}",outcome,"${AVG_OUTCOME_NAME}","Auto-generated outcome: ${AVG_OUTCOME_NAME}",latest,"${DEFAULT_MASTERY_THRESHOLD}",${ratingsCsv}`;


    logger.debug("Importing outcome via CSV...");

    const importRes = await safeFetch(
        `/api/v1/courses/${courseId}/outcome_imports?import_type=instructure_csv`,
        {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "text/csv",
                "X-CSRF-Token": csrfToken
            },
            body: csvContent
        },
        "createOutcome"
    );

    const importData = await safeJsonParse(importRes, "createOutcome");
    const importId = importData.id;
    logger.debug(`Outcome import started: ID ${importId}`);

    // Wait until the import completes
    let attempts = 0;
    let status = null;
    const maxAttempts = 15;
    const pollIntervalMs = 2000;

    while (attempts++ < maxAttempts) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
        const pollRes = await safeFetch(
            `/api/v1/courses/${courseId}/outcome_imports/${importId}`,
            {},
            "createOutcome:poll"
        );
        const pollData = await safeJsonParse(pollRes, "createOutcome:poll");

        const state = pollData.workflow_state;
        logger.debug(`Poll attempt ${attempts}: ${state}`);

        if (state === "succeeded") {
            status = pollData;
            break;
        } else if (state === "failed") {
            throw new Error("Outcome import failed");
        }
    }

    // After 30s with no result
    if (!status) {
        throw new TimeoutError(
            "Timed out waiting for outcome import to complete",
            maxAttempts * pollIntervalMs
        );
    }

    logger.debug("Outcome fully created");
}

export async function getAssignmentObjectFromOutcomeObj(courseId, outcomeObject) {
    const alignments = outcomeObject.alignments ?? [];

    for (const alignment of alignments) {
        if (!alignment.startsWith("assignment_")) continue;

        const assignmentId = alignment.split("_")[1];
        const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
        if (!res.ok) continue;

        const assignment = await res.json();
        if (assignment.name === AVG_ASSIGNMENT_NAME) {
            logger.debug("Assignment found:", assignment);
            return assignment;
        }
    }

    // If no match found
    logger.warn(`Assignment "${AVG_ASSIGNMENT_NAME}" not found in alignments`);
    return null;
}

export async function createAssignment(courseId) {
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

    const res = await safeFetch(
        `/api/v1/courses/${courseId}/assignments`,
        {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify(payload)
        },
        "createAssignment"
    );

    const assignment = await safeJsonParse(res, "createAssignment");
    logger.info("Assignment created:", assignment.name);
    return assignment.id;
}

export async function getRubricForAssignment(courseId, assignmentId) {
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

    logger.debug("Found rubric and first criterion ID:", {rubricId, criterionId});

    return {rubricId, criterionId};
}

export async function createRubric(courseId, assignmentId, outcomeId) {
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


    const response = await safeFetch(
        `/api/v1/courses/${courseId}/rubrics`,
        {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify(rubricPayload)
        },
        "createRubric"
    );

    const rubric = await safeJsonParse(response, "createRubric");
    logger.debug("Rubric created and linked to outcome:", rubric);
    return rubric.id;
}

async function startUpdateFlow() {
    const courseId = getCourseId();
    if (!courseId) throw new ValidationError("Course ID not found", "courseId");

    // Try to restore previous state
    const stateMachine = new UpdateFlowStateMachine();
    const restored = stateMachine.loadFromLocalStorage(courseId);

    if (restored) {
        logger.info('Resuming update flow from saved state:', stateMachine.getCurrentState());
    }

    // Create banner
    const banner = showFloatingBanner({
        text: `Preparing to update "${AVG_OUTCOME_NAME}": checking setup...`
    });

    // Initialize context
    stateMachine.updateContext({ courseId, banner });

    // Alert user
    alert("You may minimize this browser or switch to another tab, but please keep this tab open until the process is fully complete.");

    try {
        // Start from IDLE if not restored, otherwise continue from saved state
        if (!restored) {
            stateMachine.transition(STATES.CHECKING_SETUP);
        }

        // Run state machine loop
        while (stateMachine.getCurrentState() !== STATES.IDLE) {
            const currentState = stateMachine.getCurrentState();

            // Skip IDLE and ERROR states in the loop
            if (currentState === STATES.IDLE || currentState === STATES.ERROR) {
                break;
            }

            logger.debug(`Executing state: ${currentState}`);

            // Get handler for current state
            const handler = STATE_HANDLERS[currentState];

            if (!handler) {
                throw new Error(`No handler found for state: ${currentState}`);
            }

            // Execute handler and get next state
            const nextState = await handler(stateMachine);

            // Save state before transitioning
            stateMachine.saveToLocalStorage(courseId);

            // Transition to next state
            if (nextState !== currentState) {
                stateMachine.transition(nextState);
            }
        }

        // Update UI after completion
        const toolbar = document.querySelector('.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]');
        if (toolbar) renderLastUpdateNotice(toolbar, courseId);

    } catch (error) {
        // Transition to ERROR state
        stateMachine.updateContext({ error });
        stateMachine.transition(STATES.ERROR);
        stateMachine.saveToLocalStorage(courseId);

        // Handle error display
        if (error instanceof UserCancelledError) {
            const userMessage = getUserFriendlyMessage(error);
            alert(`Update cancelled: ${userMessage}`);
            banner.remove();
        } else {
            const userMessage = handleError(error, "startUpdateFlow", { banner });
            setTimeout(() => {
                banner.remove();
            }, 3000);
        }

        cleanUpLocalStorage();
    } finally {
        // Clear state machine from localStorage
        stateMachine.clearLocalStorage(courseId);
        cleanUpLocalStorage();
    }
}


