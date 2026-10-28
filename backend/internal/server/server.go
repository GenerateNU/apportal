// Package server builds the Fiber app: middleware, health checks, and every
// handler package's Huma routes.
package server

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humafiber"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/handlers/applicant"
	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/applicationtemplate"
	"github.com/GenerateNU/apportal/backend/internal/handlers/assignmentplanner"
	"github.com/GenerateNU/apportal/backend/internal/handlers/challenge"
	"github.com/GenerateNU/apportal/backend/internal/handlers/chiefreview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/codesubmission"
	"github.com/GenerateNU/apportal/backend/internal/handlers/cycle"
	"github.com/GenerateNU/apportal/backend/internal/handlers/decision"
	"github.com/GenerateNU/apportal/backend/internal/handlers/draft"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/leadassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/preferencelist"
	"github.com/GenerateNU/apportal/backend/internal/handlers/question"
	"github.com/GenerateNU/apportal/backend/internal/handlers/recordingreview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewquestion"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/handlers/selection"
	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/handlers/writtenreview"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/storage"
)

// requestTimeout bounds the request context (and so every query) and sits
// under writeTimeout so a timed-out request can still write its error.
const (
	readTimeout    = 5 * time.Second
	writeTimeout   = 15 * time.Second
	idleTimeout    = 60 * time.Second
	requestTimeout = 10 * time.Second

	// fasthttp's 4096 default overflows on the bulk endpoints' 200-id query
	// strings plus the bearer token, and the 431 it returns carries no CORS
	// header, so the browser reports a CORS failure instead.
	readBufferSize = 16 * 1024
)

type Config struct {
	CORSOrigins     []string
	SupabaseURL     string
	SupabaseAnonKey string
	Storage         *storage.Client
	Challenge       *applicant.ChallengeClient
}

// CreateApp builds the Fiber app with its middleware, the plain health checks,
// and the Huma API, which also serves the OpenAPI spec and Scalar docs at /docs.
func CreateApp(db *gorm.DB, cfg Config) *fiber.App {
	verifier := middleware.NewSupabaseVerifier(cfg.SupabaseURL, cfg.SupabaseAnonKey)
	app := fiber.New(fiber.Config{
		ReadTimeout:    readTimeout,
		WriteTimeout:   writeTimeout,
		IdleTimeout:    idleTimeout,
		ReadBufferSize: readBufferSize,
	})

	// Middleware applies outermost-first.
	app.Use(middleware.Recovery())
	app.Use(middleware.CORS(cfg.CORSOrigins))
	app.Use(middleware.Logging())
	app.Use(middleware.WithTimeout(requestTimeout))
	app.Use(middleware.WithActor(verifier, user.NewUserDB(db).GetUserByEmail))

	app.Get("/", root)
	app.Get("/healthz", health)
	app.Get("/readyz", ready(db))

	api := humafiber.New(app, humaConfig())
	CreateRoutes(api, db, cfg.Storage, cfg.Challenge)
	return app
}

// humaConfig is shared by the server and OpenAPIYAML so the served API and the
// generated spec can't drift.
func humaConfig() huma.Config {
	config := huma.DefaultConfig("apportal API", "0.1.0")
	config.DocsRenderer = huma.DocsRendererScalar
	config.Info.Description = "Generate application portal — applications, reviews, and the hiring pipeline."
	return config
}

func CreateRoutes(api huma.API, db *gorm.DB, storageClient *storage.Client, challengeClient *applicant.ChallengeClient) {
	cycle.Route(api, db)
	applicationtemplate.Route(api, db)
	question.Route(api, db)
	challenge.Route(api, db)
	user.Route(api, db)
	applicant.Route(api, db, challengeClient)
	application.Route(api, db, storageClient)
	codesubmission.Route(api, db)

	// Review → interview → selection pipeline.
	leadassignment.Route(api, db)
	assignmentplanner.Route(api, db)
	reviewquestion.Route(api, db)
	writtenreview.Route(api, db)
	chiefreview.Route(api, db)
	reviewrelease.Route(api, db)
	interviewassignment.Route(api, db)
	interview.Route(api, db)
	recordingreview.Route(api, db)
	preferencelist.Route(api, db)
	selection.Route(api, db)
	draft.Route(api, db)
	decision.Route(api, db)
}

// OpenAPIYAML registers the same routes as the server over a dry-run database
// and returns the spec, so `make openapi` needs no running server or database.
func OpenAPIYAML() ([]byte, error) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		return nil, err
	}
	api := humafiber.New(fiber.New(), humaConfig())
	CreateRoutes(api, db, storage.NewClient("", ""), applicant.NewChallengeClient("", ""))
	return api.OpenAPI().YAML()
}

func root(c fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"message": "apportal backend is running",
		"docs":    "/docs",
	})
}

func health(c fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok"})
}

func ready(db *gorm.DB) fiber.Handler {
	return func(c fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
		defer cancel()

		sqlDB, err := db.DB()
		if err == nil {
			err = sqlDB.PingContext(ctx)
		}
		if err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status":   "unhealthy",
				"database": "down",
				"error":    err.Error(),
			})
		}
		return c.JSON(fiber.Map{"status": "ok", "database": "up"})
	}
}
