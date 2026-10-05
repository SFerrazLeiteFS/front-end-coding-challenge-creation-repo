# Mock server

A GraphQL server for the Approval Inbox. It serves the schema in `../schema/schema.graphql` and simulates realistic network conditions: responses take varying amounts of time, things occasionally go wrong, and other people work on the same data in parallel.

## Start

`pnpm dev` in the repository root starts it together with the web app. To start only the mock:

```sh
pnpm mock
```

It listens on http://localhost:4000/graphql. Opening that URL in a browser shows GraphiQL. Queries and mutations use HTTP POST (or GET); subscriptions are served over Server-Sent Events (the `graphql-sse` protocol in "distinct connections" mode, which urql and most GraphQL clients support).

## Who you are

Every request needs an `authorization: Bearer <token>` header. Any non-empty token is accepted, and the token names the signed-in user (`viewer`): `demo.user` becomes "Demo User", `alex.berger` becomes "Alex Berger". Use different tokens to act as different people.

All users see the same team inbox. Tasks are assigned to Alex Berger, Jamie Novak, Morgan Fischer, Riley Weiss or Taylor Kim, or to nobody.

## Settings

Settings are read from environment variables when the server starts, for example:

```sh
MOCK_CHAOS=off pnpm dev
```

| Variable | Default | |
|---|---|---|
| `MOCK_CHAOS` | `on` | `off` gives stable, immediate responses and no parallel activity, useful for development and tests |
| `MOCK_SEED` | `1` | the generated data set (and everything else that varies) is derived from it |
| `MOCK_PORT` | `4000` | |

All options are documented in `src/config.ts`.

## Starting over

```sh
curl -X POST http://localhost:4000/__mock/reset
```

resets the data to its initial state. Restarting the server does the same.
