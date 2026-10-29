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

func (l *LeadAssignmentDB) CreateLeadAssignment(ctx context.Context, applicationID, leadNUID, assignedBy string) (models.LeadAssignment, error) {
	assignment := models.LeadAssignment{ApplicationID: applicationID, LeadNUID: leadNUID, AssignedBy: assignedBy}
	err := utils.Insert(l.db.WithContext(ctx), &assignment, "application_id", "lead_nuid", "assigned_by")
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

// ListLeadAssignmentsForCycle returns every assignment for one role in a
// cycle, so the planner can seed loads and coverage in one query.
func (l *LeadAssignmentDB) ListLeadAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.LeadAssignment, error) {
	assignments := []models.LeadAssignment{}
	err := l.db.WithContext(ctx).Table("lead_assignments la").
		Select("la.*").
		Joins("JOIN applications a ON a.id = la.application_id").
		Where("a.cycle_id = ? AND a.application_role = ?", cycleID, role).
		Order("la.assigned_at").Order("la.id").
		Find(&assignments).Error
	return assignments, err
}

// DeleteLeadAssignmentsForCycle clears one role's assignments in a cycle, for
// a chief undoing a bad run, and returns how many were removed.
func (l *LeadAssignmentDB) DeleteLeadAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) (int, error) {
	db := l.db.WithContext(ctx)
	apps := db.Model(&models.Application{}).Select("id").Where("cycle_id = ? AND application_role = ?", cycleID, role)
	res := db.Where("application_id IN (?)", apps).Delete(&models.LeadAssignment{})
	return int(res.RowsAffected), res.Error
}

// ListReviewerProgressForCycle pairs every assignment for one role in a cycle
// with its review's submission time; the left join keeps unreviewed pairs.
func (l *LeadAssignmentDB) ListReviewerProgressForCycle(ctx context.Context, cycleID string, role models.Role) ([]ReviewerProgressRow, error) {
	rows := []ReviewerProgressRow{}
	err := l.db.WithContext(ctx).Table("lead_assignments la").
		Select("la.lead_nuid, la.application_id, a.user_nuid AS applicant_nuid, u.full_name, u.email, la.assigned_at, wr.submitted_at").
		Joins("JOIN applications a ON a.id = la.application_id").
		Joins("JOIN users u ON u.nuid = a.user_nuid").
		Joins("LEFT JOIN written_reviews wr ON wr.application_id = la.application_id AND wr.reviewer_nuid = la.lead_nuid").
		Where("a.cycle_id = ? AND a.application_role = ?", cycleID, role).
		Order("la.lead_nuid").Order("la.assigned_at").
		Scan(&rows).Error
	return rows, err
}

func (l *LeadAssignmentDB) DeleteLeadAssignment(ctx context.Context, id string) error {
	res := l.db.WithContext(ctx).Where("id = ?", id).Delete(&models.LeadAssignment{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}
