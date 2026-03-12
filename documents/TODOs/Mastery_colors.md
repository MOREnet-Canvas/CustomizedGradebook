# Canvas Outcome Proficiency Integration — TODO

## Goal
Retrieve **Outcome Proficiency (mastery color scales)** from Canvas accounts and use them in:

1. **Admin Dashboard** – discover and store proficiency scales
2. **Mastery Dashboard** – render mastery colors using the actual Canvas scale

This avoids guessing mastery colors and ensures the dashboard matches Canvas.

---

# Phase 1 — Test the API

## Test endpoint in browser console

Run this in Canvas DevTools:

```javascript
fetch("/api/v1/accounts/1/outcome_proficiency")
  .then(r => r.json())
  .then(console.log)
```

Expected response structure:

```json
{
  "ratings": [
    {
      "description": "Exceeds",
      "points": 4,
      "color": "#2ecc71",
      "mastery": false
    }
  ]
}
```

### Tasks

- [ ] Confirm endpoint works for root account
- [ ] Inspect returned fields
- [ ] Verify color values exist
- [ ] Verify mastery threshold

---

# Phase 2 — Discover Proficiency Scales for All Accounts

Canvas districts may have **different proficiency scales per sub-account**.

## Endpoint

```
GET /api/v1/accounts/:account_id/outcome_proficiency
```

### Tasks

- [ ] Get list of accounts

```javascript
fetch("/api/v1/accounts")
```

- [ ] Loop through accounts
- [ ] Attempt to fetch proficiency scale for each
- [ ] Store valid responses

Example logic:

```javascript
accounts.forEach(account => {
  fetch(`/api/v1/accounts/${account.id}/outcome_proficiency`)
})
```

### Output structure

Store results like:

```json
{
  "account_id": 1,
  "account_name": "District Root",
  "proficiency": {
    "ratings": [...]
  }
}
```

---

# Phase 3 — Add to Admin Dashboard

## Admin Dashboard Section

Create new panel:

```
Outcome Proficiency Scales
```

Display:

| Account | Mastery Level | Ratings | Colors |
|-------|-------|-------|-------|

Example UI:

```
Account: District Root
Mastery: Target (3)

Exceeds           4      #2ecc71
Beyond Target     3.5    #4caf50
Target            3      #8bc34a
Approaching       2.5    #ffc107
Developing        2      #ff9800
Beginning         1.5    #f44336
```

### Tasks

- [ ] Create admin panel
- [ ] Fetch proficiency scales
- [ ] Display rating descriptions
- [ ] Display color hex values
- [ ] Mark mastery threshold
- [ ] Cache results

---

# Phase 4 — Store Proficiency Scale

Store scale for use by the Mastery Dashboard.

Possible storage:

```
window.CG_PROFICIENCY_SCALE
```

Example:

```javascript
window.CG_PROFICIENCY_SCALE = {
  mastery_points: 3,
  ratings: [...]
}
```

### Tasks

- [ ] Save scale globally
- [ ] Cache in localStorage or config
- [ ] Fallback if unavailable

---

# Phase 5 — Use in Mastery Dashboard

Replace current color logic with real Canvas scale.

## Current logic

```
score >= mastery_points → green
```

## New logic

1. Determine rating band
2. Use rating.color

Example:

```javascript
function getRating(score, ratings) {
  const sorted = [...ratings].sort((a,b) => b.points - a.points);
  return sorted.find(r => score >= r.points);
}

const rating = getRating(score, proficiency.ratings);
const color = rating.color;
```

### Tasks

- [ ] Load proficiency scale
- [ ] Match score to rating band
- [ ] Apply color to mastery UI
- [ ] Ensure colors match Canvas

---

# Phase 6 — Fallback Behavior

If API is unavailable:

Fallback to derived logic:

```
score >= mastery_points → green
score near mastery → yellow
else → red
```

### Tasks

- [ ] Detect missing proficiency API
- [ ] Enable fallback colors
- [ ] Log warning for admins

---

# Phase 7 — Performance

Avoid repeated API calls.

### Tasks

- [ ] Fetch proficiency scale once
- [ ] Cache per account
- [ ] Refresh only when admin reloads config

---

# Final Result

Mastery Dashboard will:

- Use **real Canvas mastery colors**
- Match **Learning Mastery Gradebook visuals**
- Support **multiple account scales**
- Require **no hardcoded color logic**

---