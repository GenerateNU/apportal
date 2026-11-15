package applicationtemplate

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type ApplicationTemplateDB struct {
	db *gorm.DB
}

func NewApplicationTemplateDB(db *gorm.DB) *ApplicationTemplateDB {
	return &ApplicationTemplateDB{db: db}
}

// GetOrCreateApplicationTemplate fetches the (cycle, role) template, creating
// it titled "<role name> Application" on first access so callers never see a missing row.
func (a *ApplicationTemplateDB) GetOrCreateApplicationTemplate(ctx context.Context, cycleID, roleID string) (models.ApplicationTemplate, error) {
	db := a.db.WithContext(ctx)
	var template models.ApplicationTemplate
	err := db.Where("cycle_id = ? AND role_id = ?", cycleID, roleID).Take(&template).Error
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return template, err
	}

	var roleName string
	if err := db.Model(&models.Role{}).Where("id = ?", roleID).Pluck("name", &roleName).Error; err != nil {
		return template, err
	}
	template = models.ApplicationTemplate{CycleID: cycleID, RoleID: roleID, Title: roleName + " Application"}
	res := db.Select("cycle_id", "role_id", "title").
		Clauses(clause.OnConflict{DoNothing: true}, clause.Returning{}).
		Create(&template)
	if res.Error != nil || res.RowsAffected > 0 {
		return template, res.Error
	}

	// Lost a race with a concurrent create; read what the other writer inserted.
	template = models.ApplicationTemplate{}
	err = db.Where("cycle_id = ? AND role_id = ?", cycleID, roleID).Take(&template).Error
	return template, err
}

// ListCycleApplicationTemplates returns one template per role of the cycle,
// creating the default-titled draft for any role that has none yet.
func (a *ApplicationTemplateDB) ListCycleApplicationTemplates(ctx context.Context, cycleID string) ([]models.ApplicationTemplate, error) {
	templates := []models.ApplicationTemplate{}
	err := a.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := createMissingCycleTemplates(tx, cycleID).Error; err != nil {
			return err
		}
		return cycleTemplatesQuery(tx, cycleID).Find(&templates).Error
	})
	return templates, err
}

func cycleTemplatesQuery(db *gorm.DB, cycleID string) *gorm.DB {
	return db.Table("application_templates AS at").
		Select("at.*").
		Joins("JOIN roles r ON r.id = at.role_id").
		Where("at.cycle_id = ?", cycleID).
		Order("r.created_at")
}

func createMissingCycleTemplates(db *gorm.DB, cycleID string) *gorm.DB {
	return db.Exec(`INSERT INTO application_templates (cycle_id, role_id, title)
SELECT r.cycle_id, r.id, r.name || ' Application'
FROM roles r
WHERE r.cycle_id = ?
ON CONFLICT DO NOTHING`, cycleID)
}

// ListOpenApplicationTemplates returns the templates live for applicants: the
// template and its cycle are both open and the template hasn't closed.
func (a *ApplicationTemplateDB) ListOpenApplicationTemplates(ctx context.Context) ([]models.ApplicationTemplate, error) {
	templates := []models.ApplicationTemplate{}
	err := a.db.WithContext(ctx).Table("application_templates AS at").
		Select("at.*").
		Joins("JOIN cycles c ON c.id = at.cycle_id").
		Joins("JOIN roles r ON r.id = at.role_id").
		Where("at.status = ? AND c.status = ?", models.CycleOpen, models.CycleOpen).
		Where("at.closes_at IS NULL OR at.closes_at > now()").
		Order("c.created_at DESC").Order("r.created_at").
		Find(&templates).Error
	return templates, err
}

func (a *ApplicationTemplateDB) UpdateApplicationTemplate(ctx context.Context, cycleID, roleID string, in ApplicationTemplateUpdate) (models.ApplicationTemplate, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "title", in.Title)
	utils.SetIf(updates, "description", in.Description)
	utils.SetIf(updates, "instructions", in.Instructions)
	utils.SetIf(updates, "opens_at", in.OpensAt)
	utils.SetIf(updates, "closes_at", in.ClosesAt)
	utils.SetIf(updates, "status", in.Status)
	utils.SetIf(updates, "review_status", in.ReviewStatus)
	utils.SetIf(updates, "review_closes_at", in.ReviewClosesAt)
	return utils.UpdateReturning[models.ApplicationTemplate](a.db.WithContext(ctx), updates,
		"cycle_id = ? AND role_id = ?", cycleID, roleID)
}
