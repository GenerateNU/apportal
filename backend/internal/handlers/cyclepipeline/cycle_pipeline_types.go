package cyclepipeline

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
)

type CycleInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

type StepInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
}

type SetStepInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
	Body struct {
		Enabled bool `json:"enabled"`
	}
}

type AssignmentInput struct {
	ID   string          `path:"id" doc:"Cycle ID"`
	Step models.Step     `path:"step" doc:"Step"`
	Kind models.StepKind `path:"kind" doc:"Assignment kind"`
}

type SetAssignmentInput struct {
	ID   string          `path:"id" doc:"Cycle ID"`
	Step models.Step     `path:"step" doc:"Step"`
	Kind models.StepKind `path:"kind" doc:"Assignment kind"`
	Body struct {
		PerApplicant int `json:"per_applicant" minimum:"1"`
	}
}

type OpeningStepInput struct {
	ID     string      `path:"id" doc:"Cycle ID"`
	RoleID string      `path:"role_id" doc:"Role ID"`
	Step   models.Step `path:"step" doc:"Step"`
}

type SetDeadlineInput struct {
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
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
	Body struct {
		RoleID         *string  `json:"role_id,omitempty"`
		ApplicationIDs []string `json:"application_ids"`
	}
}

type UndoInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Step models.Step `path:"step" doc:"Step"`
	Body struct {
		RoleID *string `json:"role_id,omitempty"`
	}
}

type StepsOutput struct {
	Body []pipeline.StepConfig
}

type PipelineOutput struct {
	Body pipeline.View
}

type AdvanceResult struct {
	MovedApplicationIDs []string      `json:"moved_application_ids"`
	Pipeline            pipeline.View `json:"pipeline"`
}

type AdvanceOutput struct {
	Body AdvanceResult
}

type UndoResult struct {
	RestoredApplicationIDs []string      `json:"restored_application_ids"`
	Pipeline               pipeline.View `json:"pipeline"`
}

type UndoOutput struct {
	Body UndoResult
}

type MyPipeline struct {
	Role        string                `json:"role" enum:"admin,chief,lead"`
	CurrentStep *models.Step          `json:"current_step,omitempty"`
	Steps       []pipeline.StepView   `json:"steps"`
	NextActions []pipeline.NextAction `json:"next_actions"`
	Tasks       []pipeline.Task       `json:"tasks"`
}

type MyPipelineOutput struct {
	Body MyPipeline
}

type CycleOutput struct {
	Body models.Cycle
}
