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

func defaultTemplateTitle(role models.Role) string {
	switch role {
	case models.RoleSoftwareEngineer:
		return "Software Engineer Application"
	case models.RoleSoftwareDesigner:
		return "Software Designer Application"
	default:
		return "Application"
	}
}

// GetOrCreateApplicationTemplate fetches the (cycle, role) template, creating
// it with a default title on first access so callers never see a missing row.
func (a *ApplicationTemplateDB) GetOrCreateApplicationTemplate(ctx context.Context, cycleID string, role models.Role) (models.ApplicationTemplate, error) {
	db := a.db.WithContext(ctx)
	var template models.ApplicationTemplate
	err := db.Where("cycle_id = ? AND application_role = ?", cycleID, role).Take(&template).Error
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return template, err
	}

	template = models.ApplicationTemplate{CycleID: cycleID, ApplicationRole: role, Title: defaultTemplateTitle(role)}
	res := db.Select("cycle_id", "application_role", "title").
		Clauses(clause.OnConflict{DoNothing: true}, clause.Returning{}).
		Create(&template)
	if res.Error != nil || res.RowsAffected > 0 {
		return template, res.Error
	}

	// Lost a race with a concurrent create; read what the other writer inserted.
	template = models.ApplicationTemplate{}
	err = db.Where("cycle_id = ? AND application_role = ?", cycleID, role).Take(&template).Error
	return template, err
}

// ListOpenApplicationTemplates returns the templates live for applicants: the
// template and its cycle are both open and the template hasn't closed.
func (a *ApplicationTemplateDB) ListOpenApplicationTemplates(ctx context.Context) ([]models.ApplicationTemplate, error) {
	templates := []models.ApplicationTemplate{}
	err := a.db.WithContext(ctx).Table("application_templates AS at").
		Select("at.*").
		Joins("JOIN cycles c ON c.id = at.cycle_id").
		Where("at.status = ? AND c.status = ?", models.CycleOpen, models.CycleOpen).
		Where("at.closes_at IS NULL OR at.closes_at > now()").
		Order("c.created_at DESC").Order("at.application_role").
		Find(&templates).Error
	return templates, err
}

func (a *ApplicationTemplateDB) UpdateApplicationTemplate(ctx context.Context, cycleID string, role models.Role, in ApplicationTemplateUpdate) (models.ApplicationTemplate, error) {
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
		"cycle_id = ? AND application_role = ?", cycleID, role)
}
