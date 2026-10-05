# Tickets

Source: `specs/spec.md` v1. Status values: see `docs/agents/triage-labels.md`.

| # | Ticket | Blocked by | Status |
|---|---|---|---|
| 01 | [Mock walking skeleton](01-mock-walking-skeleton.md) | – | done |
| 02 | [Web scaffold](02-web-scaffold.md) | 01 | done |
| 03 | [Seed data, task detail and form schemas](03-seed-data-and-task-detail.md) | 01 | done |
| 04 | [Task list with filters, sorting and pagination](04-task-list.md) | 03 | done |
| 05 | [Completing a task with validation and errors](05-complete-task.md) | 03 | done |
| 06 | [Realistic conditions and control endpoints](06-realistic-conditions-and-control.md) | 05 | done |
| 07 | [Simulated colleague and live updates over SSE](07-colleague-and-subscription.md) | 06 | done |
| 08 | [Candidate docs and review playbook](08-documentation.md) | 02, 04, 07 | done |
| 09 | [Export, pre-export check and ZIP](09-export-and-zip.md) | 08 | ready-for-agent |
| 10 | [Pairing extension: file upload](10-pairing-file-upload.md) | 08 | ready-for-agent |
| 11 | [Pairing extension: bulk approve](11-pairing-bulk-approve.md) | 10 | ready-for-agent |

Frontier at start: 01. After 01: 02 and 03 in parallel. After 03: 04 and 05 in parallel.
