---
status: done
spec: specs/spec.md (Shape of the starter, Mock server, Auth, Schema)
---

# 01: Mock walking skeleton

**What to build:** A pnpm workspace with the starter layout, the complete GraphQL schema from the spec, and a running mock server that answers `viewer` for any bearer token. The builder repo has a test harness that talks to the mock only through its fetch handler.

**Blocked by:** None (can start immediately)

- [x] pnpm workspace root for the starter with scripts `dev`, `test`, `codegen`, `mock` (scripts may be placeholders where later tickets fill them)
- [x] Schema file contains the full schema as in `docs/schema-and-mock.md` v3 (resolvers for later fields may be missing)
- [x] Mock built through one factory taking configuration (seed, rates, latency, chaos on/off, task count) and a clock, returning a fetch-style handler
- [x] Clock is injectable and advanceable in tests; production uses real time
- [x] CLI entry runs via `tsx` without build step, serves `/graphql` on port 4000 (configurable), CORS allows the web app origin on port 3000
- [x] Any non-empty bearer token is valid; `viewer` ID and display name are derived from the token
- [x] Missing or empty token returns HTTP 401 with a small JSON message body, no GraphQL error
- [x] Builder-repo test suite (Vitest) runs against the factory's fetch handler; tests for `viewer` and 401 are green
- [x] Nothing in the starter contains internal names, hosts or evaluation wording

## Result (2026-10-05)

- All criteria met. `pnpm test` at the builder root: 22 tests green; typecheck clean for tests and mock server.
- Manual check: `pnpm mock` answers `viewer` via curl, returns 401 without token, serves GraphiQL in the browser.
- Workspace scripts use `pnpm -r --if-present`, so `dev`, `test` and `codegen` pick up the web app from ticket 02 without changes.
- Builder repo runs the tests against `starter/mock-server` via relative imports; it is a separate pnpm project, not a workspace containing `starter/` (so the starter keeps its own lockfile). Setup: `pnpm setup`.

## Deviations and findings

- Added (not in the ticket): GraphiQL page on `GET /graphql` for browsers, preset with the demo token. Useful for candidates exploring the schema; costs nothing.
- `MOCK_CORS_ORIGIN` added so the web app port can change without code edits.
- pnpm 12 blocks dependency build scripts by default; `allowBuilds: esbuild` is needed for `tsx`.
- Kept the agreed name `MOCK_CHAOS` (review suggested a more neutral name); it only reveals what `task.md` already says.
