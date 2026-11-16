package reviewranking

import "github.com/GenerateNU/apportal/backend/internal/models"

type AppRow struct {
	ID    string
	Stage models.ApplicationStage
}

// ScoreRow is one score from a submitted written review.
type ScoreRow struct {
	ApplicationID    string
	ReviewerNUID     string
	ReviewQuestionID string
	Score            int
	ScoreMin         int
	ScoreMax         int
	Ranked           bool
}

type OpeningInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" required:"true" doc:"Applicant role"`
}

type RankingOutput struct {
	Body models.ReviewRanking
}

type PutCutoffInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" required:"true" doc:"Applicant role"`
	Body   struct {
		Mode  models.CutoffMode `json:"mode"`
		Value float64           `json:"value" doc:"top_n: a whole number >= 0; min_score: any finite normalized score"`
	}
}

type CutoffOutput struct {
	Body models.ReviewCutoff
}

type PutOverrideInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Included bool `json:"included" doc:"true adds the application to the shortlist, false removes it"`
	}
}

type OverrideOutput struct {
	Body models.ReviewCutoffOverride
}

type AdvanceInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" required:"true" doc:"Applicant role"`
	Body   *AdvanceBody
}

type AdvanceBody struct {
	ApplicationIDs []string `json:"application_ids,omitempty" maxItems:"200" doc:"Defaults to everyone on the shortlist; each must be on it"`
}

func (in *AdvanceInput) applicationIDs() []string {
	if in.Body == nil {
		return nil
	}
	return in.Body.ApplicationIDs
}

type AdvanceOutput struct {
	Body struct {
		Moved []string `json:"moved" doc:"Applications moved forward; anyone already past review is left alone"`
	}
}
