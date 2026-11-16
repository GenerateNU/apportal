package interviewpanel

import "github.com/GenerateNU/apportal/backend/internal/models"

const maxMembers = 20

type PanelsOutput struct {
	Body []models.InterviewPanelDetail
}

type PanelOutput struct {
	Body models.InterviewPanelDetail
}

type CreatePanelInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Name        string   `json:"name" minLength:"1" maxLength:"100"`
		MemberNUIDs []string `json:"member_nuids,omitempty" maxItems:"20" doc:"Cycle staff not already on another panel"`
	}
}

type PanelPathInput struct {
	ID      string `path:"id" doc:"Cycle ID"`
	PanelID string `path:"panel_id"`
}

type RenamePanelInput struct {
	ID      string `path:"id" doc:"Cycle ID"`
	PanelID string `path:"panel_id"`
	Body    struct {
		Name string `json:"name" minLength:"1" maxLength:"100"`
	}
}

type MemberPathInput struct {
	ID      string `path:"id" doc:"Cycle ID"`
	PanelID string `path:"panel_id"`
	NUID    string `path:"nuid"`
}

type AutoPanelsInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Size   int    `json:"size" minimum:"1" maximum:"20"`
		RoleID string `json:"role_id,omitempty" doc:"Only people who may interview for this opening; empty means anyone who may interview for some opening"`
	}
}
