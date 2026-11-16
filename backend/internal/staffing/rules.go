package staffing

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

// Permissions holds, per kind and opening, whether adding (or removing) someone is blocked.
type Permissions map[models.StepKind]map[string]error

func (p Permissions) Of(kind models.StepKind, roleID string) error { return p[kind][roleID] }

// Policy is everything the workflow says about staffing a cycle. A zero limit means the count isn't set; Record audits a
// change that goes ahead as an override.
type Policy struct {
	Limits  map[models.StepKind]int
	Adds    Permissions
	Removes Permissions
	Record  func(tx *gorm.DB, roleID string, kind models.StepKind, remove bool) error
}

type StaffingRules interface {
	Load(ctx context.Context, db *gorm.DB, cycleID string) (Policy, error)
}

type Conflicts interface {
	Conflicted(ctx context.Context, db *gorm.DB, cycleID string, applicantNUIDs []string) (map[string]map[string]bool, error)
}

type NoConflicts struct{}

func (NoConflicts) Conflicted(context.Context, *gorm.DB, string, []string) (map[string]map[string]bool, error) {
	return map[string]map[string]bool{}, nil
}

type StoredConflicts struct{}

func (StoredConflicts) Conflicted(ctx context.Context, db *gorm.DB, cycleID string, applicantNUIDs []string) (map[string]map[string]bool, error) {
	out := map[string]map[string]bool{}
	if len(applicantNUIDs) == 0 {
		return out, nil
	}
	var rows []struct{ ApplicantNUID, LeadNUID string }
	err := db.WithContext(ctx).Table("review_conflicts").Select("applicant_nuid, lead_nuid").
		Where("cycle_id = ? AND applicant_nuid IN ?", cycleID, applicantNUIDs).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		if out[r.ApplicantNUID] == nil {
			out[r.ApplicantNUID] = map[string]bool{}
		}
		out[r.ApplicantNUID][r.LeadNUID] = true
	}
	return out, nil
}

type WorkflowRules struct{}

func (WorkflowRules) Load(ctx context.Context, db *gorm.DB, cycleID string) (Policy, error) {
	f, err := workflow.Load(db, cycleID)
	if err != nil {
		return Policy{}, err
	}
	caller, err := workflow.CallerOn(ctx, db, cycleID)
	if err != nil {
		return Policy{}, err
	}
	return PolicyFrom(f, caller), nil
}

func TeamOf(kind models.StepKind) workflow.Work {
	if kind == models.KindReviewer {
		return workflow.SetupReviewTeam
	}
	return workflow.SetupInterviewTeam
}

func WorkOf(kind models.StepKind) workflow.Work {
	if kind == models.KindReviewer {
		return workflow.WorkReviewAssignment
	}
	return workflow.WorkInterviewAssignment
}

func PolicyFrom(f *workflow.CycleState, actor workflow.Caller) Policy {
	p := Policy{Limits: map[models.StepKind]int{}, Adds: Permissions{}, Removes: Permissions{}}
	for _, k := range models.StaffKinds {
		w := WorkOf(k)
		if s := workflow.StepOf(w); f.Enabled[s] {
			p.Limits[k] = f.Assignments[s][k]
		}
		p.Adds[k], p.Removes[k] = map[string]error{}, map[string]error{}
		for _, o := range f.Openings {
			p.Adds[k][o.RoleID] = f.AssignmentPermission(actor, w, o.RoleID, false)
			p.Removes[k][o.RoleID] = f.AssignmentPermission(actor, w, o.RoleID, true)
		}
	}
	p.Record = func(tx *gorm.DB, roleID string, kind models.StepKind, remove bool) error {
		return workflow.Authorize(tx, f, f.AssignmentOp(actor, WorkOf(kind), roleID, remove))
	}
	return p
}
