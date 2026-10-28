package leadassignment

import "github.com/GenerateNU/apportal/backend/internal/models"

type ReviewerProgressInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type ReviewerProgressOutput struct {
	Body []models.ReviewerProgress
}
