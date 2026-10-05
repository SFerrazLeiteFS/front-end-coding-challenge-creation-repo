---
status: done
spec: specs/spec.md (Mock server, Control endpoints)
---

# 06: Realistic conditions and control endpoints

**What to build:** The central layer that adds latency, unavailability, server errors, partial data and lost responses, one switch to turn it all off, and control endpoints to change rates and trigger a behaviour on the next request.

**Blocked by:** 05

- [x] Defaults: latency 300 to 1500 ms uniform, 5 % HTTP 503 without body, 2 % `INTERNAL` for the whole operation, 3 % of `assignee` resolvers return null plus an error with path, 2 % of completions persist but respond 503
- [x] All rates and latency configurable via env; chaos switch off disables latency and all failure injection
- [x] Applied in one plugin layer, not in resolvers
- [x] Runtime config endpoint changes rates and latency with the same keys as env
- [x] Next-request trigger applies one behaviour to the next request, optionally filtered by operation: unavailable, internal, partial, lost-response, slow (with duration), conflict, validation
- [x] Lost response followed by retry gives `FAILED_PRECONDITION`, and `completedBy` shows the viewer
- [x] Aborted requests are logged with the operation name
- [x] All named and commented neutrally
- [x] Builder tests: one per behaviour via trigger or rate 1; chaos off gives stable immediate responses
- [x] HTTP smoke test on a free port: 503, aborted request
- [x] Full mock test suite runs in under 10 seconds with chaos off

## Result (2026-10-05)

- 137 builder tests green in about 1.5 s (chaos off), typecheck clean.
- HTTP smoke test over a real port: query, 503 with empty body, abort detection (`request aborted: Viewer`), control endpoint.
- Manual: `pnpm mock` with `POST /__mock/config` returns the effective settings under their env names.

## Deviations and findings

- "One plugin layer" became one HTTP layer (`http.ts`, built with `@whatwg-node/server`, now a direct dependency) in front of graphql-yoga, plus two small reads in resolvers (failing `assignee`, conflict/validation/lost-response on `completeTask`). A yoga plugin cannot replace the HTTP status after a successful mutation. Spec updated.
- 503 and INTERNAL responses carry the CORS origin header, so the browser can read the status instead of seeing an opaque network error.
- Requests without a token skip latency and failures and never use up a trigger; they always get 401.
- Triggers for `lost-response`, `conflict` and `validation` wait for the next `completeTask`, even without an operation filter.
- `MOCK_CHAOS` is changeable at runtime (beyond the ticket). Reset also drops pending triggers and restarts the random sequence.
- The version-bump endpoint is part of ticket 07, as planned (named `POST /__mock/bump-version/:taskId` there).
