package tag

import (
	"context"
	"reflect"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type TagDB struct {
	db *gorm.DB
}

func NewTagDB(db *gorm.DB) *TagDB {
	return &TagDB{db: db}
}

func (t *TagDB) ListTags(ctx context.Context, cycleID string) ([]models.CycleTag, error) {
	tags := []models.CycleTag{}
	err := t.db.WithContext(ctx).Where("cycle_id = ?", cycleID).Order("created_at").Order("id").Find(&tags).Error
	return tags, err
}

func (t *TagDB) GetTag(ctx context.Context, id string) (models.CycleTag, error) {
	var tag models.CycleTag
	err := t.db.WithContext(ctx).Where("id = ?", id).Take(&tag).Error
	return tag, utils.DBErr(err)
}

// TagNameTaken reports whether the cycle already has a tag by that name,
// ignoring case and the tag excludeID (empty for none).
func (t *TagDB) TagNameTaken(ctx context.Context, cycleID, name, excludeID string) (bool, error) {
	q := t.db.WithContext(ctx).Model(&models.CycleTag{}).
		Where("cycle_id = ? AND lower(name) = lower(?)", cycleID, name)
	if excludeID != "" {
		q = q.Where("id <> ?", excludeID)
	}
	var n int64
	err := q.Count(&n).Error
	return n > 0, err
}

func (t *TagDB) CreateTag(ctx context.Context, cycleID, name, color string) (models.CycleTag, error) {
	tag := models.CycleTag{CycleID: cycleID, Name: name, Color: color}
	err := utils.Insert(t.db.WithContext(ctx), &tag, "cycle_id", "name", "color")
	return tag, err
}

func (t *TagDB) UpdateTag(ctx context.Context, id string, name, color *string) (models.CycleTag, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "name", name)
	utils.SetIf(updates, "color", color)
	return utils.UpdateReturning[models.CycleTag](t.db.WithContext(ctx), updates, "id = ?", id)
}

// CountCycleTags counts how many of ids are tags of the cycle, so a caller can
// tell whether every id belongs to it.
func (t *TagDB) CountCycleTags(ctx context.Context, cycleID string, ids []string) (int, error) {
	var n int64
	err := t.db.WithContext(ctx).Model(&models.CycleTag{}).
		Where("cycle_id = ? AND id IN ?", cycleID, ids).Count(&n).Error
	return int(n), err
}

// DeleteTag removes the tag and strips it from its cycle's applications.
func (t *TagDB) DeleteTag(ctx context.Context, tag models.CycleTag) error {
	return t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(
			"UPDATE applications SET tag_ids = array_remove(tag_ids, ?::uuid) WHERE cycle_id = ? AND tag_ids @> ARRAY[?]::uuid[]",
			tag.ID, tag.CycleID, tag.ID,
		).Error; err != nil {
			return err
		}
		res := tx.Where("id = ?", tag.ID).Delete(&models.CycleTag{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return utils.ErrNotFound
		}
		return nil
	})
}

// SetApplicationTags replaces the application's tag ids and returns them.
func (t *TagDB) SetApplicationTags(ctx context.Context, applicationID string, ids []string) ([]string, error) {
	literal, err := models.ArrayLiteral(reflect.ValueOf(ids))
	if err != nil {
		return nil, err
	}
	res := t.db.WithContext(ctx).Exec("UPDATE applications SET tag_ids = ?::uuid[] WHERE id = ?", literal, applicationID)
	if res.Error != nil {
		return nil, utils.DBErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, utils.ErrNotFound
	}
	return append([]string{}, ids...), nil
}
