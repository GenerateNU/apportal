package reviewrelease

import "github.com/GenerateNU/apportal/backend/internal/models"

type ReviewGatesOutput struct {
	Body []models.ReviewGate
}

type ReviewGateOutput struct {
	Body models.ReviewGate
}

type SetReviewReleaseInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		RoleID   string            `json:"role_id" doc:"Applicant role ID"`
		Kind     models.ReviewKind `json:"kind" doc:"Review kind: written or recording"`
		Released bool              `json:"released" doc:"True releases reviews to all reviewers; false hides them again"`
	}
}
