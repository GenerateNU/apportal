package leadassignment

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type LeadAssignmentOutput struct {
	Body models.LeadAssignment
}

type LeadAssignmentsOutput struct {
	Body []models.LeadAssignment
}

type CreateLeadAssignmentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		LeadNUID string `json:"lead_nuid"`
	}
}

type DeleteAllLeadAssignmentsInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type DeleteAllLeadAssignmentsOutput struct {
	Body struct {
		Deleted int `json:"deleted" doc:"Number of lead assignments removed"`
	}
}

// LeadAssignmentPair is one lead assigned to one application, for bulk writes.
type LeadAssignmentPair struct {
	ApplicationID string
	LeadNUID      string
}

// ReviewerProgressRow is one lead's assignment with its review's submission
// time, before grouping by lead.
type ReviewerProgressRow struct {
	LeadNUID      string
	ApplicationID string
	ApplicantNUID string
	FullName      string
	Email         string
	AssignedAt    time.Time
	SubmittedAt   *time.Time
}
