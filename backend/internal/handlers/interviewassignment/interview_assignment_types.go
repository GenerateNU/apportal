package interviewassignment

import "github.com/GenerateNU/apportal/backend/internal/models"

type InterviewerOutput struct {
	Body models.InterviewerDetail
}

type InterviewReviewerOutput struct {
	Body models.InterviewReviewerDetail
}

type InterviewReviewersOutput struct {
	Body []models.InterviewReviewerDetail
}

type AddInterviewerInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		InterviewerNUID string `json:"interviewer_nuid" minLength:"1"`
	}
}

type AddReviewerInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		ReviewerNUID string `json:"reviewer_nuid" minLength:"1"`
	}
}

type ListBulkInput struct {
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type UnassignAllInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Applicant role"`
}

type UnassignAllOutput struct {
	Body struct {
		Deleted int `json:"deleted" doc:"Number of assignments removed"`
	}
}

type AssignmentPair struct {
	ApplicationID string
	LeadNUID      string
}
