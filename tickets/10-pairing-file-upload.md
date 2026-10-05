---
status: ready-for-agent
spec: specs/spec.md (Pairing extensions), docs/schema-and-mock.md (Pairing extensions 1)
---

# 10: Pairing extension: file upload

**What to build:** On branch `pairing-extensions`, a new file field type with an upload flow in the mock, ready to apply during the follow-up session.

**Blocked by:** 08

- [ ] Branch `pairing-extensions` created from main
- [ ] `FileField` (`accept`, `maxSizeBytes`) and `FileValue` in the schema; at least one form variant uses it
- [ ] `createUpload` mutation returns a presigned-style URL served by the mock; the form value references the upload
- [ ] Validation for accept, size and missing upload with `fieldErrors`
- [ ] Changes touch only schema, mock and builder tests, never the web app
- [ ] Builder tests for the upload flow
