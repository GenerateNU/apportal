package cyclestaff

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type CycleStaffDB struct {
	db *gorm.DB
}

func NewCycleStaffDB(db *gorm.DB) *CycleStaffDB {
	return &CycleStaffDB{db: db}
}

// ListStaff lists a cycle's staff, or only those with role when it's set.
func (s *CycleStaffDB) ListStaff(ctx context.Context, cycleID string, role models.CycleStaffRole) ([]models.CycleStaffMember, error) {
	rows := []models.CycleStaffMember{}
	return rows, staffQuery(s.db.WithContext(ctx), cycleID, role).Find(&rows).Error
}

func (s *CycleStaffDB) CycleType(ctx context.Context, cycleID string) (models.ApplicationType, error) {
	var cycle models.Cycle
	err := s.db.WithContext(ctx).Select("application_type").Where("id = ?", cycleID).Take(&cycle).Error
	return cycle.ApplicationType, utils.DBErr(err)
}

func (s *CycleStaffDB) ListUserCycles(ctx context.Context, nuid string) ([]models.CycleStaff, error) {
	rows := []models.CycleStaff{}
	err := s.db.WithContext(ctx).Table("cycle_staff cs").
		Select("cs.cycle_id, cs.user_nuid, cs.role, cs.created_at").
		Joins("JOIN cycles c ON c.id = cs.cycle_id").
		Where("cs.user_nuid = ?", nuid).
		Order("c.created_at DESC").
		Scan(&rows).Error
	return rows, err
}

// SetStaff adds the user to the cycle's staff or changes their role.
func (s *CycleStaffDB) SetStaff(ctx context.Context, cycleID, nuid string, role models.CycleStaffRole) (models.CycleStaff, error) {
	row := models.CycleStaff{CycleID: cycleID, UserNUID: nuid, Role: role}
	err := s.db.WithContext(ctx).Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "user_nuid"}},
			DoUpdates: clause.AssignmentColumns([]string{"role"}),
		},
		clause.Returning{},
	).Select("cycle_id", "user_nuid", "role").Create(&row).Error
	if utils.ForeignKeyViolation(err) {
		return row, utils.ErrNotFound
	}
	return row, utils.DBErr(err)
}

func (s *CycleStaffDB) RemoveStaff(ctx context.Context, cycleID, nuid string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := workflow.HoldCycle(tx, cycleID); err != nil {
			return err
		}
		res := tx.Where("cycle_id = ? AND user_nuid = ?", cycleID, nuid).Delete(&models.CycleStaff{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return utils.ErrNotFound
		}
		for _, q := range []struct {
			sql  string
			args []any
		}{
			{`DELETE FROM lead_assignments l USING applications a
				WHERE a.id = l.application_id AND a.cycle_id = ? AND l.lead_nuid = ?
				AND NOT EXISTS (SELECT 1 FROM written_reviews w
					WHERE w.application_id = l.application_id AND w.reviewer_nuid = l.lead_nuid AND w.submitted_at IS NOT NULL)`,
				[]any{cycleID, nuid}},
			{`DELETE FROM interviewers x USING interviews i, applications a
				WHERE i.id = x.interview_id AND a.id = i.application_id AND a.cycle_id = ?
				AND x.interviewer_nuid = ? AND i.submitted_at IS NULL`, []any{cycleID, nuid}},
			{`DELETE FROM interview_reviewers r USING interviews i, applications a
				WHERE i.id = r.interview_id AND a.id = i.application_id AND a.cycle_id = ?
				AND r.reviewer_nuid = ? AND r.writeup_submitted_at IS NULL`, []any{cycleID, nuid}},
			{`DELETE FROM staff_group_members m USING staff_groups g
				WHERE g.id = m.group_id AND g.cycle_id = ? AND m.user_nuid = ?`, []any{cycleID, nuid}},
			{`DELETE FROM interview_panel_members WHERE cycle_id = ? AND user_nuid = ?`, []any{cycleID, nuid}},
			{`DELETE FROM staff_slots WHERE cycle_id = ? AND user_nuid = ?`, []any{cycleID, nuid}},
		} {
			if err := tx.Exec(q.sql, q.args...).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// CopyPreviousCycleStaff gives a new cycle the staff of the latest earlier
// cycle with its branch and application type. Pass the creating transaction.
func CopyPreviousCycleStaff(tx *gorm.DB, cycleID string) error {
	return copyPreviousCycleStaff(tx, cycleID).Error
}

// The role enum orders lead before chief, so DESC lists chiefs first.
func staffQuery(db *gorm.DB, cycleID string, role models.CycleStaffRole) *gorm.DB {
	q := db.Table("cycle_staff cs").
		Select("cs.user_nuid, u.full_name, u.email, cs.role, cs.created_at").
		Joins("JOIN users u ON u.nuid = cs.user_nuid").
		Where("cs.cycle_id = ?", cycleID).
		Order("cs.role DESC").Order("u.full_name")
	if role != "" {
		q = q.Where("cs.role = ?", role)
	}
	return q
}

func copyPreviousCycleStaff(db *gorm.DB, cycleID string) *gorm.DB {
	return db.Exec(`INSERT INTO cycle_staff (cycle_id, user_nuid, role)
SELECT ?, s.user_nuid, s.role
FROM cycle_staff s
WHERE s.cycle_id = (
	SELECT c.id FROM cycles c
	JOIN cycles n ON n.id = ?
	WHERE c.branch_id = n.branch_id AND c.application_type = n.application_type AND c.id <> n.id
	ORDER BY c.created_at DESC LIMIT 1
)`, cycleID, cycleID)
}
