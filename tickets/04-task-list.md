---
status: done
spec: specs/spec.md (Domain rules, Pagination and cursors), must-have 1
---

# 04: Task list with filters, sorting and pagination

**What to build:** The `tasks` connection with every filter and sort from the spec and opaque, expiring cursors. Proves must-have 1 is implementable.

**Blocked by:** 03

- [x] Filters status, priority, process, search, due-before; OR within a field, AND across fields
- [x] Search is a case-insensitive substring match on title; empty string means no filter
- [x] `dueBefore` excludes tasks without due date
- [x] Sorts due ascending and descending, created descending, priority descending; tasks without due date last for due sorts; ties broken by ID
- [x] Without a status filter all statuses are returned
- [x] Connection offers `edges` (with cursor) and `nodes`, `pageInfo` with `hasNextPage` and `endCursor`; no total count, no backward pagination
- [x] `first` defaults to 20, is capped silently at 100, below 1 gives `VALIDATION_FAILED`
- [x] Cursors are opaque base64 with sort key, ID, filter/sort hash and issue time
- [x] Cursor from a different filter or sort, or older than 10 minutes (via the clock), gives `BAD_CURSOR`
- [x] Builder tests: each filter and sort, full pagination run without duplicates or gaps, cursor mismatch and expiry, `first` bounds

## Result (2026-10-05)

- 63 builder tests green, typecheck clean.
- Pagination resumes from the sort key stored in the cursor, so it works even when the task behind the cursor changed or was removed.
- With 10,000 tasks: first page about 20 ms, full run over 100 pages about 0.4 s.

## Deviations and findings

- Errors must be created with `createGraphQLError` from graphql-yoga. A `GraphQLError` from `graphql` is a different class instance under the builder tests (dual ESM/CJS package) and gets masked as `INTERNAL_SERVER_ERROR`. All mock errors go through `mockError()` in `errors.ts`.
- Spec updated: empty lists and empty strings in the filter mean no filter; search is not trimmed; `dueBefore` must be a strict ISO 8601 date-time with time zone, otherwise `VALIDATION_FAILED` with a field error. `parseDateTime()` in `time.ts` is reusable for date values in ticket 05.
- Cursors with a forged sort key or an issue time in the future are rejected with `BAD_CURSOR`.
- `VALIDATION_FAILED` for `first < 1` also carries a `fieldErrors` entry for `first`, consistent with the field-error shape.
