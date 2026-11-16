package access

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// Gate is the checks handlers make; Checker and Static both satisfy it.
type Gate interface {
	CanCycle(ctx context.Context, action CycleAction, cycleID string) error
	CanApplication(ctx context.Context, action ApplicationAction, applicationID string) error
}

func IsAdmin(actor middleware.Actor) bool {
	return actor.HasRole(models.UserRoleAdmin)
}

// currentActor 401s without a signed-in caller, before any lookup runs.
func currentActor(ctx context.Context) (middleware.Actor, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return middleware.Actor{}, huma.Error401Unauthorized("authentication required")
	}
	return actor, nil
}

func RequireActor(ctx context.Context) error {
	_, err := currentActor(ctx)
	return err
}

// RequireAdmin rejects anyone but a global admin.
func RequireAdmin(ctx context.Context) error {
	actor, err := currentActor(ctx)
	if err != nil {
		return err
	}
	if !IsAdmin(actor) {
		return huma.Error403Forbidden("admin role required")
	}
	return nil
}
