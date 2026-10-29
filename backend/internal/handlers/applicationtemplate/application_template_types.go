package applicationtemplate

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ApplicationTemplateOutput wraps a single application template response body.
type ApplicationTemplateOutput struct {
	Body models.ApplicationTemplate
}

// ApplicationTemplatesOutput wraps a list of application templates.
type ApplicationTemplatesOutput struct {
	Body []models.ApplicationTemplate
}

type ListOpenApplicationTemplatesInput struct{}

type GetApplicationTemplateInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
}

type UpdateApplicationTemplateInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
	Body struct {
		Title          *string             `json:"title,omitempty"`
		Description    *string             `json:"description,omitempty"`
		Instructions   *string             `json:"instructions,omitempty"`
		OpensAt        *time.Time          `json:"opens_at,omitempty"`
		ClosesAt       *time.Time          `json:"closes_at,omitempty"`
		Status         *models.CycleStatus `json:"status,omitempty"`
		ReviewStatus   *models.CycleStatus `json:"review_status,omitempty"`
		ReviewClosesAt *time.Time          `json:"review_closes_at,omitempty"`
	}
}

// ApplicationTemplateUpdate carries partial-update fields; nil pointers are
// left unchanged.
type ApplicationTemplateUpdate struct {
	Title          *string
	Description    *string
	Instructions   *string
	OpensAt        *time.Time
	ClosesAt       *time.Time
	Status         *models.CycleStatus
	ReviewStatus   *models.CycleStatus
	ReviewClosesAt *time.Time
}
