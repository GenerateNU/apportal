package reviewquestion

import "github.com/GenerateNU/apportal/backend/internal/models"

type ReviewQuestionAverageInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Applicant role"`
}

type ReviewQuestionAverageOutput struct {
	Body []models.ReviewQuestionAverage
}
