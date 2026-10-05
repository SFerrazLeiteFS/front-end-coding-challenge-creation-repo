# Triage Labels

| Role in mattpocock/skills | String in this repo | Meaning                                  |
| ------------------------- | ------------------- | ---------------------------------------- |
| `needs-triage`            | `needs-triage`      | Maintainer needs to evaluate this ticket |
| `needs-info`              | `needs-info`        | Waiting on Samuel for a decision or info |
| `ready-for-agent`         | `ready-for-agent`   | Fully specified, ready for an AFK agent  |
| `ready-for-human`         | `ready-for-human`   | Requires human implementation            |
| `wontfix`                 | `wontfix`           | Will not be actioned                     |

## Terminal state

A finished ticket gets `status: done` (outside the five triage roles). Skills that would write other values (e.g. German `offen`/`erledigt`) must use these English strings instead: `ready-for-agent`/`ready-for-human` for open tickets, `done` for finished ones.

When a skill mentions a role, use the string from the table above.
