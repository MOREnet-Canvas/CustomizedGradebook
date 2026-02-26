# Parent Mastery Dashboard Setup Instructions
*(For Canvas Admins)*

This will add a **“View Mastery Dashboard”** button to the top of a course Front Page for use in the Canvas Parent app.

---

## Step 1 — Get the Course ID

1. Open the course in Canvas.
2. Look at the URL in your browser.

It will look like:

```
https://yourdistrict.instructure.com/courses/38297
```

The number after `/courses/` is the **Course ID**.

In this example:

```
38297
```

Make note of that number.

---

## Step 2 — Create the Mastery Dashboard Page

1. Go to **Pages** in the course.
2. Click **+ Page**.
3. Title the page:

```
Mastery Dashboard
```

4. Click **HTML Editor** and paste:

```html
<div id="parent-mastery-root"></div>
```

5. Click **Save & Publish**.

---

## Step 3 — Add the Button to the Front Page

1. Go to **Pages → Front Page**.
2. Click **Edit**.
3. Switch to the **HTML Editor**.
4. At the very top of the page content, paste the button below.

---

### Replace `COURSE_ID` with the number from Step 1

```html
<div style="margin: 16px 0;">
  <a
    href="/courses/COURSE_ID/pages/mastery-dashboard?cg_web=1"
    style="display:block; padding:14px; background:#005f9e; color:white; text-align:center; border-radius:8px; text-decoration:none; font-size:16px; font-weight:600;"
  >
    View Mastery Dashboard
  </a>
  <div style="font-size:12px; color:#666; margin-top:6px; text-align:center;">
    For parents/observers using the Canvas Parent app
  </div>
</div>
```

Example using course ID `38297`:

```html
href="/courses/38297/pages/mastery-dashboard?cg_web=1"
```

5. Click **Save & Publish**.

---

## Step 4 — Confirm Homepage Setting

1. Go to **Settings → Course Details**
2. Under **Homepage**, ensure it is set to:

```
Pages Front Page
```

3. Click **Update Course Details**

---

# Important Notes

- The `?cg_web=1` is required so the Parent app opens the page in its internal web view.
- The Mastery Dashboard functionality depends on the Mobile Theme script being installed at the root account.
- The button can remain visible to all users. The dashboard page will only render data for observers.