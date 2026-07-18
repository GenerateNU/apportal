// Command openapi writes the backend's OpenAPI 3.1 spec (as YAML) to stdout.
// It runs no server and needs no database. Use it to refresh the committed spec
// consumed by frontend codegen:
//
//	make openapi   # writes backend/api/openapi.yaml
package main

import (
	"fmt"
	"os"

	"github.com/GenerateNU/apportal/backend/internal/handlers"
)

func main() {
	spec, err := handlers.OpenAPIYAML()
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to generate OpenAPI spec:", err)
		os.Exit(1)
	}
	if _, err := os.Stdout.Write(spec); err != nil {
		fmt.Fprintln(os.Stderr, "failed to write spec:", err)
		os.Exit(1)
	}
}
