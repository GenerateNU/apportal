package cycleworkflow

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/middleware"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type CycleInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

type CloseInput struct {
	ID string `path:"id" doc:"Cycle ID"`
	middleware.DryRunQuery
}

type StepInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
}

type SetStepInput struct {
	middleware.DryRunQuery
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
	Body struct {
		Enabled bool `json:"enabled"`
	}
}

type AssignmentInput struct {
	middleware.DryRunQuery
	ID   string          `path:"id" doc:"Cycle ID"`
	Step models.Step     `path:"step" doc:"Step"`
	Kind models.StepKind `path:"kind" doc:"Assignment kind"`
}

type SetAssignmentInput struct {
	middleware.DryRunQuery
	ID   string          `path:"id" doc:"Cycle ID"`
	Step models.Step     `path:"step" doc:"Step"`
	Kind models.StepKind `path:"kind" doc:"Assignment kind"`
	Body struct {
		PerApplicant int `json:"per_applicant" minimum:"1"`
	}
}

type OpeningStepInput struct {
	middleware.DryRunQuery
	ID     string      `path:"id" doc:"Cycle ID"`
	RoleID string      `path:"role_id" doc:"Role ID"`
	Step   models.Step `path:"step" doc:"Step"`
}

type DeadlineKindInput struct {
	middleware.DryRunQuery
	ID     string          `path:"id" doc:"Cycle ID"`
	RoleID string          `path:"role_id" doc:"Role ID"`
	Step   models.Step     `path:"step" doc:"Step"`
	Kind   models.StepKind `path:"kind" doc:"Deadline kind"`
}

type SetPeerReleaseInput struct {
	middleware.DryRunQuery
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		RoleID   string            `json:"role_id" doc:"Applicant role ID"`
		Kind     models.ReviewKind `json:"kind" doc:"Review kind: written or recording"`
		Released bool              `json:"released" doc:"True shows reviewers each other's reviews; false hides them again"`
	}
}

type ReviewGatesOutput struct {
	Body []models.ReviewGate
}

type ReviewGatesChangeOutput struct {
	Body struct {
		Gates   []models.ReviewGate `json:"gates"`
		Preview workflow.Preview    `json:"preview"`
	}
}

type SetDeadlineInput struct {
	middleware.DryRunQuery
	ID     string          `path:"id" doc:"Cycle ID"`
	RoleID string          `path:"role_id" doc:"Role ID"`
	Step   models.Step     `path:"step" doc:"Step"`
	Kind   models.StepKind `path:"kind" doc:"Deadline kind"`
	Body   struct {
		DueAt time.Time `json:"due_at"`
		Hard  *bool     `json:"hard,omitempty"`
	}
}

type AdvanceInput struct {
	middleware.DryRunQuery
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
	Body struct {
		RoleID         *string  `json:"role_id,omitempty"`
		ApplicationIDs []string `json:"application_ids"`
	}
}

type UndoInput struct {
	middleware.DryRunQuery
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
	Body struct {
		RoleID *string `json:"role_id,omitempty"`
	}
}

type StepsOutput struct {
	Body []workflow.StepConfig
}

type WorkflowOutput struct {
	Body WorkflowChange
}

type WorkflowChange struct {
	workflow.Overview
	Preview *workflow.Preview `json:"preview,omitempty" doc:"What the change did, or with dry_run=true, what it would do"`
}

type StepsChangeOutput struct {
	Body struct {
		Steps   []workflow.StepConfig `json:"steps"`
		Preview workflow.Preview      `json:"preview"`
	}
}

type AdvanceResult struct {
	MovedApplicationIDs []string          `json:"moved_application_ids"`
	Workflow            workflow.Overview `json:"workflow"`
	Preview             workflow.Preview  `json:"preview"`
}

type AdvanceOutput struct {
	Body AdvanceResult
}

type UndoResult struct {
	RestoredApplicationIDs []string          `json:"restored_application_ids"`
	Workflow               workflow.Overview `json:"workflow"`
	Preview                workflow.Preview  `json:"preview"`
}

type UndoOutput struct {
	Body UndoResult
}

type CloseResult struct {
	Cycle   models.Cycle     `json:"cycle"`
	Preview workflow.Preview `json:"preview"`
}

type CloseOutput struct {
	Body CloseResult
}
