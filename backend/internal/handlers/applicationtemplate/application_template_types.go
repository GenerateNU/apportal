package applicationtemplate

import (
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

type ListCycleApplicationTemplatesInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

type GetApplicationTemplateInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Applicant role"`
}

type UpdateApplicationTemplateInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Applicant role"`
	Body   struct {
		Title        *string `json:"title,omitempty"`
		Description  *string `json:"description,omitempty"`
		Instructions *string `json:"instructions,omitempty"`
	}
}

// ApplicationTemplateUpdate carries partial-update fields; nil pointers are
// left unchanged.
type ApplicationTemplateUpdate struct {
	Title        *string
	Description  *string
	Instructions *string
}
