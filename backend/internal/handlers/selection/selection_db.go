package selection

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type SelectionDB struct {
	db *gorm.DB
}

func NewSelectionDB(db *gorm.DB) *SelectionDB {
	return &SelectionDB{db: db}
}

// UpsertSelection records or updates a lead's pick. The cycle comes from the
// application, so an unknown application is ErrNotFound.
func (s *SelectionDB) UpsertSelection(ctx context.Context, applicationID, leadNUID string, note *string) (models.LeadSelection, error) {
	db := s.db.WithContext(ctx)
	var app models.Application
	if err := db.Select("cycle_id").Where("id = ?", applicationID).Take(&app).Error; err != nil {
		return models.LeadSelection{}, utils.DBErr(err)
	}

	selection := models.LeadSelection{CycleID: app.CycleID, LeadNUID: leadNUID, ApplicationID: applicationID, Note: note}
	err := db.Select("cycle_id", "lead_nuid", "application_id", "note").
		Clauses(
			clause.OnConflict{
				Columns: []clause.Column{{Name: "cycle_id"}, {Name: "lead_nuid"}, {Name: "application_id"}},
				DoUpdates: append(
					clause.AssignmentColumns([]string{"note"}),
					clause.Assignment{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")},
				),
			},
			clause.Returning{},
		).
		Create(&selection).Error
	return selection, utils.DBErr(err)
}

func (s *SelectionDB) DeleteSelection(ctx context.Context, applicationID, leadNUID string) error {
	res := s.db.WithContext(ctx).Where("application_id = ? AND lead_nuid = ?", applicationID, leadNUID).
		Delete(&models.LeadSelection{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}

// ListSelections returns a cycle's selections, optionally for one lead.
func (s *SelectionDB) ListSelections(ctx context.Context, cycleID string, leadNUID string) ([]models.LeadSelection, error) {
	q := s.db.WithContext(ctx).Where("cycle_id = ?", cycleID)
	if leadNUID != "" {
		q = q.Where("lead_nuid = ?", leadNUID)
	}
	selections := []models.LeadSelection{}
	return selections, q.Order("created_at").Find(&selections).Error
}
