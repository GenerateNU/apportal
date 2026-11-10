package cycle

import "github.com/GenerateNU/apportal/backend/internal/models"

type CycleStageOutput struct {
	Body models.CycleStage
}

type CycleStagesOutput struct {
	Body []models.CycleStage
}

type CreateCycleStageInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Stage               models.ApplicationStage `json:"stage"`
		DisplayOrder        int                     `json:"display_order"`
		IsActive            *bool                   `json:"is_active,omitempty"`
		RequiredAssignments int                     `json:"required_assignments,omitempty"`
		Label               *string                 `json:"label,omitempty"`
	}
}

type ListCycleStagesInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

type UpdateCycleStageInput struct {
	ID   string `path:"id" doc:"Cycle stage ID"`
	Body struct {
		DisplayOrder        *int    `json:"display_order,omitempty"`
		IsActive            *bool   `json:"is_active,omitempty"`
		RequiredAssignments *int    `json:"required_assignments,omitempty"`
		Label               *string `json:"label,omitempty"`
	}
}
