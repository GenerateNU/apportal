// Package middleware holds Fiber middleware: the actor extractor, request
// logging, and panic recovery.
package middleware

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v3"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// Actor is the authenticated caller: a real user row, resolved from a
// verified Supabase session rather than trusted from the request.
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

// WithActor verifies the request's bearer token against Supabase and, when it
// belongs to a known user, stores their real Actor (NUID and roles read from
// the users table, not the request) on the request's context. A missing or
// invalid token, or one with no matching user row, leaves the context empty
// — requireReviewer/requireChief in the handlers package do the actual
// rejecting, so applicant-facing (unauthenticated) routes still work.
func WithActor(verifier *SupabaseVerifier, users *store.Store) fiber.Handler {
	return func(c fiber.Ctx) error {
		ctx := c.Context()

		if token := bearerToken(c.Get("Authorization")); token != "" {
			if email, err := verifier.Verify(ctx, token); err == nil {
				if user, err := users.GetUserByEmail(ctx, email); err == nil {
					ctx = ContextWithActor(ctx, Actor{NUID: user.NUID, Roles: user.Roles})
				}
			}
		}

		c.SetContext(ctx)
		return c.Next()
	}
}

// bearerToken extracts the token from an `Authorization: Bearer <token>`
// header, or "" if the header is absent or malformed.
func bearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimPrefix(header, prefix)
}

// ContextWithActor returns ctx carrying the given actor.
func ContextWithActor(ctx context.Context, actor Actor) context.Context {
	return context.WithValue(ctx, actorKey, actor)
}

// ActorFrom returns the Actor stored on the context, if any. Authorization
// checks live in the handlers package (requireReviewer/requireChief) so they
// can return Huma errors that appear in the OpenAPI spec.
func ActorFrom(ctx context.Context) (Actor, bool) {
	actor, ok := ctx.Value(actorKey).(Actor)
	return actor, ok
}
