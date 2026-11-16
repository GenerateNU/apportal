package workflow

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
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
	parts := make([]string, 0, len(setupChecks))
	args := make([]any, 0, len(setupChecks)*2)
	for i, c := range setupChecks {
		parts = append(parts, fmt.Sprintf("SELECT %d AS idx, ready.* FROM (%s) AS ready(role_id)", i, c.ready))
		args = append(args, f.CycleID)
	}
	var rows []struct {
		Idx    int
		RoleID string
	}
	if err := db.Raw(strings.Join(parts, " UNION ALL "), args...).Scan(&rows).Error; err != nil {
		return err
	}
	done := map[int]map[string]bool{}
	for _, r := range rows {
		if done[r.Idx] == nil {
			done[r.Idx] = map[string]bool{}
		}
		done[r.Idx][r.RoleID] = true
	}
	for i, c := range setupChecks {
		s := StepOf(c.work)
		if !f.Enabled[s] {
			continue
		}
		for _, o := range f.Openings {
			if !done[i][o.RoleID] {
				k := key{o.RoleID, s}
				f.Missing[k] = append(f.Missing[k], missingSetup{c.work, c.label})
			}
		}
	}
	return nil
}
