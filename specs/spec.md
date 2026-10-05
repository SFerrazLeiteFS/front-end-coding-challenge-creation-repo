---
title: Starter repo for the Approval Inbox take-home
status: ready-for-agent
version: 2
date: 2026-10-05
sources: BRIEFING.md (v2), schema-and-mock.md (v2), task.md, specs/research.md, grilling session 2026-10-05
---

# Spec: Starter repo for the Approval Inbox take-home

## Problem Statement

FireStart is hiring a Senior Front-End Developer (React/Next.js). After the first interview, candidates get a half-day take-home: an Approval Inbox where users see workflow tasks and complete them. To make the submission say something about real engineering, candidates need a backend that behaves like ours on a normal day: slow at times, occasionally failing, partially failing, with colleagues editing the same data. Today no such backend exists, and the real gateway cannot be shared.

The hiring team also needs to evaluate submissions reproducibly: trigger a specific failure on demand against a candidate's app and see how it reacts, without telling the candidate in advance which edge cases exist. A senior candidate should think of them independently.

Finally, the starter must be safe to ship: no internal code, schema, hosts or wording that reveals how submissions are judged, and a clean single-commit history.

## Solution

A builder repo produces a `starter/` directory that is exported as a single commit to a private repo and handed to candidates as a ZIP. The starter contains:

- a GraphQL mock server that mirrors the shape of our gateway (connections, unions, errors in `extensions`, SSE subscriptions, bearer auth) and simulates realistic conditions: latency, unavailability, server errors, partial data, lost responses, expiring cursors and a simulated colleague
- a minimal Next.js scaffold with urql and codegen that proves one query works server-rendered and after client-side navigation, and nothing more
- the candidate-facing task description and an empty `NOTES.md` template

The mock documents only what a candidate needs to work (start, token, switching realistic conditions off, seed, reset). Everything else is discoverable in its source. The hiring team gets a builder-only review playbook with on-demand triggers for every behaviour.

## User Stories

### Candidate: getting started

1. As a candidate, I want `pnpm install && pnpm dev` to start mock and web app in under five minutes on Node LTS, so that I spend my half day on the task, not on setup.
2. As a candidate, I want no Docker, accounts or secrets, so that I can start on any machine.
3. As a candidate, I want a README with the task and a short "Getting started" section (Node and pnpm versions, ports, token), so that I know what to do and how to run it.
4. As a candidate, I want an example page that shows data from the mock rendered on the server, so that I see how Server Components fetch data.
5. As a candidate, I want a second example page that fetches the same data in a client component, reachable via client-side navigation, so that I see how the browser client and SSR hydration are wired.
6. As a candidate, I want generated, typed GraphQL documents already committed, so that the app runs without running codegen first.
7. As a candidate, I want a `codegen` script against the local schema file, so that I can regenerate types after writing new operations.
8. As a candidate, I want a working test setup with one example test, so that I can write my own tests immediately.
9. As a candidate, I want default lint and format configuration, so that I don't spend time on tooling.
10. As a candidate, I want an empty `NOTES.md` with headings for decisions, trade-offs, left out, next steps and AI usage, so that I know what the team expects to read.
11. As a candidate, I want to be free to choose another GraphQL client or test tools, so that I can use what I know best and explain why.

### Candidate: working against the mock

12. As a candidate, I want one GraphQL endpoint reachable from both the browser and the Next.js server, so that the setup matches a realistic architecture.
13. As a candidate, I want any non-empty bearer token to be accepted and to determine the viewer, so that I can simulate different users in different tabs.
14. As a candidate, I want a missing or empty token to fail with HTTP 401, so that I notice when a request path forgets the header.
15. As a candidate, I want to switch off latency, failures and the simulated colleague with one environment variable, so that I can develop and test against stable responses.
16. As a candidate, I want a seed that makes the data set reproducible, so that my tests and screenshots stay stable.
17. As a candidate, I want a reset endpoint, so that I can return to the seeded data set after experiments.
18. As a candidate, I want the README to tell me that responses vary in time, things occasionally go wrong and others work on the same data, so that I know the conditions without being given a checklist.
19. As a candidate, I want the mock's configuration options in one readable source file, so that I can find every option if I look.

### Candidate: task list

