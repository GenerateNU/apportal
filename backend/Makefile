SHELL := /bin/sh

APP_NAME := apportal-backend
MAIN_PACKAGE := ./cmd/server
BIN_DIR := bin
BIN_PATH := $(BIN_DIR)/$(APP_NAME)

.PHONY: help fmt fmt-check lint test test-cover vet tidy run dev build clean docker-build docker-up docker-down docker-logs prettier prettier-check

help:
	@printf '%s\n' \
		'Available targets:' \
		'  make fmt          Format Go code and supported docs' \
		'  make fmt-check    Check formatting without writing' \
		'  make lint         Run Go vet and golangci-lint if installed' \
		'  make test         Run Go tests' \
		'  make test-cover    Run tests with coverage output' \
		'  make tidy         Tidy Go modules' \
		'  make run          Run the backend locally' \
		'  make dev          Run with hot reload (rebuilds on file save)' \
		'  make build        Build the backend binary' \
		'  make docker-build Build the backend Docker image' \
		'  make docker-up    Start the backend with Docker Compose' \
		'  make docker-down  Stop the Docker Compose stack' \
		'  make prettier     Format markdown/yaml/json with Prettier' \
		'  make clean        Remove build artifacts'

fmt:
	@files=$$(find . -name '*.go' -not -path './bin/*' -not -path './vendor/*'); \
	if [ -n "$$files" ]; then \
		gofmt -w $$files; \
	fi
	@$(MAKE) prettier

fmt-check:
	@files=$$(find . -name '*.go' -not -path './bin/*' -not -path './vendor/*' -print | xargs gofmt -l); \
	if [ -n "$$files" ]; then \
		printf 'gofmt needed for:%s\n' "$$files"; \
		exit 1; \
	fi
	@$(MAKE) prettier-check

lint: vet
	@command -v golangci-lint >/dev/null 2>&1 && golangci-lint run ./... || printf '%s\n' 'golangci-lint not installed; skipped'

vet:
	@go vet ./...

test:
	@go test ./...

test-cover:
	@mkdir -p $(BIN_DIR)
	@go test ./... -coverprofile=$(BIN_DIR)/coverage.out

tidy:
	@go mod tidy

run:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; go run $(MAIN_PACKAGE)

AIR := $(shell command -v air 2>/dev/null || echo "$$(go env GOPATH)/bin/air")

dev:
	@if [ ! -x "$(AIR)" ]; then \
		printf '%s\n' 'air not found; installing...'; \
		go install github.com/air-verse/air@latest; \
	fi
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; "$(AIR)"

build:
	@mkdir -p $(BIN_DIR)
	@go build -o $(BIN_PATH) $(MAIN_PACKAGE)

clean:
	@rm -rf $(BIN_DIR)

docker-build:
	@docker build -t $(APP_NAME) .

docker-up:
	@docker compose up --build

docker-down:
	@docker compose down

docker-logs:
	@docker compose logs -f

prettier:
	@files=$$(find . -maxdepth 1 \( -name '*.md' -o -name '*.yml' -o -name '*.yaml' -o -name '*.json' \) -print); \
	if command -v npx >/dev/null 2>&1 && [ -n "$$files" ]; then \
		npx prettier --write $$files; \
	else \
		printf '%s\n' 'prettier skipped'; \
	fi

prettier-check:
	@files=$$(find . -maxdepth 1 \( -name '*.md' -o -name '*.yml' -o -name '*.yaml' -o -name '*.json' \) -print); \
	if command -v npx >/dev/null 2>&1 && [ -n "$$files" ]; then \
		npx prettier --check $$files; \
	else \
		printf '%s\n' 'prettier check skipped'; \
	fi
