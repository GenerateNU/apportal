// Package middleware holds Fiber middleware: the auth-stub actor extractor,
// request logging, and panic recovery.
package middleware

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v3"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// Actor is the authenticated caller. This is a stub: identity is read from
// request headers (X-NUID / X-Role) rather than a verified session/token.
// Swapping in real NUID login means changing only how Actor gets populated.
type Actor struct {
	NUID  string
	Roles []models.UserRole
}

// HasRole reports whether the actor holds the given role.
func (a Actor) HasRole(role models.UserRole) bool {
	for _, r := range a.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// HasAnyRole reports whether the actor holds at least one of the given roles.
func (a Actor) HasAnyRole(roles ...models.UserRole) bool {
	for _, role := range roles {
		if a.HasRole(role) {
			return true
		}
	}
	return false
}

type contextKey struct{}

var actorKey contextKey

// WithActor reads X-NUID and X-Role headers and, when present, stores an Actor
// on the request's user context (which Huma surfaces to operation handlers as
// their context.Context). X-Role is a comma-separated list of roles. Absent
// headers leave the context empty so applicant-facing (unauthenticated) routes
// still work.
func WithActor() fiber.Handler {
	return func(c fiber.Ctx) error {
		ctx := ContextWithActor(c.Context(), c.Get("X-NUID"), c.Get("X-Role"))
		c.SetContext(ctx)
		return c.Next()
	}
}

// ContextWithActor returns ctx carrying an Actor built from the given NUID and
// comma-separated role header. When nuid is empty it returns ctx unchanged.
func ContextWithActor(ctx context.Context, nuid, roleHeader string) context.Context {
	if nuid == "" {
		return ctx
	}
	actor := Actor{NUID: nuid, Roles: parseRoles(roleHeader)}
	return context.WithValue(ctx, actorKey, actor)
}

// parseRoles splits a comma-separated X-Role header into roles, ignoring blanks.
func parseRoles(header string) []models.UserRole {
	if header == "" {
		return nil
	}
	parts := strings.Split(header, ",")
	roles := make([]models.UserRole, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			roles = append(roles, models.UserRole(p))
		}
	}
	return roles
}

// ActorFrom returns the Actor stored on the context, if any. Authorization
// checks live in the handlers package (requireReviewer/requireChief) so they
// can return Huma errors that appear in the OpenAPI spec.
func ActorFrom(ctx context.Context) (Actor, bool) {
	actor, ok := ctx.Value(actorKey).(Actor)
	return actor, ok
}
