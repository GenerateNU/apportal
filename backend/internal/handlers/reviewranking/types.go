package reviewranking

import "github.com/GenerateNU/apportal/backend/internal/models"

type AppRow struct {
	ID    string
	Stage models.ApplicationStage
}

type ScoreRow struct {
	ApplicationID    string
	ReviewerNUID     string
	ReviewQuestionID string
	Score            int
	ScoreMin         int
	ScoreMax         int
}

type RankingInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Applicant role"`
}

type RankingOutput struct {
	Body models.ReviewRanking
}

type PutCutoffInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		RoleID string            `json:"role_id"`
		Mode   models.CutoffMode `json:"mode" enum:"min_score,top_n"`
		Value  float64           `json:"value"`
	}
}

type DeleteCutoffInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Applicant role"`
}

type CutoffOutput struct {
	Body models.ReviewCutoff
}

type PutOverrideInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Included bool `json:"included" doc:"true adds the application to the list, false removes it"`
	}
}

type OverrideOutput struct {
	Body models.ReviewCutoffOverride
}