20. As a candidate, I want a paginated task list with cursor-based forward pagination, so that I can build infinite scroll or "load more".
21. As a candidate, I want both `edges` (with cursors) and `nodes` on the connection, so that I can choose the shape that suits me.
22. As a candidate, I want to filter by status, priority, process, title search and due date, so that I can build the required filters.
23. As a candidate, I want a list of all processes, so that I can populate a process filter.
24. As a candidate, I want sort options by due date (both directions), creation date and priority, so that I can offer sorting.
25. As a candidate, I want stable ordering with a deterministic tie-breaker and tasks without due date always last, so that pagination does not jump around.
26. As a candidate, I want a cursor from a different filter or sort, or an expired cursor, to fail with a clear error code, so that I can handle filter changes during infinite scroll.
27. As a candidate, I want the list to return all statuses when no status filter is set, so that I decide on a sensible default filter in the UI.

### Candidate: detail view and form

28. As a candidate, I want to fetch a single task with its form schema and prefilled values, so that I can build a detail view.
29. As a candidate, I want an unknown task ID to return `null`, so that I can show a "not found" state.
30. As a candidate, I want form fields to be polymorphic (text, number, date, select, boolean, decision), so that I build a renderer from the field schema.
31. As a candidate, I want each field's constraints (required, max length, pattern, min, max, step, options, multiple) in the schema, so that I can validate on the client.
32. As a candidate, I want a decision field whose comment becomes required for certain decisions, so that I have to handle a cross-field rule.
33. As a candidate, I want prefilled values as a union of typed values, so that I can initialise the form correctly.
34. As a candidate, I want to see who completed a task and when, so that I can show it in the UI.

### Candidate: completing a task

35. As a candidate, I want to complete a task by sending its expected version and all values, so that concurrent edits are detected.
36. As a candidate, I want a version mismatch to fail with a conflict code and the current version, so that I can offer reload or merge.
37. As a candidate, I want completing a no-longer-open task to fail with a precondition code and the current status, so that I can explain what happened.
38. As a candidate, I want completing a removed task to fail with a not-found code, so that I can handle deleted tasks.
39. As a candidate, I want server-side validation to return all field errors at once, keyed by field, so that I can show them next to the fields.
40. As a candidate, I want server-side validation to check every rule in the schema even if my client already did, so that I learn the server is the source of truth.
41. As a candidate, I want network failures to arrive as HTTP 503 without body, distinct from GraphQL errors, so that I can tell both failure paths apart.
42. As a candidate, I want to be able to find out after a failed retry whether I or a colleague completed the task, so that I can give correct feedback.

### Candidate: live updates

43. As a candidate, I want a subscription over SSE that emits events when tasks are created, updated, completed or removed, so that I can choose between subscription and polling.
44. As a candidate, I want events to carry the task's current state (last state for removed tasks), so that I can update my UI without refetching.
45. As a candidate, I want the stream to drop occasionally under realistic conditions, so that I have to think about reconnecting.
46. As a candidate, I want a simulated colleague to edit, complete, create, cancel and remove tasks, so that I experience real conflicts.

### Hiring team: evaluating submissions

47. As a reviewer, I want to trigger a specific behaviour (unavailable, internal error, partial data, lost response, slow response, conflict, validation error) on the next matching request, so that I can test a candidate's app on demand.
48. As a reviewer, I want to bump a task's version immediately, so that I can provoke a conflict while a form is open.
49. As a reviewer, I want to change rates and latency at runtime, so that I can make conditions harsher or calmer during the follow-up.
50. As a reviewer, I want a builder-only playbook with one command per behaviour and what a good reaction looks like, so that every reviewer evaluates the same way.
51. As a reviewer, I want none of these triggers mentioned in the candidate-facing docs, so that I see whether the candidate thinks of edge cases independently.
52. As a reviewer, I want a pairing extensions branch (file upload, bulk approve, live updates) that only touches schema and mock, so that it applies cleanly to any candidate's code during the session.

### Builder: shipping

53. As the builder, I want an export script that copies the starter into a fresh directory, creates a single "Initial commit" and pushes to the target repo, so that candidates never see builder history.
54. As the builder, I want the export to refuse to overwrite a non-empty target unless I pass an explicit force flag, so that I don't destroy history by accident.
55. As the builder, I want the export to fail if content, file names or the commit message contain forbidden terms or a firestart host name, so that nothing internal or revealing ships.
56. As the builder, I want exactly one allowed exception, the contact address, so that the task description can name a contact.
57. As the builder, I want a script that packages the exported repo as a ZIP without dependencies or history beyond the single commit, so that I can send it by mail.
58. As the builder, I want integration tests in the builder repo proving each must-have is implementable against the mock, so that I know the starter supports the task.
59. As the builder, I want one test per mock behaviour with fixed configuration and a controllable clock, so that every behaviour is reproducible.
60. As the builder, I want the mock tests to run in under ten seconds with realistic conditions off, so that I can run them on every change.

## Implementation Decisions

