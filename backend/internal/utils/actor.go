package utils

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// CurrentActor returns the authenticated caller from the context. Handlers call
// it after a require* check has confirmed an identity is present, so a missing
// actor safely yields a zero-value Actor (empty NUID).
func CurrentActor(ctx context.Context) middleware.Actor {
	actor, _ := middleware.ActorFrom(ctx)
	return actor
}

// RequireReviewer rejects calls lacking a reviewer identity. Leads, chiefs, and
// admins can review. The actor is populated by middleware.WithActor from request
// headers (auth stub).
func RequireReviewer(ctx context.Context) error {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || !actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin) {
		return huma.Error401Unauthorized("reviewer identity required")
	}
	return nil
}

// RequireChief rejects calls that are not made by a chief (or admin).
func RequireChief(ctx context.Context) error {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return huma.Error401Unauthorized("reviewer identity required")
	}
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		return huma.Error403Forbidden("chief role required")
	}
	return nil
}
