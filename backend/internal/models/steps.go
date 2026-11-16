package models

import (
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

type Step string

const (
	StepApplications Step = "applications"
	StepReviews      Step = "reviews"
	StepInterviews   Step = "interviews"
	StepDecisions    Step = "decisions"
	StepFeedback     Step = "feedback"
)

var Steps = []Step{StepApplications, StepReviews, StepInterviews, StepDecisions, StepFeedback}

func (s Step) Valid() bool {
	for _, v := range Steps {
		if v == s {
			return true
		}
	}
	return false
}

func (Step) Schema(huma.Registry) *huma.Schema {
	return enumSchema(string(StepApplications), string(StepReviews), string(StepInterviews), string(StepDecisions), string(StepFeedback))
}

type StepKind string

const (
	KindApplicant         StepKind = "applicant"
	KindReviewer          StepKind = "reviewer"
	KindInterviewer       StepKind = "interviewer"
	KindRecordingReviewer StepKind = "recording_reviewer"
	KindPreferenceList    StepKind = "preference_list"
)

func (k StepKind) Valid() bool {
	switch k {
	case KindApplicant, KindReviewer, KindInterviewer, KindRecordingReviewer, KindPreferenceList:
		return true
	}
	return false
}

func (StepKind) Schema(huma.Registry) *huma.Schema {
	return enumSchema(string(KindApplicant), string(KindReviewer), string(KindInterviewer), string(KindRecordingReviewer), string(KindPreferenceList))
}

type CycleStep struct {
	CycleID     string            `json:"cycle_id" gorm:"primaryKey;type:uuid"`
	Step        Step              `json:"step" gorm:"primaryKey;type:text;check:cycle_steps_step_check,step IN ('applications','reviews','interviews','decisions','feedback')"`
	Enabled     bool              `json:"enabled" gorm:"not null;default:true"`
	Position    int               `json:"position" gorm:"not null;default:0"`
	CompletedAt *time.Time        `json:"completed_at,omitempty"`
	Cycle       Cycle             `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	Assignments []StepAssignment  `json:"-" gorm:"foreignKey:CycleID,Step;references:CycleID,Step;constraint:OnDelete:CASCADE"`
	Openings    []OpeningStep     `json:"-" gorm:"foreignKey:CycleID,Step;references:CycleID,Step;constraint:OnDelete:CASCADE"`
	Deadlines   []OpeningDeadline `json:"-" gorm:"foreignKey:CycleID,Step;references:CycleID,Step;constraint:OnDelete:CASCADE"`
}

type StepAssignment struct {
	CycleID      string   `json:"cycle_id" gorm:"primaryKey;type:uuid"`
	Step         Step     `json:"step" gorm:"primaryKey;type:text"`
	Kind         StepKind `json:"kind" gorm:"primaryKey;type:text;check:step_assignments_kind_check,kind IN ('reviewer','interviewer','recording_reviewer')"`
	PerApplicant int      `json:"per_applicant" gorm:"type:integer;not null;check:step_assignments_per_applicant_check,per_applicant > 0"`
}

type OpeningStep struct {
	CycleID    string     `json:"cycle_id" gorm:"primaryKey;type:uuid"`
	RoleID     string     `json:"role_id" gorm:"primaryKey;type:uuid"`
	Step       Step       `json:"step" gorm:"primaryKey;type:text"`
	ReleasedAt *time.Time `json:"released_at,omitempty"`
	ReleasedBy *string    `json:"released_by,omitempty"`
	Role       Role       `json:"-" gorm:"foreignKey:RoleID;references:ID;constraint:OnDelete:CASCADE"`
	Releaser   *User      `json:"-" gorm:"foreignKey:ReleasedBy;references:NUID"`
}

type OpeningDeadline struct {
	CycleID string    `json:"cycle_id" gorm:"primaryKey;type:uuid"`
	RoleID  string    `json:"role_id" gorm:"primaryKey;type:uuid"`
	Step    Step      `json:"step" gorm:"primaryKey;type:text"`
	Kind    StepKind  `json:"kind" gorm:"primaryKey;type:text;check:opening_deadlines_kind_check,kind IN ('applicant','reviewer','interviewer','recording_reviewer','preference_list')"`
	DueAt   time.Time `json:"due_at" gorm:"not null"`
	Hard    bool      `json:"hard" gorm:"not null;default:true"`
	Role    Role      `json:"-" gorm:"foreignKey:RoleID;references:ID;constraint:OnDelete:CASCADE"`
}

type ApplicationMove struct {
	ID            string           `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Seq           int64            `json:"-" gorm:"type:bigserial;not null;<-:false"`
	BatchID       string           `json:"batch_id" gorm:"type:uuid;not null;index:idx_application_moves_batch"`
	ApplicationID string           `json:"application_id" gorm:"type:uuid;not null;index:idx_application_moves_app"`
	FromStage     ApplicationStage `json:"from_stage" gorm:"type:application_stage;not null"`
	ToStage       ApplicationStage `json:"to_stage" gorm:"type:application_stage;not null"`
	MovedBy       string           `json:"moved_by" gorm:"not null"`
	MovedAt       time.Time        `json:"moved_at" gorm:"not null;default:now()"`
	UndoneAt      *time.Time       `json:"undone_at,omitempty"`
	UndoneBy      *string          `json:"undone_by,omitempty"`
	Application   Application      `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Mover         User             `json:"-" gorm:"foreignKey:MovedBy;references:NUID"`
	Undoer        *User            `json:"-" gorm:"foreignKey:UndoneBy;references:NUID"`
}

type WorkflowOverride struct {
	ID        string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID   string          `json:"cycle_id" gorm:"type:uuid;not null;index:idx_workflow_overrides_cycle"`
	RoleID    *string         `json:"role_id,omitempty" gorm:"type:uuid"`
	Step      Step            `json:"step" gorm:"type:text;not null"`
	Op        string          `json:"op" gorm:"not null"`
	Level     string          `json:"level" gorm:"not null"`
	ActorNUID string          `json:"actor_nuid" gorm:"not null"`
	Reason    string          `json:"reason" gorm:"not null"`
	Plan      json.RawMessage `json:"plan,omitempty" gorm:"type:jsonb"`
	CreatedAt time.Time       `json:"created_at" gorm:"not null;default:now()"`
	Cycle     Cycle           `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	Actor     User            `json:"-" gorm:"foreignKey:ActorNUID;references:NUID"`
}