### Shape of the starter

- Starter layout as in the briefing: task README, NOTES template, schema file, mock server package with its own README, Next.js app, pnpm workspace root with scripts `dev`, `test`, `codegen`, `mock`.
- `dev` starts mock and web app together.
- Everything in the starter is in English and free of internal names, hosts and evaluation wording.

### Mock server

- graphql-yoga, TypeScript, run directly via `tsx` without a build step. Separate Node process on port 4000 (configurable), path `/graphql`, CORS allowing the web app origin on port 3000.
- Built through one factory that takes configuration (seed, rates, latency, chaos on/off, task count) and a clock, and returns a fetch-style handler. The CLI entry wraps it in an HTTP server. Tests use the factory directly.
- All state in memory. Restart or reset restores the seeded data set.
- Realistic conditions are decided per request in one place (`conditions`). HTTP-level effects (latency, 503, whole-operation `INTERNAL`, replacing a saved completion's response with 503, abort logging) live in one HTTP layer in front of graphql-yoga; the two field- and mutation-level effects (a failing `assignee`, conflict/validation triggers on `completeTask`) are read by the resolvers. Requests without a valid token skip all of this and always get 401.
- Defaults: latency 300 to 1500 ms uniform, 5 % HTTP 503, 2 % internal error for the whole operation, 3 % of `assignee` resolvers return null plus an error with path, 2 % of completions persist but respond 503, simulated colleague every 8 s, 250 tasks (max 10,000).
- One switch disables latency, all failure injection and the simulated colleague. With it off, responses are stable and immediate.
- Randomness: the data set is derived from the seed and the current UTC day. All dates (created, due, prefilled dates, date limits in forms) are relative to the start of that day, so the data looks current and stays identical all day; a reset on another day shifts the dates but keeps everything else. Behaviours are tested via rates of 0 or 1 and on-demand triggers, never by luck. Intermediate rates are reproducible only for sequential requests with the same seed; this is the documented limit.
- One injectable clock drives cursor expiry, the colleague interval and stream lifetime.
- Aborted requests are logged to the console with the operation name. No further behaviour.

### Control endpoints (in code, not in candidate docs)

- Reset to the seed.
- Change rates, latency and the realistic-conditions switch at runtime (same keys as the environment variables; start-only keys are rejected).
- Bump a task's version immediately (`POST /__mock/bump-version/:taskId`, emits `UPDATED`).
- Next-request trigger: applies one behaviour to the next request, optionally filtered by operation name or root field. Behaviours: unavailable (503), internal, partial, lost-response, slow (with duration), conflict, validation. The last three only apply to `completeTask` and wait for the next completion. Reset also drops pending triggers and restarts the random sequence.
- All are named and commented neutrally ("useful for testing").

### Auth

- Any non-empty bearer token is valid. The viewer's ID and display name are derived from the token.
- Missing or empty token: HTTP 401 with a small JSON message body, not a GraphQL error (mirrors the gateway).

### Schema (changes against schema-and-mock.md v2)

- Added: `processes` query returning a plain list of all processes (no connection).
- Added: `completedBy` (nullable user) and `completedAt` (nullable date-time) on `Task`.
- Added: `nodes` on the task connection next to `edges`.
- Removed: `totalCount`. Removed backward pagination (`before`, `last`, `hasPreviousPage`, `startCursor`).
- `first` defaults to 20, values above 100 are silently capped, values below 1 fail with `VALIDATION_FAILED`.
- Subscription `taskEvents(filter)` stays, payload `{ kind, task }` with kinds created, updated, completed, removed. For removed, `task` is the last state. An event is sent when the task matches the filter before or after the change, so subscribers learn when a task leaves their filter.
- Rest of the sketch (filter, enums, form field interface and six implementations, value union, complete input with one-of-style value input) stays as drafted.

### Domain rules

- Shared team inbox: every viewer sees the same tasks. `tasks` does not filter by viewer. `assignee` is informational: one of about five fixed team members, or null.
- Anyone may complete any open task. No permission checks, no forbidden error.
- Completion allowed from `OPEN` and `IN_PROGRESS`. `IN_PROGRESS` only comes from the seed or the colleague. No claim mutation.
- Filter semantics: OR within a field, AND across fields. Empty lists and empty strings mean no filter. Search is a case-insensitive substring match on title (not trimmed). `dueBefore` must be an ISO 8601 date-time with time zone (otherwise `VALIDATION_FAILED` with a field error for `dueBefore`) and excludes tasks without due date.
- Sorting: tasks without due date always last for due-date sorts. Ties broken by ID.
- Six processes with one fixed form variant each (e.g. invoice, leave, contract, purchase order, expenses, onboarding). Together they use every field type. At least two use a decision field with a required comment on reject.

### Pagination and cursors

- Cursors are opaque base64 and encode sort key, ID, a hash of filter and sort, and the issue time.
- A cursor from a different filter or sort, or older than 10 minutes, fails with `BAD_CURSOR`.
- Pagination continues "after this entry". Tasks changed by the colleague may move between pages (duplicate or skipped). The mock does not compensate.

### Validation rules (server is source of truth)

- Required means a value is present. Empty text (including text of only spaces) and empty selection count as missing; such empty values are not stored.
- Text: max length; pattern is a JavaScript regex without flags, matched against the whole value.
- Number: min and max inclusive; step relative to min (or zero), with a small tolerance for floating-point rounding (e.g. 533.54 with step 0.01 is valid).
- Date: min and max inclusive, date-time values.
- Select: every value must be an option, each at most once; exactly one when not multiple.
- Boolean: required means the value must be true (confirmation checkbox).
- Decision: value must be allowed; if the decision is in the comment-required list, the referenced text field becomes required.
- Per input: exactly one value field set, matching the field type; at most one value per key; unknown keys fail; optional fields may be omitted.
- All violations are returned together in `fieldErrors` (one entry per invalid field). Prefilled values are defaults; all fields stay editable (no read-only flag). On completion the stored values are replaced by exactly the submitted ones; prefilled values that are not sent are dropped.

### Error convention

- Errors carry `extensions.code`, always lowercase key, generic code names (not copied from the gateway).
- `NOT_FOUND`: completing a removed task. `task(id)` with an unknown ID returns null without error.
- `CONFLICT` with `currentVersion`: expected version mismatch.
- `FAILED_PRECONDITION` with `currentStatus`: task no longer open.
- `VALIDATION_FAILED` with `fieldErrors: [{ key, message }]`.
- `BAD_CURSOR`: foreign or expired cursor.
- `INTERNAL`: simulated server error, whole operation or single field.
- Network failure: HTTP 503 without body.
- Errors about the request itself keep or get a code too: `GRAPHQL_PARSE_FAILED` and `GRAPHQL_VALIDATION_FAILED` (from graphql-yoga) for documents that don't parse or don't match the schema, `BAD_REQUEST` (HTTP 400) for variables of the wrong type.
- Structured field errors are deliberately better than the real gateway; the difference is a discussion topic, not something to reproduce.

### Simulated colleague

- Every 8 s one action on a random `OPEN` or `IN_PROGRESS` task, drawn with the seed: 60 % update (priority, due date or a prefilled value, version +1), 20 % complete (completed by a colleague, version +1), 10 % create a new open task, 5 % cancel (version +1), 5 % remove entirely.
- Own completions also bump the version and emit a completed event.
- Off when realistic conditions are off. In tests, driven by the clock or the version-bump endpoint.

### Subscription

- SSE only (no WebSocket), as in the gateway.
- With realistic conditions on, each stream is closed after a random lifetime of 2 to 5 minutes; the switch is checked when the lifetime is up, so it also applies to streams opened while it was off. No separate switch. Reset ends all open streams. Whole-operation `INTERNAL` does not apply to subscription requests.

### Web scaffold

- Same majors as our webapp: Next 16, React 19, urql 5 with `@urql/next` 2, graphql 17 (fall back to 16 only if yoga or codegen don't support it; record as deviation), TypeScript 6, pnpm 12 pinned via `packageManager`, Node 24 or later.
- urql client with only the default document cache and fetch exchanges. No graphcache, no retry, no auth exchange, no subscription exchange, no error handling.
- Server Components fetch via `@urql/next/rsc`. Client components via the urql Next provider with SSR exchange.
- Token from a committed, non-secret env value used by both server and browser as bearer header. No login, no cookie, no middleware.
- Two example pages linking to each other: one Server Component and one client component, both showing only the viewer's display name. No tasks on example pages.
- graphql-codegen with client preset against the local schema file. Generated output is committed.
- Vitest, jsdom, Testing Library, user-event, one example test. Next default ESLint config, Prettier defaults.
- Not included: MSW, Playwright, Storybook, Tailwind, UI libraries, form libraries, filter components.

### Candidate-facing documentation

- Starter README: task text from `task.md` with two edits (visual design sentence reworded to "Visual design doesn't matter here; a plain, usable interface is enough.", contact set to s.ferraz-leite@firestart.com), plus a "Getting started" section.
- Mock README documents only: starting, port, token and viewer, the switch for realistic conditions, the seed, the reset endpoint, the general sentence about varying responses, failures and parallel edits, and a pointer to the config source file. Not documented: individual rates, runtime config, version bump, next-request trigger.
- `NOTES.md`: five empty headings (Decisions, Trade-offs, Left out, Next steps, AI usage).

### Builder-only documentation

- Review playbook: one entry per behaviour with the trigger command and what a good reaction looks like.
- `CONTEXT.md` and ADRs, if created, stay in the builder repo.

### Export and delivery

- Export script builds in a temporary directory, creates exactly one commit "Initial commit" and pushes to a remote given as parameter (default: the private org repo `front-end-coding-challenge`). Refuses a non-empty target without an explicit force flag; with it, force-pushes to keep a single commit.
- No GitHub template flag needed.
- Pre-export check fails on forbidden terms (pitfall, trap, gotcha, evaluation, assessment, interview, rubric, scoring) or any host name containing `firestart`, in file contents, file names and the commit message. The only exception is the contact address in the starter README. The word "FireStart" as company name stays allowed.
- Packaging script produces a ZIP of the exported repo without `node_modules`, sent to candidates by mail. Candidates submit as a private repo link or ZIP, as in the task.

### Pairing extensions

- Live on branch `pairing-extensions` in the builder repo. Touch only schema, mock and builder tests, never the web app. Rebased onto main after every ticket that changes the starter.

### Housekeeping

- `task.md` and `schema-and-mock.md` move to `docs/`. `schema-and-mock.md` is updated to match this spec.

## Testing Decisions

- Good tests exercise external behaviour only: requests in, status, body and `extensions` out. No tests of data generator, cursor encoding or plugin internals.
- **Mock (main seam):** the factory's fetch handler, with realistic conditions off, the next-request trigger and the injectable clock. Covers:
  - Must-have 1: every filter, every sort, full pagination run without duplicates or gaps (with colleague off), `BAD_CURSOR` on filter change and on expiry, `first` capping and lower bound, `processes`.
  - Must-have 2: each of the six form variants loads, every field type appears at least once, values are readable, unknown ID returns null.
  - Must-have 3: happy path, `CONFLICT`, `FAILED_PRECONDITION` with `completedBy`, `NOT_FOUND`, `VALIDATION_FAILED` with all field errors including required comment on reject, lost response followed by retry.
  - Must-haves 4 and 5 (candidate tests, NOTES): not applicable, no test.
  - One test per behaviour: 503, internal error, partial data, colleague actions, stream lifetime, 401, abort logging.
- **Mock smoke test:** real HTTP on a free port for 503, aborted request and an SSE stream over the wire.
- **Export (second seam):** the export script run against a local bare Git repo instead of GitHub: exactly one commit, check fails on an injected forbidden term and host, contact address passes, refusal without force on a non-empty target, ZIP contains no `node_modules`.
- **Web scaffold:** no automated tests in the builder repo. Done criteria 1 and 2 checked by hand before each export. The one example test in the starter belongs to candidates.
- Runtime target: mock tests under 10 seconds with realistic conditions off.
- Prior art: none in this repo. Our webapp uses Vitest, Testing Library and MSW; builder tests use Vitest for consistency.

## Out of Scope

- The Approval Inbox itself (list, filters, detail, form renderer, completion handling, retries, cache setup). That is the candidates' work.
- gRPC in any form.
- Real authentication, login, cookies, token refresh.
- Permissions, per-user task assignment, an "assigned to me" filter, claiming tasks.
- `totalCount`, backward pagination, read-only fields, idempotency keys.
- WebSocket transport for subscriptions.
- Automated end-to-end tests of the web scaffold.
- Per-candidate repos and outside collaborators (2FA requirement and seat limits in the org).
- File upload and bulk approve in the starter (pairing branch only).

## Further Notes

- Research findings with evidence: `specs/research.md` (builder repo only).
- Our webapp does not distinguish network from GraphQL errors and does not map server field errors into forms. The task asks candidates for exactly that. Legitimate, but worth knowing for the conversation.
- Our webapp's codegen config contains a hard-coded bearer token and the dev API host. Unrelated to this repo, but should be fixed there.
- Change log: version 1, 2026-10-05, from grilling session. Version 2, 2026-10-05 (ticket 03): data set derived from seed and current UTC day; step check tolerates floating-point rounding. Ticket 04: empty filter values, strict `dueBefore`. Ticket 05: blank text counts as missing and is not stored, submitted values replace stored ones, request-level error codes. Ticket 06: where conditions live, runtime chaos switch, trigger matching, reset. Ticket 07: bump-version endpoint name, event filter before/after, stream lifetime and reset.
