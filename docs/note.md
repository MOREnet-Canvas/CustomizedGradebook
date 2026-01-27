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
TODO: Add Checks for assignments
- have they had mastery refresh done?
- do they have points possible set to 0?
- what grading scheme are they using?
- are all assignments using same grading scheme?


## Debugging

## Grade Customization
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
 - determine grading scheme
 - determine rubric ratings
 - if override is enabled for account
 - if override should be enforced for course
 - script and css downloads
 - warning that script has changed
 - version number and selector
 - excluded words from outcome
 - extra script inclusion
 - cg_ indicator
 - button label
 - outcome name
 - assignment name
 - rubric name