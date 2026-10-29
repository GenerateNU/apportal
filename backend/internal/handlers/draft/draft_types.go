package draft

import "github.com/GenerateNU/apportal/backend/internal/models"

type DraftBoardOutput struct {
	Body models.DraftBoard
}

type DraftOutput struct {
	Body models.Draft
}

type DraftScopedInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role: software_engineer or software_designer"`
}

type OpenDraftInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role   models.Role `json:"role" doc:"Applicant role: software_engineer or software_designer"`
		Rounds int         `json:"rounds,omitempty" doc:"How many times around the board; defaults to 1" minimum:"0"`
	}
}

type UpdateDraftInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		Status *models.DraftStatus `json:"status,omitempty" doc:"setup, active, or complete"`
		Rounds *int                `json:"rounds,omitempty" doc:"How many times around the board" minimum:"1"`
	}
}

type SetDraftTeamsInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		PreferenceListIDs []string `json:"preference_list_ids" doc:"The drafting groups, in the order they pick" minItems:"1" maxItems:"50"`
	}
}

type MakeDraftPickInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		ApplicationID string `json:"application_id"`
		PickNumber    int    `json:"pick_number,omitempty" doc:"Which slot to fill; omit for the one on the clock" minimum:"0"`
	}
}

type DraftPickOutput struct {
	Body models.DraftPick
}

type ReplaceDraftPickInput struct {
	ID         string `path:"id" doc:"Draft ID"`
	PickNumber int    `path:"pick_number" doc:"Which slot to change" minimum:"1"`
	Body       struct {
		ApplicationID string `json:"application_id"`
	}
}

type RemoveDraftPickInput struct {
	ID         string `path:"id" doc:"Draft ID"`
	PickNumber int    `path:"pick_number" doc:"Which slot to empty" minimum:"1"`
}

type DraftIDInput struct {
	ID string `path:"id" doc:"Draft ID"`
}

type DraftedApplicationsOutput struct {
	Body map[string]string
}

type DraftUpdate struct {
	Status *models.DraftStatus
	Rounds *int
}
