package cycleworkflow

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type service struct {
	access   *access.Checker
	roleDB   *role.RoleDB
	db       *gorm.DB
	workflow *workflow.Service
	now      func() time.Time
}

func newService(db *gorm.DB) *service {
	s := &service{access: access.NewChecker(db), roleDB: role.NewRoleDB(db), db: db, now: time.Now}
	s.workflow = workflow.NewService(db).WithClock(func() time.Time { return s.now() })
	return s
}

func parseID(id, name string) error {
	if _, err := uuid.Parse(id); err != nil {
		return huma.Error422UnprocessableEntity("invalid " + name)
	}
	return nil
}

func validStep(s models.Step) error {
	if !s.Valid() {
		return huma.Error422UnprocessableEntity("invalid step")
	}
	return nil
}

func validKind(k models.StepKind) error {
	if !k.Valid() {
		return huma.Error422UnprocessableEntity("invalid kind")
	}
	return nil
}

func (s *service) cycle(ctx context.Context, cycleID string, action access.CycleAction) error {
	if err := access.RequireActor(ctx); err != nil {
		return err
	}
	if err := parseID(cycleID, "cycle id"); err != nil {
		return err
	}
	return s.access.CanCycle(ctx, action, cycleID)
}

func (s *service) opening(ctx context.Context, cycleID, roleID string, step models.Step) error {
	if err := s.cycle(ctx, cycleID, access.ManageCycle); err != nil {
		return err
	}
	if err := validStep(step); err != nil {
		return err
	}
	return role.RequireCycleRole(ctx, s.roleDB, cycleID, roleID)
}

func (s *service) facts(ctx context.Context, cycleID string) (*workflow.CycleState, error) {
	f, err := s.workflow.State(ctx, cycleID)
	return f, workflow.HTTPErr(err)
}

func (s *service) view(ctx context.Context, cycleID string) (workflow.Overview, error) {
	v, err := s.workflow.Overview(ctx, cycleID)
	return v, workflow.HTTPErr(err)
}

func (s *service) workflowOut(ctx context.Context, cycleID string, err error) (*WorkflowOutput, error) {
	return s.changeOut(ctx, cycleID, nil, err)
}

