package leadassignment

import "github.com/GenerateNU/apportal/backend/internal/models"

type ReviewerProgressInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Applicant role"`
}

type ReviewerProgressOutput struct {
	Body []models.ReviewerProgress
}
