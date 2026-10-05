---
status: done
spec: specs/spec.md (Web scaffold)
---

# 02: Web scaffold

**What to build:** A minimal Next.js app that shows the viewer's display name, once rendered by a Server Component and once by a client component after client-side navigation. `pnpm dev` starts mock and web app together.

**Blocked by:** 01

- [x] Next 16, React 19, urql 5 with `@urql/next` 2, graphql 17 (or 16 with the reason recorded as deviation in the spec), TypeScript 6, pnpm 12 pinned via `packageManager`, Node 24 or later
- [x] urql client uses only the default document cache and fetch exchanges; no graphcache, retry, auth, subscription exchange or error handling
- [x] Token from a committed, non-secret env value, sent as bearer header from server and browser
- [x] Page `/`: Server Component via `@urql/next/rsc` shows `viewer.displayName`
- [x] Page `/client-example`: client component via urql Next provider with SSR exchange shows `viewer.displayName`
- [ ] Both pages link to each other; data shows on direct load and after client-side navigation (direct load verified via curl; client-side navigation in a real browser still to check by hand, see Result)
- [x] No tasks shown anywhere
- [x] graphql-codegen with client preset against the local schema file; generated output committed; `pnpm codegen` regenerates it
- [x] Vitest, jsdom, Testing Library, user-event with one passing example test
- [x] Next default ESLint config and Prettier defaults
- [x] `pnpm install && pnpm dev` on a fresh clone starts both in under 5 minutes (checked by hand, result noted in the ticket)
- [x] Not included: MSW, Playwright, Storybook, Tailwind, UI or form libraries

## Result (2026-10-05)

- Versions: next 16.3.8, react 19.3.0, urql 5.0.4, @urql/next 2.0.1, graphql 17.0.2 (no fallback to 16 needed; yoga and codegen work with 17), TypeScript 6.0.3, pnpm 12.9.1, Node 24.15.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (1 example test) green in `apps/web`; `pnpm codegen` reproduces the committed output; builder tests still 22 green.
- Fresh clone (git archive of `starter/` into an empty directory): `pnpm install && pnpm dev` served `/` with "Signed in as Demo User" after 24 s. Caveat: the pnpm store on this machine was warm, so a cold machine will take longer (download of ~730 packages), still expected well under 5 minutes.
- Direct load of `/` and `/client-example` checked with curl (both render the viewer). Client-side navigation in a real browser could not be checked here (no browser tooling in the session): open `/`, click "Client Component example", expect "Signed in as Demo User" and a request to `localhost:4000/graphql` with the bearer header.

## Deviations and findings

- ESLint 9 instead of 10: `eslint-config-next` 16 plugins don't support ESLint 10 yet.
- `@vitejs/plugin-react` pinned to `~6.1.1`: 6.1.2 was published today and pnpm 12's minimum release age policy rejects it.
- `unrs-resolver` added to `allowBuilds` (needed by the Next ESLint config).
- `next dev` writes `AGENTS.md`/`CLAUDE.md` into the app by default in Next 16; disabled with `agentRules: false` so the starter stays free of generated tool files.
- Added `NEXT_PUBLIC_GRAPHQL_URL` next to the token; both are required and fail loudly when missing.
- Codegen uses `fragmentMasking: false` like our webapp.
- Example pages render nothing when the query fails (no error UI on purpose; that is part of the task).
