package cyclestaff

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
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
	res := s.db.WithContext(ctx).Where("cycle_id = ? AND user_nuid = ?", cycleID, nuid).Delete(&models.CycleStaff{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
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
