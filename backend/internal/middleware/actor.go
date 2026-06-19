// Package middleware holds net/http middleware: the auth-stub actor extractor,
// request logging, and panic recovery.
package middleware

import (
	"context"
	"net/http"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// Actor is the authenticated caller. This is a stub: identity is read from
// request headers (X-NUID / X-Role) rather than a verified session/token.
// Swapping in real NUID login means changing only how Actor gets populated.
type Actor struct {
	NUID string
	Role models.ReviewerRole
}

type contextKey struct{}

var actorKey contextKey

// WithActor reads X-NUID and X-Role headers and, when present, stores an Actor
// in the request context. Absent headers leave the context empty so that
// applicant-facing (unauthenticated) routes still work.
func WithActor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nuid := r.Header.Get("X-NUID")
		if nuid != "" {
			actor := Actor{
				NUID: nuid,
				Role: models.ReviewerRole(r.Header.Get("X-Role")),
			}
			r = r.WithContext(context.WithValue(r.Context(), actorKey, actor))
		}
		next.ServeHTTP(w, r)
	})
}

// ActorFrom returns the Actor stored on the context, if any. Authorization
// checks live in the handlers package (requireReviewer/requireChief) so they
// can return Huma errors that appear in the OpenAPI spec.
func ActorFrom(ctx context.Context) (Actor, bool) {
	actor, ok := ctx.Value(actorKey).(Actor)
	return actor, ok
}
