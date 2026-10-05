---
status: done
spec: specs/spec.md (Export and delivery), done criterion 6
---

# 09: Export, pre-export check and ZIP

**What to build:** A script that exports the starter as a single commit to the private repo, guarded by a check for forbidden content, and a script that packages the result as a ZIP for candidates.

**Blocked by:** 08

- [x] Export builds in a temporary directory, creates exactly one commit "Initial commit", pushes to a remote given as parameter (default: the private org repo `front-end-coding-challenge`)
- [x] Refuses a non-empty target without an explicit force flag; with it, force-pushes so history stays one commit
- [x] Check fails on forbidden terms (pitfall, trap, gotcha, evaluation, assessment, interview, rubric, scoring) or host names containing `firestart`, in contents, file names and commit message
- [x] Only exception: the contact address in the starter README; the company name "FireStart" stays allowed
- [x] ZIP script packages the exported repo without `node_modules`
- [x] Builder tests against a local bare Git repo: one commit, check fails on injected term and host, contact passes, refusal without force, ZIP contents
- [x] Real check run over the current starter passes

## Result (2026-10-05)

- 200 builder tests green (38 for check, export and ZIP against local bare repositories and fixtures).
- Real check over the current starter passes, including `pnpm-lock.yaml` and generated files.
- ZIP built with `--from-ref main`, unzipped into an empty directory: `pnpm install` and `pnpm dev` work, the example page shows "Demo User".
- ZIPs from the exported repo and from `--from-ref main` were byte-identical (review).

## Deviations and findings

- The check is a Node script (`scripts/check-starter.mjs`) instead of bash: word splitting of identifiers (`interviewMode`, `is_trap`) and the exact contact-address exception were fragile with grep. A missing directory is an error, not a pass.
- "firestart" fails anywhere except as the plain company name and the exact contact address in `README.md`; that includes `firestartorg`, `@firestart/…`, `firestart:4000` and file names.
- Export takes `starter/` from `main` (not the checked-out branch), uses the neutral author `Approval Inbox <approval-inbox@example.com>`, treats any ref (also tags) as "not empty", and with `--force` mirrors so the target has one branch and one commit.
- `package-zip.sh --from-ref <ref>` (not in the ticket) builds the ZIP straight from this repo, so a ZIP can be produced without pushing to the org repo.
- Shared defaults and helpers in `scripts/lib.sh`.
