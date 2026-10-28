package interviewassignment

import "github.com/GenerateNU/apportal/backend/internal/models"

type InterviewAssignmentOutput struct {
	Body models.InterviewAssignment
}

type SetInterviewAssignmentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		InterviewerNUID string `json:"interviewer_nuid"`
	}
}

type InterviewAssignmentsOutput struct {
	Body []models.InterviewAssignment
}

type ListAssignmentsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type InterviewReviewAssignmentOutput struct {
	Body models.InterviewReviewAssignment
}

type InterviewReviewAssignmentsOutput struct {
	Body []models.InterviewReviewAssignment
}

type AssignRecordingReviewerInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		LeadNUID string `json:"lead_nuid"`
	}
}

// UnassignAllInput identifies a cycle-and-role-scoped bulk-delete.
type UnassignAllInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type UnassignAllOutput struct {
	Body struct {
		Deleted int `json:"deleted" doc:"Number of assignments removed"`
	}
}
