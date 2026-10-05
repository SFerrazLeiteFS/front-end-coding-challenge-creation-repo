# AGENTS.md

Builder repo for the take-home starter. Read `BRIEFING.md` first; only `starter/` ships to candidates.

## Agent skills

### Issue tracker

Local markdown: spec in `specs/`, one file per ticket in `tickets/`. No external PRs. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five roles with default strings; `offen`/`erledigt` from `/to-tickets` mapped onto them. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the builder repo root, never inside `starter/`. See `docs/agents/domain.md`.

## Workflow

- All coding work (every `/implement` run) happens on its own branch off `main`, one branch per ticket, named `ticket/<NN>-<slug>`.
- Each ticket ends with a pull request against `main` for Samuel to review. Never commit code directly to `main` and never merge your own PR.
- Docs-only changes to specs and tickets outside an `/implement` run may go to `main`.
