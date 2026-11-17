package selection

import "github.com/GenerateNU/apportal/backend/internal/models"

type SelectionOutput struct {
	Body models.LeadSelection
}

type SelectionsOutput struct {
	Body struct {
		Selections []models.LeadSelection `json:"selections"`
		NextCursor string                 `json:"next_cursor,omitempty"`
	}
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
	Limit    int    `query:"limit" doc:"Max results per page; omit (or 0) to return every match" minimum:"0" maximum:"200"`
	Cursor   string `query:"cursor" doc:"next_cursor from the previous page; omit for the first page"`
}
