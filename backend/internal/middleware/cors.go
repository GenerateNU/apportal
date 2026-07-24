package middleware

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
)

// CORS allows the configured origins to call the API from the browser.
// Without this, preflight OPTIONS requests fail with no
// Access-Control-Allow-Origin header and every fetch from the frontend is
// blocked before it reaches a handler.
func CORS(allowedOrigins []string) fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins: allowedOrigins,
		// PATCH is included (unlike some of our other services) since
		// update-user/update-cycle/etc. rely on it.
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
}
