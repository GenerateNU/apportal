# apportal frontend

The Next.js (App Router) frontend for the Generate application portal. It uses
Supabase for auth and talks to the Go backend in [`../backend`](../backend) for
all application/review data.

> **Note:** This project pins a newer Next.js with breaking changes from older
> releases (for example, middleware is `src/proxy.ts`, not `middleware.ts`).
> See [AGENTS.md](AGENTS.md) and consult `node_modules/next/dist/docs/` before
> relying on older Next.js conventions.

## Getting Started

Copy the env template and fill in your Supabase project values:

```bash
cp .env.example .env
```

- `NEXT_PUBLIC_API_URL` — backend base URL (defaults to `http://localhost:8080`)
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable (anon) key

Then install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Make sure the backend is
running (see [../README.md](../README.md)) so data requests resolve.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
- `npm run format:check` — check formatting with Prettier
- `npm test` — run unit tests (Vitest, watch mode with `npm run test:watch`)

## Project Structure

```text
src/
  app/                  App Router routes
    (portal)/           Authenticated shell (sidebar); admin / reviewer / applicant sections
    login/ signup/      Auth pages
    error.tsx …         Error, loading, and not-found boundaries
    providers.tsx       TanStack Query + auth context providers
  components/           Shared UI (ui/ primitives, nav/)
  lib/
    api/                Typed fetch client + per-resource request functions
    queries/            TanStack Query hooks and the central query-key factory
    supabase/           Browser/server Supabase clients
    auth/               Auth context
  proxy.ts              Request-time auth gate (Next.js "proxy", formerly middleware)
  types/                Shared app-level types (e.g. role mapping)
```

## Data Fetching

- Request functions live in `src/lib/api/*` and go through the shared
  `apiFetch` client (`src/lib/api/client.ts`).
- React components consume data via TanStack Query hooks in
  `src/lib/queries/*`. Query keys come from the factory in
  `src/lib/queries/keys.ts` — never hand-write a key in a component, so
  invalidation stays consistent.

## Testing

Unit tests use [Vitest](https://vitest.dev/) and live next to the code they
cover (`*.test.ts`). Run them with `npm test`. These run in CI on every PR.
