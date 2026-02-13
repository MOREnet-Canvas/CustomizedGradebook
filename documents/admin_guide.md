

# Quick reference guide for new features added to the Customized Gradebook theme script.

---

## Accessing the Admin Dashboard

### How to Open
1. Navigate to your Canvas account's Theme Editor
2. Look for the **"CG Tools"** button (appears near the JavaScript file control)
3. Click the button to open the Admin Dashboard in a new tab

### Dashboard Sections
The Admin Dashboard contains several panels:
- **Installed Theme Overrides**: Shows current theme configuration
- **Account Filter**: Configure which accounts the script should run on
- **Script Version**: Configure which version of the script to use
- **Configuration Settings**: Configure various settings for the script
  - **Enable Student Grade Page Customization**: Enable or disable student grade page customization
  - **Enable Grade Override**: Enable or disable grade override
  - **Enforce Course Override Setting**: Enable or disable enforcing course override setting
  - **Enforce Course Grading Scheme**: Enable or disable enforcing course grading scheme
  - **Excluded Outcome Keywords**, **UI Labels**, **Rating Scale**
- **Grading Schemes**: Configure grading schemes for the script


---

## 1. Score Sync (SpeedGrader)

### What It Does
Score Sync automatically calculates and submits assignment scores based on rubric assessments in SpeedGrader. This feature only works in **standards-based courses**.

When you grade a rubric in SpeedGrader, Score Sync:
1. Detects the rubric submission
2. Calculates a score using your selected method (MIN/AVG/MAX/SUM)
3. Automatically writes the score to the assignment grade field
4. Updates the grade input UI immediately

### How to Use

**In SpeedGrader:**
1. Open any assignment with a rubric in a standards-based course
2. Look for the **Score Sync** controls in the grading interface (appears as a checkbox with a dropdown)
3. Toggle the checkbox to enable/disable Score Sync for this assignment
4. Select your calculation method from the dropdown:
   - **MIN**: Uses the lowest rubric criterion score
   - **AVG**: Uses the average of all rubric criterion scores
   - **MAX**: Uses the highest rubric criterion score
   - **SUM**: Adds all rubric criterion scores together

**Settings:**
- Settings are saved **per-assignment** and **per-course**
- Assignment-level settings override course-level defaults
- Settings persist across SpeedGrader sessions

### Expected Outcomes
- After grading a rubric, the assignment score field updates automatically
- The calculated score appears in the "Assignment Score" display
- No manual score entry needed
- Grade is immediately visible in the gradebook

---

## 2. Refresh Mastery

### The Problem
Canvas LMS has a known issue where mastery levels and letter grade labels don't reliably display for standards-based assignments when `points_possible = 0`. Even though rubric scores are recorded correctly, Canvas may not show the corresponding mastery level descriptions (like "Target", "Developing") or calculate mastery status properly.

### What Refresh Mastery Does
Refresh Mastery forces Canvas to recalculate and display mastery levels by:
1. Temporarily setting the assignment's `points_possible` to match the grading scale maximum (e.g., 4)
2. Waiting for Canvas to propagate the change (default: 5 seconds)
3. Reverting `points_possible` back to 0
4. Applying the selected grading scheme to the assignment

This process triggers Canvas to recalculate mastery levels and persist the letter grade labels correctly.

### How to Use

**Manual Refresh (Assignment Kebab Menu):**
1. Navigate to the Gradebook
2. Find the assignment you want to refresh
3. Click the assignment's **kebab menu** (three dots)
4. Select **"Refresh Mastery"** from the menu
5. Wait for the success banner: "✓ Mastery Levels updated - Reload the page in ~30 seconds to see changes"
6. Reload the page after ~30 seconds

**Automatic Refresh (During Update Flow):**
- Refresh Mastery now runs **automatically** during the grade update flow
- Happens after grades are uploaded but before verification starts
- Applies to the "Current Score Assignment" (avg assignment)
- No manual action needed

### Expected Outcomes
- Mastery level descriptions appear in the gradebook (e.g., "Target", "Developing")
- Letter grades display correctly for students
- Mastery status calculations update properly
- Student grades remain unchanged (only display/calculation updates)

---

## 3. Enforce Course Grading Scheme

### What It Does
This feature flag automatically enables the course-level grading scheme setting via Canvas API when a grading scheme is selected in the Admin Dashboard.

**Without this feature:**
- Teachers must manually enable the grading scheme in Canvas course settings
- Grading scheme selection in Admin Dashboard only affects assignments, not course-level display

**With this feature enabled:**
- Script automatically calls Canvas API to enable course-level grading scheme
- Course setting updates during the grade update flow
- Ensures consistency between assignment and course-level grading

### How to Enable

**In the Admin Dashboard:**
1. Open the Admin Dashboard (see "Accessing the Admin Dashboard" above)
2. Scroll to the **"Account Settings"** section
3. Find the **"Feature Flags"** subsection
4. Locate the checkbox: **"Enforce Course Grading Scheme"**
5. Check the box to enable
6. Click **"Generate Loader"** to create updated theme script
7. Download and install the new loader in Theme Editor

### When to Use
Enable this feature when:
- You want grading schemes to apply automatically at the course level
- You want override grades to display with mastery-level descriptions
- You want consistent grading scheme application across all course views

Leave disabled when:
- Teachers should control course-level grading scheme settings manually
- You want to preserve teacher autonomy over grading display

### Expected Outcomes
- Course-level grading scheme setting enables automatically during updates
- Override grades display using grading scheme descriptions
- No manual course setting changes needed

---

## 4. Testing the New Features

### Recommended Test: 25-26 PLP Integrated Algebra I

To test Score Sync and see override grade changes:

1. **Navigate to the course**: 25-26 PLP Integrated Algebra I
2. **Grade a new assignment**:
   - Open an assignment with a rubric in SpeedGrader
   - Use the Score Sync controls to test MIN/AVG/MAX/SUM methods
   - Grade the rubric for a few students
   - Verify scores auto-populate in the assignment grade field

3. **Run an update**:
   - Go to the Gradebook
   - Click the **"Update Current Score"** button
   - Wait for the update flow to complete

4. **Check override grades**:
   - **Before update**: Override grades show as traditional letter grades (A, B, C, D, F)
   - **After update**: Override grades should change to mastery-level descriptions (Target, Developing, Beginning, Exemplary, etc.)
   - Verify the grading scheme descriptions match your selected scheme

### What You Should See
- Score Sync automatically calculates assignment scores from rubrics
- Refresh Mastery runs automatically during the update (no manual action needed)
- Override grades change from A-F to mastery descriptions (if grading scheme is configured)
- Mastery levels display correctly in the gradebook

---

## Support

For questions or issues with these features, contact the MOREnet development team.