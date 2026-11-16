package staffing

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type Guard struct {
	Rules     InterviewRules
	Conflicts Conflicts
}

func NewGuard(db *gorm.DB) *Guard {
	return &Guard{Rules: NewStageRules(db), Conflicts: NoConflicts{}}
}

// Snapshot is a cycle's rules plus the applicants a decision touches, read
// in one pass so a plan or a single add sees the same facts.
type Snapshot struct {
	CycleID    string
	Openings   Openings
	Limits     map[models.StaffKind]int
	Released   map[string]bool
	Applicants map[string]*Applicant
}

func (s Snapshot) Rules(roleID string, kind models.StaffKind) Rules {
	return Rules{Released: s.Released[roleID], Limit: s.Limits[kind], Eligible: s.Openings.Eligible(roleID, kind)}
}

func (s Snapshot) Check(applicationID, nuid string, kind models.StaffKind) error {
	a, ok := s.Applicants[applicationID]
	if !ok {
		return utils.ErrNotFound
	}
	return Check(*a, s.Rules(a.RoleID, kind), nuid, kind)
}

// Load reads through db, so pass the transaction holding the applicants'
// interview locks.
func (g *Guard) Load(ctx context.Context, db *gorm.DB, cycleID string, applicationIDs []string) (Snapshot, error) {
	snap := Snapshot{CycleID: cycleID, Released: map[string]bool{}}
	var err error
	if snap.Openings, err = LoadOpenings(db, cycleID); err != nil {
		return snap, err
	}
	if snap.Limits, err = Limits(ctx, g.Rules, cycleID); err != nil {
		return snap, err
	}
	if snap.Applicants, err = loadApplicants(db, cycleID, applicationIDs); err != nil {
		return snap, err
	}
	var roles []string
	if err := db.Model(&models.Role{}).Where("cycle_id = ?", cycleID).Pluck("id", &roles).Error; err != nil {
		return snap, err
	}
	for _, r := range roles {
		if snap.Released[r], err = g.Rules.Released(ctx, cycleID, r); err != nil {
			return snap, err
		}
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

// LockApplicants holds the applications' rows until tx ends, so two adds
// can't both see room under the cap.
func LockApplicants(tx *gorm.DB, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	var locked []string
	return tx.Model(&models.Application{}).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id IN ?", ids).Order("id").Pluck("id", &locked).Error
}

// CheckAdd locks and loads one applicant through tx and runs Check.
func (g *Guard) CheckAdd(ctx context.Context, tx *gorm.DB, applicationID, nuid string, kind models.StaffKind) error {
	var app models.Application
	if err := tx.Select("id", "cycle_id").Where("id = ?", applicationID).Take(&app).Error; err != nil {
		return utils.DBErr(err)
	}
	if err := LockApplicants(tx, []string{applicationID}); err != nil {
		return err
	}
	snap, err := g.Load(ctx, tx, app.CycleID, []string{applicationID})
	if err != nil {
		return err
	}
	return snap.Check(applicationID, nuid, kind)
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
			Stage: a.Stage, Assigned: map[models.StaffKind][]string{}}
	}
	var rows []struct {
		ApplicationID string
		NUID          string
		Kind          models.StaffKind
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
