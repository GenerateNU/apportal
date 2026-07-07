package middleware

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
)

// CORS allows the frontend origin to call the API from the browser. Without
// this, preflight OPTIONS requests fail with no Access-Control-Allow-Origin
// header and every fetch from frontendURL is blocked before it reaches a
// handler.
func CORS(frontendURL string) fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins: []string{frontendURL},
		AllowHeaders: []string{"Content-Type", "X-NUID", "X-Role"},
	})
}
