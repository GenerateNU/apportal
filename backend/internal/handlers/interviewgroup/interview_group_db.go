package interviewgroup

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type InterviewGroupDB struct {
	db *gorm.DB
}

func NewInterviewGroupDB(db *gorm.DB) *InterviewGroupDB {
	return &InterviewGroupDB{db: db}
}

type GroupWrite struct {
	Name        string
	MeetingSlot *time.Time
	MemberNUIDs []string
}

func (d *InterviewGroupDB) ListForCycle(ctx context.Context, cycleID string) ([]models.InterviewGroupDetail, error) {
	var groups []models.InterviewGroup
	if err := d.db.WithContext(ctx).Where("cycle_id = ?", cycleID).Order("name").Find(&groups).Error; err != nil {
		return nil, err
	}
	return d.withMembers(d.db.WithContext(ctx), groups)
}

func (d *InterviewGroupDB) Get(ctx context.Context, id string) (models.InterviewGroupDetail, error) {
	return d.get(d.db.WithContext(ctx), id)
}

func (d *InterviewGroupDB) GetMany(ctx context.Context, ids []string) ([]models.InterviewGroupDetail, error) {
	if len(ids) == 0 {
		return []models.InterviewGroupDetail{}, nil
	}
	var groups []models.InterviewGroup
	if err := d.db.WithContext(ctx).Where("id IN ?", ids).Order("name").Find(&groups).Error; err != nil {
		return nil, err
	}
	return d.withMembers(d.db.WithContext(ctx), groups)
}

func (d *InterviewGroupDB) get(db *gorm.DB, id string) (models.InterviewGroupDetail, error) {
	var group models.InterviewGroup
	if err := db.Where("id = ?", id).Take(&group).Error; err != nil {
		return models.InterviewGroupDetail{}, utils.DBErr(err)
	}
	out, err := d.withMembers(db, []models.InterviewGroup{group})
	if err != nil {
		return models.InterviewGroupDetail{}, err
	}
	return out[0], nil
}

func (d *InterviewGroupDB) withMembers(db *gorm.DB, groups []models.InterviewGroup) ([]models.InterviewGroupDetail, error) {
	out := make([]models.InterviewGroupDetail, len(groups))
	if len(groups) == 0 {
		return out, nil
	}
	ids := make([]string, len(groups))
	for n, g := range groups {
		ids[n] = g.ID
	}
	var members []models.InterviewGroupMemberDetail
	err := db.Table("interview_group_members m").
		Select("m.group_id, m.member_nuid, u.full_name").
		Joins("JOIN users u ON u.nuid = m.member_nuid").
		Where("m.group_id IN ?", ids).
		Order("u.full_name").Order("m.member_nuid").
		Scan(&members).Error
	if err != nil {
		return nil, err
	}
	byGroup := make(map[string][]models.InterviewGroupMemberDetail, len(groups))
	for _, m := range members {
		byGroup[m.GroupID] = append(byGroup[m.GroupID], m)
	}
	for n, g := range groups {
		ms := byGroup[g.ID]
		if ms == nil {
			ms = []models.InterviewGroupMemberDetail{}
		}
		out[n] = models.InterviewGroupDetail{InterviewGroup: g, Members: ms}
	}
	return out, nil
}

type InvalidMembersError struct {
	NotInterviewers []string
	AlreadyGrouped  []string
}

func (e *InvalidMembersError) Error() string {
	var parts []string
	if len(e.NotInterviewers) > 0 {
		parts = append(parts, fmt.Sprintf("not a lead or chief: %s", strings.Join(e.NotInterviewers, ", ")))
	}
	if len(e.AlreadyGrouped) > 0 {
		parts = append(parts, fmt.Sprintf("already in another group this cycle: %s", strings.Join(e.AlreadyGrouped, ", ")))
	}
	return strings.Join(parts, "; ")
}

func checkMembers(tx *gorm.DB, cycleID string, skipGroupIDs []string, writes []GroupWrite) error {
	var nuids []string
	inBatch := map[string]int{}
	for _, w := range writes {
		for _, n := range w.MemberNUIDs {
			if inBatch[n] == 0 {
				nuids = append(nuids, n)
			}
			inBatch[n]++
		}
	}
	if len(nuids) == 0 {
		return nil
	}

	var users []struct {
		NUID        string
		FullName    string
		Interviewer bool
	}
	err := tx.Raw(`SELECT nuid, full_name, roles && ARRAY['lead','chief']::user_role[] AS interviewer
		FROM users WHERE nuid IN ?`, nuids).Scan(&users).Error
	if err != nil {
		return err
	}
	name := make(map[string]string, len(users))
	interviewer := make(map[string]bool, len(users))
	for _, u := range users {
		name[u.NUID] = u.FullName
		interviewer[u.NUID] = u.Interviewer
	}
	label := func(nuid string) string {
		if name[nuid] != "" {
			return name[nuid]
		}
		return nuid
	}

	q := tx.Table("interview_group_members m").
		Joins("JOIN interview_groups g ON g.id = m.group_id").
		Where("g.cycle_id = ? AND m.member_nuid IN ?", cycleID, nuids)
	if len(skipGroupIDs) > 0 {
		q = q.Where("g.id NOT IN ?", skipGroupIDs)
	}
	var grouped []string
	if err := q.Distinct().Pluck("m.member_nuid", &grouped).Error; err != nil {
		return err
	}
	groupedSet := make(map[string]bool, len(grouped))
	for _, n := range grouped {
		groupedSet[n] = true
	}

	bad := &InvalidMembersError{}
	for _, n := range nuids {
		if !interviewer[n] {
			bad.NotInterviewers = append(bad.NotInterviewers, label(n))
		}
		if groupedSet[n] || inBatch[n] > 1 {
			bad.AlreadyGrouped = append(bad.AlreadyGrouped, label(n))
		}
	}
	if len(bad.NotInterviewers) > 0 || len(bad.AlreadyGrouped) > 0 {
		return bad
	}
	return nil
}

