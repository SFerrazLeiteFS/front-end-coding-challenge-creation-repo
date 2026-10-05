# Issue tracker: Local Markdown

Specs and tickets for this repo live as markdown files in the repo itself.

## Conventions

- The spec is `specs/spec.md` (written during the grilling session)
- Tickets are `tickets/<NN>-<slug>.md`, numbered from `01` in dependency order, plus an index `tickets/README.md`
- Triage state is recorded as `status:` in the ticket frontmatter (see `triage-labels.md`)
- Dependencies are recorded as a `Blocked by: NN, NN` line; a ticket is unblocked when every listed ticket is done
- Comments and conversation history append to the bottom of the file under a `## Comments` heading
- Nothing under `specs/` or `tickets/` is ever copied into `starter/`

## When a skill says "publish to the issue tracker"

Create a new file under `tickets/` (or `specs/` for a spec/PRD). Do not use `.scratch/`.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the ticket number directly.
