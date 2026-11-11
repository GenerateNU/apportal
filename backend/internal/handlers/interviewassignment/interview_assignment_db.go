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

func ensureInterviews(tx *gorm.DB, applicationIDs []string) error {
	rows := make([]models.Interview, len(applicationIDs))
	for i, id := range applicationIDs {
		rows[i] = models.Interview{ApplicationID: id}
	}
	return tx.Select("application_id").Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

func interviewIDs(tx *gorm.DB, applicationIDs []string) (map[string]string, error) {
	var rows []models.Interview
	if err := tx.Select("id", "application_id").Where("application_id IN ?", applicationIDs).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.ApplicationID] = r.ID
	}
	return out, nil
}

func interviewerDetails(db *gorm.DB) *gorm.DB {
	return db.Table("interviewers x").
		Select("x.*, i.application_id, u.full_name AS interviewer_name").
		Joins("JOIN interviews i ON i.id = x.interview_id").
		Joins("JOIN users u ON u.nuid = x.interviewer_nuid")
}

func reviewerDetails(db *gorm.DB) *gorm.DB {
	return db.Table("interview_reviewers r").
		Select("r.*, i.application_id, u.full_name AS reviewer_name").
		Joins("JOIN interviews i ON i.id = r.interview_id").
		Joins("JOIN users u ON u.nuid = r.reviewer_nuid")
}

func cycleInterviews(db *gorm.DB, cycleID string, role models.Role) *gorm.DB {
	return db.Table("interviews i").Select("i.id").
		Joins("JOIN applications a ON a.id = i.application_id").
		Where("a.cycle_id = ? AND a.application_role = ?", cycleID, role)
}

func (d *InterviewAssignmentDB) ListInterviewers(ctx context.Context, applicationIDs []string) ([]models.InterviewerDetail, error) {
	out := []models.InterviewerDetail{}
	if len(applicationIDs) == 0 {
		return out, nil
	}
	err := interviewerDetails(d.db.WithContext(ctx)).
		Where("i.application_id IN ?", applicationIDs).
		Order("i.application_id").Order("x.assigned_at").Order("x.id").
		Scan(&out).Error
	return out, err
}

func (d *InterviewAssignmentDB) GetInterviewer(ctx context.Context, id string) (models.InterviewerDetail, error) {
	var out models.InterviewerDetail
	err := interviewerDetails(d.db.WithContext(ctx)).Where("x.id = ?", id).Take(&out).Error
	return out, utils.DBErr(err)
}

func (d *InterviewAssignmentDB) ListInterviewersForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.InterviewerDetail, error) {
	out := []models.InterviewerDetail{}
	db := d.db.WithContext(ctx)
	err := interviewerDetails(db).
		Where("x.interview_id IN (?)", cycleInterviews(db, cycleID, role)).
		Order("x.assigned_at").Order("x.id").
		Scan(&out).Error
	return out, err
}

func (d *InterviewAssignmentDB) IsInterviewer(ctx context.Context, applicationID, nuid string) (bool, error) {
	var n int64
	err := d.db.WithContext(ctx).Table("interviewers x").
		Joins("JOIN interviews i ON i.id = x.interview_id").
		Where("i.application_id = ? AND x.interviewer_nuid = ?", applicationID, nuid).
		Count(&n).Error
	return n > 0, err
}

func (d *InterviewAssignmentDB) AddInterviewer(ctx context.Context, applicationID, nuid, assignedBy string) (models.InterviewerDetail, error) {
	var id string
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureInterviews(tx, []string{applicationID}); err != nil {
			return err
		}
		ids, err := interviewIDs(tx, []string{applicationID})
		if err != nil {
			return err
		}
		row := models.Interviewer{InterviewID: ids[applicationID], InterviewerNUID: nuid, AssignedBy: assignedBy}
		if err := utils.Insert(tx, &row, "interview_id", "interviewer_nuid", "assigned_by"); err != nil {
			return err
		}
		id = row.ID
		return nil
	})
	if err != nil {
		return models.InterviewerDetail{}, err
	}
	return d.GetInterviewer(ctx, id)
}

func (d *InterviewAssignmentDB) RemoveInterviewer(ctx context.Context, id string) error {
	db := d.db.WithContext(ctx)
	res := db.Where("id = ? AND interview_id IN (?)", id,
		db.Table("interviews").Select("id").Where("conducted_at IS NULL")).
		Delete(&models.Interviewer{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		return nil
	}
	if _, err := d.GetInterviewer(ctx, id); err != nil {
		return err
	}
	return utils.ErrConflict
}

func (d *InterviewAssignmentDB) DeleteInterviewersForCycle(ctx context.Context, cycleID string, role models.Role) (int, error) {
	db := d.db.WithContext(ctx)
	res := db.Where("interview_id IN (?)", cycleInterviews(db, cycleID, role).Where("i.conducted_at IS NULL")).
		Delete(&models.Interviewer{})
	return int(res.RowsAffected), res.Error
}

func (d *InterviewAssignmentDB) CreateInterviewers(ctx context.Context, pairs []AssignmentPair, assignedBy string) (int, error) {
	if len(pairs) == 0 {
		return 0, nil
	}
	created := 0
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		ids, err := ensureInterviewIDs(tx, pairs)
		if err != nil {
			return err
		}
		rows := make([]models.Interviewer, len(pairs))
		for n, p := range pairs {
			rows[n] = models.Interviewer{InterviewID: ids[p.ApplicationID], InterviewerNUID: p.LeadNUID, AssignedBy: assignedBy}
		}
		res := tx.Select("interview_id", "interviewer_nuid", "assigned_by").
			Clauses(clause.OnConflict{DoNothing: true}).Create(&rows)
		created = int(res.RowsAffected)
		return res.Error
	})
	return created, err
}

