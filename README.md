# apportal
The Application Portal

## Backend Setup

The Go backend lives in [backend/](backend/). It connects to Supabase Postgres and can run either directly on your machine or in Docker.

### Environment Variables

Copy [backend/.env.example](backend/.env.example) to [backend/.env](backend/.env) and set:

- `PORT` - defaults to `8080`
- `DATABASE_URL` - Supabase Session Pooler URL for `make run`
- `DATABASE_URL_DOCKER` - same Supabase Session Pooler URL for `make docker-up`

### Run Locally

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

- `GET /healthz` - liveness check for the app process
- `GET /readyz` - readiness check that pings Supabase Postgres

### Useful Commands

From [backend/](backend/):

- `make dev` - run with hot reload (rebuilds on file save)
- `make fmt` - format Go code and supported docs
- `make fmt-check` - check formatting without changing files
- `make lint` - run `go vet` and `golangci-lint` if installed
- `make test` - run Go tests
- `make build` - build the backend binary
- `make docker-down` - stop the Docker Compose stack
