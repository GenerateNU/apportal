package assignmentplanner

import (
	"github.com/GenerateNU/apportal/backend/internal/interviewassign"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// PlanLeadDay is a lead's declared meeting day for this planning run —
// supplied per request rather than stored, same as PlanTeam.
type PlanLeadDay struct {
	LeadNUID string `json:"lead_nuid"`
	Day      string `json:"day" minLength:"1" doc:"The lead's meeting-day key for this run (matches an applicant availability key)"`
}

// PlanConflict declares a lead ineligible to interview or review a specific
// applicant's interview — supplied per request rather than stored, same as
// PlanLeadDay. A hard exclusion in the planner, not a preference.
type PlanConflict struct {
	LeadNUID      string `json:"lead_nuid"`
	ApplicationID string `json:"application_id"`
}

// PlannedInterviewer is one lead's proposed interview queue.
type PlannedInterviewer struct {
	LeadNUID     string               `json:"lead_nuid"`
	FullName     string               `json:"full_name"`
	Day          string               `json:"day"`
	Cap          int                  `json:"cap"`
	Existing     int                  `json:"existing"`
	Added        int                  `json:"added"`
	Total        int                  `json:"total"`
	Applications []PlannedApplication `json:"applications"`
}

// InterviewerPlanPreview is the whole interviewer-stage proposal.
type InterviewerPlanPreview struct {
	PoolSize     int                  `json:"pool_size"`
	Interviewers []PlannedInterviewer `json:"interviewers"`
	// Unassigned lists applicants no lead had spare capacity for.
	Unassigned []PlannedApplication `json:"unassigned"`
	// NoDayMatch lists applicants assigned despite no interviewer sharing
	// their day (the best-effort fallback fired).
	NoDayMatch []PlannedApplication `json:"no_day_match"`
	Warnings   []string             `json:"warnings"`
	TotalAdded int                  `json:"total_added"`
}

// --- interviewer pool ---
type InterviewPoolInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type InterviewPoolOutput struct {
	Body struct {
		PoolSize   int             `json:"pool_size"`
		LeadCount  int             `json:"lead_count"`
		Applicants []PoolApplicant `json:"applicants"`
	}
}

// --- interviewer capacity ---
type InterviewerCapacityInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role   `json:"role"`
		Leads                  []PlanLeadDay `json:"leads"`
		ExcludedApplicationIDs []string      `json:"excluded_application_ids,omitempty"`
	}
}

type InterviewerCapacityOutput struct {
	Body interviewassign.InterviewCapacity
}

// --- interviewer preview/commit ---
type InterviewerPreviewInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role    `json:"role"`
		Leads                  []PlanLeadDay  `json:"leads"`
		Conflicts              []PlanConflict `json:"conflicts,omitempty" doc:"Leads ineligible to interview a specific applicant"`
		Cap                    int            `json:"cap" minimum:"1"`
		CapOverrides           map[string]int `json:"cap_overrides,omitempty"`
		ExcludedApplicationIDs []string       `json:"excluded_application_ids,omitempty"`
	}
}

type interviewerRun struct {
	plan   interviewassign.InterviewerPlan
	prior  map[string]string
	byID   map[string]models.ApplicationSummary
	appIDs []string
}

type PreviewInterviewerPlanOutput struct {
	Body InterviewerPlanPreview
}

type CommitInterviewerPlanOutput struct {
	Body struct {
		Created int                    `json:"created"`
		Plan    InterviewerPlanPreview `json:"plan"`
	}
}

// --- reviewer capacity ---
type ReviewerCapacityInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role   `json:"role"`
		Leads                  []PlanLeadDay `json:"leads"`
		Coverage               int           `json:"coverage" minimum:"1"`
		ExcludedApplicationIDs []string      `json:"excluded_application_ids,omitempty"`
	}
}

type ReviewerCapacityOutput struct {
	Body interviewassign.InterviewCapacity
}

// --- reviewer preview/commit ---
type ReviewerPreviewInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role    `json:"role"`
		Leads                  []PlanLeadDay  `json:"leads"`
		Conflicts              []PlanConflict `json:"conflicts,omitempty" doc:"Leads ineligible to review a specific applicant's interview"`
		Coverage               int            `json:"coverage" minimum:"1"`
		Cap                    int            `json:"cap" minimum:"1"`
		CapOverrides           map[string]int `json:"cap_overrides,omitempty"`
		ExcludedApplicationIDs []string       `json:"excluded_application_ids,omitempty"`
	}
}

type reviewerRun struct {
	plan     interviewassign.ReviewerPlan
	prior    []interviewassign.ReviewerPair
	byID     map[string]models.ApplicationSummary
	appIDs   []string
	coverage int
}

// PlannedReviewer is one lead's proposed interview-review queue.
type PlannedReviewer struct {
	LeadNUID     string               `json:"lead_nuid"`
	FullName     string               `json:"full_name"`
	Day          string               `json:"day"`
	Cap          int                  `json:"cap"`
	Existing     int                  `json:"existing"`
	Added        int                  `json:"added"`
	Total        int                  `json:"total"`
	Applications []PlannedApplication `json:"applications"`
}

// InterviewReviewPlanPreview is the whole reviewer-stage proposal.
type InterviewReviewPlanPreview struct {
	PoolSize       int                  `json:"pool_size"`
	Coverage       int                  `json:"coverage"`
	Reviewers      []PlannedReviewer    `json:"reviewers"`
	CoverageCounts map[string]int       `json:"coverage_counts"`
	UnderCovered   []PlannedApplication `json:"under_covered"`
	NoDayMatch     []PlannedApplication `json:"no_day_match"`
	Warnings       []string             `json:"warnings"`
	TotalAdded     int                  `json:"total_added"`
}

type PreviewInterviewReviewerPlanOutput struct {
	Body InterviewReviewPlanPreview
}

type CommitInterviewReviewerPlanOutput struct {
	Body struct {
		Created int                        `json:"created"`
		Plan    InterviewReviewPlanPreview `json:"plan"`
	}
}
