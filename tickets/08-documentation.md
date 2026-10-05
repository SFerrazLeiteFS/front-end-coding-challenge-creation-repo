---
status: done
spec: specs/spec.md (Candidate-facing documentation, Builder-only documentation)
---

# 08: Candidate docs and review playbook

**What to build:** Everything a candidate reads in the starter, and the builder-only playbook that tells reviewers how to trigger each behaviour.

**Blocked by:** 02, 04, 07

- [x] Starter README is the text of `docs/task.md` plus a "Getting started" section (Node and pnpm versions, `pnpm install && pnpm dev`, ports, token)
- [x] Mock README documents only: start, port, token and viewer, chaos switch, seed, reset endpoint, the general sentence about varying responses, failures and parallel edits, a pointer to the config source file
- [x] Mock README does not mention individual rates, runtime config, version bump or next-request trigger
- [x] `NOTES.md` with five empty headings: Decisions, Trade-offs, Left out, Next steps, AI usage
- [x] Review playbook in the builder repo: one entry per behaviour with trigger command and what a good reaction looks like
- [x] No forbidden terms or firestart hosts in the starter (manual grep until ticket 09 exists)

## Result (2026-10-05)

- 162 builder tests green; `tests/docs.test.ts` guards the docs: starter README = `docs/task.md` + Getting started, the mock README covers the allowed facts and none of `_RATE`, `MOCK_LATENCY_MS`, `/__mock/config`, `/__mock/next`, `bump-version`, lost, partial, 503, conflict, cursor; NOTES has the five sections; the playbook covers every trigger behaviour and the version bump.
- Getting started followed in a fresh copy of `starter/` (review): installs on Node 24 / pnpm 12, web app shows "Demo User", GraphiQL works.
- Playbook commands checked against a running mock.
- Only `FireStart` (company name) and the contact address match "firestart" in the starter, both allowed.

## Deviations and findings

- The mock README also explains GraphiQL, GET for queries, SSE for subscriptions (graphql-sse, distinct connections) and names the team members. Plain facts a candidate needs to work, beyond the minimal list.
- Removal by the colleague has no on-demand trigger; the playbook says so and uses another token in GraphiQL for "completed by someone else" instead.
- The scaffold refuses an empty token before sending requests, so the playbook's 401 scenario uses a single space as token.
- Smoke tests had left mock processes running (`pkill -f 'tsx src/cli.ts'` does not match the actual command line; use `pkill -f 'src/cli.ts'`).
