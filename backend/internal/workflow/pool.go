package workflow

import (
	"database/sql"

	"gorm.io/gorm"
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
