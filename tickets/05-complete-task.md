---
status: ready-for-agent
spec: specs/spec.md (Validation rules, Error convention), must-have 3
---

# 05: Completing a task with validation and errors

**What to build:** `completeTask` with optimistic concurrency, full server-side validation and the error convention from the spec. Proves must-have 3 is implementable (except the lost response, which comes with ticket 06).

**Blocked by:** 03

- [ ] Allowed from `OPEN` and `IN_PROGRESS`; success sets `COMPLETED`, `completedBy` (viewer), `completedAt`, version +1, and returns the task
- [ ] Version mismatch gives `CONFLICT` with `currentVersion`
- [ ] Task no longer open gives `FAILED_PRECONDITION` with `currentStatus`
- [ ] Removed task gives `NOT_FOUND`
- [ ] All validation rules from the spec, including required semantics, pattern as whole-value JavaScript regex, inclusive bounds, step relative to min, boolean required means true, decision comment rule
- [ ] Input rules: exactly one value field set and matching the field type, at most one value per key, unknown keys fail, optional fields may be omitted
- [ ] All violations returned together as `VALIDATION_FAILED` with `fieldErrors: [{ key, message }]`
- [ ] Errors always use `extensions.code` (lowercase key)
- [ ] Builder tests for happy path and every error case, including required comment on reject
