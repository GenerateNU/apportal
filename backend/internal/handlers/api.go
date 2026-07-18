package handlers

import (
	"context"
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// storeErr maps store sentinel errors to the matching Huma HTTP error so the
// operation returns the right status code (and it appears in the OpenAPI spec).
func storeErr(err error) error {
	switch {
	case errors.Is(err, store.ErrNotFound):
		return huma.Error404NotFound("not found")
	case errors.Is(err, store.ErrConflict):
		return huma.Error409Conflict("already exists")
	case store.InvalidInput(err):
		return huma.Error422UnprocessableEntity("request references data that does not exist or violates a constraint")
	default:
		slog.Error("unexpected store error", "error", err)
		return huma.Error500InternalServerError("internal server error")
	}
}

// currentActor returns the authenticated caller from the context. Handlers call
// it after a require* check has confirmed an identity is present, so a missing
// actor safely yields a zero-value Actor (empty NUID).
func currentActor(ctx context.Context) middleware.Actor {
	actor, _ := middleware.ActorFrom(ctx)
	return actor
}

// requireReviewer rejects calls lacking a reviewer identity. Leads, chiefs, and
// admins can review. The actor is populated by middleware.WithActor from request
// headers (auth stub).
func requireReviewer(ctx context.Context) error {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || !actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin) {
		return huma.Error401Unauthorized("reviewer identity required")
	}
	return nil
}

// requireChief rejects calls that are not made by a chief (or admin).
func requireChief(ctx context.Context) error {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return huma.Error401Unauthorized("reviewer identity required")
	}
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		return huma.Error403Forbidden("chief role required")
	}
	return nil
}
