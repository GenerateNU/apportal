package leadassignment

import "github.com/GenerateNU/apportal/backend/internal/models"

type ReviewerProgressInput struct {
	ID      string `path:"id" doc:"Cycle ID"`
	RoleID  string `query:"role_id" doc:"Applicant role"`
	RoleIDs string `query:"role_ids" doc:"Comma-separated roles, instead of role_id"`
}

type ReviewerProgressOutput struct {
	Body []models.ReviewerProgress
}
