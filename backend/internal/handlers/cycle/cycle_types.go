package cycle

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"

	"gorm.io/gorm"
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
		BranchID        string                 `json:"branch_id"`
		Name            string                 `json:"name"`
		ApplicationType models.ApplicationType `json:"application_type,omitempty"`
		OpensAt         *time.Time             `json:"opens_at,omitempty"`
		ClosesAt        *time.Time             `json:"closes_at,omitempty"`
	}
}

type ListCyclesInput struct {
	Status   string `query:"status" doc:"Optional status filter: draft, open, closed, archived"`
	BranchID string `query:"branch_id" doc:"Optional branch filter"`
}

// CycleTemplateSummaryOutput wraps a cycle's per-role template counts.
type CycleTemplateSummaryOutput struct {
	Body []models.CycleRoleSummary
}

const maxBulkCycles = 200

type TemplateSummariesInput struct {
	CycleIDs string `query:"cycle_ids" doc:"Comma-separated cycle ids"`
}

type CycleIDInput struct {
	ID string `path:"id"`
}

type UpdateCycleInput struct {
	ID   string `path:"id"`
	Body struct {
		Name            *string                 `json:"name,omitempty"`
		Status          *models.CycleStatus     `json:"status,omitempty" doc:"Only archived (from closed) or closed (from archived)"`
		ApplicationType *models.ApplicationType `json:"application_type,omitempty"`
		OpensAt         *time.Time              `json:"opens_at,omitempty"`
		ClosesAt        *time.Time              `json:"closes_at,omitempty"`
	}
}

type CycleCreate struct {
	BranchID        string
	Name            string
	Status          models.CycleStatus
	ApplicationType models.ApplicationType
	OpensAt         *time.Time
	ClosesAt        *time.Time
}

// CycleUpdate carries partial-update fields; nil pointers are left unchanged.
type CycleUpdate struct {
	Name            *string
	Status          *models.CycleStatus
	ApplicationType *models.ApplicationType
	OpensAt         *time.Time
	ClosesAt        *time.Time
}

// CycleFilter holds optional list filters; empty fields are ignored.
type CycleFilter struct {
	Status   models.CycleStatus
	BranchID string
	// Listable limits to cycles the caller may list; nil means every cycle.
	Listable *gorm.DB
}