func (d *InterviewGroupDB) Create(ctx context.Context, cycleID, createdBy string, in GroupWrite) (models.InterviewGroupDetail, error) {
	out, err := d.CreateMany(ctx, cycleID, createdBy, []GroupWrite{in})
	if err != nil {
		return models.InterviewGroupDetail{}, err
	}
	return out[0], nil
}

func (d *InterviewGroupDB) CreateMany(ctx context.Context, cycleID, createdBy string, in []GroupWrite) ([]models.InterviewGroupDetail, error) {
	var out []models.InterviewGroupDetail
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := checkMembers(tx, cycleID, nil, in); err != nil {
			return err
		}
		ids := make([]string, len(in))
		for n, w := range in {
			group := models.InterviewGroup{CycleID: cycleID, Name: w.Name, MeetingSlot: w.MeetingSlot, CreatedBy: createdBy}
			if err := utils.Insert(tx, &group, "cycle_id", "name", "meeting_slot", "created_by"); err != nil {
				return err
			}
			if err := insertMembers(tx, group.ID, w.MemberNUIDs); err != nil {
				return err
			}
			ids[n] = group.ID
		}
		var groups []models.InterviewGroup
		if err := tx.Where("id IN ?", ids).Order("name").Find(&groups).Error; err != nil {
			return err
		}
		var err error
		out, err = d.withMembers(tx, groups)
		return err
	})
	return out, utils.DBErr(err)
}

func (d *InterviewGroupDB) Update(ctx context.Context, id string, in GroupWrite) (models.InterviewGroupDetail, error) {
	var out models.InterviewGroupDetail
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current models.InterviewGroup
		if err := tx.Where("id = ?", id).Take(&current).Error; err != nil {
			return err
		}
		if err := checkMembers(tx, current.CycleID, []string{id}, []GroupWrite{in}); err != nil {
			return err
		}
		_, err := utils.UpdateReturning[models.InterviewGroup](tx,
			map[string]any{"name": in.Name, "meeting_slot": in.MeetingSlot}, "id = ?", id)
		if err != nil {
			return err
		}
		if err := tx.Where("group_id = ?", id).Delete(&models.InterviewGroupMember{}).Error; err != nil {
			return err
		}
		if err := insertMembers(tx, id, in.MemberNUIDs); err != nil {
			return err
		}
		out, err = d.get(tx, id)
		return err
	})
	return out, utils.DBErr(err)
}

func insertMembers(tx *gorm.DB, groupID string, nuids []string) error {
	if len(nuids) == 0 {
		return nil
	}
	rows := make([]models.InterviewGroupMember, len(nuids))
	for n, nuid := range nuids {
		rows[n] = models.InterviewGroupMember{GroupID: groupID, MemberNUID: nuid}
	}
	return tx.Select("group_id", "member_nuid").Create(&rows).Error
}

func (d *InterviewGroupDB) CountApplicationsInCycle(ctx context.Context, cycleID string, ids []string) (int64, error) {
	var n int64
	err := d.db.WithContext(ctx).Model(&models.Application{}).
		Where("cycle_id = ? AND id IN ?", cycleID, ids).Count(&n).Error
	return n, err
}

func (d *InterviewGroupDB) ApplicantsWithInterviewers(ctx context.Context, ids []string) ([]string, error) {
	var names []string
	err := d.db.WithContext(ctx).Table("applications a").
		Joins("JOIN users u ON u.nuid = a.user_nuid").
		Where("a.id IN ?", ids).
		Where("EXISTS (SELECT 1 FROM interviews i JOIN interviewers iv ON iv.interview_id = i.id WHERE i.application_id = a.id)").
		Order("u.full_name").
		Pluck("u.full_name", &names).Error
	return names, err
}

func (d *InterviewGroupDB) Delete(ctx context.Context, id string) error {
	res := d.db.WithContext(ctx).Where("id = ?", id).Delete(&models.InterviewGroup{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}
