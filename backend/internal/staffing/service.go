package staffing

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

// Pool is one kind of staffing work across a cycle's openings, as a planner sees it: the per-applicant limit, who is
// eligible per opening, and the openings the workflow blocks adding to.
type Pool struct {
	Limit    int
	Eligible map[string][]string
	Blocked  map[string]error
}

func (p Pool) RequireLimit(kind models.StepKind) error {
	return Rules{Limit: p.Limit}.RequireLimit(kind)
}

type Service struct {
	db    *gorm.DB
	rules StaffingRules
}

func NewService(db *gorm.DB) *Service { return &Service{db: db, rules: WorkflowRules{}} }

func (s *Service) Pool(ctx context.Context, cycleID string, kind models.StepKind) (Pool, error) {
	db := s.db.WithContext(ctx)
	p, err := s.rules.Load(ctx, db, cycleID)
	if err != nil {
		return Pool{}, err
	}
	o, err := LoadOpenings(db, cycleID)
	if err != nil {
		return Pool{}, err
	}
	out := Pool{Limit: p.Limits[kind], Eligible: map[string][]string{}, Blocked: map[string]error{}}
	for role, blocked := range p.Adds[kind] {
		out.Eligible[role] = o.Eligible(role, kind)
		out.Blocked[role] = blocked
	}
	return out, nil
}

// RequireAdd authorizes adding to an opening outside a Guard check, recording it when it goes ahead as an override.
func (s *Service) RequireAdd(ctx context.Context, cycleID, roleID string, kind models.StepKind) error {
	return workflow.NewService(s.db).RequireAssignmentChange(ctx, cycleID, roleID, WorkOf(kind), false)
}
