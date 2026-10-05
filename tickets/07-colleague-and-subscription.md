---
status: done
spec: specs/spec.md (Simulated colleague, Subscription)
---

# 07: Simulated colleague and live updates over SSE

**What to build:** A simulated colleague that edits, completes, creates, cancels and removes tasks, and an SSE subscription that reports these changes and own completions.

**Blocked by:** 06

- [x] Every 8 s (configurable, driven by the clock) one action on a random open or in-progress task, drawn with the seed: 60 % update (priority, due date or a prefilled value, version +1), 20 % complete (completed by a colleague, version +1), 10 % create, 5 % cancel (version +1), 5 % remove
- [x] Colleague is off when chaos is off
- [x] Version-bump endpoint bumps a task's version immediately
- [x] Subscription `taskEvents(filter)` over SSE only, payload `{ kind, task }`; removed events carry the last state
- [x] Own completions emit a completed event
- [x] With chaos on, each stream closes after a random lifetime of 2 to 5 minutes (via the clock)
- [x] Builder tests: each colleague action, events for colleague and own changes, filter on the subscription, stream lifetime, version bump causes `CONFLICT`
- [x] HTTP smoke test receives an event over a real SSE connection

## Result (2026-10-05)

- 157 builder tests green in about 6 s, typecheck clean. SSE smoke test receives a colleague event over a real connection.
- Colleague: seeded (own random sequence), acts only while `MOCK_CHAOS` is on (read at each tick), only on open or in-progress tasks; created tasks continue the numbering (`task-0251`, …).
- Events carry a snapshot of the task; the colleague, own completions and the version bump publish them.

## Deviations and findings

- The subscription listens to the event bus as soon as it is requested; listening lazily on the first read lost events.
- An event goes to a stream when the task matches its filter before **or** after the change (spec updated), so a stream filtered on `OPEN` learns about completions and cancellations.
- Stream lifetime: drawn for every stream, the switch is checked when it is up (so it also works after switching chaos on at runtime). Reset ends open streams. Whole-operation `INTERNAL` no longer applies to subscription requests (an event-stream client would get a JSON body).
- The version-bump endpoint is called `POST /__mock/bump-version/:taskId` (neutral name instead of `conflict`); spec and schema doc updated.
- Colleague value updates change prefilled numbers or dates; tasks without such values get a priority change instead.
- Tests that run the colleague for a long time use a short interval, so they stay below the minimum stream lifetime of two minutes.

## Comments

- From ticket 05: `completeTask` mutates the stored task object in place. Snapshot (copy) the task when emitting events, so a later change does not alter an event already sent.
- From ticket 06: `MOCK_CHAOS` can be switched at runtime via `/__mock/config`. The colleague and the stream lifetime must read `config.chaos` when they act, not only at start. `conditions.reset()` exists for reset; the colleague's own random sequence should restart on reset too.
