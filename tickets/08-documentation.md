---
status: ready-for-agent
spec: specs/spec.md (Candidate-facing documentation, Builder-only documentation)
---

# 08: Candidate docs and review playbook

**What to build:** Everything a candidate reads in the starter, and the builder-only playbook that tells reviewers how to trigger each behaviour.

**Blocked by:** 02, 04, 07

- [ ] Starter README is the text of `docs/task.md` plus a "Getting started" section (Node and pnpm versions, `pnpm install && pnpm dev`, ports, token)
- [ ] Mock README documents only: start, port, token and viewer, chaos switch, seed, reset endpoint, the general sentence about varying responses, failures and parallel edits, a pointer to the config source file
- [ ] Mock README does not mention individual rates, runtime config, version bump or next-request trigger
- [ ] `NOTES.md` with five empty headings: Decisions, Trade-offs, Left out, Next steps, AI usage
- [ ] Review playbook in the builder repo: one entry per behaviour with trigger command and what a good reaction looks like
- [ ] No forbidden terms or firestart hosts in the starter (manual grep until ticket 09 exists)
