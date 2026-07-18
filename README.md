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

## Backend

The Go backend connects to Supabase Postgres and can run directly on your
machine or in Docker.

### Environment Variables

Copy [backend/.env.example](backend/.env.example) to `backend/.env` and set:

- `PORT` — defaults to `8080`
- `DATABASE_URL` — Supabase Session Pooler URL for `make run`
- `DATABASE_URL_DOCKER` — same Supabase Session Pooler URL for `make docker-up`

### Run

From [backend/](backend/):

```bash
make run
```

### Run with Hot Reload

For development, `make dev` watches `.go` files and automatically rebuilds and
restarts the server on save. It uses [air](https://github.com/air-verse/air)
(configured in [backend/.air.toml](backend/.air.toml)) and installs it on first
run if it isn't already present.

From [backend/](backend/):

```bash
make dev
```

### Run with Docker

From [backend/](backend/):

```bash
make docker-up
```

### Health Endpoints

- `GET /healthz` — liveness check for the app process
- `GET /readyz` — readiness check that pings Supabase Postgres
- `GET /docs` — Scalar API docs (OpenAPI at `/openapi.json`)

### Useful Commands

From [backend/](backend/):

- `make dev` — run with hot reload (rebuilds on file save)
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
