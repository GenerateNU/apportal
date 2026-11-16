package meetingslot

import (
	"context"
	"slices"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type MeetingSlotDB struct {
	db *gorm.DB
}

func NewMeetingSlotDB(db *gorm.DB) *MeetingSlotDB {
	return &MeetingSlotDB{db: db}
}

func (d *MeetingSlotDB) List(ctx context.Context, cycleID string) ([]models.MeetingSlot, error) {
	out := []models.MeetingSlot{}
	err := d.db.WithContext(ctx).Where("cycle_id = ?", cycleID).Order("position").Order("label").Find(&out).Error
	return out, err
}

func (d *MeetingSlotDB) Create(ctx context.Context, cycleID, label string) (models.MeetingSlot, error) {
	var row models.MeetingSlot
	err := d.db.WithContext(ctx).Raw(`INSERT INTO meeting_slots (cycle_id, label, position)
		SELECT ?, ?, COALESCE(MAX(position), -1) + 1 FROM meeting_slots WHERE cycle_id = ?
		RETURNING *`, cycleID, label, cycleID).Scan(&row).Error
	return row, utils.DBErr(err)
}

func (d *MeetingSlotDB) Rename(ctx context.Context, cycleID, slotID, label string) (models.MeetingSlot, error) {
	return utils.UpdateReturning[models.MeetingSlot](d.db.WithContext(ctx), map[string]any{"label": label},
		"id = ? AND cycle_id = ?", slotID, cycleID)
}

func (d *MeetingSlotDB) Delete(ctx context.Context, cycleID, slotID string) error {
	return d.db.WithContext(ctx).Where("id = ? AND cycle_id = ?", slotID, cycleID).Delete(&models.MeetingSlot{}).Error
}

func (d *MeetingSlotDB) Reorder(ctx context.Context, cycleID string, ids []string) (bool, error) {
	ok := false
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var have []string
		if err := tx.Model(&models.MeetingSlot{}).Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("cycle_id = ?", cycleID).Pluck("id", &have).Error; err != nil {
			return err
		}
		if len(have) != len(ids) || !containsAll(have, ids) {
			return nil
		}
		for i, id := range ids {
			if err := tx.Model(&models.MeetingSlot{}).Where("id = ?", id).Update("position", i).Error; err != nil {
				return err
			}
		}
		ok = true
		return nil
	})
	return ok, err
}

func containsAll(set, ids []string) bool {
	for _, id := range ids {
		if !slices.Contains(set, id) {
			return false
		}
	}
	return true
}

func (d *MeetingSlotDB) InCycle(ctx context.Context, cycleID string, ids []string) (bool, error) {
	if len(ids) == 0 {
		return true, nil
	}
	var n int64
	err := d.db.WithContext(ctx).Model(&models.MeetingSlot{}).Where("cycle_id = ? AND id IN ?", cycleID, ids).Count(&n).Error
	return int(n) == len(ids), err
}

func (d *MeetingSlotDB) StaffSlots(ctx context.Context, cycleID string) ([]models.StaffSlot, error) {
	out := []models.StaffSlot{}
	err := d.db.WithContext(ctx).Where("cycle_id = ?", cycleID).Order("user_nuid").Find(&out).Error
	return out, err
}

func (d *MeetingSlotDB) SetStaffSlot(ctx context.Context, row models.StaffSlot) error {
	return d.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "user_nuid"}},
		DoUpdates: clause.AssignmentColumns([]string{"slot_id"}),
	}).Select("cycle_id", "user_nuid", "slot_id").Create(&row).Error
}

func (d *MeetingSlotDB) ClearStaffSlot(ctx context.Context, cycleID, nuid string) error {
	return d.db.WithContext(ctx).Where("cycle_id = ? AND user_nuid = ?", cycleID, nuid).Delete(&models.StaffSlot{}).Error
}

func (d *MeetingSlotDB) SetMatchBySlot(ctx context.Context, cycleID string, on bool) error {
	res := d.db.WithContext(ctx).Model(&models.Cycle{}).Where("id = ?", cycleID).Update("match_by_slot", on)
	if res.Error == nil && res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return res.Error
}

func (d *MeetingSlotDB) Application(ctx context.Context, applicationID string) (models.Application, error) {
	var app models.Application
	err := d.db.WithContext(ctx).Select("id", "cycle_id", "stage").Where("id = ?", applicationID).Take(&app).Error
	return app, utils.DBErr(err)
}

func (d *MeetingSlotDB) ApplicationSlotIDs(ctx context.Context, applicationID string) ([]string, error) {
	out := []string{}
	err := d.db.WithContext(ctx).Table("application_slots s").Joins("JOIN meeting_slots m ON m.id = s.slot_id").
		Where("s.application_id = ?", applicationID).Order("m.position").Pluck("s.slot_id", &out).Error
	return out, err
}

func (d *MeetingSlotDB) SetApplicationSlots(ctx context.Context, applicationID string, ids []string) error {
	return d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("application_id = ?", applicationID).Delete(&models.ApplicationSlot{}).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		rows := make([]models.ApplicationSlot, len(ids))
		for i, id := range ids {
			rows[i] = models.ApplicationSlot{ApplicationID: applicationID, SlotID: id}
		}
		return tx.Select("application_id", "slot_id").Create(&rows).Error
	})
}
