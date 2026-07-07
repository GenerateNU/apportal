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

// Router holds shared dependencies for the plain (non-Huma) health endpoints.
type Router struct {
	database *pgxpool.Pool
}

// NewRouter builds the Fiber app. It applies the middleware chain, mounts the
// plain health checks, creates a Huma API over the same app (which auto-serves
// the OpenAPI spec at /openapi.json|yaml and Scalar docs at /docs), then
// registers every domain's typed operations.
func NewRouter(database *pgxpool.Pool, frontendURL string) *fiber.App {
	st := store.New(database)
	app := fiber.New(fiber.Config{
		ReadTimeout: 5 * time.Second,
	})

	// Middleware applies outermost-first.
	app.Use(middleware.Recovery())
	app.Use(middleware.CORS(frontendURL))
	app.Use(middleware.Logging())
	app.Use(middleware.WithActor())

	// Plain liveness/readiness routes (not part of the documented API surface).
	router := &Router{database: database}
	app.Get("/", router.root)
	app.Get("/healthz", router.health)
	app.Get("/readyz", router.ready)

	// Huma API: OpenAPI 3.1 generated from the typed operations below, rendered
	// with Scalar (loaded from CDN) at /docs.
	config := huma.DefaultConfig("apportal API", "0.1.0")
	config.DocsRenderer = huma.DocsRendererScalar
	config.Info.Description = "Generate application portal — applications, reviews, and the hiring pipeline."
	api := humafiber.New(app, config)

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
	(&interviewAssignmentHandler{store: st}).register(api)
	(&interviewHandler{store: st}).register(api)
	(&recordingReviewHandler{store: st}).register(api)
	(&selectionHandler{store: st}).register(api)

	return app
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
