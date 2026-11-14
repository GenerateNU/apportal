package utils

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
)

// CurrentActor returns the authenticated caller from the context. Handlers call
// it after a require* check has confirmed an identity is present, so a missing
// actor safely yields a zero-value Actor (empty NUID).
func CurrentActor(ctx context.Context) middleware.Actor {
	actor, _ := middleware.ActorFrom(ctx)
	return actor
}
