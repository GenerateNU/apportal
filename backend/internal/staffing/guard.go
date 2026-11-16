package staffing

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type Guard struct {
	Rules     InterviewRules
	Conflicts Conflicts
}

func NewGuard() *Guard {
	return &Guard{Rules: PipelineRules{}, Conflicts: NoConflicts{}}
}

type Snapshot struct {
	CycleID    string
	Openings   Openings
	Limits     map[models.StepKind]int
	Released   map[string]bool
	Frozen     map[string]error
	Applicants map[string]*Applicant
}

func (s Snapshot) Rules(roleID string, kind models.StepKind) Rules {
	return Rules{Frozen: s.Frozen[roleID], Released: s.Released[roleID], Limit: s.Limits[kind], Eligible: s.Openings.Eligible(roleID, kind)}
}

func (s Snapshot) RequireLimit(kind models.StepKind) error {
	return Rules{Limit: s.Limits[kind]}.RequireLimit(kind)
}

func (s Snapshot) Locked(roleID string) error {
	if err := s.Frozen[roleID]; err != nil {
		return err
	}
	if s.Released[roleID] {
		return ErrLocked
	}
	return nil
}

func (s Snapshot) Check(applicationID, nuid string, kind models.StepKind) error {
	a, ok := s.Applicants[applicationID]
	if !ok {
		return utils.ErrNotFound
	}
	return Check(*a, s.Rules(a.RoleID, kind), nuid, kind)
}

func (g *Guard) Load(ctx context.Context, db *gorm.DB, cycleID string, applicationIDs []string) (Snapshot, error) {
	snap := Snapshot{CycleID: cycleID}
	var err error
	if snap.Openings, err = LoadOpenings(db, cycleID); err != nil {
		return snap, err
	}
	p, err := g.Rules.Load(ctx, db, cycleID)
	if err != nil {
		return snap, err
	}
	snap.Limits, snap.Released, snap.Frozen = p.Limits, p.Released, p.Frozen
	if snap.Applicants, err = loadApplicants(db, cycleID, applicationIDs); err != nil {
		return snap, err
	}
	nuids := make([]string, 0, len(snap.Applicants))
	for _, a := range snap.Applicants {
		nuids = append(nuids, a.ApplicantNUID)
	}
	conflicts, err := g.Conflicts.Conflicted(ctx, cycleID, nuids)
	if err != nil {
		return snap, err
	}
	for _, a := range snap.Applicants {
		a.Conflicted = conflicts[a.ApplicantNUID]
	}
	return snap, nil
}

// Hold takes the cycle before the applications' rows, the order pipeline moves use, so a release or
// advance can't land between check and write, and two adds can't both see room under the cap.
func Hold(tx *gorm.DB, cycleID string, applicationIDs []string) error {
	if err := pipeline.HoldCycle(tx, cycleID); err != nil {
		return err
	}
	if len(applicationIDs) == 0 {
		return nil
	}
	var locked []string
	return tx.Model(&models.Application{}).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id IN ?", applicationIDs).Order("id").Pluck("id", &locked).Error
}

func (g *Guard) held(ctx context.Context, tx *gorm.DB, applicationID string) (Snapshot, string, error) {
	var app models.Application
	if err := tx.Select("id", "cycle_id", "role_id").Where("id = ?", applicationID).Take(&app).Error; err != nil {
		return Snapshot{}, "", utils.DBErr(err)
	}
	if err := Hold(tx, app.CycleID, []string{applicationID}); err != nil {
		return Snapshot{}, "", err
	}
	snap, err := g.Load(ctx, tx, app.CycleID, []string{applicationID})
	return snap, app.RoleID, err
}

func (g *Guard) CheckAdd(ctx context.Context, tx *gorm.DB, applicationID, nuid string, kind models.StepKind) error {
	snap, _, err := g.held(ctx, tx, applicationID)
	if err != nil {
		return err
	}
	return snap.Check(applicationID, nuid, kind)
}

func (g *Guard) CheckRemove(ctx context.Context, tx *gorm.DB, applicationID string) error {
	snap, roleID, err := g.held(ctx, tx, applicationID)
	if err != nil {
		return err
	}
	return snap.Locked(roleID)
}

func (g *Guard) CheckOpening(ctx context.Context, tx *gorm.DB, cycleID, roleID string) error {
	if err := pipeline.HoldCycle(tx, cycleID); err != nil {
		return err
	}
	snap, err := g.Load(ctx, tx, cycleID, nil)
	if err != nil {
		return err
	}
	return snap.Locked(roleID)
}

func loadApplicants(db *gorm.DB, cycleID string, ids []string) (map[string]*Applicant, error) {
	out := map[string]*Applicant{}
	if len(ids) == 0 {
		return out, nil
	}
	var apps []models.Application
	if err := db.Select("id", "cycle_id", "role_id", "user_nuid", "stage").
		Where("cycle_id = ? AND id IN ?", cycleID, ids).Find(&apps).Error; err != nil {
		return nil, err
	}
	for _, a := range apps {
		out[a.ID] = &Applicant{ApplicationID: a.ID, CycleID: a.CycleID, RoleID: a.RoleID, ApplicantNUID: a.UserNUID,
			Stage: a.Stage, Assigned: map[models.StepKind][]string{}}
	}
	var rows []struct {
		ApplicationID string
		NUID          string
		Kind          models.StepKind
	}
	err := db.Raw(`SELECT i.application_id, x.interviewer_nuid AS nuid, 'interviewer' AS kind
			FROM interviewers x JOIN interviews i ON i.id = x.interview_id WHERE i.application_id IN ?
		UNION ALL SELECT i.application_id, r.reviewer_nuid, 'recording_reviewer'
			FROM interview_reviewers r JOIN interviews i ON i.id = r.interview_id WHERE i.application_id IN ?
		UNION ALL SELECT l.application_id, l.lead_nuid, 'reviewer'
			FROM lead_assignments l WHERE l.application_id IN ?
		ORDER BY 1, 3, 2`, ids, ids, ids).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		if a := out[r.ApplicationID]; a != nil {
			a.Assigned[r.Kind] = append(a.Assigned[r.Kind], r.NUID)
		}
	}
	return out, nil
}
