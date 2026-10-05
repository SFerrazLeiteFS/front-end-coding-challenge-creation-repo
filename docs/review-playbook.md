# Review playbook

Builder repo only. Never copy into `starter/`.

How to put a candidate's submission through every behaviour of the mock, on demand. Use it while reviewing the submission and during the follow-up conversation. What counts as a good reaction is a guide for the conversation, not a checklist to score.

## Setup

Run the submission against our mock from this repo, so the triggers below are available even if the candidate changed theirs:

```sh
pnpm --dir starter install
MOCK_CHAOS=off pnpm --dir starter mock          # calm: no delays, no failures, no colleague
pnpm --dir <submission>/apps/web dev            # or however the submission starts its app
```

`MOCK_CHAOS=off` keeps everything quiet until you trigger something. Triggers work regardless of that switch.

Shortcuts used below:

```sh
M=http://localhost:4000/__mock
next() { curl -s -X POST "$M/next" -H 'content-type: application/json' -d "$1"; echo; }
```

`next` applies a behaviour to the next request only. With `"operation"` it waits for a request whose operation name or root field matches (e.g. `"completeTask"`, `"tasks"`, or the candidate's operation name like `"TaskList"`). `lost-response`, `conflict` and `validation` always wait for the next `completeTask`.

Reset between scenarios: `curl -X POST $M/reset` (data back to the seed, pending triggers dropped, open event streams closed).

## Network and server errors

### Server unavailable (HTTP 503, no body)

```sh
next '{ "behavior": "unavailable", "operation": "tasks" }'
```

Then load or refresh the list.

- Good: the user sees that the list could not be loaded and can retry; a retry (manual or automatic with backoff) succeeds. The code tells a network or HTTP failure apart from a GraphQL error.
- Weak: blank page, endless spinner, raw error text, or the app treats the 503 like an empty list.
- Ask: how would you retry, and which operations are safe to retry automatically?

### Whole operation fails (`INTERNAL`)

```sh
next '{ "behavior": "internal", "operation": "tasks" }'
```

- Good: an error state with a way to try again; the app stays usable.
- Ask: what does the user see, and what would you log?

### Part of the data fails (`assignee` is null, error with `path`)

```sh
next '{ "behavior": "partial", "operation": "tasks" }'
```

Every assignee in that response is `null` with an `INTERNAL` error pointing at it; everything else is there.

- Good: the list still renders; the assignee shows as unknown or unavailable (not as "unassigned"); the error is not shown as if the whole page failed.
- Weak: the whole list is thrown away because `errors` is not empty, or the missing assignee silently looks like "nobody".
- Ask: how does your client handle `data` and `errors` in the same response?

### Slow response

```sh
next '{ "behavior": "slow", "ms": 4000, "operation": "tasks" }'
```

Change a filter, and while the slow request is pending change it again.

- Good: a loading state; the result of the second filter wins, the slow first response does not overwrite it; stale requests are aborted or ignored. With the mock running in a terminal, an aborted request shows up as `request aborted: <operation>`.
- Weak: flicker back to the old filter's results when the slow response arrives.
- Ask: what happens when responses arrive out of order?

## Completing a task

Open a task's detail view and fill the form before triggering.

### Conflict: someone changed the task

```sh
next '{ "behavior": "conflict" }'
```

or, independent of the next request, bump a specific task while its form is open (`POST /__mock/bump-version/:taskId`):

```sh
curl -s -X POST "$M/bump-version/task-0042"
```

Submitting then gets `CONFLICT` with `currentVersion`.

- Good: the user is told the task changed, can see the new state and decide, without losing what they typed.
- Weak: a generic error, or a silent retry with the new version that overwrites the other person's change.
- Ask: when is it safe to retry with the new version, and when not?

### Validation error from the server

```sh
next '{ "behavior": "validation" }'
```

The server rejects the completion with `VALIDATION_FAILED` and a `fieldErrors` entry for the first field, even though the client's own validation passed.

- Good: the message appears at the field; the form keeps the user's input.
- Weak: only a toast, or the form is reset.
- Also try for real: submit a reject without comment, a text with only spaces, a number off its step (if the client lets it through).

### The response gets lost (saved, but HTTP 503)

```sh
next '{ "behavior": "lost-response" }'
```

The completion is saved; the client gets a 503. A retry gets `FAILED_PRECONDITION` with `currentStatus: COMPLETED`.

- Good: after the retry fails, the app re-reads the task, sees `completedBy` is the viewer and tells the user it worked. No duplicate completion, no scary error.
- Weak: "Task is no longer open" shown as a failure, or the user is stuck.
- Ask: how would you make this idempotent if you could change the API?

### Task completed or removed by someone else

With the colleague active (`MOCK_CHAOS=on`, or set `MOCK_FOREIGN_EDIT_INTERVAL_MS=2000` at start to speed it up), keep a detail view open until the task is completed or removed elsewhere, then submit.

- Good: `FAILED_PRECONDITION` explained as "already completed by Alex Berger"; `NOT_FOUND` explained as "this task no longer exists"; the list reflects it.

## Live updates and the list

### Parallel activity

Start the mock with the colleague on and calm otherwise:

```sh
MOCK_CHAOS=on MOCK_LATENCY_MS=0 MOCK_UNAVAILABLE_RATE=0 MOCK_INTERNAL_RATE=0 \
MOCK_PARTIAL_RATE=0 MOCK_LOST_RESPONSE_RATE=0 MOCK_FOREIGN_EDIT_INTERVAL_MS=3000 pnpm --dir starter mock
```

- Good: the list stays current via the `taskEvents` subscription or polling; changed tasks update in place, completed ones leave an "open" filter, new ones appear.
- Ask: subscription or polling, and why? What happens to the cache when an event arrives?

### Event stream ends

Streams end after two to five minutes while realistic conditions are on. To end one right away:

```sh
curl -X POST $M/reset
```

- Good: the client reconnects and refetches, so nothing is missed while it was disconnected.

### Two people

Open the app in two browsers with different tokens (`NEXT_PUBLIC_API_TOKEN=alex.berger` vs `demo.user`), complete the same task in both.

- Good: the second one gets a clear message about who completed it.

### Paging while the data changes

Use infinite scroll or "load more", change a filter mid-way, or wait more than ten minutes before loading the next page.

- Good: a `BAD_CURSOR` restarts the list from the top instead of breaking it.

## Harsher conditions

Turn realistic conditions up while the app is running:

```sh
curl -s -X POST "$M/config" -H 'content-type: application/json' \
  -d '{ "MOCK_CHAOS": "on", "MOCK_UNAVAILABLE_RATE": 0.3, "MOCK_INTERNAL_RATE": 0.1, "MOCK_LATENCY_MS": "500-3000" }'
```

Defaults: latency 300–1500 ms, 5 % HTTP 503, 2 % `INTERNAL`, 3 % failing assignee lookups, 2 % lost completion responses, colleague every 8 s. The response shows all effective settings.

## Authentication

Set `NEXT_PUBLIC_API_TOKEN=` (empty) and restart the web app.

- Good: an understandable message instead of a broken page; the 401 (plain JSON, not a GraphQL error) is handled in both server-rendered and client-side requests.
