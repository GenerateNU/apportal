package cycle

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// CycleOutput wraps a single cycle response body.
type CycleOutput struct {
	Body models.Cycle
}

// CyclesOutput wraps a list of cycles.
type CyclesOutput struct {
	Body []models.Cycle
}

type CreateCycleInput struct {
	Body struct {
		Name            string                 `json:"name"`
		Status          models.CycleStatus     `json:"status,omitempty"`
		ApplicationType models.ApplicationType `json:"application_type,omitempty"`
		OpensAt         *time.Time             `json:"opens_at,omitempty"`
		ClosesAt        *time.Time             `json:"closes_at,omitempty"`
	}
}

type ListCyclesInput struct {
	Status string `query:"status" doc:"Optional status filter: draft, open, closed, archived"`
}

// CycleTemplateSummaryOutput wraps a cycle's per-role template counts.
type CycleTemplateSummaryOutput struct {
	Body []models.CycleRoleSummary
}

type CycleIDInput struct {
	ID string `path:"id"`
}

type UpdateCycleInput struct {
	ID   string `path:"id"`
	Body struct {
		Name            *string                 `json:"name,omitempty"`
		Status          *models.CycleStatus     `json:"status,omitempty"`
		ApplicationType *models.ApplicationType `json:"application_type,omitempty"`
		OpensAt         *time.Time              `json:"opens_at,omitempty"`
		ClosesAt        *time.Time              `json:"closes_at,omitempty"`
	}
}
