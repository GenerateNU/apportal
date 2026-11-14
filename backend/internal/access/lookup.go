package access

import "gorm.io/gorm"

// These select the thing a check is about: a cycle aliased c, or an
// application aliased a joined to its cycle c. table is always a constant from
// the caller, never input.

type (
	cycleQuery       func(*gorm.DB) *gorm.DB
	applicationQuery func(*gorm.DB) *gorm.DB
)

func cycleByID(id string) cycleQuery {
	return func(db *gorm.DB) *gorm.DB {
		return db.Table("cycles c").Where("c.id = ?", id)
	}
}

// rowCycle is the cycle of a row with a cycle_id.
func rowCycle(table, id string) cycleQuery {
	return func(db *gorm.DB) *gorm.DB {
		return db.Table(table+" x").Joins("JOIN cycles c ON c.id = x.cycle_id").Where("x.id = ?", id)
	}
}

func applicationByID(id string) applicationQuery {
	return func(db *gorm.DB) *gorm.DB {
		return db.Table("applications a").
			Joins("JOIN cycles c ON c.id = a.cycle_id").
			Where("a.id = ?", id)
	}
}

// rowApplication is the application of a row with an application_id.
func rowApplication(table, id string) applicationQuery {
	return func(db *gorm.DB) *gorm.DB {
		return db.Table(table+" x").
			Joins("JOIN applications a ON a.id = x.application_id").
			Joins("JOIN cycles c ON c.id = a.cycle_id").
			Where("x.id = ?", id)
	}
}

// interviewRowApplication is the application of a row with an interview_id.
func interviewRowApplication(table, id string) applicationQuery {
	return func(db *gorm.DB) *gorm.DB {
		return db.Table(table+" x").
			Joins("JOIN interviews i ON i.id = x.interview_id").
			Joins("JOIN applications a ON a.id = i.application_id").
			Joins("JOIN cycles c ON c.id = a.cycle_id").
			Where("x.id = ?", id)
	}
}