func ensureInterviewIDs(tx *gorm.DB, pairs []AssignmentPair) (map[string]string, error) {
	seen := map[string]bool{}
	apps := make([]string, 0, len(pairs))
	for _, p := range pairs {
		if !seen[p.ApplicationID] {
			seen[p.ApplicationID] = true
			apps = append(apps, p.ApplicationID)
		}
	}
	if err := ensureInterviews(tx, apps); err != nil {
		return nil, err
	}
	return interviewIDs(tx, apps)
}

func (d *InterviewAssignmentDB) ListReviewers(ctx context.Context, applicationIDs []string) ([]models.InterviewReviewerDetail, error) {
	out := []models.InterviewReviewerDetail{}
	if len(applicationIDs) == 0 {
		return out, nil
	}
	err := reviewerDetails(d.db.WithContext(ctx)).
		Where("i.application_id IN ?", applicationIDs).
		Order("i.application_id").Order("r.assigned_at").Order("r.id").
		Scan(&out).Error
	return out, err
}

func (d *InterviewAssignmentDB) GetReviewer(ctx context.Context, id string) (models.InterviewReviewerDetail, error) {
	var out models.InterviewReviewerDetail
	err := reviewerDetails(d.db.WithContext(ctx)).Where("r.id = ?", id).Take(&out).Error
	return out, utils.DBErr(err)
}

func (d *InterviewAssignmentDB) ListReviewersForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.InterviewReviewerDetail, error) {
	out := []models.InterviewReviewerDetail{}
	db := d.db.WithContext(ctx)
	err := reviewerDetails(db).
		Where("r.interview_id IN (?)", cycleInterviews(db, cycleID, role)).
		Order("r.assigned_at").Order("r.id").
		Scan(&out).Error
	return out, err
}

func (d *InterviewAssignmentDB) IsReviewer(ctx context.Context, applicationID, nuid string) (bool, error) {
	var n int64
	err := d.db.WithContext(ctx).Table("interview_reviewers r").
		Joins("JOIN interviews i ON i.id = r.interview_id").
		Where("i.application_id = ? AND r.reviewer_nuid = ?", applicationID, nuid).
		Count(&n).Error
	return n > 0, err
}

func (d *InterviewAssignmentDB) AddReviewer(ctx context.Context, applicationID, nuid, assignedBy string) (models.InterviewReviewerDetail, error) {
	var id string
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureInterviews(tx, []string{applicationID}); err != nil {
			return err
		}
		ids, err := interviewIDs(tx, []string{applicationID})
		if err != nil {
			return err
		}
		row := models.InterviewReviewer{InterviewID: ids[applicationID], ReviewerNUID: nuid, AssignedBy: assignedBy}
		if err := utils.Insert(tx, &row, "interview_id", "reviewer_nuid", "assigned_by"); err != nil {
			return err
		}
		id = row.ID
		return nil
	})
	if err != nil {
		return models.InterviewReviewerDetail{}, err
	}
	return d.GetReviewer(ctx, id)
}

func (d *InterviewAssignmentDB) RemoveReviewer(ctx context.Context, id string) error {
	res := d.db.WithContext(ctx).Where("id = ? AND writeup_submitted_at IS NULL", id).Delete(&models.InterviewReviewer{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		return nil
	}
	if _, err := d.GetReviewer(ctx, id); err != nil {
		return err
	}
	return utils.ErrConflict
}

func (d *InterviewAssignmentDB) DeleteReviewersForCycle(ctx context.Context, cycleID string, role models.Role) (int, error) {
	db := d.db.WithContext(ctx)
	res := db.Where("writeup_submitted_at IS NULL AND interview_id IN (?)", cycleInterviews(db, cycleID, role)).
		Delete(&models.InterviewReviewer{})
	return int(res.RowsAffected), res.Error
}

func (d *InterviewAssignmentDB) CreateReviewers(ctx context.Context, pairs []AssignmentPair, assignedBy string) (int, error) {
	if len(pairs) == 0 {
		return 0, nil
	}
	created := 0
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		ids, err := ensureInterviewIDs(tx, pairs)
		if err != nil {
			return err
		}
		rows := make([]models.InterviewReviewer, len(pairs))
		for n, p := range pairs {
			rows[n] = models.InterviewReviewer{InterviewID: ids[p.ApplicationID], ReviewerNUID: p.LeadNUID, AssignedBy: assignedBy}
		}
		res := tx.Select("interview_id", "reviewer_nuid", "assigned_by").
			Clauses(clause.OnConflict{DoNothing: true}).Create(&rows)
		created = int(res.RowsAffected)
		return res.Error
	})
	return created, err
}
