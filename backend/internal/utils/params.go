package utils

import (
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

// MaxBulkApplications bounds both the query string and the fan-out of the
// underlying `IN (...)`. Comfortably above any page size the UI uses.
const MaxBulkApplications = 200

// ApplicationScopedInput identifies an operation acting on an application by ID.
// Shared across the workflow handlers.
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

// RequireUUIDs takes name, value pairs and 422s on the first value that
// isn't a UUID.
func RequireUUIDs(pairs ...string) error {
	for i := 0; i+1 < len(pairs); i += 2 {
		if _, err := uuid.Parse(pairs[i+1]); err != nil {
			return huma.Error422UnprocessableEntity("invalid " + pairs[i])
		}
	}
	return nil
}

// UUIDList checks and dedupes ids, keeping their order.
func UUIDList(name string, ids []string) ([]string, error) {
	seen := make(map[string]bool, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if _, err := uuid.Parse(id); err != nil {
			return nil, huma.Error422UnprocessableEntity("invalid " + name)
		}
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out, nil
}

// NUIDList trims, drops blanks and dedupes, keeping order.
func NUIDList(nuids []string) []string {
	seen := make(map[string]bool, len(nuids))
	out := make([]string, 0, len(nuids))
	for _, n := range nuids {
		if n = strings.TrimSpace(n); n != "" && !seen[n] {
			seen[n] = true
			out = append(out, n)
		}
	}
	return out
}
