---
status: ready-for-agent
spec: specs/spec.md (Domain rules, Pagination and cursors), must-have 1
---

# 04: Task list with filters, sorting and pagination

**What to build:** The `tasks` connection with every filter and sort from the spec and opaque, expiring cursors. Proves must-have 1 is implementable.

**Blocked by:** 03

- [ ] Filters status, priority, process, search, due-before; OR within a field, AND across fields
- [ ] Search is a case-insensitive substring match on title; empty string means no filter
- [ ] `dueBefore` excludes tasks without due date
- [ ] Sorts due ascending and descending, created descending, priority descending; tasks without due date last for due sorts; ties broken by ID
- [ ] Without a status filter all statuses are returned
- [ ] Connection offers `edges` (with cursor) and `nodes`, `pageInfo` with `hasNextPage` and `endCursor`; no total count, no backward pagination
- [ ] `first` defaults to 20, is capped silently at 100, below 1 gives `VALIDATION_FAILED`
- [ ] Cursors are opaque base64 with sort key, ID, filter/sort hash and issue time
- [ ] Cursor from a different filter or sort, or older than 10 minutes (via the clock), gives `BAD_CURSOR`
- [ ] Builder tests: each filter and sort, full pagination run without duplicates or gaps, cursor mismatch and expiry, `first` bounds
