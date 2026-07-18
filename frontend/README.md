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
- `npm run generate:api` — regenerate the typed API client from the OpenAPI spec

## Generated API Client

The typed API client and TanStack Query hooks in `src/generated/` are generated
from the backend's OpenAPI spec with [Orval](https://orval.dev/)
(`orval.config.ts`). The generated files are committed but machine-generated —
change the backend types and regenerate rather than editing them by hand
(lint and Prettier skip `src/generated/`).

To regenerate after a backend API change:

```bash
# 1. refresh the spec from the backend (no server/DB needed)
cd ../backend && make openapi        # writes backend/api/openapi.yaml
# 2. regenerate the client from the spec
cd ../frontend && npm run generate:api
```

Every request routes through the mutator in
[`src/lib/api/orval-mutator.ts`](src/lib/api/orval-mutator.ts), which applies the
base URL (`NEXT_PUBLIC_API_URL`) and maps errors to `APIError`. It's a plain
function (not a hook), so the generated client works in both client components
and server-side prefetch.

Reviewer auth (the `X-NUID` / `X-Role` headers) can be supplied two ways:

- **Per request** — pass `actor` in the request options. Always works, and is
  required for server-side prefetch:

  ```ts
  const { data } = useListApplications(params, { request: { actor } })
  ```

- **Client-side default** — call `setActorHeaders(actor)` once (e.g. from the
  auth provider when the signed-in user changes) so browser requests are authed
  without passing `actor` each time; `clearActorHeaders()` on sign-out:

  ```ts
  const { data } = useListApplications(params) // actor from the default headers
  ```

  This is client-only — server-side prefetch must always pass `actor` per
  request (the shared axios instance is reused across users on the server). A
  per-request `actor` overrides the client default.

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
