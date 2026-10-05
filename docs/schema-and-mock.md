# GraphQL Schema and Mock Server

Version 3, 2026-10-05. Aligned with `specs/spec.md` v1 (grilling session). Gateway facts behind the decisions: `specs/research.md`.

## Schema sketch

The shape follows our gateway (connections, unions for polymorphic data, errors via `extensions`, SSE subscriptions). Names and fields are deliberately generic and not copied from the real schema.

```graphql
scalar DateTime

type Query {
  viewer: User!
  processes: [Process!]!
  tasks(first: Int = 20, after: String, filter: TaskFilter, sort: TaskSort = DUE_ASC): TaskConnection!
  task(id: ID!): Task          # null for unknown IDs, no error
}

type Mutation {
  completeTask(input: CompleteTaskInput!): CompleteTaskPayload!
}

type Subscription {
  taskEvents(filter: TaskFilter): TaskEvent!   # SSE only
}

input TaskFilter {
  status: [TaskStatus!]
  priority: [Priority!]
  processId: ID
  search: String
  dueBefore: DateTime
}

enum TaskStatus { OPEN IN_PROGRESS COMPLETED CANCELLED }
enum Priority { LOW NORMAL HIGH URGENT }
enum TaskSort { DUE_ASC DUE_DESC CREATED_DESC PRIORITY_DESC }

type TaskConnection {
  edges: [TaskEdge!]!
  nodes: [Task!]!
  pageInfo: PageInfo!
}
type TaskEdge { cursor: String!, node: Task! }
type PageInfo { hasNextPage: Boolean!, endCursor: String }

type User { id: ID!, displayName: String! }
type Process { id: ID!, name: String! }

type Task {
  id: ID!
  version: Int!
  title: String!
  process: Process!
  status: TaskStatus!
  priority: Priority!
  assignee: User           # nullable, resolver may partially fail
  createdAt: DateTime!
  dueAt: DateTime
  completedBy: User
  completedAt: DateTime
  form: FormSchema!
  values: [FieldValue!]!
}

type FormSchema { fields: [FormField!]! }

interface FormField {
  key: ID!
  label: String!
  required: Boolean!
  helpText: String
}
type TextField implements FormField     { key: ID!, label: String!, required: Boolean!, helpText: String, multiline: Boolean!, maxLength: Int, pattern: String }
type NumberField implements FormField   { key: ID!, label: String!, required: Boolean!, helpText: String, min: Float, max: Float, step: Float, unit: String }
type DateField implements FormField     { key: ID!, label: String!, required: Boolean!, helpText: String, min: DateTime, max: DateTime }
type SelectField implements FormField   { key: ID!, label: String!, required: Boolean!, helpText: String, options: [SelectOption!]!, multiple: Boolean! }
type BooleanField implements FormField  { key: ID!, label: String!, required: Boolean!, helpText: String }
type DecisionField implements FormField { key: ID!, label: String!, required: Boolean!, helpText: String, allowed: [Decision!]!, commentRequiredFor: [Decision!]!, commentFieldKey: ID! }

type SelectOption { value: String!, label: String! }
enum Decision { APPROVE REJECT RETURN }

union FieldValue = TextValue | NumberValue | DateValue | SelectValue | BooleanValue | DecisionValue
type TextValue     { key: ID!, text: String! }
type NumberValue   { key: ID!, number: Float! }
type DateValue     { key: ID!, date: DateTime! }
type SelectValue   { key: ID!, selected: [String!]! }
type BooleanValue  { key: ID!, bool: Boolean! }
type DecisionValue { key: ID!, decision: Decision! }

input CompleteTaskInput {
  taskId: ID!
  expectedVersion: Int!
  values: [FieldValueInput!]!
}

# Exactly one value field must be set. Mirrors the proto oneof behind the gateway.
input FieldValueInput {
  key: ID!
  text: String
  number: Float
  date: DateTime
  selected: [String!]
  bool: Boolean
  decision: Decision
}

type CompleteTaskPayload { task: Task! }

type TaskEvent {
  kind: TaskEventKind!
  task: Task!              # last state for REMOVED
}
enum TaskEventKind { CREATED UPDATED COMPLETED REMOVED }
```

## Domain rules

- Shared team inbox: every viewer sees the same tasks. `assignee` is informational (about five fixed team members, or null). Anyone may complete any open task; no permission checks.
- `completeTask` is allowed from `OPEN` and `IN_PROGRESS`. `IN_PROGRESS` only comes from the seed or the simulated colleague.
- Without a status filter, `tasks` returns all statuses.
- Filters: OR within a field, AND across fields. `search` is a case-insensitive substring match on `title`; empty string means no filter. `dueBefore` excludes tasks without `dueAt`.
- Sorting: tasks without `dueAt` always last for `DUE_*`. Ties broken by `id`.
- `first`: default 20, capped silently at 100, below 1 is `VALIDATION_FAILED`.
- Six processes, one fixed form variant each. Together they use every field type; at least two use a `DecisionField` with a required comment on `REJECT`.

## Validation rules

Server-side validation is the source of truth and checks every rule, even if the client has already checked it. All violations are returned together.

| Field | Rules |
|---|---|
| all | `required` means a value is present. Empty text and empty selection count as missing. |
| Text | `maxLength`; `pattern` is a JavaScript regex without flags, matched against the whole value |
| Number | `min`/`max` inclusive, `step` relative to `min` (or 0) |
| Date | `min`/`max` inclusive |
| Select | every value must be an option; exactly one when `multiple: false` |
| Boolean | `required: true` means the value must be `true` |
| Decision | value in `allowed`; if in `commentRequiredFor`, the text field `commentFieldKey` is required |

