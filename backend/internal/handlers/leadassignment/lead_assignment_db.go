package leadassignment

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type LeadAssignmentDB struct {
	db *gorm.DB
}

func NewLeadAssignmentDB(db *gorm.DB) *LeadAssignmentDB {
	return &LeadAssignmentDB{db: db}
}

type Check func(tx *gorm.DB) error

type RemoveCheck func(tx *gorm.DB, applicationID string) error

func (l *LeadAssignmentDB) Assign(ctx context.Context, applicationID, leadNUID, assignedBy string, check Check) (models.LeadAssignment, error) {
	assignment := models.LeadAssignment{ApplicationID: applicationID, LeadNUID: leadNUID, AssignedBy: assignedBy}
	err := l.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := check(tx); err != nil {
			return err
		}
		return utils.Insert(tx, &assignment, "application_id", "lead_nuid", "assigned_by")
	})
	return assignment, err
}

func (l *LeadAssignmentDB) ListLeadAssignments(ctx context.Context, applicationID string) ([]models.LeadAssignment, error) {
	assignments := []models.LeadAssignment{}
	err := l.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("assigned_at").Find(&assignments).Error
	return assignments, err
}

// CreateLeadAssignments inserts many assignments in one statement and reports
// how many were new. Existing pairs are skipped, so committing the same plan
// twice is a no-op rather than an error.
func (l *LeadAssignmentDB) CreateLeadAssignments(ctx context.Context, pairs []LeadAssignmentPair, assignedBy string) (int, error) {
	if len(pairs) == 0 {
		return 0, nil
	}
	rows := make([]models.LeadAssignment, len(pairs))
	for i, p := range pairs {
		rows[i] = models.LeadAssignment{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID, AssignedBy: assignedBy}
	}
	res := l.db.WithContext(ctx).Select("application_id", "lead_nuid", "assigned_by").
		Clauses(clause.OnConflict{DoNothing: true}).Create(&rows)
	return int(res.RowsAffected), res.Error
}

// UnassignUnsubmitted clears one opening's assignments, keeping reviewers who already submitted.
func (l *LeadAssignmentDB) UnassignUnsubmitted(ctx context.Context, cycleID, roleID string, check Check) (int, error) {
	deleted := 0
	err := l.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := check(tx); err != nil {
			return err
		}
		res := deleteUnsubmittedQuery(tx, cycleID, roleID).Delete(&models.LeadAssignment{})
		deleted = int(res.RowsAffected)
		return res.Error
	})
	return deleted, err
}

func deleteUnsubmittedQuery(db *gorm.DB, cycleID, role string) *gorm.DB {
	apps := db.Session(&gorm.Session{NewDB: true}).Model(&models.Application{}).Select("id").Where("cycle_id = ? AND role_id = ?", cycleID, role)
	return db.Where("application_id IN (?)", apps).
		Where(`NOT EXISTS (SELECT 1 FROM written_reviews wr WHERE wr.application_id = lead_assignments.application_id
			AND wr.reviewer_nuid = lead_assignments.lead_nuid AND wr.submitted_at IS NOT NULL)`)
}

// ListReviewerProgressForCycle pairs every assignment for one role in a cycle
// with its review's submission time; the left join keeps unreviewed pairs.
func (l *LeadAssignmentDB) ListReviewerProgressForCycle(ctx context.Context, cycleID string, role string) ([]ReviewerProgressRow, error) {
	rows := []ReviewerProgressRow{}
	err := l.db.WithContext(ctx).Table("lead_assignments la").
		Select("la.lead_nuid, la.application_id, a.user_nuid AS applicant_nuid, u.full_name, u.email, la.assigned_at, wr.submitted_at").
		Joins("JOIN applications a ON a.id = la.application_id").
		Joins("JOIN users u ON u.nuid = a.user_nuid").
		Joins("LEFT JOIN written_reviews wr ON wr.application_id = la.application_id AND wr.reviewer_nuid = la.lead_nuid").
		Where("a.cycle_id = ? AND a.role_id = ?", cycleID, role).
		Order("la.lead_nuid").Order("la.assigned_at").
		Scan(&rows).Error
	return rows, err
}

func (l *LeadAssignmentDB) Unassign(ctx context.Context, id string, check RemoveCheck) error {
	return l.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var app string
		if err := tx.Model(&models.LeadAssignment{}).Select("application_id").Where("id = ?", id).Take(&app).Error; err != nil {
			return utils.DBErr(err)
		}
		if err := check(tx, app); err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&models.LeadAssignment{}).Error
	})
}

func (l *LeadAssignmentDB) RoleInCycle(ctx context.Context, cycleID, roleID string) (bool, error) {
	var n int64
	err := l.db.WithContext(ctx).Model(&models.Role{}).Where("id = ? AND cycle_id = ?", roleID, cycleID).Count(&n).Error
	return n > 0, err
}
