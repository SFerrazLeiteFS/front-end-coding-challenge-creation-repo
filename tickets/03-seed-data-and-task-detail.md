---
status: done
spec: specs/spec.md (Domain rules, Schema), must-have 2
---

# 03: Seed data, task detail and form schemas

**What to build:** A deterministic data set from the seed, queryable as a single task with its form schema and prefilled values, plus the list of processes. Proves must-have 2 is implementable.

**Blocked by:** 01

- [x] Same seed always produces the same tasks, processes, forms and values; default 250 tasks, configurable up to 10,000
- [x] Six processes with one fixed form variant each; together they use every field type; at least two use a decision field with a required comment on reject
- [x] About five fixed team members; `assignee` is one of them or null
- [x] Statuses in the seed include `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`; completed tasks have `completedBy` and `completedAt`
- [x] `processes` returns all six as a plain list
- [x] `task(id)` returns the task with form fields and prefilled values; unknown ID returns null without error
- [x] Reset endpoint restores the seeded data set
- [x] Builder tests: every form variant loads, every field type appears, values readable, unknown ID returns null, same seed gives identical data, reset works

## Result (2026-10-05)

- 33 builder tests green, typecheck clean. 10,000 tasks generate in about 40 ms.
- Processes: invoice approval, leave request, contract review, purchase order, expense report, employee onboarding. Invoice, leave, contract and purchase have a decision with a required comment on reject. Expense report and onboarding have no decision.
- Team: Alex Berger, Jamie Novak, Morgan Fischer, Riley Weiss, Taylor Kim. Their IDs match the viewer for tokens like `alex.berger`, so a candidate can act as an assignee.
- Required booleans and decisions are never prefilled (prefills are defaults the user confirms).
- Reset is proven by advancing the clock two days: before the reset nothing changes, after it the dates shift and the titles stay. A mutation check (reset as no-op) makes the test fail.

## Deviations and findings

- Spec v2: "fully derived from the seed" was not achievable with current-looking dates. The data set now depends on the seed and the current UTC day; everything is relative to the start of that day, so it stays identical all day. Review caught an earlier version where `completedAt` drifted every hour; fixed and covered by a test (00:30 vs 23:30).
- Spec v2: the step check tolerates floating-point rounding (e.g. 533.54 with step 0.01). Ticket 05's validator must do the same.
- Form date limits (`min` = today) are part of the "fixed" form; they move with the day like all other dates.
- `/__mock/reset` needs no token, like all control endpoints.
