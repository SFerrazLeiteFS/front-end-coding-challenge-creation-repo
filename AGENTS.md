# AGENTS.md

Builder repo for the take-home starter. Read `BRIEFING.md` first; only `starter/` ships to candidates.

## Agent skills

### Issue tracker

Local markdown: spec in `specs/`, one file per ticket in `tickets/`. No external PRs. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five roles with default strings, plus `done` for finished tickets. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the builder repo root, never inside `starter/`. See `docs/agents/domain.md`.

## Language

English is the working language: all documentation, specs, tickets, source code, comments, commit messages and PR descriptions are in English. German is only the conversation language with Samuel.

## Workflow

- All coding work (every `/implement` run) happens on its own branch off `main`, one branch per ticket, named `ticket/<NN>-<slug>`.
- Each ticket ends with a pull request against `main` for Samuel to review. Never commit code directly to `main` and never merge your own PR.
- Docs-only changes to specs and tickets outside an `/implement` run may go to `main`.
