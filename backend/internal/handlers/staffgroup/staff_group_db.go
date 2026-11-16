package staffgroup

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type StaffGroupDB struct {
	db *gorm.DB
}

func NewStaffGroupDB(db *gorm.DB) *StaffGroupDB {
	return &StaffGroupDB{db: db}
}

func (d *StaffGroupDB) List(ctx context.Context, cycleID string) ([]StaffGroup, error) {
	db := d.db.WithContext(ctx)
	var groups []models.StaffGroup
	if err := db.Where("cycle_id = ?", cycleID).Order("name").Find(&groups).Error; err != nil {
		return nil, err
	}
	var members []GroupMember
	err := db.Table("staff_group_members m").
		Select("m.group_id, m.user_nuid, COALESCE(u.full_name, m.user_nuid) AS full_name").
		Joins("JOIN staff_groups g ON g.id = m.group_id").
		Joins("LEFT JOIN users u ON u.nuid = m.user_nuid").
		Where("g.cycle_id = ?", cycleID).Order("full_name").Scan(&members).Error
	if err != nil {
		return nil, err
	}
	byGroup := map[string][]GroupMember{}
	for _, m := range members {
		byGroup[m.GroupID] = append(byGroup[m.GroupID], m)
	}
	out := make([]StaffGroup, len(groups))
	for i, g := range groups {
		out[i] = StaffGroup{ID: g.ID, CycleID: g.CycleID, Name: g.Name, CreatedAt: g.CreatedAt, Members: byGroup[g.ID]}
		if out[i].Members == nil {
			out[i].Members = []GroupMember{}
		}
	}
	return out, nil
}

func (d *StaffGroupDB) Get(ctx context.Context, cycleID, groupID string) (StaffGroup, error) {
	groups, err := d.List(ctx, cycleID)
	if err != nil {
		return StaffGroup{}, err
	}
	for _, g := range groups {
		if g.ID == groupID {
			return g, nil
		}
	}
	return StaffGroup{}, utils.ErrNotFound
}

func (d *StaffGroupDB) Create(ctx context.Context, cycleID, name string, nuids []string) (string, error) {
	var id string
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row := models.StaffGroup{CycleID: cycleID, Name: name}
		if err := utils.Insert(tx, &row, "cycle_id", "name"); err != nil {
			return err
		}
		id = row.ID
		return addMembers(tx, id, nuids)
	})
	return id, err
}

func addMembers(tx *gorm.DB, groupID string, nuids []string) error {
	if len(nuids) == 0 {
		return nil
	}
	rows := make([]models.StaffGroupMember, len(nuids))
	for i, n := range nuids {
		rows[i] = models.StaffGroupMember{GroupID: groupID, UserNUID: n}
	}
	return tx.Select("group_id", "user_nuid").Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

func (d *StaffGroupDB) Rename(ctx context.Context, cycleID, groupID, name string) error {
	_, err := utils.UpdateReturning[models.StaffGroup](d.db.WithContext(ctx), map[string]any{"name": name},
		"id = ? AND cycle_id = ?", groupID, cycleID)
	return err
}

func (d *StaffGroupDB) Delete(ctx context.Context, cycleID, groupID string) error {
	return d.db.WithContext(ctx).Where("id = ? AND cycle_id = ?", groupID, cycleID).Delete(&models.StaffGroup{}).Error
}

func (d *StaffGroupDB) InCycle(ctx context.Context, cycleID string, groupIDs []string) (bool, error) {
	if len(groupIDs) == 0 {
		return true, nil
	}
	var n int64
	err := d.db.WithContext(ctx).Model(&models.StaffGroup{}).
		Where("cycle_id = ? AND id IN ?", cycleID, groupIDs).Count(&n).Error
	return int(n) == len(groupIDs), err
}

func (d *StaffGroupDB) AddMember(ctx context.Context, groupID, nuid string) error {
	return addMembers(d.db.WithContext(ctx), groupID, []string{nuid})
}

func (d *StaffGroupDB) RemoveMember(ctx context.Context, cycleID, groupID, nuid string) error {
	db := d.db.WithContext(ctx)
	return db.Where("group_id = ? AND user_nuid = ? AND group_id IN (?)", groupID, nuid,
		db.Model(&models.StaffGroup{}).Select("id").Where("cycle_id = ?", cycleID)).
		Delete(&models.StaffGroupMember{}).Error
}

// TeamsUsing lists the opening teams a group is part of.
func (d *StaffGroupDB) TeamsUsing(ctx context.Context, cycleID, groupID string) ([]models.OpeningTeam, error) {
	var teams []models.OpeningTeam
	err := d.db.WithContext(ctx).Where("cycle_id = ? AND group_id = ?", cycleID, groupID).Find(&teams).Error
	return teams, err
}

func (d *StaffGroupDB) ListTeams(ctx context.Context, cycleID string) ([]OpeningTeam, error) {
	var rows []models.OpeningTeam
	if err := d.db.WithContext(ctx).Where("cycle_id = ?", cycleID).
		Order("role_id").Order("kind").Order("group_id").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := []OpeningTeam{}
	for _, r := range rows {
		if n := len(out); n > 0 && out[n-1].RoleID == r.RoleID && out[n-1].Kind == r.Kind {
			out[n-1].GroupIDs = append(out[n-1].GroupIDs, r.GroupID)
			continue
		}
		out = append(out, OpeningTeam{RoleID: r.RoleID, Kind: r.Kind, GroupIDs: []string{r.GroupID}})
	}
	return out, nil
}

func (d *StaffGroupDB) SetTeam(ctx context.Context, cycleID, roleID string, kind models.StepKind, groupIDs []string) error {
	return d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("cycle_id = ? AND role_id = ? AND kind = ?", cycleID, roleID, kind).
			Delete(&models.OpeningTeam{}).Error; err != nil {
			return err
		}
		if len(groupIDs) == 0 {
			return nil
		}
		rows := make([]models.OpeningTeam, len(groupIDs))
		for i, g := range groupIDs {
			rows[i] = models.OpeningTeam{CycleID: cycleID, RoleID: roleID, Kind: kind, GroupID: g}
		}
		return tx.Select("cycle_id", "role_id", "kind", "group_id").Create(&rows).Error
	})
}
