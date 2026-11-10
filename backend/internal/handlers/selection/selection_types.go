package selection

import "github.com/GenerateNU/apportal/backend/internal/models"

type SelectionOutput struct {
	Body models.LeadSelection
}

type SelectionsOutput struct {
	Body []models.LeadSelection
}

type UpsertSelectionInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Note *string `json:"note,omitempty"`
	}
}

type ListSelectionsInput struct {
	ID       string `path:"id" doc:"Cycle ID"`
	LeadNUID string `query:"lead_nuid" doc:"Optional lead filter"`
}
