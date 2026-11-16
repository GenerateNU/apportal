package interviewboard

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/middleware"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const maxRoles = 50

type InterviewBoardPerson struct {
	AssignmentID string `json:"assignment_id"`
	NUID         string `json:"nuid"`
	FullName     string `json:"full_name"`
	Done         bool   `json:"done"`
}

type InterviewBoardRow struct {
	ApplicationID      string                  `json:"application_id"`
	ApplicantNUID      string                  `json:"applicant_nuid"`
	FullName           string                  `json:"full_name"`
	Email              string                  `json:"email"`
	RoleID             string                  `json:"role_id"`
	Stage              models.ApplicationStage `json:"stage"`
	ScheduledAt        *time.Time              `json:"scheduled_at,omitempty"`
	Started            bool                    `json:"started" doc:"Has notes, a write-up or a rating"`
	Done               bool                    `json:"done" doc:"Interview submitted"`
	Interviewers       []InterviewBoardPerson  `json:"interviewers" gorm:"-"`
	RecordingReviewers []InterviewBoardPerson  `json:"recording_reviewers" gorm:"-"`
	SlotIDs            []string                `json:"slot_ids" gorm:"-" doc:"Meeting slots the applicant can make"`
}

type BoardInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Only this opening"`
}

type BoardOutput struct {
	Body []InterviewBoardRow
}

type AutoPlanInput struct {
	middleware.DryRunQuery
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		RoleIDs       []string `json:"role_ids,omitempty" maxItems:"50" doc:"Openings to plan; empty means all"`
		ByPanel       bool     `json:"by_panel,omitempty" doc:"Give each unstaffed applicant one whole panel"`
		MatchSlots    *bool    `json:"match_slots,omitempty" doc:"Prefer interviewers on a slot the applicant can make; defaults to the cycle's match_by_slot"`
		WithRecording bool     `json:"with_recording,omitempty" doc:"Also plan recording reviewers, after interviewers"`
	}
}

type PlannedAssignment struct {
	ApplicationID string          `json:"application_id"`
	Kind          models.StepKind `json:"kind"`
	NUID          string          `json:"nuid"`
	FullName      string          `json:"full_name"`
	PanelID       string          `json:"panel_id,omitempty"`
}

type PlanLoad struct {
	NUID     string          `json:"nuid"`
	FullName string          `json:"full_name"`
	Kind     models.StepKind `json:"kind"`
	Existing int             `json:"existing"`
	Added    int             `json:"added"`
}

type InterviewPlan struct {
	Saved              bool                `json:"saved"`
	MatchSlots         bool                `json:"match_slots"`
	Interviewers       []PlannedAssignment `json:"interviewers"`
	RecordingReviewers []PlannedAssignment `json:"recording_reviewers"`
	ShortInterviewers  []string            `json:"short_interviewers" doc:"Applications still below the interviewer count"`
	ShortRecording     []string            `json:"short_recording" doc:"Applications still below the recording reviewer count"`
	NoSlotMatch        []string            `json:"no_slot_match" doc:"Applications assigned someone who doesn't share any of their slots"`
	Loads              []PlanLoad          `json:"loads"`
	Warnings           []string            `json:"warnings"`
}

type AutoPlanOutput struct {
	Body InterviewPlan
}
