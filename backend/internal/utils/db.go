package utils

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Insert creates row from only the named columns, leaving the rest (ids,
// timestamps) to their database defaults, and reads the stored row back.
func Insert[T any](db *gorm.DB, row *T, columns ...string) error {
	return DBErr(db.Select(columns).Clauses(clause.Returning{}).Create(row).Error)
}

// UpdateReturning applies a partial update to the single row matching the
// condition and returns it. An empty update still returns the current row.
// Like the SQL it replaced, it leaves updated_at to the caller or a trigger.
func UpdateReturning[T any](db *gorm.DB, updates map[string]any, query string, args ...any) (T, error) {
	var row T
	if len(updates) == 0 {
		return row, DBErr(db.Where(query, args...).Take(&row).Error)
	}
	res := db.Model(&row).Clauses(clause.Returning{}).Where(query, args...).UpdateColumns(updates)
	if res.Error != nil {
		return row, DBErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return row, ErrNotFound
	}
	return row, nil
}
