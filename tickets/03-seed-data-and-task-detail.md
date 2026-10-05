---
status: ready-for-agent
spec: specs/spec.md (Domain rules, Schema), must-have 2
---

# 03: Seed data, task detail and form schemas

**What to build:** A deterministic data set from the seed, queryable as a single task with its form schema and prefilled values, plus the list of processes. Proves must-have 2 is implementable.

**Blocked by:** 01

- [ ] Same seed always produces the same tasks, processes, forms and values; default 250 tasks, configurable up to 10,000
- [ ] Six processes with one fixed form variant each; together they use every field type; at least two use a decision field with a required comment on reject
- [ ] About five fixed team members; `assignee` is one of them or null
- [ ] Statuses in the seed include `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`; completed tasks have `completedBy` and `completedAt`
- [ ] `processes` returns all six as a plain list
- [ ] `task(id)` returns the task with form fields and prefilled values; unknown ID returns null without error
- [ ] Reset endpoint restores the seeded data set
- [ ] Builder tests: every form variant loads, every field type appears, values readable, unknown ID returns null, same seed gives identical data, reset works
