---
status: ready-for-agent
spec: specs/spec.md (Export and delivery), done criterion 6
---

# 09: Export, pre-export check and ZIP

**What to build:** A script that exports the starter as a single commit to the private repo, guarded by a check for forbidden content, and a script that packages the result as a ZIP for candidates.

**Blocked by:** 08

- [ ] Export builds in a temporary directory, creates exactly one commit "Initial commit", pushes to a remote given as parameter (default: the private org repo `front-end-coding-challenge`)
- [ ] Refuses a non-empty target without an explicit force flag; with it, force-pushes so history stays one commit
- [ ] Check fails on forbidden terms (pitfall, trap, gotcha, evaluation, assessment, interview, rubric, scoring) or host names containing `firestart`, in contents, file names and commit message
- [ ] Only exception: the contact address in the starter README; the company name "FireStart" stays allowed
- [ ] ZIP script packages the exported repo without `node_modules`
- [ ] Builder tests against a local bare Git repo: one commit, check fails on injected term and host, contact passes, refusal without force, ZIP contents
- [ ] Real check run over the current starter passes
