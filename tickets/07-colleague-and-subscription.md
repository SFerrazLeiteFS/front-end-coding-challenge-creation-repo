---
status: ready-for-agent
spec: specs/spec.md (Simulated colleague, Subscription)
---

# 07: Simulated colleague and live updates over SSE

**What to build:** A simulated colleague that edits, completes, creates, cancels and removes tasks, and an SSE subscription that reports these changes and own completions.

**Blocked by:** 06

- [ ] Every 8 s (configurable, driven by the clock) one action on a random open or in-progress task, drawn with the seed: 60 % update (priority, due date or a prefilled value, version +1), 20 % complete (completed by a colleague, version +1), 10 % create, 5 % cancel (version +1), 5 % remove
- [ ] Colleague is off when chaos is off
- [ ] Version-bump endpoint bumps a task's version immediately
- [ ] Subscription `taskEvents(filter)` over SSE only, payload `{ kind, task }`; removed events carry the last state
- [ ] Own completions emit a completed event
- [ ] With chaos on, each stream closes after a random lifetime of 2 to 5 minutes (via the clock)
- [ ] Builder tests: each colleague action, events for colleague and own changes, filter on the subscription, stream lifetime, version bump causes `CONFLICT`
- [ ] HTTP smoke test receives an event over a real SSE connection

## Comments

- From ticket 05: `completeTask` mutates the stored task object in place. Snapshot (copy) the task when emitting events, so a later change does not alter an event already sent.
- From ticket 06: `MOCK_CHAOS` can be switched at runtime via `/__mock/config`. The colleague and the stream lifetime must read `config.chaos` when they act, not only at start. `conditions.reset()` exists for reset; the colleague's own random sequence should restart on reset too.
