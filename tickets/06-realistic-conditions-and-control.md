---
status: ready-for-agent
spec: specs/spec.md (Mock server, Control endpoints)
---

# 06: Realistic conditions and control endpoints

**What to build:** The central layer that adds latency, unavailability, server errors, partial data and lost responses, one switch to turn it all off, and control endpoints to change rates and trigger a behaviour on the next request.

**Blocked by:** 05

- [ ] Defaults: latency 300 to 1500 ms uniform, 5 % HTTP 503 without body, 2 % `INTERNAL` for the whole operation, 3 % of `assignee` resolvers return null plus an error with path, 2 % of completions persist but respond 503
- [ ] All rates and latency configurable via env; chaos switch off disables latency and all failure injection
- [ ] Applied in one plugin layer, not in resolvers
- [ ] Runtime config endpoint changes rates and latency with the same keys as env
- [ ] Next-request trigger applies one behaviour to the next request, optionally filtered by operation: unavailable, internal, partial, lost-response, slow (with duration), conflict, validation
- [ ] Lost response followed by retry gives `FAILED_PRECONDITION`, and `completedBy` shows the viewer
- [ ] Aborted requests are logged with the operation name
- [ ] All named and commented neutrally
- [ ] Builder tests: one per behaviour via trigger or rate 1; chaos off gives stable immediate responses
- [ ] HTTP smoke test on a free port: 503, aborted request
- [ ] Full mock test suite runs in under 10 seconds with chaos off
