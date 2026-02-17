# TODO – Investigate Remote CSS Strategy for CG Dashboard

## 🎯 Objective
Explore how to reduce the size of the uploaded `css_loader.css` file by loading most dashboard styles remotely, while keeping Canvas stable and secure.

---

## 🔎 Phase 1 – Assess Current State

- [ ] Confirm current size of `css_loader.css`
- [ ] Identify which styles are strictly required locally
- [ ] Identify which styles are dashboard-only and safe to move remote
- [ ] Confirm no critical Canvas overrides depend on local-only loading
- [ ] Ensure no styles rely on runtime-injected `<style>` blocks

---

## 🌐 Phase 2 – Prepare Remote Hosting

- [ ] Choose hosting location:
  - GitHub Pages
  - Render
  - S3 / CloudFront
- [ ] Upload full dashboard CSS as:
  - `cg-admin-dashboard.css`
- [ ] Verify file is served with:
  - HTTPS
  - Correct MIME type (`text/css`)
- [ ] Add versioned file naming strategy:
  - Example: `cg-admin-dashboard.v1.2.0.css`

---

## 🔐 Phase 3 – Verify Canvas CSP Compatibility

- [ ] Check Account Settings → Security → CSP allowed domains
- [ ] Add remote domain if necessary
- [ ] Confirm no CSP violations appear in browser console
- [ ] Test in:
  - Root account
  - Sub-account
  - Gradebook
  - Theme Editor preview

---

## 🧪 Phase 4 – Implement Remote Loader

Replace uploaded CSS contents with:

```css
@import url("https://yourdomain.com/cg-admin-dashboard.v1.2.0.css");
```

- [ ] Upload minimal CSS file to Canvas
- [ ] Confirm dashboard styles load correctly
- [ ] Confirm sticky panel still renders properly
- [ ] Confirm header styles render correctly
- [ ] Test in incognito browser
- [ ] Test on slower network connection

---

## 🧠 Phase 5 – Stability & Fallback Planning

- [ ] Decide whether to keep a minimal local fallback style block
- [ ] Determine rollback strategy if remote CSS fails
- [ ] Document process for admins
- [ ] Document hosting update procedure

---

## 🚦 Decision Point

After testing:

- [ ] Continue with remote CSS strategy
OR
- [ ] Keep fully local CSS and revisit architecture later

---

## Important Constraints

- Remote domain must be CSP-approved.
- CSS must be served over HTTPS.
- Avoid runtime style injection where possible.
- Keep the uploaded Canvas CSS file minimal and stable.