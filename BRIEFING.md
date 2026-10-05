# Briefing: Starter Repo for the Senior Front-End Developer Take-Home

Version 2, 2026-10-05, owner: Samuel (CTO)

## What this is about

FireStart is hiring a Senior Front-End Developer (React/Next.js) for FireStart Cloud, with the prospect of becoming Front-End Lead. After the first interview, candidates get a take-home assignment: a small "Approval Inbox" where users see and complete workflow tasks assigned to them. Deadline one week, realistic effort at most half a day.

The assignment should make the candidate's thinking and way of working visible, and deliberately leave loose ends that we explore in the follow-up interview with the team. The follow-up should reveal whether real engineering is behind the submission. AI use is allowed and must be disclosed.

**Your job:** build the starter repo candidates work with. It consists of a GraphQL mock server that behaves like a real backend under realistic conditions, and a minimal Next.js scaffold. You do **not** build the Approval Inbox itself. That is the candidates' task.

## Architecture the starter repo should reflect

This is how the FireStart Cloud `webapp` talks to the backend today (finding from the frontend repo, as of 2026-10-05):

```
Browser ──GraphQL (HTTP, urql)──▶ Gateway (fuego/gateway, Go, gqlgen) ──gRPC──▶ Microservices
   ▲                                ▲
   │ SSR/HTML                       │ GraphQL (SSR via ssrExchange, RSC via @urql/next/rsc)
Next.js server (apps/webapp) ───────┘
```

The browser calls the gateway directly, with no Next.js proxy. The JWT is sent as an `authorization` header. Server Components fetch through the same urql approach. The `webapp` uses gRPC/ConnectRPC only server-side for tenant lookup; gRPC plays no role in the assignment.

The starter repo mirrors this shape: one GraphQL endpoint reachable from both the browser and the Next.js server, auth via bearer header.

## Decisions made

| Topic | Decision | Consequence |
|---|---|---|
| Protocol | GraphQL, no gRPC in the assignment | Mock server is a GraphQL server; gRPC only comes up in the follow-up interview as a discussion topic |
| Client | urql, as in the `webapp` | Starter installs and wires urql minimally; how deeply candidates use it is up to them |
| Domain scope | Approval Inbox with the five must-haves from `docs/task.md` | Mock must fully support all five |
| Pitfalls | as described in `docs/schema-and-mock.md` | Mock behaves realistically badly, but configurable and switchable off for tests |
| Candidate effort | max. half a day | Scaffold must run in under 5 minutes (`pnpm install && pnpm dev`), no Docker, no accounts |
| Language | English for everything in this repo and in `starter/` | Docs, code, comments, commit messages in English |

## Hard constraints

1. **Nothing internal in the starter.** No proprietary code, no real schema, no real service or host names from FireStart repos. The starter schema copies the *shape* of our architecture (connections, error extensions, unions), not its content.
2. **No hints about evaluation.** No code, comment, file name or commit message in `starter/` contains words like pitfall, trap, gotcha, evaluation, assessment, interview, rubric, scoring. The mock describes its behaviour neutrally ("simulates realistic network conditions").
3. **No solution in the scaffold.** No Graphcache setup, no retry logic, no form renderer, no filter components. The scaffold only proves that a query goes through.
4. **Deterministically testable.** All random mock behaviour depends on a seed and can be switched off via env.
5. **English only.** All docs, code, comments and commit messages in `starter/` and in this repo are in English.

## Deliverables in `starter/`

```
starter/
  README.md            task description (from docs/task.md)
  NOTES.md             empty template for candidates
  schema/schema.graphql
  mock-server/         GraphQL mock (TypeScript), with its own README
  apps/web/            Next.js scaffold (App Router) with urql, codegen, test setup
  package.json         pnpm workspace, scripts: dev, test, codegen, mock
```

Pairing extensions for the follow-up interview (file upload field type, bulk approve, see `docs/schema-and-mock.md`) do **not** go into the starter. They live on the branch `pairing-extensions` in this builder repo and are applied during the interview.

## Delivery

A script `scripts/export-starter.sh` copies `starter/` into an empty directory, initialises a fresh Git repo with a single commit ("Initial commit") and pushes to a separate GitHub template repo. Candidates get a copy generated from the template, not access to the template itself.

Before every export a check runs that fails if `starter/` contains any term from constraint 2 or any host name containing `firestart`.

## Open questions (resolve in the grilling session)

Questions 1 to 5 are facts about our existing code. Look them up in the `webapp` and `fuego/gateway` repos; do not assume them. Samuel's statements on these count as hypotheses until confirmed in code.

1. **Error mapping in the gateway.** How does `fuego/gateway` translate gRPC status codes into GraphQL errors? Is there an `extensions.code`, with which values? How do field validation errors reach the client? The mock adopts the same convention.
2. **Subscriptions.** Does the gateway support subscriptions (gqlgen WebSocket transport)? Does the `webapp` use them? This decides whether the mock offers subscriptions or live updates are expected via polling.
3. **Cache.** Does the `webapp` use `@urql/exchange-graphcache` or the default document cache? Are there optimistic updates?
4. **Codegen.** graphql-codegen, gql.tada or none? The starter prescribes the same approach.
5. **Versions and tooling.** Next.js, React and urql versions, package manager, test stack (Vitest/Jest, Testing Library, MSW, Playwright) of the `webapp`. The starter adopts them.
6. **List pagination in the gateway.** Relay connections with cursors, or offset? The mock draft assumes connections.
7. **Mock technology.** Proposal: graphql-yoga (built-in subscriptions over SSE or graphql-ws, plugins for latency and errors). Alternative: MSW with GraphQL handlers, which runs the mock in the browser and in tests without a separate process, but loses realism for network failures.

## Done when

1. Fresh clone of the exported starter: `pnpm install && pnpm dev` starts mock and Next.js in under 5 minutes on a machine with Node LTS, with no further steps.
2. The example page in the scaffold shows data from the mock, both server-rendered and after client-side navigation.
3. Every must-have from `docs/task.md` can be implemented against the mock; proven by one integration test per must-have **in the builder repo** (not in the starter).
4. Every pitfall from `docs/schema-and-mock.md` is reproducible by a test with a fixed seed.
5. `MOCK_CHAOS=off` gives stable responses without latency; the mock tests run in under 10 seconds with it.
6. The export check from section Delivery passes, and the template repo history has exactly one commit.
7. Branch `pairing-extensions` applies to the starter without conflicts with the scaffold.

## Change log

- Version 1, 2026-10-05: initial briefing.
- Version 2, 2026-10-05: everything in English; former open question on documentation language resolved.
- Version 3, 2026-10-05: open questions resolved in the grilling session; decisions in `specs/spec.md`, evidence in `specs/research.md`.
