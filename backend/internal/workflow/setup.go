package workflow

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type setupCheck struct {
	work  Work
	label string
	ready string
}

// setupChecks select, per cycle, the openings whose setup for that work is in place.
var setupChecks = []setupCheck{
	{SetupApplicationForm, "Add application questions", `SELECT r.id FROM roles r WHERE r.cycle_id = ?
		AND EXISTS (SELECT 1 FROM questions q WHERE q.cycle_id = r.cycle_id AND (q.role_id = r.id OR q.role_id IS NULL))`},
	{SetupReviewRubric, "Add review questions", `SELECT r.id FROM roles r WHERE r.cycle_id = ?
		AND EXISTS (SELECT 1 FROM review_questions q WHERE q.cycle_id = r.cycle_id AND (q.role_id = r.id OR q.role_id IS NULL))`},
	{SetupInterviewScript, "Write the interview script", `SELECT role_id FROM interview_script WHERE cycle_id = ?
		AND CASE WHEN jsonb_typeof(questions) = 'array' THEN jsonb_array_length(questions) > 0 ELSE false END`},
}

type missingSetup struct {
	work  Work
	label string
}

// LoadSetup records which enabled steps are still missing setup per opening, for the next actions.
func (f *CycleState) LoadSetup(db *gorm.DB) error {
	for _, c := range setupChecks {
		s := StepOf(c.work)
		if !f.Enabled[s] {
			continue
		}
		var ready []string
		if err := db.Raw(c.ready, f.CycleID).Scan(&ready).Error; err != nil {
			return err
		}
		done := map[string]bool{}
		for _, r := range ready {
			done[r] = true
		}
		for _, o := range f.Openings {
			if !done[o.RoleID] {
				k := key{o.RoleID, s}
				f.Missing[k] = append(f.Missing[k], missingSetup{c.work, c.label})
			}
		}
	}
	return nil
}

// RequirePositions refuses building the recruitment team before the cycle has a position to recruit for.
func (s *Service) RequirePositions(ctx context.Context, cycleID string) error {
	var n int64
	if err := s.db.WithContext(ctx).Model(&models.Role{}).Where("cycle_id = ?", cycleID).Limit(1).Count(&n).Error; err != nil {
		return HTTPErr(err)
	}
	if n == 0 {
		return huma.Error409Conflict("add a position first")
	}
	return nil
}
