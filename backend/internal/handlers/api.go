package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// writeJSON / writeError back the plain net/http health & root routes that are
// not Huma operations.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// storeErr maps store sentinel errors to the matching Huma HTTP error so the
// operation returns the right status code (and it appears in the OpenAPI spec).
func storeErr(err error) error {
	switch {
	case errors.Is(err, store.ErrNotFound):
		return huma.Error404NotFound("not found")
	case errors.Is(err, store.ErrConflict):
		return huma.Error409Conflict("already exists")
	default:
		slog.Error("unexpected store error", "error", err)
		return huma.Error500InternalServerError("internal server error")
	}
}

// currentActor returns the authenticated actor. Callers should already have
// passed requireReviewer/requireChief, so the actor is guaranteed populated.
func currentActor(ctx context.Context) middleware.Actor {
	a, _ := middleware.ActorFrom(ctx)
	return a
}

// requireReviewer rejects calls lacking a valid reviewer identity. The actor is
// populated by middleware.WithActor from request headers (auth stub).
func requireReviewer(ctx context.Context) error {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || !actor.Role.Valid() {
		return huma.Error401Unauthorized("reviewer identity required")
	}
	return nil
}

// requireChief rejects calls that are not made by a chief.
func requireChief(ctx context.Context) error {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return huma.Error401Unauthorized("reviewer identity required")
	}
	if actor.Role != models.ReviewerRoleChief {
		return huma.Error403Forbidden("chief role required")
	}
	return nil
}
