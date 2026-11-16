package cyclepipeline

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type service struct {
	access *access.Checker
	roleDB *role.RoleDB
	db     *gorm.DB
	now    func() time.Time
}

func newService(db *gorm.DB) *service {
	return &service{access: access.NewChecker(db), roleDB: role.NewRoleDB(db), db: db, now: time.Now}
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

func (s *service) cycle(ctx context.Context, cycleID string, action access.CycleAction) (pipeline.Actor, error) {
	if err := access.RequireActor(ctx); err != nil {
		return pipeline.Actor{}, err
	}
	if err := parseID(cycleID, "cycle id"); err != nil {
		return pipeline.Actor{}, err
	}
	a, err := s.access.Cycle(ctx, cycleID)
	if err != nil {
		return pipeline.Actor{}, err
	}
	if err := a.Can(action); err != nil {
		return pipeline.Actor{}, err
	}
	return pipeline.Actor{NUID: utils.CurrentActor(ctx).NUID, Admin: a.Admin()}, nil
}

func (s *service) opening(ctx context.Context, cycleID, roleID string, step models.Step) (pipeline.Actor, error) {
	actor, err := s.cycle(ctx, cycleID, access.ManageCycle)
	if err != nil {
		return actor, err
	}
	if err := validStep(step); err != nil {
		return actor, err
	}
	return actor, role.RequireCycleRole(ctx, s.roleDB, cycleID, roleID)
}

func (s *service) facts(ctx context.Context, cycleID string) (*pipeline.Facts, error) {
	f, err := pipeline.Load(s.db.WithContext(ctx), cycleID)
	return f, pipeline.HTTPErr(err)
}

func (s *service) view(ctx context.Context, cycleID string) (pipeline.View, error) {
	f, err := s.facts(ctx, cycleID)
	if err != nil {
		return pipeline.View{}, err
	}
	late, err := pipeline.LoadLate(s.db.WithContext(ctx), cycleID)
	if err != nil {
		return pipeline.View{}, pipeline.HTTPErr(err)
	}
	return f.View(s.now(), late), nil
}

func (s *service) pipelineOut(ctx context.Context, cycleID string, err error) (*PipelineOutput, error) {
	if err != nil {
		return nil, pipeline.HTTPErr(err)
	}
	v, err := s.view(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	return &PipelineOutput{Body: v}, nil
}

func (s *service) stepsOut(ctx context.Context, cycleID string, err error) (*StepsOutput, error) {
	if err != nil {
		return nil, pipeline.HTTPErr(err)
	}
	f, err := s.facts(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	return &StepsOutput{Body: f.StepConfigs()}, nil
}

func (s *service) listSteps(ctx context.Context, in *CycleInput) (*StepsOutput, error) {
	if _, err := s.cycle(ctx, in.ID, access.ReviewCycle); err != nil {
		return nil, err
	}
	return s.stepsOut(ctx, in.ID, nil)
}

func (s *service) setStep(ctx context.Context, in *SetStepInput) (*StepsOutput, error) {
	if _, err := s.cycle(ctx, in.ID, access.ManageCycle); err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	return s.stepsOut(ctx, in.ID, pipeline.SetStepEnabled(s.db.WithContext(ctx), in.ID, in.Step, in.Body.Enabled))
}

func (s *service) setAssignment(ctx context.Context, in *SetAssignmentInput) (*StepsOutput, error) {
	if _, err := s.cycle(ctx, in.ID, access.ManageCycle); err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	if err := validKind(in.Kind); err != nil {
		return nil, err
	}
	n := in.Body.PerApplicant
	return s.stepsOut(ctx, in.ID, pipeline.SetAssignment(s.db.WithContext(ctx), in.ID, in.Step, in.Kind, &n))
}

func (s *service) removeAssignment(ctx context.Context, in *AssignmentInput) (*StepsOutput, error) {
	if _, err := s.cycle(ctx, in.ID, access.ManageCycle); err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	if err := validKind(in.Kind); err != nil {
		return nil, err
	}
	return s.stepsOut(ctx, in.ID, pipeline.SetAssignment(s.db.WithContext(ctx), in.ID, in.Step, in.Kind, nil))
}

func (s *service) getPipeline(ctx context.Context, in *CycleInput) (*PipelineOutput, error) {
	if _, err := s.cycle(ctx, in.ID, access.ReviewCycle); err != nil {
		return nil, err
	}
	return s.pipelineOut(ctx, in.ID, nil)
}

func (s *service) release(ctx context.Context, in *OpeningStepInput) (*PipelineOutput, error) {
	actor, err := s.opening(ctx, in.ID, in.RoleID, in.Step)
	if err != nil {
		return nil, err
	}
	return s.pipelineOut(ctx, in.ID, pipeline.Release(s.db.WithContext(ctx), in.ID, in.RoleID, in.Step, actor, s.now()))
}

func (s *service) unrelease(ctx context.Context, in *OpeningStepInput) (*PipelineOutput, error) {
	actor, err := s.opening(ctx, in.ID, in.RoleID, in.Step)
	if err != nil {
		return nil, err
	}
	return s.pipelineOut(ctx, in.ID, pipeline.Unrelease(s.db.WithContext(ctx), in.ID, in.RoleID, in.Step, actor))
}

func (s *service) setDeadline(ctx context.Context, in *SetDeadlineInput) (*PipelineOutput, error) {
	actor, err := s.opening(ctx, in.ID, in.RoleID, in.Step)
	if err != nil {
		return nil, err
	}
	if err := validKind(in.Kind); err != nil {
		return nil, err
	}
	if in.Body.DueAt.IsZero() {
		return nil, huma.Error422UnprocessableEntity("due_at is required")
	}
	return s.pipelineOut(ctx, in.ID, pipeline.SetDeadline(s.db.WithContext(ctx), pipeline.DeadlineInput{
		CycleID: in.ID, RoleID: in.RoleID, Step: in.Step, Kind: in.Kind,
		DueAt: in.Body.DueAt, Hard: in.Body.Hard, DefaultHard: true, Actor: actor,
	}))
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
	actor, err := s.cycle(ctx, in.ID, access.ManageCycle)
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
	moved, err := pipeline.Advance(s.db.WithContext(ctx), pipeline.AdvanceInput{
		CycleID: in.ID, Step: in.Step, RoleID: roleID, ApplicationIDs: ids, Actor: actor,
	}, s.now())
	if err != nil {
		return nil, pipeline.HTTPErr(err)
	}
	v, err := s.view(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &AdvanceOutput{Body: AdvanceResult{MovedApplicationIDs: moved, Pipeline: v}}, nil
}

func (s *service) undo(ctx context.Context, in *UndoInput) (*UndoOutput, error) {
	actor, err := s.cycle(ctx, in.ID, access.ManageCycle)
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
	restored, err := pipeline.Undo(s.db.WithContext(ctx), in.ID, in.Step, roleID, actor, s.now())
	if err != nil {
		return nil, pipeline.HTTPErr(err)
	}
	v, err := s.view(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &UndoOutput{Body: UndoResult{RestoredApplicationIDs: restored, Pipeline: v}}, nil
}

func (s *service) complete(ctx context.Context, in *StepInput) (*PipelineOutput, error) {
	if _, err := s.cycle(ctx, in.ID, access.ManageCycle); err != nil {
		return nil, err
	}
	if err := validStep(in.Step); err != nil {
		return nil, err
	}
	return s.pipelineOut(ctx, in.ID, pipeline.Complete(s.db.WithContext(ctx), in.ID, in.Step, s.now()))
}

func (s *service) closeCycle(ctx context.Context, in *CycleInput) (*CycleOutput, error) {
	actor, err := s.cycle(ctx, in.ID, access.ManageCycle)
	if err != nil {
		return nil, err
	}
	c, err := pipeline.CloseCycle(s.db.WithContext(ctx), in.ID, actor.Admin)
	if err != nil {
		return nil, pipeline.HTTPErr(err)
	}
	return &CycleOutput{Body: c}, nil
}

func (s *service) myPipeline(ctx context.Context, in *CycleInput) (*MyPipelineOutput, error) {
	if err := access.RequireActor(ctx); err != nil {
		return nil, err
	}
	if err := parseID(in.ID, "cycle id"); err != nil {
		return nil, err
	}
	a, err := s.access.Cycle(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := a.Can(access.ReviewCycle); err != nil {
		return nil, err
	}
	f, err := s.facts(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	tasks := []pipeline.Task{}
	if a.Staff() != "" {
		counts, err := pipeline.LoadTaskCounts(s.db.WithContext(ctx), in.ID, utils.CurrentActor(ctx).NUID)
		if err != nil {
			return nil, pipeline.HTTPErr(err)
		}
		tasks = f.Tasks(counts)
	}
	late, err := pipeline.LoadLate(s.db.WithContext(ctx), in.ID)
	if err != nil {
		return nil, pipeline.HTTPErr(err)
	}
	now := s.now()
	v := f.View(now, late)
	out := MyPipeline{Role: myRole(a), CurrentStep: v.CurrentStep, Steps: v.Steps, NextActions: []pipeline.NextAction{}, Tasks: tasks}
	if a.Allows(access.ManageCycle) {
		out.NextActions = f.NextActions(now)
	}
	return &MyPipelineOutput{Body: out}, nil
}

func myRole(a access.CycleAccess) string {
	switch {
	case a.Admin():
		return "admin"
	case a.Staff() == models.CycleStaffChief:
		return "chief"
	}
	return "lead"
}