func (s *service) changeOut(ctx context.Context, cycleID string, p *workflow.Preview, err error) (*WorkflowOutput, error) {
	if err != nil {
		return nil, workflow.HTTPErr(err)
	}
	v, err := s.view(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	return &WorkflowOutput{Body: WorkflowChange{Overview: v, Preview: p}}, nil
}

func (s *service) stepsChangeOut(ctx context.Context, cycleID string, p workflow.Preview, err error) (*StepsChangeOutput, error) {
	if err != nil {
		return nil, workflow.HTTPErr(err)
	}
	f, err := s.facts(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	out := &StepsChangeOutput{}
	out.Body.Steps, out.Body.Preview = f.StepConfigs(), p
	return out, nil
}

func (s *service) stepsOut(ctx context.Context, cycleID string, err error) (*StepsOutput, error) {
	if err != nil {
		return nil, workflow.HTTPErr(err)
	}
	f, err := s.facts(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	return &StepsOutput{Body: f.StepConfigs()}, nil
}

func (s *service) listSteps(ctx context.Context, in *CycleInput) (*StepsOutput, error) {
	if err := s.cycle(ctx, in.ID, access.ReviewCycle); err != nil {
		return nil, err
	}
	return s.stepsOut(ctx, in.ID, nil)
}

func (s *service) setStep(ctx context.Context, in *SetStepInput) (*StepsChangeOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	p, err := s.workflow.SetStepEnabled(ctx, in.ID, in.Step, in.Body.Enabled)
	return s.stepsChangeOut(ctx, in.ID, p, err)
}

func (s *service) setAssignment(ctx context.Context, in *SetAssignmentInput) (*StepsChangeOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	if err := validKind(in.Kind); err != nil {
		return nil, err
	}
	n := in.Body.PerApplicant
	p, err := s.workflow.SetAssignment(ctx, in.ID, in.Step, in.Kind, &n)
	return s.stepsChangeOut(ctx, in.ID, p, err)
}

func (s *service) removeAssignment(ctx context.Context, in *AssignmentInput) (*StepsChangeOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	if err := validKind(in.Kind); err != nil {
		return nil, err
	}
	p, err := s.workflow.SetAssignment(ctx, in.ID, in.Step, in.Kind, nil)
	return s.stepsChangeOut(ctx, in.ID, p, err)
}

func (s *service) getWorkflow(ctx context.Context, in *CycleInput) (*WorkflowOutput, error) {
	err := s.cycle(ctx, in.ID, access.ReviewCycle)
	if err != nil {
		return nil, err
	}
	return s.workflowOut(ctx, in.ID, nil)
}

func (s *service) release(ctx context.Context, in *OpeningStepInput) (*WorkflowOutput, error) {
	err := s.opening(ctx, in.ID, in.RoleID, in.Step)
	if err != nil {
		return nil, err
	}
	p, err := s.workflow.Release(ctx, in.ID, in.RoleID, in.Step)
	return s.changeOut(ctx, in.ID, &p, err)
}

func (s *service) unrelease(ctx context.Context, in *OpeningStepInput) (*WorkflowOutput, error) {
	err := s.opening(ctx, in.ID, in.RoleID, in.Step)
	if err != nil {
		return nil, err
	}
	p, err := s.workflow.Unrelease(ctx, in.ID, in.RoleID, in.Step)
	return s.changeOut(ctx, in.ID, &p, err)
}

func (s *service) clearDeadline(ctx context.Context, in *DeadlineKindInput) (*WorkflowOutput, error) {
	err := s.opening(ctx, in.ID, in.RoleID, in.Step)
	if err != nil {
		return nil, err
	}
	if err := validKind(in.Kind); err != nil {
		return nil, err
	}
	p, err := s.workflow.ClearDeadline(ctx, in.ID, in.RoleID, in.Step, in.Kind)
	return s.changeOut(ctx, in.ID, &p, err)
}

func (s *service) setDeadline(ctx context.Context, in *SetDeadlineInput) (*WorkflowOutput, error) {
	err := s.opening(ctx, in.ID, in.RoleID, in.Step)
	if err != nil {
		return nil, err
	}
	if err := validKind(in.Kind); err != nil {
		return nil, err
	}
	if in.Body.DueAt.IsZero() {
		return nil, huma.Error422UnprocessableEntity("due_at is required")
	}
	p, err := s.workflow.SetDeadline(ctx, workflow.DeadlineInput{
		CycleID: in.ID, RoleID: in.RoleID, Step: in.Step, Kind: in.Kind,
		DueAt: in.Body.DueAt, Hard: in.Body.Hard, DefaultHard: true,
	})
	return s.changeOut(ctx, in.ID, &p, err)
}

func (s *service) optionalRole(ctx context.Context, cycleID string, roleID *string) (string, error) {
	if roleID == nil {
		return "", nil
	}
	return *roleID, role.RequireCycleRole(ctx, s.roleDB, cycleID, *roleID)
}

func parseApplicationIDs(ids []string) ([]string, error) {
	if len(ids) == 0 {
		return nil, huma.Error422UnprocessableEntity("application_ids is required")
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if err := parseID(id, "application id"); err != nil {
			return nil, err
		}
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out, nil
}

func (s *service) advance(ctx context.Context, in *AdvanceInput) (*AdvanceOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	ids, err := parseApplicationIDs(in.Body.ApplicationIDs)
	if err != nil {
		return nil, err
	}
	roleID, err := s.optionalRole(ctx, in.ID, in.Body.RoleID)
	if err != nil {
		return nil, err
	}
	moved, p, err := s.workflow.Advance(ctx, workflow.AdvanceInput{
		CycleID: in.ID, Step: in.Step, RoleID: roleID, ApplicationIDs: ids,
	})
	if err != nil {
		return nil, workflow.HTTPErr(err)
	}
	v, err := s.view(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &AdvanceOutput{Body: AdvanceResult{MovedApplicationIDs: orNone(moved), Workflow: v, Preview: p}}, nil
}

func (s *service) undo(ctx context.Context, in *UndoInput) (*UndoOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	roleID, err := s.optionalRole(ctx, in.ID, in.Body.RoleID)
	if err != nil {
		return nil, err
	}
	restored, p, err := s.workflow.Undo(ctx, in.ID, in.Step, roleID)
	if err != nil {
		return nil, workflow.HTTPErr(err)
	}
	v, err := s.view(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &UndoOutput{Body: UndoResult{RestoredApplicationIDs: orNone(restored), Workflow: v, Preview: p}}, nil
}

func (s *service) complete(ctx context.Context, in *StepInput) (*WorkflowOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	return s.workflowOut(ctx, in.ID, s.workflow.Complete(ctx, in.ID, in.Step))
}

func (s *service) closeCycle(ctx context.Context, in *CloseInput) (*CloseOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	c, p, err := s.workflow.CloseCycle(ctx, in.ID)
	if err != nil {
		return nil, workflow.HTTPErr(err)
	}
	return &CloseOutput{Body: CloseResult{Cycle: c, Preview: p}}, nil
}

func orNone(ids []string) []string {
	if ids == nil {
		return []string{}
	}
	return ids
}

func (s *service) listReviewGates(ctx context.Context, in *CycleInput) (*ReviewGatesOutput, error) {
	if err := s.cycle(ctx, in.ID, access.ReviewCycle); err != nil {
		return nil, err
	}
	gates, err := s.workflow.ReviewGates(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewGatesOutput{Body: gates}, nil
}

func (s *service) setPeerRelease(ctx context.Context, in *SetPeerReleaseInput) (*ReviewGatesChangeOutput, error) {
	err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	if err := parseID(in.Body.RoleID, "role id"); err != nil {
		return nil, err
	}
	p, err := s.workflow.SetPeerRelease(ctx, in.ID, in.Body.RoleID, in.Body.Kind, in.Body.Released)
	if err != nil {
		return nil, workflow.HTTPErr(err)
	}
	gates, err := s.workflow.ReviewGates(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &ReviewGatesChangeOutput{}
	out.Body.Gates, out.Body.Preview = gates, p
	return out, nil
}