Per input: exactly one value field set and matching the field type, at most one value per key, unknown keys fail, optional fields may be omitted. Prefilled `values` are defaults; all fields stay editable.

## Error convention

Errors arrive in the `errors` array with `extensions.code` (always lowercase key, generic code names).

| Code | When | Extra data in `extensions` |
|---|---|---|
| `NOT_FOUND` | `completeTask` on a removed task | |
| `CONFLICT` | `expectedVersion` does not match the current version | `currentVersion` |
| `FAILED_PRECONDITION` | task is no longer `OPEN`/`IN_PROGRESS` | `currentStatus` |
| `VALIDATION_FAILED` | any validation rule above, `first < 1`, invalid `dueBefore` | `fieldErrors: [{ key, message }]` (for field rules) |
| `BAD_CURSOR` | cursor belongs to a different filter/sort or is older than 10 min | |
| `INTERNAL` | simulated server error, whole operation or single field | |

Outside GraphQL errors:

- Missing or empty bearer token: HTTP 401 with a small JSON message body.
- Network failure: HTTP 503 with no body. The client has to distinguish both failure paths.

## Mock behaviour

graphql-yoga, separate process on port 4000, `/graphql`, CORS for the web app on port 3000, state in memory. The data set is derived from `MOCK_SEED` and the current UTC day (dates are relative to today). `MOCK_CHAOS=off` disables latency, all failure injection and the simulated colleague. One injectable clock drives cursor expiry, colleague interval and stream lifetime.

| Behaviour | Default | Env | What it exercises |
|---|---|---|---|
| Data set | 250 tasks across 6 processes | `MOCK_TASK_COUNT` (up to 10,000) | pagination, performance question in the interview |
| Latency | 300 to 1500 ms per operation, uniform | `MOCK_LATENCY_MS=300-1500` | loading states, race conditions on fast filter changes |
| Cancellation | aborted requests are logged with operation name | | whether candidates abort stale requests |
| HTTP 503 | 5 % of all requests | `MOCK_UNAVAILABLE_RATE` | retry strategy, telling network errors from GraphQL errors |
| `INTERNAL` whole operation | 2 % | `MOCK_INTERNAL_RATE` | error UX |
| Partial data | 3 % of `assignee` resolvers return `null` plus an error with `path` | `MOCK_PARTIAL_RATE` | whether `data` is used despite `errors` |
| Lost response | 2 % of `completeTask`: change is persisted, response is 503 | `MOCK_LOST_RESPONSE_RATE` | idempotency on retry: second attempt gets `FAILED_PRECONDITION`; `completedBy` tells who did it |
| Foreign edits | every 8 s one action on a random open task, see below | `MOCK_FOREIGN_EDIT_INTERVAL_MS` | real conflicts, two-tabs question, live updates |
| Cursors | opaque base64 of sort key, ID, filter/sort hash, issue time | | `BAD_CURSOR`, filter change during infinite scroll |
| Subscription | SSE; events for foreign edits and own completions; with chaos each stream closes after 2 to 5 min | | reconnect, cache integration |
| Auth | any non-empty bearer token is valid, `viewer` is derived from the token | | header propagation in SSR and browser |

Foreign edit actions (drawn with the seed): 60 % update (`priority`, `dueAt` or a prefilled value, version +1), 20 % complete (`completedBy` a colleague, version +1), 10 % create, 5 % cancel (version +1), 5 % remove. Own completions also bump the version and emit `COMPLETED`.

Intermediate rates are reproducible only for sequential requests with the same seed. Tests use rates of 0 or 1 and the next-request trigger.

## Control endpoints

- `POST /__mock/reset` resets the data set to the seed.
- `POST /__mock/config` changes rates and latency at runtime (JSON body with the same keys as the env variables).
- `POST /__mock/conflict/:taskId` bumps a task's version immediately.
- `POST /__mock/next` applies one behaviour to the next request, optionally filtered by `operation`. Behaviours: `unavailable`, `internal`, `partial`, `lost-response`, `slow` (with `ms`), `conflict`, `validation`.

Candidate-facing mock README documents only start, port, token/viewer, `MOCK_CHAOS=off`, `MOCK_SEED`, `/__mock/reset`, a general sentence about varying responses, failures and parallel edits, and a pointer to the config source file. Rates and the other control endpoints are only discoverable in the code, named and commented neutrally. The builder-only review playbook lists one trigger per behaviour.

## Pairing extensions (branch `pairing-extensions` only)

Not in the starter. Applied during the follow-up interview so candidates make an architecturally relevant change live. Touch only schema, mock and builder tests, never the web app.

1. **File upload:** new field type `FileField implements FormField` (`accept`, `maxSizeBytes`) and `FileValue`. Upload via a separate `createUpload` mutation returning a presigned URL on the mock, then a reference in the form value. Exercises: renderer extensibility, unknown `__typename` in older clients, multi-step flows.
2. **Bulk approve:** mutation `completeTasks(inputs: [CompleteTaskInput!]!)` with a result per task (success or error code). Exercises: partial success, conflicts within the batch, cache updates for many entries.
3. **Live updates:** if not already built, wire a subscription or polling into the list.

## Change log

- Version 1, 2026-10-05: initial draft.
- Version 2, 2026-10-05: translated to English.
- Version 3, 2026-10-05: aligned with grilling decisions: `processes`, `completedBy`/`completedAt`, `nodes`; removed `totalCount`, backward pagination, `UNAUTHENTICATED` (now HTTP 401), `MOCK_STREAM_DROP`; `task(id)` returns null; domain and validation rules; `/__mock/next`; documentation split.
