pushing will automatically update dev

to update production:
npm run build:dev
npm run build:prod
then push


For checking version in DevTools: CG.version



## Next Steps

~~TODO: SpeedGrader - Find lowest rubric score and use that for grade override~~
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
~~TODO: remove canvasHelpers.js?~~
~~TODO: get rid of all references to current score~~
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
## Admin Dashboard - Improvements
    - make sure it doesn't reproduce unnecessary code
    - Use don't hard code colors - use theme colors
    - make better json editor


## Agent Recommendations
### Recommendations
### For v1.0.2 (Next Patch):
    Consider adding:
    1. Version selector UI in loader generator panel
    2. Configuration editors for outcome/assignment/rubric names
    3. Excluded keywords editor with add/remove functionality
### For v1.1.0 (Next Minor):
    Consider adding API-based features:
    1. Grading scheme detector (read-only API call)
    2. Rubric ratings inspector (read-only API call)
    3. Override settings checker (read-only API call)
These would require careful API integration but would provide valuable diagnostic information.