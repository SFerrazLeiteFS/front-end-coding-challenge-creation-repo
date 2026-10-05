---
status: ready-for-agent
spec: specs/spec.md (Shape of the starter, Mock server, Auth, Schema)
---

# 01: Mock walking skeleton

**What to build:** A pnpm workspace with the starter layout, the complete GraphQL schema from the spec, and a running mock server that answers `viewer` for any bearer token. The builder repo has a test harness that talks to the mock only through its fetch handler.

**Blocked by:** None (can start immediately)

- [ ] pnpm workspace root for the starter with scripts `dev`, `test`, `codegen`, `mock` (scripts may be placeholders where later tickets fill them)
- [ ] Schema file contains the full schema as in `docs/schema-and-mock.md` v3 (resolvers for later fields may be missing)
- [ ] Mock built through one factory taking configuration (seed, rates, latency, chaos on/off, task count) and a clock, returning a fetch-style handler
- [ ] Clock is injectable and advanceable in tests; production uses real time
- [ ] CLI entry runs via `tsx` without build step, serves `/graphql` on port 4000 (configurable), CORS allows the web app origin on port 3000
- [ ] Any non-empty bearer token is valid; `viewer` ID and display name are derived from the token
- [ ] Missing or empty token returns HTTP 401 with a small JSON message body, no GraphQL error
- [ ] Builder-repo test suite (Vitest) runs against the factory's fetch handler; tests for `viewer` and 401 are green
- [ ] Nothing in the starter contains internal names, hosts or evaluation wording
