---
scope: workspace
types:
  - always
  - auto
  - manual
priority: highest
---

## Always Rules (Hard Constraints)

### 1. Code-Only by Default
DEFAULT behavior is **code-only output**.

- Do NOT create documentation, long explanations, or summaries.
- Do NOT explain code unless explicitly asked.
- Keep responses limited to code changes unless clarification is required.

---

### 2. Documentation Requires Explicit Request
Do NOT create, modify, or update documentation unless the user explicitly requests documentation **for that specific change set**.

This includes:
- README files
- Markdown files
- JSDoc / docstrings
- Header comments or block comments
- Architecture or design explanations

If documentation is desired, the user will ask.

---

### 3. Clarify Before Coding
If requirements are unclear or have multiple valid interpretations:
- Ask targeted clarification questions **before writing code**
- Do NOT guess silently

If uncertainty is minor and non-blocking:
- Make the smallest reasonable assumption
- State the assumption in **one short line only**

---

### 4. Terminal Commands
Do NOT run, simulate, or assume execution of terminal or shell commands.

- Ask the user to run commands themselves
- Wait for user-provided results if execution output is required

---

## Auto Rules (Quality Defaults)

### 5. Prefer Maintainable, Tight Implementations
When making changes, prefer:
- Simple, readable code over clever code
- Consistent naming and structure across the project
- Small modules with clear responsibility
- Removing dead code / duplication when encountered (only if it is safe and directly related)

Refactors ARE allowed when they improve correctness, clarity, or reduce duplication.

---

### 6. Safe Product Evolution
Changes that may affect the wider system are allowed, but must be explicit in the output:

- If adding a dependency, clearly list:
    - what dependency was added
    - why it is necessary
- If changing build/deploy config, clearly list:
    - what file changed
    - what behavior changes
- If changing file structure, clearly list:
    - what moved/renamed
    - new import paths if applicable

(No documentation files created/updated unless explicitly requested.)


## Manual Rules (Opt-In)

### 7. Documentation Mode
Documentation is allowed **only** when explicitly enabled by the user, e.g.:
- “Doc mode on”
- “Update the README”
- “Add documentation for this”

---

### 8. Explain Mode
Explanations are allowed **only** when explicitly enabled by the user, e.g.:
- “Explain why”
- “Walk me through this”
- “Debug mode on”

---

## Enforcement Check (Silent)
Before responding, ensure:
- No documentation was added unless requested
- No explanations were added unless requested
- No terminal commands were executed or assumed