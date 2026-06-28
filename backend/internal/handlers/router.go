package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// Router holds shared dependencies for the plain (non-Huma) health endpoints.
type Router struct {
	database *pgxpool.Pool
}

// NewRouter builds the full HTTP handler. It mounts the plain health checks on
// a ServeMux, creates a Huma API over the same mux (which auto-serves the
// OpenAPI spec at /openapi.json|yaml and Scalar docs at /docs), registers every
// domain's typed operations, then wraps the mux in the middleware chain.
func NewRouter(database *pgxpool.Pool) http.Handler {
	st := store.New(database)
	mux := http.NewServeMux()

	// Plain liveness/readiness routes (not part of the documented API surface).
	router := &Router{database: database}
	mux.HandleFunc("GET /", router.root)
	mux.HandleFunc("GET /healthz", router.health)
	mux.HandleFunc("GET /readyz", router.ready)

	// Huma API: OpenAPI 3.1 generated from the typed operations below, rendered
	// with Scalar (loaded from CDN) at /docs.
	config := huma.DefaultConfig("apportal API", "0.1.0")
	config.DocsRenderer = huma.DocsRendererScalar
	config.Info.Description = "Generate application portal — applications, reviews, and the hiring pipeline."
	api := humago.New(mux, config)

	(&cycleHandler{store: st}).register(api)
	(&cycleStageHandler{store: st}).register(api)
	(&questionHandler{store: st}).register(api)
	(&challengeHandler{store: st}).register(api)
	(&userHandler{store: st}).register(api)
	(&applicantHandler{store: st}).register(api)
	(&applicationHandler{store: st}).register(api)
	(&answerHandler{store: st}).register(api)
	(&codeSubmissionHandler{store: st}).register(api)

	// Middleware applies outermost-first.
	return middleware.Recovery(middleware.Logging(middleware.WithActor(mux)))
}

func (router *Router) root(w http.ResponseWriter, r *http.Request) {
	// "GET /" is a catch-all subtree pattern, so guard it to the exact root
	// and 404 anything else that no specific route matched.
	if r.URL.Path != "/" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "apportal backend is running",
		"docs":    "/docs",
	})
}

func (router *Router) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (router *Router) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	status := http.StatusOK
	response := map[string]string{"status": "ok", "database": "up"}

	if err := router.database.Ping(ctx); err != nil {
		status = http.StatusServiceUnavailable
		response["status"] = "unhealthy"
		response["database"] = "down"
		response["error"] = err.Error()
	}

	writeJSON(w, status, response)
}
