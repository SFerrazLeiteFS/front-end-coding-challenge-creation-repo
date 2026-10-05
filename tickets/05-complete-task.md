---
status: done
spec: specs/spec.md (Validation rules, Error convention), must-have 3
---

# 05: Completing a task with validation and errors

**What to build:** `completeTask` with optimistic concurrency, full server-side validation and the error convention from the spec. Proves must-have 3 is implementable (except the lost response, which comes with ticket 06).

**Blocked by:** 03

- [x] Allowed from `OPEN` and `IN_PROGRESS`; success sets `COMPLETED`, `completedBy` (viewer), `completedAt`, version +1, and returns the task
- [x] Version mismatch gives `CONFLICT` with `currentVersion`
- [x] Task no longer open gives `FAILED_PRECONDITION` with `currentStatus`
- [x] Removed task gives `NOT_FOUND`
- [x] All validation rules from the spec, including required semantics, pattern as whole-value JavaScript regex, inclusive bounds, step relative to min, boolean required means true, decision comment rule
- [x] Input rules: exactly one value field set and matching the field type, at most one value per key, unknown keys fail, optional fields may be omitted
- [x] All violations returned together as `VALIDATION_FAILED` with `fieldErrors: [{ key, message }]`
- [x] Errors always use `extensions.code` (lowercase key)
- [x] Builder tests for happy path and every error case, including required comment on reject

## Result (2026-10-05)

- 104 builder tests green, typecheck clean (41 for completion and validation).
- Order of checks: NOT_FOUND → FAILED_PRECONDITION (`currentStatus`) → CONFLICT (`currentVersion`) → VALIDATION_FAILED (`fieldErrors`). A repeated completion therefore gets FAILED_PRECONDITION, and `completedBy` shows the viewer, which is what the lost-response case in ticket 06 relies on.
- "Removed task gives NOT_FOUND" is covered via an unknown ID; removal itself arrives with the colleague in ticket 07, which deletes the task from the store.

## Deviations and findings

- Spec updated: text of only spaces counts as missing and is not stored; a multiple select rejects the same option twice; submitted values replace the stored ones (prefills not sent are dropped).
- Request-level errors had no `extensions.code` (variables of the wrong type come from graphql-yoga with HTTP 400 and no code). They now get `BAD_REQUEST`; yoga's own `GRAPHQL_PARSE_FAILED` / `GRAPHQL_VALIDATION_FAILED` stay. Spec and schema doc updated.
- A decision that is not allowed is reported on the decision only, not additionally on the comment.
- `completeTask` changes the stored task object in place. Ticket 07 must copy the task when it emits events with "the last state".
