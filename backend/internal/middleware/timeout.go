package middleware

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"
)

// WithTimeout bounds the request's context with a deadline. Because handlers
// pass this context straight to pgx, the deadline also caps query execution:
// pgx cancels an in-flight query when the context expires and returns the
// connection to the pool. Fiber's ReadTimeout only limits reading the request,
// not query execution, so without this a slow or hung query can hold one of the
// pool's few connections indefinitely and eventually starve the service.
//
// The deadline should sit a little under the server WriteTimeout so a timed-out
// request still has room to write its error response before the socket closes.
func WithTimeout(d time.Duration) fiber.Handler {
	return func(c fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), d)
		defer cancel()
		c.SetContext(ctx)
		return c.Next()
	}
}
