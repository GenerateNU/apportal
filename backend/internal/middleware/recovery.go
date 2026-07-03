package middleware

import (
	"log/slog"

	"github.com/gofiber/fiber/v3"
)

// Recovery converts a panic in a downstream handler into a 500 response
// instead of crashing the server.
func Recovery() fiber.Handler {
	return func(c fiber.Ctx) (err error) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("panic recovered", "error", rec, "path", c.Path())
				err = c.Status(fiber.StatusInternalServerError).
					JSON(fiber.Map{"error": "internal server error"})
			}
		}()
		return c.Next()
	}
}
