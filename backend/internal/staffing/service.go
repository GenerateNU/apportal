package staffing

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

// KindRules is one kind of staffing work across a cycle's openings, as a planner sees it: the per-applicant limit, who is
// eligible per opening, and the openings the workflow blocks adding to.
type KindRules struct {
	Limit    int
	Eligible map[string][]string
	Blocked  map[string]error
}

func (p KindRules) RequireLimit(kind models.StepKind) error {
	return Rules{Limit: p.Limit}.RequireLimit(kind)
}

type Service struct {
	db    *gorm.DB
	rules StaffingRules
}

func NewService(db *gorm.DB) *Service { return &Service{db: db, rules: WorkflowRules{}} }

func (s *Service) ForKind(ctx context.Context, cycleID string, kind models.StepKind) (KindRules, error) {
	db := s.db.WithContext(ctx)
	p, err := s.rules.Load(ctx, db, cycleID)
	if err != nil {
		return KindRules{}, err
	}
	o, err := LoadOpenings(db, cycleID)
	if err != nil {
		return KindRules{}, err
	}
	out := KindRules{Limit: p.Limits[kind], Eligible: map[string][]string{}, Blocked: map[string]error{}}
	for role, blocked := range p.Adds[kind] {
		out.Eligible[role] = o.Eligible(role, kind)
		out.Blocked[role] = blocked
	}
	return out, nil
}

func (s *Service) RequireAdd(ctx context.Context, cycleID string, roleIDs []string, kind models.StepKind) error {
	return workflow.NewService(s.db).RequireAssignmentChanges(ctx, cycleID, roleIDs, WorkOf(kind), false)
}
