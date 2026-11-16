package reviewrules

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type Conflict struct {
	LeadNUID      string    `json:"lead_nuid"`
	LeadName      string    `json:"lead_name"`
	ApplicantNUID string    `json:"applicant_nuid"`
	ApplicantName string    `json:"applicant_name"`
	CreatedAt     time.Time `json:"created_at"`
}

type Blocked map[string]map[string]bool

func (b Blocked) Add(applicationID, nuid string) {
	if b[applicationID] == nil {
		b[applicationID] = map[string]bool{}
	}
	b[applicationID][nuid] = true
}

func (b Blocked) Merge(other Blocked) Blocked {
	for app, nuids := range other {
		for n := range nuids {
			b.Add(app, n)
		}
	}
	return b
}

type Conflicts struct {
	db *gorm.DB
}

func NewConflicts(db *gorm.DB) *Conflicts {
	return &Conflicts{db: db}
}

func (c *Conflicts) List(ctx context.Context, cycleID string) ([]Conflict, error) {
	rows := []Conflict{}
	err := listQuery(c.db.WithContext(ctx), cycleID).Scan(&rows).Error
	return rows, err
}

func listQuery(db *gorm.DB, cycleID string) *gorm.DB {
	return db.Table("review_conflicts rc").
		Select("rc.lead_nuid, l.full_name AS lead_name, rc.applicant_nuid, a.full_name AS applicant_name, rc.created_at").
		Joins("JOIN users l ON l.nuid = rc.lead_nuid").
		Joins("JOIN users a ON a.nuid = rc.applicant_nuid").
		Where("rc.cycle_id = ?", cycleID).
		Order("l.full_name").Order("a.full_name").Order("rc.lead_nuid").Order("rc.applicant_nuid")
}

func (c *Conflicts) Put(ctx context.Context, cycleID, leadNUID, applicantNUID string) error {
	return put(c.db.WithContext(ctx), cycleID, leadNUID, applicantNUID).Error
}

func put(db *gorm.DB, cycleID, leadNUID, applicantNUID string) *gorm.DB {
	row := models.ReviewConflict{CycleID: cycleID, LeadNUID: leadNUID, ApplicantNUID: applicantNUID}
	return db.Clauses(clause.OnConflict{DoNothing: true}).Select("cycle_id", "lead_nuid", "applicant_nuid").Create(&row)
}

func (c *Conflicts) Delete(ctx context.Context, cycleID, leadNUID, applicantNUID string) error {
	return c.db.WithContext(ctx).
		Where("cycle_id = ? AND lead_nuid = ? AND applicant_nuid = ?", cycleID, leadNUID, applicantNUID).
		Delete(&models.ReviewConflict{}).Error
}

func (c *Conflicts) IsStaff(ctx context.Context, cycleID, nuid string) (bool, error) {
	var n int64
	err := c.db.WithContext(ctx).Model(&models.CycleStaff{}).
		Where("cycle_id = ? AND user_nuid = ?", cycleID, nuid).Count(&n).Error
	return n > 0, err
}

// HasApplicant ignores drafts, which only their owner can see.
func (c *Conflicts) HasApplicant(ctx context.Context, cycleID, nuid string) (bool, error) {
	var n int64
	err := c.db.WithContext(ctx).Model(&models.Application{}).
		Where("cycle_id = ? AND user_nuid = ? AND stage <> ?", cycleID, nuid, models.StageDraft).Count(&n).Error
	return n > 0, err
}

func (c *Conflicts) Blocked(ctx context.Context, cycleID string) (Blocked, error) {
	var rows []struct {
		ApplicationID string
		LeadNUID      string
	}
	if err := blockedQuery(c.db.WithContext(ctx), cycleID).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := Blocked{}
	for _, r := range rows {
		out.Add(r.ApplicationID, r.LeadNUID)
	}
	return out, nil
}

func blockedQuery(db *gorm.DB, cycleID string) *gorm.DB {
	return db.Table("review_conflicts rc").
		Select("a.id AS application_id, rc.lead_nuid").
		Joins("JOIN applications a ON a.cycle_id = rc.cycle_id AND a.user_nuid = rc.applicant_nuid").
		Where("rc.cycle_id = ?", cycleID)
}

func (c *Conflicts) Conflicted(ctx context.Context, applicationID, nuid string) (bool, error) {
	var n int64
	err := conflictedQuery(c.db.WithContext(ctx), applicationID, nuid).Count(&n).Error
	return n > 0, err
}

func conflictedQuery(db *gorm.DB, applicationID, nuid string) *gorm.DB {
	return db.Table("review_conflicts rc").
		Joins("JOIN applications a ON a.cycle_id = rc.cycle_id AND a.user_nuid = rc.applicant_nuid").
		Where("a.id = ? AND rc.lead_nuid = ?", applicationID, nuid)
}

// LockAssignments serializes reviewer writes on a cycle until tx ends, so two
// writers can't both read a free slot and overfill an applicant.
func LockAssignments(tx *gorm.DB, cycleID string) error {
	return tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", "lead_assignments:"+cycleID).Error
}
