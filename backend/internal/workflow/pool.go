package workflow

import (
	"context"
	"database/sql"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// StaffPool is everyone who can be given work on a cycle: its staff, plus every
// admin on a chief cycle, which has no staff because admins review it.
func StaffPool(db *gorm.DB, cycleID string) *gorm.DB {
	return db.Raw(`SELECT user_nuid FROM cycle_staff WHERE cycle_id = @cycle
UNION
SELECT u.nuid FROM users u JOIN cycles c ON c.id = @cycle AND c.application_type = 'chief'
WHERE 'admin' = ANY(u.roles)`, sql.Named("cycle", cycleID))
}

func InStaffPool(db *gorm.DB, cycleID, nuid string) (bool, error) {
	var n int64
	err := db.Table("(?) AS p", StaffPool(db, cycleID)).Where("p.user_nuid = ?", nuid).Count(&n).Error
	return n > 0, err
}

func PoolMembers(ctx context.Context, db *gorm.DB, cycleID string) ([]models.CycleStaffMember, error) {
	rows := []models.CycleStaffMember{}
	db = db.WithContext(ctx)
	err := db.Table("(?) AS p", StaffPool(db, cycleID)).
		Select("p.user_nuid, u.full_name, u.email, COALESCE(cs.role, 'chief') AS role, COALESCE(cs.created_at, u.created_at) AS created_at").
		Joins("JOIN users u ON u.nuid = p.user_nuid").
		Joins("LEFT JOIN cycle_staff cs ON cs.cycle_id = ? AND cs.user_nuid = p.user_nuid", cycleID).
		Order("role DESC").Order("u.full_name").
		Scan(&rows).Error
	return rows, err
}
