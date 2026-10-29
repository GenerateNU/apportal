package utils

import (
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// MaxBulkApplications bounds both the query string and the fan-out of the
// underlying `IN (...)`. Comfortably above any page size the UI uses.
const MaxBulkApplications = 200

// ApplicationScopedInput identifies an operation acting on an application by ID.
// Shared across the pipeline handlers.
type ApplicationScopedInput struct {
	ID string `path:"id" doc:"Application ID"`
}

// IDInput identifies a resource by its own ID (not application-scoped).
type IDInput struct {
	ID string `path:"id"`
}

// CycleScopedInput identifies an operation acting on a cycle by ID.
type CycleScopedInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

// SplitIDs parses a comma-separated id list, dropping blanks.
func SplitIDs(raw string) []string {
	ids := make([]string, 0, 8)
	for _, id := range strings.Split(raw, ",") {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

func ParseTemplateRole(raw string) (models.Role, error) {
	role := models.Role(raw)
	if raw == "" || !role.Valid() {
		return "", huma.Error422UnprocessableEntity("missing or invalid role")
	}
	return role, nil
}
