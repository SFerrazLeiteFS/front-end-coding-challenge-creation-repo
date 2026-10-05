# fe-takehome-builder

Private repo. This is where the starter repo for the take-home assignment "Senior Front-End Developer, FireStart Cloud" gets built.

This repo itself is **never** shared with candidates. Only the contents of `starter/` are shipped, exported with a fresh Git history into a separate template repo (see `BRIEFING.md`, section Delivery).

## Getting started (Claude Code)

1. Read `BRIEFING.md`. That is the assignment.
2. Grilling session: resolve the open questions in `BRIEFING.md`, write the spec to `specs/spec.md`.
3. `/to-tickets`: tickets go to `tickets/`.
4. `/implement`: one ticket per run.

## Running the builder tests

```
pnpm setup   # installs starter/ and the builder test tooling
pnpm test    # builder tests against starter/mock-server
```

## Shipping the starter

```
node scripts/check-starter.mjs <dir>       # forbidden terms (also inside identifiers) and internal names
scripts/export-starter.sh [--force]        # starter/ from main → one commit "Initial commit" → candidate repo
scripts/package-zip.sh                     # ZIP from the candidate repo → dist/approval-inbox.zip
scripts/package-zip.sh --from-ref main     # ZIP straight from starter/ on main, without exporting
```

Only content committed on `main` is shipped (`--ref` to choose another ref). Check by hand before an export: `pnpm install && pnpm dev` in a fresh copy, both example pages.

## Contents

| Path | Purpose |
|---|---|
| `BRIEFING.md` | Assignment, scope, decisions made, open questions |
| `docs/schema-and-mock.md` | GraphQL schema sketch and mock server behaviour |
| `docs/task.md` | Draft of the candidate-facing task description, becomes `starter/README.md` |
| `specs/` | created during the grilling session |
| `tickets/` | created by `/to-tickets` |
| `tests/` | builder-only tests proving the starter supports the task |
| `scripts/` | check, export and ZIP for the starter |
| `starter/` | created during implementation, the only part that ships |

## Language

English throughout: docs, code, comments, commit messages. English is the working language of the engineering team.
