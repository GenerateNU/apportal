package middleware

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// RequireReviewer returns operation middleware that rejects requests lacking a
// reviewer identity (lead, chief, or admin) before the handler runs. Attach it
// to a huma.Operation's Middlewares field.
func RequireReviewer(api huma.API) func(ctx huma.Context, next func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		actor, ok := ActorFrom(ctx.Context())
		if !ok || !actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin) {
			huma.WriteErr(api, ctx, http.StatusUnauthorized, "reviewer identity required")
			return
		}
		next(ctx)
	}
}

// RequireChief returns operation middleware that rejects requests not made by a
// chief (or admin) before the handler runs. Attach it to a huma.Operation's
// Middlewares field.
func RequireChief(api huma.API) func(ctx huma.Context, next func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		actor, ok := ActorFrom(ctx.Context())
		if !ok || actor.NUID == "" {
			huma.WriteErr(api, ctx, http.StatusUnauthorized, "reviewer identity required")
			return
		}
		if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
			huma.WriteErr(api, ctx, http.StatusForbidden, "chief role required")
			return
		}
		next(ctx)
	}
}
