# Take-Home Assignment: Approval Inbox

Thanks for taking the time. This assignment is the basis for our next conversation with the team.

## Context

FireStart Cloud automates business processes. Much of that work ends up as a task for a person: approve an invoice, review a leave request, send back a contract. You will build a small **Approval Inbox** where users see their tasks and complete them.

## What you get

A repo with:

- a GraphQL mock server (`mock-server/`, schema in `schema/schema.graphql`)
- a minimal Next.js scaffold (`apps/web/`) with urql, codegen and a test setup

`pnpm install && pnpm dev` starts both. The mock behaves like a real backend on a normal day: responses take varying amounts of time, things occasionally go wrong, and other people work on the same data in parallel. How to configure the mock is described in `mock-server/README.md`.

You don't need prior experience with GraphQL or urql. If you prefer a different client, use it and explain why in `NOTES.md`.

## What we expect

1. **Task list with filters.** Filter state lives in the URL: links can be shared and the back button works.
2. **Detail view** with a form you render from the task's field schema, including validation.
3. **Completing a task** with sensible error and conflict handling.
4. **Tests** where you consider them relevant. A few good ones beat many.
5. **`NOTES.md`**: your decisions, trade-offs, what you deliberately left out and what you would do next. Also, what you used AI tools for.

Anything beyond that is optional. Visual design doesn't matter here; a plain, usable interface is enough.

## Time

Plan for **half a day at most**. We mean it. If you notice it taking longer, stop and write down in `NOTES.md` what you would still have done and how. An unfinished solution with clear reasoning tells us more than a complete one you can't explain.

## AI tools

Allowed and welcome, the way you would use them on the job. Briefly note in `NOTES.md` what you used them for. In the conversation, what counts is that you can stand behind every line of your submission and keep developing it.

## Submission

Within one week, as a link to a private repo (with access for the address in your invitation) or as a ZIP without `node_modules`.

## What happens next

In the follow-up conversation (about 60 minutes) you briefly walk us through your solution. Then we extend it together: 40 minutes of pairing on your code, with a change we only show you during the session. You work on your own machine with your usual tools. At the end there's time for your questions to us.

If you have questions about the assignment, reach out to s.ferraz-leite@firestart.com at any time.

## Getting started

You need Node.js 24 or later and pnpm 12. With Corepack (`corepack enable`), the right pnpm version is picked up from `package.json`.

```sh
pnpm install
pnpm dev
```

This starts:

- the web app on http://localhost:3000
- the GraphQL mock server on http://localhost:4000/graphql (open it in a browser for GraphiQL)

The web app sends the bearer token from `apps/web/.env` (`NEXT_PUBLIC_API_TOKEN`). The token determines who you are signed in as; see `mock-server/README.md`.

Other scripts in the root:

| Script | What it does |
|---|---|
| `pnpm test` | runs the tests (Vitest) |
| `pnpm codegen` | regenerates the typed GraphQL documents in `apps/web/src/gql` from the schema |
| `pnpm mock` | starts only the mock server |
