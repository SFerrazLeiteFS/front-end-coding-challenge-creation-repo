---
status: ready-for-agent
spec: specs/spec.md (Web scaffold)
---

# 02: Web scaffold

**What to build:** A minimal Next.js app that shows the viewer's display name, once rendered by a Server Component and once by a client component after client-side navigation. `pnpm dev` starts mock and web app together.

**Blocked by:** 01

- [ ] Next 16, React 19, urql 5 with `@urql/next` 2, graphql 17 (or 16 with the reason recorded as deviation in the spec), TypeScript 6, pnpm 12 pinned via `packageManager`, Node 24 or later
- [ ] urql client uses only the default document cache and fetch exchanges; no graphcache, retry, auth, subscription exchange or error handling
- [ ] Token from a committed, non-secret env value, sent as bearer header from server and browser
- [ ] Page `/`: Server Component via `@urql/next/rsc` shows `viewer.displayName`
- [ ] Page `/client-example`: client component via urql Next provider with SSR exchange shows `viewer.displayName`
- [ ] Both pages link to each other; data shows on direct load and after client-side navigation
- [ ] No tasks shown anywhere
- [ ] graphql-codegen with client preset against the local schema file; generated output committed; `pnpm codegen` regenerates it
- [ ] Vitest, jsdom, Testing Library, user-event with one passing example test
- [ ] Next default ESLint config and Prettier defaults
- [ ] `pnpm install && pnpm dev` on a fresh clone starts both in under 5 minutes (checked by hand, result noted in the ticket)
- [ ] Not included: MSW, Playwright, Storybook, Tailwind, UI or form libraries
