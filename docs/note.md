pushing will automatically update dev

to update production:
npm run build:dev
npm run build:prod
then push


For checking version in DevTools: CG.version



## Next Steps
TODO: Fix per student grade page as teacher
TODO: SpeedGrader - Find lowest rubric score and use that for grade override
TODO: Have the button appear for CBE courses on both gradebook pages
TODO: Admin dashboard


## Debugging
TODO: Make sure there isn't an option for notifying students of updates in the assignment creation or update
TODO: Teacher dashboard console says student role not found, but it still searches through courses, another debug message says no active student classes found.

## Grade Customization
TODO: Don't edit grade page so much especially the right side bar.
TODO: When no avg_assignment course grade page doesn't remove /4 fix?
TODO: Do we want to make points classes default to standards based?

## Possible Enhancements
TODO: figure out how to get grading scheme(s) → this might be easy way to determine class type
TODO: Mastery Refresh: This does not update rubric scores, so outcome results are unchanged. Maybe this needs to stay this way.

## Refactoring
TODO: remove canvasHelpers.js?
TODO: get rid of all references to current score
TODO: remove legacy code

## Admin Dashboard
 -  determine grading scheme
 - determine rubric ratings
 - if override is enabled for account
 - if override forced enabled for course
 - 