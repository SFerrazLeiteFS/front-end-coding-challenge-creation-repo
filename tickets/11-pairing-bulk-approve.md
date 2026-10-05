---
status: ready-for-agent
spec: specs/spec.md (Pairing extensions), docs/schema-and-mock.md (Pairing extensions 2), done criterion 7
---

# 11: Pairing extension: bulk approve

**What to build:** On branch `pairing-extensions`, a bulk completion mutation with a result per task, and proof that the branch applies cleanly to the starter.

**Blocked by:** 10

- [ ] `completeTasks(inputs)` returns one result per input: success with task, or error code with the same extensions as `completeTask`
- [ ] Partial success: valid inputs complete even if others fail; conflicts within the batch are reported per task
- [ ] Changes touch only schema, mock and builder tests, never the web app
- [ ] Builder tests for all-success, partial success and conflicts
- [ ] Branch rebases onto main without conflicts and applies to an exported starter without conflicts in the web app
