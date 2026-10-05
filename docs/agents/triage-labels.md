# Triage Labels

| Role in mattpocock/skills | String in this repo | Meaning                                  |
| ------------------------- | ------------------- | ---------------------------------------- |
| `needs-triage`            | `needs-triage`      | Maintainer needs to evaluate this ticket |
| `needs-info`              | `needs-info`        | Waiting on Samuel for a decision or info |
| `ready-for-agent`         | `ready-for-agent`   | Fully specified, ready for an AFK agent  |
| `ready-for-human`         | `ready-for-human`   | Requires human implementation            |
| `wontfix`                 | `wontfix`           | Will not be actioned                     |

## Mapping from `/to-tickets` and `/implement`

These skills write `status: offen` and `status: erledigt`. Treat them as:

- `offen` → `ready-for-agent` if `bearbeiter` names an agent, otherwise `ready-for-human`
- `erledigt` → done (terminal state, outside the triage roles)

When a skill mentions a role, use the string from the table above.
