package handlers

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humafiber"
	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// Server timeouts. requestTimeout bounds the request context (and therefore DB
// query execution) and sits under writeTimeout so a timed-out request can still
// write its error response.
const (
	readTimeout    = 5 * time.Second
	writeTimeout   = 15 * time.Second
	idleTimeout    = 60 * time.Second
	requestTimeout = 10 * time.Second
)

// Router holds shared dependencies for the plain (non-Huma) health endpoints.
type Router struct {
	database *pgxpool.Pool
}

// NewRouter builds the Fiber app. It applies the middleware chain, mounts the
// plain health checks, creates a Huma API over the same app (which auto-serves
// the OpenAPI spec at /openapi.json|yaml and Scalar docs at /docs), then
// registers every domain's typed operations.
func NewRouter(database *pgxpool.Pool, corsOrigins []string) *fiber.App {
	st := store.New(database)
	app := fiber.New(fiber.Config{
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
		IdleTimeout:  idleTimeout,
	})

	// Middleware applies outermost-first.
	app.Use(middleware.Recovery())
	app.Use(middleware.CORS(corsOrigins))
	app.Use(middleware.Logging())
	app.Use(middleware.WithTimeout(requestTimeout))
	app.Use(middleware.WithActor())

	// Plain liveness/readiness routes (not part of the documented API surface).
	router := &Router{database: database}
	app.Get("/", router.root)
	app.Get("/healthz", router.health)
	app.Get("/readyz", router.ready)

	// Huma API: OpenAPI 3.1 generated from the typed operations below, rendered
	// with Scalar (loaded from CDN) at /docs.
	api := humafiber.New(app, humaConfig())
	registerHandlers(api, st)

	return app
}

// humaConfig builds the shared Huma configuration used both by the live server
// and by OpenAPIYAML so the runtime API and the generated spec never drift.
func humaConfig() huma.Config {
	config := huma.DefaultConfig("apportal API", "0.1.0")
	config.DocsRenderer = huma.DocsRendererScalar
	config.Info.Description = "Generate application portal — applications, reviews, and the hiring pipeline."
	return config
}

// registerHandlers wires every domain's typed operations onto the API.
func registerHandlers(api huma.API, st *store.Store) {
	(&cycleHandler{store: st}).register(api)
	(&cycleStageHandler{store: st}).register(api)
	(&questionHandler{store: st}).register(api)
	(&challengeHandler{store: st}).register(api)
	(&userHandler{store: st}).register(api)
	(&applicantHandler{store: st}).register(api)
	(&applicationHandler{store: st}).register(api)
	(&answerHandler{store: st}).register(api)
	(&codeSubmissionHandler{store: st}).register(api)

	// Review → interview → selection pipeline.
	(&leadAssignmentHandler{store: st}).register(api)
	(&writtenReviewHandler{store: st}).register(api)
	(&chiefReviewHandler{store: st}).register(api)
	(&reviewReleaseHandler{store: st}).register(api)
	(&interviewAssignmentHandler{store: st}).register(api)
	(&interviewHandler{store: st}).register(api)
	(&recordingReviewHandler{store: st}).register(api)
	(&selectionHandler{store: st}).register(api)
}

// OpenAPIYAML builds the same Huma API used at runtime and returns its OpenAPI
// 3.1 document as YAML. Operations are only registered, not invoked, so it needs
// no database — the store wraps a nil pool. This lets `make openapi` (see
// cmd/openapi) dump the spec for frontend codegen without a running server.
func OpenAPIYAML() ([]byte, error) {
	api := humafiber.New(fiber.New(), humaConfig())
	registerHandlers(api, store.New(nil))
	return api.OpenAPI().YAML()
}

func (router *Router) root(c fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"message": "apportal backend is running",
		"docs":    "/docs",
	})
}

func (router *Router) health(c fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok"})
}

func (router *Router) ready(c fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	if err := router.database.Ping(ctx); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status":   "unhealthy",
			"database": "down",
			"error":    err.Error(),
		})
	}

	return c.JSON(fiber.Map{"status": "ok", "database": "up"})
}
