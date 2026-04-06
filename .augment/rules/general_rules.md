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

- Do NOT create documentation files, long explanations, or summaries.
- Do NOT explain code unless explicitly asked.
- Keep responses limited to code changes unless clarification is required.

---

### 2. File-Based Documentation Requires Explicit Request
Do NOT create, modify, or update **documentation files** unless the user explicitly requests it for that specific change set.

This includes:
- README files (`.md`, `.txt`, or similar)
- Architecture or design explanation documents
- Changelog entries

**Exceptions — always allowed without a request:**
- JSDoc comments (`/** */`) on functions, classes, and exported members
- Inline `//` comments explaining non-obvious logic
- Type annotations and parameter descriptions within code files

---

### 3. Use Existing Services — Do Not Recreate
Before writing any new utility, helper, or service function:

- Search the codebase for an existing implementation that covers the need
- Prefer calling or extending an existing service over creating a parallel one
- If an existing service is close but not quite right, prefer modifying it (safely) over duplicating it

If no existing service exists, create a new one — but:
- Place it where similar utilities live
- Name it consistently with the existing pattern
- Export it in a way that other modules can consume it

---

### 4. New Modules Must Consider Shared Use
When creating a new module or service:

- Identify whether any functions in it are likely to be needed by other modules
- If yes, export those functions explicitly (do not leave them as internal-only by default)
- Do not hardcode assumptions that tie the module to a single caller

---

### 5. Clarify Before Coding
If requirements are unclear or have multiple valid interpretations:
- Ask targeted clarification questions **before writing code**
- Do NOT guess silently

If uncertainty is minor and non-blocking:
- Make the smallest reasonable assumption
- State the assumption in **one short line only**

---

### 6. Terminal Commands
Do NOT run, simulate, or assume execution of terminal or shell commands.

- Ask the user to run commands themselves
- Wait for user-provided results if execution output is required

---

## Auto Rules (Quality Defaults)

### 7. Prefer Maintainable, Tight Implementations
When making changes, prefer:
- Simple, readable code over clever code
- Consistent naming and structure across the project
- Small modules with clear responsibility
- Removing dead code / duplication when encountered (only if safe and directly related)

Refactors ARE allowed when they improve correctness, clarity, or reduce duplication.

---

### 8. Safe Product Evolution
Changes that may affect the wider system must be explicit in the output:

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

---

## Manual Rules (Opt-In)

### 9. Documentation Mode
`.md`, `.txt`, or other standalone documentation files are allowed **only** when explicitly enabled, e.g.:
- "Doc mode on"
- "Update the README"
- "Add documentation for this"

---

### 10. Explain Mode
Explanations are allowed **only** when explicitly enabled, e.g.:
- "Explain why"
- "Walk me through this"
- "Debug mode on"

---

## Enforcement Check (Silent)
Before responding, verify:
- [ ] No `.md`/`.txt` documentation files created unless requested
- [ ] No prose explanations added unless requested
- [ ] No terminal commands executed or assumed
- [ ] No utility/service function created that duplicates an existing one
- [ ] New modules export shared-use functions explicitly