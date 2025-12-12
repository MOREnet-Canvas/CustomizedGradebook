stateDiagram-v2
%% ---------------------------
%% STATE GROUPS (LAYOUT)
%% ---------------------------
state "Setup & Validation" as SETUP {
[*] --> IDLE
IDLE --> CHECKING_SETUP: User clicks "Update Current Score"

        CHECKING_SETUP --> CREATING_OUTCOME: Outcome missing
        CHECKING_SETUP --> CREATING_ASSIGNMENT: Assignment missing
        CHECKING_SETUP --> CREATING_RUBRIC: Rubric missing
        CHECKING_SETUP --> CALCULATING: All resources exist
    }

    state "Resource Creation" as CREATION {
        CREATING_OUTCOME --> CHECKING_SETUP: Outcome created
        CREATING_ASSIGNMENT --> CHECKING_SETUP: Assignment created
        CREATING_RUBRIC --> CHECKING_SETUP: Rubric created
    }

    state "Calculate & Branch" as CALC {
        CALCULATING --> UPDATING_GRADES: Averages calculated
        CALCULATING --> COMPLETE: No changes needed
    }

    state "Updating Grades" as UPD {
        UPDATING_GRADES --> UPDATING_PER_STUDENT: < 500 students
        UPDATING_GRADES --> UPDATING_BULK: >= 500 students

        UPDATING_PER_STUDENT --> VERIFYING: All grades submitted
        UPDATING_BULK --> POLLING_PROGRESS: Bulk job started

        POLLING_PROGRESS --> POLLING_PROGRESS: Job still running
        POLLING_PROGRESS --> VERIFYING: Job completed
    }

    state "Verification" as VERIFY {
        VERIFYING --> VERIFYING: Scores not yet visible
        VERIFYING --> COMPLETE: All scores verified
    }


    %% ---------------------------
    %% ERROR HANDLING
    %% ---------------------------
    CHECKING_SETUP --> ERROR: User cancels
    CREATING_OUTCOME --> ERROR: Creation fails
    CREATING_ASSIGNMENT --> ERROR: Creation fails
    CREATING_RUBRIC --> ERROR: Creation fails
    CALCULATING --> ERROR: Calculation fails
    UPDATING_PER_STUDENT --> ERROR: Too many failures
    UPDATING_BULK --> ERROR: Bulk job fails
    POLLING_PROGRESS --> ERROR: Timeout
    VERIFYING --> ERROR: Verification fails

    ERROR --> IDLE: Reset/Retry
    COMPLETE --> IDLE: Reset


    %% ---------------------------
    %% STYLE DEFINITIONS
    %% ---------------------------

    classDef idle fill:#d9d9d9,stroke:#333,color:#000;
    class IDLE,COMPLETE idle;

    classDef setup fill:#cfe2ff,stroke:#4c6ef5,color:#000;
    class CHECKING_SETUP setup;

    classDef create fill:#e5d0ff,stroke:#9c36b5,color:#000;
    class CREATING_OUTCOME,CREATING_ASSIGNMENT,CREATING_RUBRIC create;

    classDef calc fill:#c3f7f3,stroke:#20c997,color:#000;
    class CALCULATING calc;

    classDef update fill:#ffe8cc,stroke:#f08c00,color:#000;
    class UPDATING_GRADES,UPDATING_PER_STUDENT,UPDATING_BULK,POLLING_PROGRESS update;

    classDef verify fill:#d2f8d2,stroke:#2b8a3e,color:#000;
    class VERIFYING verify;

    classDef error fill:#ffd6d6,stroke:#e03131,color:#000;
    class ERROR error;
