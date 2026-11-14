package role

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type RoleDB struct {
	db *gorm.DB
}

func NewRoleDB(db *gorm.DB) *RoleDB {
	return &RoleDB{db: db}
}

func (r *RoleDB) CreateRole(ctx context.Context, cycleID, name string) (models.Role, error) {
	role := models.Role{CycleID: cycleID, Name: name}
	err := utils.Insert(r.db.WithContext(ctx), &role, "cycle_id", "name")
	return role, err
}

// ListRoles returns a cycle's roles in order, or every role without one.
func (r *RoleDB) ListRoles(ctx context.Context, cycleID string) ([]models.Role, error) {
	roles := []models.Role{}
	return roles, rolesQuery(r.db.WithContext(ctx), cycleID).Find(&roles).Error
}

func (r *RoleDB) ListCycleRoles(ctx context.Context, cycleID string) ([]models.Role, error) {
	return r.ListRoles(ctx, cycleID)
}

func (r *RoleDB) CycleHasRole(ctx context.Context, cycleID, roleID string) (bool, error) {
	var n int64
	err := cycleRole(r.db.WithContext(ctx), cycleID, roleID).Count(&n).Error
	return n > 0, err
}

// CopyPreviousCycleRoles gives a new cycle the roles of the latest earlier
// cycle with its branch and application type. Pass the creating transaction.
func CopyPreviousCycleRoles(tx *gorm.DB, cycleID string) error {
	return copyPreviousCycleRoles(tx, cycleID).Error
}

func rolesQuery(db *gorm.DB, cycleID string) *gorm.DB {
	q := db.Model(&models.Role{}).Order("created_at").Order("name")
	if cycleID != "" {
		q = q.Where("cycle_id = ?", cycleID)
	}
	return q
}

func cycleRole(db *gorm.DB, cycleID, roleID string) *gorm.DB {
	return db.Model(&models.Role{}).Where("cycle_id = ?", cycleID).Where("id = ?", roleID)
}

// Offsets created_at by row number so the copies keep the source's order.
func copyPreviousCycleRoles(db *gorm.DB, cycleID string) *gorm.DB {
	return db.Exec(`INSERT INTO roles (cycle_id, name, created_at)
SELECT ?, r.name, now() + (row_number() OVER (ORDER BY r.created_at, r.name)) * interval '1 microsecond'
FROM roles r
WHERE r.cycle_id = (
	SELECT c.id FROM cycles c
	JOIN cycles n ON n.id = ?
	WHERE c.branch_id = n.branch_id AND c.application_type = n.application_type AND c.id <> n.id
	ORDER BY c.created_at DESC LIMIT 1
)`, cycleID, cycleID)
}

func (r *RoleDB) GetRole(ctx context.Context, id string) (models.Role, error) {
	var role models.Role
	err := r.db.WithContext(ctx).Where("id = ?", id).Take(&role).Error
	return role, utils.DBErr(err)
}

func (r *RoleDB) UpdateRole(ctx context.Context, id string, in RoleUpdate) (models.Role, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "name", in.Name)
	return utils.UpdateReturning[models.Role](r.db.WithContext(ctx), updates, "id = ?", id)
}

// DeleteRole returns ErrConflict while anything still references the role.
func (r *RoleDB) DeleteRole(ctx context.Context, id string) error {
	res := r.db.WithContext(ctx).Where("id = ?", id).Delete(&models.Role{})
	if utils.ForeignKeyViolation(res.Error) {
		return utils.ErrConflict
	}
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}
