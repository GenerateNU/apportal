package interviewassignment

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type InterviewAssignmentDB struct {
	db *gorm.DB
}

func NewInterviewAssignmentDB(db *gorm.DB) *InterviewAssignmentDB {
	return &InterviewAssignmentDB{db: db}
}

// UpsertInterviewAssignment sets an application's single interviewer,
// replacing any existing one.
func (i *InterviewAssignmentDB) UpsertInterviewAssignment(ctx context.Context, applicationID, interviewerNUID, assignedBy string) (models.InterviewAssignment, error) {
	assignment := models.InterviewAssignment{ApplicationID: applicationID, AssignedBy: assignedBy, InterviewerNUID: interviewerNUID}
	err := i.db.WithContext(ctx).Select("application_id", "assigned_by", "interviewer_nuid").
		Clauses(
			clause.OnConflict{
				Columns: []clause.Column{{Name: "application_id"}},
				DoUpdates: append(
					clause.AssignmentColumns([]string{"assigned_by", "interviewer_nuid"}),
					clause.Assignment{Column: clause.Column{Name: "assigned_at"}, Value: gorm.Expr("NOW()")},
				),
			},
			clause.Returning{},
		).
		Create(&assignment).Error
	return assignment, err
}

func (i *InterviewAssignmentDB) GetInterviewAssignment(ctx context.Context, applicationID string) (models.InterviewAssignment, error) {
	var assignment models.InterviewAssignment
	err := i.db.WithContext(ctx).Where("application_id = ?", applicationID).Take(&assignment).Error
	return assignment, utils.DBErr(err)
}

// CreateInterviewReviewAssignment assigns a lead to review the recording.
func (i *InterviewAssignmentDB) CreateInterviewReviewAssignment(ctx context.Context, applicationID, leadNUID, assignedBy string) (models.InterviewReviewAssignment, error) {
	assignment := models.InterviewReviewAssignment{ApplicationID: applicationID, LeadNUID: leadNUID, AssignedBy: assignedBy}
	err := utils.Insert(i.db.WithContext(ctx), &assignment, "application_id", "lead_nuid", "assigned_by")
	return assignment, err
}

func (i *InterviewAssignmentDB) ListInterviewReviewAssignments(ctx context.Context, applicationID string) ([]models.InterviewReviewAssignment, error) {
	assignments := []models.InterviewReviewAssignment{}
	err := i.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("assigned_at").Find(&assignments).Error
	return assignments, err
}

// ListInterviewAssignmentsForApplications is the batch form of
// GetInterviewAssignment, for pages of applications.
func (i *InterviewAssignmentDB) ListInterviewAssignmentsForApplications(ctx context.Context, applicationIDs []string) ([]models.InterviewAssignment, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	assignments := []models.InterviewAssignment{}
	err := i.db.WithContext(ctx).Where("application_id IN ?", applicationIDs).Find(&assignments).Error
	return assignments, err
}

// ListInterviewReviewAssignmentsForApplications is the batch form of
// ListInterviewReviewAssignments.
func (i *InterviewAssignmentDB) ListInterviewReviewAssignmentsForApplications(ctx context.Context, applicationIDs []string) ([]models.InterviewReviewAssignment, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	assignments := []models.InterviewReviewAssignment{}
	err := i.db.WithContext(ctx).Where("application_id IN ?", applicationIDs).
		Order("application_id").Order("assigned_at").Find(&assignments).Error
	return assignments, err
}

func (i *InterviewAssignmentDB) DeleteInterviewReviewAssignment(ctx context.Context, id string) error {
	res := i.db.WithContext(ctx).Where("id = ?", id).Delete(&models.InterviewReviewAssignment{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}

// ListInterviewAssignmentsForCycle returns every interviewer assignment for
// one role in a cycle, so the planner can seed loads in one query.
func (i *InterviewAssignmentDB) ListInterviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.InterviewAssignment, error) {
	assignments := []models.InterviewAssignment{}
	err := i.db.WithContext(ctx).Table("interview_assignments ia").
		Select("ia.*").
		Joins("JOIN applications a ON a.id = ia.application_id").
		Where("a.cycle_id = ? AND a.application_role = ?", cycleID, role).
		Order("ia.assigned_at").Order("ia.id").
		Find(&assignments).Error
	return assignments, err
}

func (i *InterviewAssignmentDB) ListInterviewReviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.InterviewReviewAssignment, error) {
	assignments := []models.InterviewReviewAssignment{}
	err := i.db.WithContext(ctx).Table("interview_review_assignments ira").
		Select("ira.*").
		Joins("JOIN applications a ON a.id = ira.application_id").
		Where("a.cycle_id = ? AND a.application_role = ?", cycleID, role).
		Order("ira.assigned_at").Order("ira.id").
		Find(&assignments).Error
	return assignments, err
}

func (i *InterviewAssignmentDB) cycleApplications(db *gorm.DB, cycleID string, role models.Role) *gorm.DB {
	return db.Model(&models.Application{}).Select("id").Where("cycle_id = ? AND application_role = ?", cycleID, role)
}

// DeleteInterviewAssignmentsForCycle clears one role's interviewer
// assignments in a cycle and returns how many were removed.
func (i *InterviewAssignmentDB) DeleteInterviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) (int, error) {
	db := i.db.WithContext(ctx)
	res := db.Where("application_id IN (?)", i.cycleApplications(db, cycleID, role)).Delete(&models.InterviewAssignment{})
	return int(res.RowsAffected), res.Error
}

func (i *InterviewAssignmentDB) DeleteInterviewReviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) (int, error) {
	db := i.db.WithContext(ctx)
	res := db.Where("application_id IN (?)", i.cycleApplications(db, cycleID, role)).Delete(&models.InterviewReviewAssignment{})
	return int(res.RowsAffected), res.Error
}

// CreateInterviewAssignments sets interviewers only where none exists yet.
// UNIQUE(application_id) plus DO NOTHING skips assigned applications, where an
// upsert would replace their interviewer.
func (i *InterviewAssignmentDB) CreateInterviewAssignments(ctx context.Context, pairs []InterviewAssignmentPair, assignedBy string) (int, error) {
	if len(pairs) == 0 {
		return 0, nil
	}
	rows := make([]models.InterviewAssignment, len(pairs))
	for n, p := range pairs {
		rows[n] = models.InterviewAssignment{ApplicationID: p.ApplicationID, AssignedBy: assignedBy, InterviewerNUID: p.LeadNUID}
	}
	res := i.db.WithContext(ctx).Select("application_id", "assigned_by", "interviewer_nuid").
		Clauses(clause.OnConflict{DoNothing: true}).Create(&rows)
	return int(res.RowsAffected), res.Error
}

// CreateInterviewReviewAssignments inserts many recording-review assignments,
// skipping pairs that already exist.
func (i *InterviewAssignmentDB) CreateInterviewReviewAssignments(ctx context.Context, pairs []InterviewReviewAssignmentPair, assignedBy string) (int, error) {
	if len(pairs) == 0 {
		return 0, nil
	}
	rows := make([]models.InterviewReviewAssignment, len(pairs))
	for n, p := range pairs {
		rows[n] = models.InterviewReviewAssignment{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID, AssignedBy: assignedBy}
	}
	res := i.db.WithContext(ctx).Select("application_id", "lead_nuid", "assigned_by").
		Clauses(clause.OnConflict{DoNothing: true}).Create(&rows)
	return int(res.RowsAffected), res.Error
}
