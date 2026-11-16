package staffing

import (
	"context"
	"errors"
	"slices"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type Teams map[models.StepKind][]string

type Openings struct {
	Staff   []string
	Teams   map[string]Teams
	Members map[string][]string
}

// Eligible: the groups picked for this kind, else the interviewers for
// recording reviews, else everyone on the cycle.
func (o Openings) Eligible(roleID string, kind models.StepKind) []string {
	groups := o.Teams[roleID][kind]
	if len(groups) == 0 {
		if kind == models.KindRecordingReviewer {
			return o.Eligible(roleID, models.KindInterviewer)
		}
		return slices.Clone(o.Staff)
	}
	in := map[string]bool{}
	for _, g := range groups {
		for _, n := range o.Members[g] {
			in[n] = true
		}
	}
	out := []string{}
	for _, n := range o.Staff {
		if in[n] {
			out = append(out, n)
		}
	}
	return out
}

func (o Openings) IsEligible(roleID string, kind models.StepKind, nuid string) bool {
	return slices.Contains(o.Eligible(roleID, kind), nuid)
}

var ErrNotStaffKind = errors.New("kind must be reviewer, interviewer or recording_reviewer")

func Eligible(ctx context.Context, db *gorm.DB, cycleID, roleID string, kind models.StepKind) ([]string, error) {
	if !kind.Staff() {
		return nil, ErrNotStaffKind
	}
	o, err := LoadOpenings(db.WithContext(ctx), cycleID)
	if err != nil {
		return nil, err
	}
	return o.Eligible(roleID, kind), nil
}

func NotStaff(db *gorm.DB, cycleID string, nuids []string) ([]string, error) {
	if len(nuids) == 0 {
		return nil, nil
	}
	var on []string
	if err := db.Table("(?) AS p", workflow.StaffPool(db, cycleID)).Where("p.user_nuid IN ?", nuids).
		Pluck("p.user_nuid", &on).Error; err != nil {
		return nil, err
	}
	var out []string
	for _, n := range nuids {
		if !slices.Contains(on, n) {
			out = append(out, n)
		}
	}
	return out, nil
}

func LoadOpenings(db *gorm.DB, cycleID string) (Openings, error) {
	o := Openings{Staff: []string{}, Teams: map[string]Teams{}, Members: map[string][]string{}}
	if err := db.Table("(?) AS p", workflow.StaffPool(db, cycleID)).
		Order("p.user_nuid").Pluck("p.user_nuid", &o.Staff).Error; err != nil {
		return o, err
	}
	var teams []models.OpeningTeam
	if err := db.Where("cycle_id = ?", cycleID).Find(&teams).Error; err != nil {
		return o, err
	}
	for _, t := range teams {
		if o.Teams[t.RoleID] == nil {
			o.Teams[t.RoleID] = Teams{}
		}
		o.Teams[t.RoleID][t.Kind] = append(o.Teams[t.RoleID][t.Kind], t.GroupID)
	}
	var members []models.StaffGroupMember
	if err := db.Table("staff_group_members m").Select("m.group_id, m.user_nuid").
		Joins("JOIN staff_groups g ON g.id = m.group_id").
		Where("g.cycle_id = ?", cycleID).Scan(&members).Error; err != nil {
		return o, err
	}
	for _, m := range members {
		o.Members[m.GroupID] = append(o.Members[m.GroupID], m.UserNUID)
	}
	return o, nil
}
