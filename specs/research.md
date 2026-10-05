# Research: open questions 1 to 7

2026-10-05, main branch of `Cloud/flints` (webapp) and `Cloud/fuego` (gateway). Builder repo only; never copy into `starter/`.

Paths: webapp relative to `flints/apps/webapp/`, gateway relative to `fuego/gateway/`.

## Q1 Error mapping (gateway)

- No generic gRPC-to-GraphQL mapping. Error presenter in `internal/app/graphql/graphql_server.go:251-316`:
  - known `*gqlerror.Error` passes through, plus `extensions.Request` (request ID)
  - everything else, including raw gRPC status errors, becomes `"Unexpected error"` with `extensions.Code = UNEXPECTED_ERROR`
  - panics become `INTERNAL_SYSTEM_ERROR` (`:131-148`)
- Hand-mapped codes per resolver via `pkg/gqlfmt/error.go`: `INVALID_ARGUMENT`, `FORBIDDEN`, `ALREADY_EXISTS`, `PROCESS_ARCHIVED`, `INSUFFICIENT_PERMISSIONS`, `DRAFT_VERSION_CONFLICT`, `DRAFT_HASH_MISMATCH`, ...
- Key casing is inconsistent: `code` for hand-mapped codes, `Code` for `UNEXPECTED_ERROR`/`INTERNAL_SYSTEM_ERROR`. The webapp reads both (`src/lib/toast.tsx:37-48`).
- No structured field validation errors: one `INVALID_ARGUMENT` with a human-readable message. No gRPC error details forwarded.
- Partial results are common: `@guard` adds `INSUFFICIENT_PERMISSIONS` with `path` and returns default data (`directive/guard.directive.go:260-296`).
- Auth: HTTP middleware, missing/invalid JWT gives HTTP 401 with a non-GraphQL JSON body (inferred from library default).
- Optimistic concurrency only for drafts: `version` + `hash` in input, `DRAFT_VERSION_CONFLICT` / `DRAFT_HASH_MISMATCH` (`service/draft.go:72-152`).
- NotFound is often swallowed (null or placeholder object, `resolver/task.resolvers.go:157-190`).

## Q2 Subscriptions

- Gateway: SSE only (`transport.SSE`, 15 s keepalive, `graphql_server.go:71-77`), no WebSocket. One field `workflowExecutionEvents`, documented as at-most-once invalidation signal ("refetch on connect and reconnect"), streams capped at 10 min.
- Webapp: `subscriptionExchange` with `graphql-sse` (`src/providers/UrqlProvider/UrqlProvider.tsx:52-105`), used in one place. Most live updates are interval polling (5 to 10 s, `usePollWhenVisible`, task side menu `TaskSidemenu.tsx:67-68`).

## Q3 Cache

- `@urql/exchange-graphcache` 9.0.1 with introspection (`src/lib/client.ts:55-282`), ~45 mutation updaters (`cache.updateQuery` / `cache.invalidate`), custom cursor pagination on one list.
- No optimistic updates. No retryExchange, no authExchange.
- Exchange order (browser): graphcache, ssr, error, subscription, fetch. RSC client: cache + fetch, `network-only`.

## Q4 Codegen

- graphql-codegen with `client-preset` (`codegen.ts`), output in `src/gql/`, `gql()` documents in `src/graphql/**/*.ts`, `fragmentMasking: false`. Schema from remote introspection.

## Q5 Versions and tooling

| | |
|---|---|
| next | 16.3.4 |
| react / react-dom | 19.2.7 |
| urql / @urql/core / @urql/next | 5.0.4 / 6.0.3 / 2.0.1 |
| graphql | 17.0.2 |
| typescript | 6.0.3 |
| pnpm | 12.5.1 (`devEngines.packageManager`) |
| Node | `>=22` in engines, 24 in Docker |
| Tests | Vitest 4.1, jsdom, Testing Library 16, user-event 14, MSW 2.15, Playwright 1.62 (separate e2e workspace) |
| Lint/format | ESLint 10 (flat config), Prettier 3 |

SSR/RSC: `@urql/next/rsc` `registerUrql` in Server Components, `UrqlProvider` + `ssrExchange` for client components. JWT lives in a cookie (`Bearer <token>`) and is passed as a static `authorization` header in browser and server.

Client error handling: one global error exchange reading `extensions.code`, toasts. Network errors and GraphQL errors are not distinguished. Server field errors are not mapped into forms. Task forms use an in-house JSON Schema form renderer.

## Q6 Pagination

- Relay-style connections: `edges { node cursor }` and/or `nodes`, `pageInfo { hasNextPage endCursor hasPreviousPage startCursor }`, args `first = 20, after, before` (sometimes `last`).
- Webapp queries use `nodes` + `pageInfo`, not `edges`.
- No `totalCount`.
- Cursor: opaque base64 of the backend page token. Invalid base64 gives a GraphQL argument error. A valid-looking but wrong token surfaces as `UNEXPECTED_ERROR` (inferred).

## Q7 Mock technology

- `gateway/mock` is a mockery unit-test mock for one Go service, not a GraphQL mock server. No reference to reuse.
- Constraints that matter: SSE subscriptions (yoga supports these natively), real HTTP 503 / aborted requests, the same endpoint for browser and Next.js server.
