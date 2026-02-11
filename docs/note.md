pushing will automatically update dev

to update production:
npm run build:dev
npm run build:prod
then push


For checking version in DevTools: CG.version



## Next Steps
TODO: Have the button appear for CBE courses on both gradebook pages
TODO: Add Checks for assignments
- have they had mastery refresh done?
- do they have points possible set to 0?
- what grading scheme are they using?
- are all assignments using same grading scheme?
TODO: Need to add choices for current assignment configuration, and suggestions.
TODO: refactor accountSettingsPanel.js it is a hot mess at this point
TODO: write out "production", clean up logging



## Debugging
TODO: The python script can make the rubric criteria ignore_for_scoring and have the assignments points set to zero, and still submit a score, not sure why ignore_for_scoring keeps this script from adding a grade to the assignment but not the outcome (rubric assessment exists, but looks blank in UI)

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
 - [ ] **determine grading scheme**
 - [ ] determine rubric ratings
 - [x] if override is enabled for account
 - [x] if override should be enforced for course
 - [x] script download
 - [x] warning that script has changed
 - [x] version number and selector
 - [x] excluded words from outcome
 - [x] extra script inclusion
 - [ ] cg_ indicator
 - [x] button label
 - [x] outcome name
 - [x] assignment name
 - [x] rubric name
 - TODO: add options for determining standards based courses
   - name patterns
   - avg assignment
   - grading scheme
   - outcomes used?

## Admin Dashboard - Improvements
    - make sure it doesn't reproduce unnecessary code
    - Use don't hard code colors - use theme colors
    - make better json editor
    - CSS downloader / alert
    - add option to manually type in version and make sure it will work.


## Agent Recommendations

### For v1.1.0 (Next Minor):
    Consider adding API-based features:
    1. Grading scheme detector (read-only API call)
    2. Rubric ratings inspector (read-only API call)
    3. Override settings checker (read-only API call)
These would require careful API integration but would provide valuable diagnostic information.

## issue 1
There needs to be a check for role and page before course id: 
```------ Account JS is duplicated in Canvas ------
customGradebookInit.js:1 Customized Gradebook Loaded
customGradebookInit.js:1 Environment: prod
customGradebookInit.js:1 Build Version: 2026-02-09 10:03:31 AM (prod, 7127d9d)
customGradebookInit.js:1 Debug logging: disabled
customGradebookInit.js:1 [INFO] Running in PROD mode
customGradebookInit.js:1 [INFO] Build environment: prod
customGradebookInit.js:1 [INFO] Initializing student grade customizations
customGradebookInit.js:1 [ERROR] Course ID not found on page.
```