# apportal

The Generate application portal — applications, reviews, and the hiring pipeline.

It has two parts:

- [`backend/`](backend/) — Go API (Fiber + Huma) backed by Supabase Postgres.
- [`frontend/`](frontend/) — Next.js app (App Router) using Supabase auth.

For the domain model and the full application → review → interview → selection
pipeline, see [info.md](info.md).

## Prerequisites

- [Go](https://go.dev/) 1.25+ (backend)
- [Node.js](https://nodejs.org/) 20+ and npm (frontend)
- A [Supabase](https://supabase.com/) project (Postgres + auth)
- Optionally [Docker](https://www.docker.com/) to run the backend in a container
- [DopplerCLI](https://docs.doppler.com/docs/install-cli) for secret managment
- [Atlas CLI](https://atlasgo.io/integrations/go-sdk) (backend) for migrations, plus `psql` to apply `internal/sql/run-always.sql`
Enable the repo's git hooks once per clone:

```bash
git config core.hooksPath .githooks
```

This runs `make format` in `frontend/` before each commit that touches it, so
formatting matches what [Frontend CI](.github/workflows/frontend-ci.yml)
checks.

## Backend

The Go backend connects to Supabase Postgres and can run directly on your
machine or in Docker.

### Environment Variables

Secrets come from [Doppler](https://docs.doppler.com/docs/install-cli), project
`apportal-backend`: config `dev` (local Supabase) and `prd` (hosted). Every
target that needs them runs through `doppler run`, so there is no `backend/.env`.
Run `doppler login` once; [backend/.env.example](backend/.env.example) lists the
variable names.

- `PORT` — defaults to `8080`
- `DATABASE_URL` — Postgres URL for `make run` / `make start-dev`
- `DATABASE_URL_DOCKER` — the same database as reached from inside the container, for `make docker-up`

### Run

From [backend/](backend/):

```bash
make run / make start-dev         # dev secrets
make start-prod   # prd secrets
```

### Run with Hot Reload

For development, `make start-dev` watches `.go` files and automatically rebuilds and
restarts the server on save, using the Doppler `dev` config. It uses [air](https://github.com/air-verse/air)
(configured in [backend/.air.toml](backend/.air.toml)) and installs it on first
run if it isn't already present.

From [backend/](backend/):

```bash
make start-dev
```

### Run with Docker

From [backend/](backend/):

```bash
make docker-up
```

### Local Database

The Supabase project (config, migrations, seed) lives in
[backend/internal/supabase/](backend/internal/supabase/). Running it locally
requires [Docker](https://www.docker.com/) and the
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

From [backend/](backend/):

```bash
supabase start --workdir internal   # start Postgres, Studio, Auth, Storage, etc.
supabase stop --workdir internal    # tear down
```

`supabase start` prints connection details, including:

- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio (DB browser): <http://127.0.0.1:54323>

Point the backend at it by setting `DATABASE_URL` in the Doppler `dev` config to the
local database URL above instead of the hosted Supabase Session Pooler URL.
Note that Supabase auth still requires `SUPABASE_URL` to point at a real
project — logging in works against that, but any user without a matching row
in the local `users` table will fail requests that look up the current actor.

### Copying Prod Data Locally

A fresh local database starts empty (aside from `seed.sql`, if present) — no
users, applications, or cycles. If you need real-shaped data to test against
(e.g. to reproduce a bug, or to exercise an existing account's roles), you
can copy data from the hosted project into your local one.

This isn't a maintained script, just a manual recipe — treat
`DATABASE_URL_DOCKER` in the Doppler `prd` config as the source (it holds the
hosted Supabase Session Pooler URL) and the local `supabase_db_internal`
Docker container as the destination. Run `pg_dump`/`psql` **inside** that
container rather than with your host's client — the local Postgres image is
on a specific major version (currently 17), and `pg_dump` refuses to dump
from a server newer than itself:

```bash
# from backend/, with the local stack already running (supabase start)
export PROD_URL=$(doppler secrets get DATABASE_URL_DOCKER --plain --project apportal-backend --config prd)
docker exec supabase_db_internal pg_dump "$PROD_URL" --data-only --schema=public -f /tmp/prod_data.sql
docker exec supabase_db_internal psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/prod_data.sql
```

This dumps every `public` schema table's data (not `auth.*` — Supabase auth
is untouched) and restores it in one transaction-safe pass, so foreign key
ordering across tables is handled automatically. Since this reads real user
data from production, don't run it against a database or machine you
wouldn't want that data sitting on.

### Testing Migrations

Migrations are generated and applied with Atlas. From [backend/](backend/):

```bash
make gen-migration MIGRATION_NAME=<name>   # diff the GORM models into a new migration
make migrate-dev                           # apply pending migrations (Doppler dev config)
```

The files live in [backend/internal/migrations/](backend/internal/migrations/).
To confirm a new migration applies cleanly against a fresh database (not just
one that already had earlier state), point `MIGRATION_DB_CONNECTION_STRING` at
an empty database, such as the local one above, and run `make migrate-dev`
before merging. See [backend/docs/MIGRATIONS.md](backend/docs/MIGRATIONS.md)
for generating, applying and reverting migrations.

### Health Endpoints

- `GET /healthz` — liveness check for the app process
- `GET /readyz` — readiness check that pings Supabase Postgres
- `GET /docs` — Scalar API docs (OpenAPI at `/openapi.json`)

### Useful Commands

From [backend/](backend/):

- `make start-dev` — run with hot reload (rebuilds on file save), Doppler `dev`
- `make start-prod` — run against Doppler `prd`
- `make fmt` — format Go code and supported docs
- `make fmt-check` — check formatting without changing files
- `make lint` — run `go vet` and `golangci-lint` (config in [backend/.golangci.yml](backend/.golangci.yml))
- `make test` — run Go tests
- `make build` — build the backend binary
- `make openapi` — write the OpenAPI spec to `backend/api/openapi.yaml` (source for frontend codegen)
- `make docker-down` — stop the Docker Compose stack

## Frontend

The Next.js frontend talks to the Go backend and uses Supabase for auth.

### Environment Variables

Copy [frontend/.env.example](frontend/.env.example) to `frontend/.env` and set:

- `NEXT_PUBLIC_API_URL` — backend base URL (defaults to `http://localhost:8080`)
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable (anon) key

### Run

From [frontend/](frontend/):

```bash
npm install
npm run dev    # start the dev server at http://localhost:3000
```

### Useful Commands

From [frontend/](frontend/):

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
- `npm run format:check` — check formatting with Prettier
- `npm test` — run unit tests (Vitest)
- `npm run generate:api` — regenerate the typed API client from the OpenAPI spec

The frontend's `src/generated/` API client is generated from the backend's
OpenAPI spec with [Orval](https://orval.dev/). After changing the backend API,
run `make openapi` (backend) then `npm run generate:api` (frontend). See
[frontend/README.md](frontend/README.md#generated-api-client) for details.

## Continuous Integration

GitHub Actions run on every pull request to `main`:

- [Backend CI](.github/workflows/backend-ci.yml) — gofmt, `go vet`, golangci-lint, `go test`, `go build`
- [Frontend CI](.github/workflows/frontend-ci.yml) — lint, type-check, format, test, build

See [.github/](.github/) for the workflows, Dependabot config, and PR template.
