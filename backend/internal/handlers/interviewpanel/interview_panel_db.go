package interviewpanel

import (
	"context"
	"fmt"
	"slices"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/interviewplan"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

var errOnAnotherPanel = fmt.Errorf("%w: already on another panel this cycle", utils.ErrConflict)

type InterviewPanelDB struct {
	db *gorm.DB
}

func NewInterviewPanelDB(db *gorm.DB) *InterviewPanelDB {
	return &InterviewPanelDB{db: db}
}

func ListPanels(db *gorm.DB, cycleID string) ([]models.InterviewPanelDetail, error) {
	var panels []models.InterviewPanel
	if err := db.Where("cycle_id = ?", cycleID).Order("name").Find(&panels).Error; err != nil {
		return nil, err
	}
	var members []models.PanelMember
	err := db.Table("interview_panel_members m").
		Select("m.panel_id, m.user_nuid, COALESCE(u.full_name, m.user_nuid) AS full_name").
		Joins("LEFT JOIN users u ON u.nuid = m.user_nuid").
		Where("m.cycle_id = ?", cycleID).Order("full_name").Scan(&members).Error
	if err != nil {
		return nil, err
	}
	byPanel := map[string][]models.PanelMember{}
	for _, m := range members {
		byPanel[m.PanelID] = append(byPanel[m.PanelID], m)
	}
	out := make([]models.InterviewPanelDetail, len(panels))
	for i, p := range panels {
		out[i] = models.InterviewPanelDetail{InterviewPanel: p, Members: byPanel[p.ID]}
		if out[i].Members == nil {
			out[i].Members = []models.PanelMember{}
		}
	}
	return out, nil
}

func (d *InterviewPanelDB) List(ctx context.Context, cycleID string) ([]models.InterviewPanelDetail, error) {
	return ListPanels(d.db.WithContext(ctx), cycleID)
}

func (d *InterviewPanelDB) Get(ctx context.Context, cycleID, panelID string) (models.InterviewPanelDetail, error) {
	panels, err := d.List(ctx, cycleID)
	if err != nil {
		return models.InterviewPanelDetail{}, err
	}
	for _, p := range panels {
		if p.ID == panelID {
			return p, nil
		}
	}
	return models.InterviewPanelDetail{}, utils.ErrNotFound
}

func insertPanel(tx *gorm.DB, cycleID, name, by string, nuids []string) (string, error) {
	row := models.InterviewPanel{CycleID: cycleID, Name: name, CreatedBy: by}
	if err := utils.Insert(tx, &row, "cycle_id", "name", "created_by"); err != nil {
		return "", err
	}
	return row.ID, insertMembers(tx, cycleID, row.ID, nuids)
}

func insertMembers(tx *gorm.DB, cycleID, panelID string, nuids []string) error {
	if len(nuids) == 0 {
		return nil
	}
	rows := make([]models.InterviewPanelMember, len(nuids))
	for i, n := range nuids {
		rows[i] = models.InterviewPanelMember{PanelID: panelID, CycleID: cycleID, UserNUID: n}
	}
	err := tx.Select("panel_id", "cycle_id", "user_nuid").Create(&rows).Error
	if utils.UniqueViolation(err) {
		return errOnAnotherPanel
	}
	return err
}

func (d *InterviewPanelDB) Create(ctx context.Context, cycleID, name, by string, nuids []string) (string, error) {
	var id string
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		id, err = insertPanel(tx, cycleID, name, by, nuids)
		return err
	})
	return id, utils.DBErr(err)
}

func (d *InterviewPanelDB) Rename(ctx context.Context, cycleID, panelID, name string) error {
	_, err := utils.UpdateReturning[models.InterviewPanel](d.db.WithContext(ctx),
		map[string]any{"name": name, "updated_at": gorm.Expr("NOW()")}, "id = ? AND cycle_id = ?", panelID, cycleID)
	return err
}

func (d *InterviewPanelDB) Delete(ctx context.Context, cycleID, panelID string) error {
	return d.db.WithContext(ctx).Where("id = ? AND cycle_id = ?", panelID, cycleID).Delete(&models.InterviewPanel{}).Error
}

// AddMember is a no-op when they're already on this panel.
func (d *InterviewPanelDB) AddMember(ctx context.Context, cycleID, panelID, nuid string) error {
	return d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var n int64
		if err := tx.Model(&models.InterviewPanel{}).Where("id = ? AND cycle_id = ?", panelID, cycleID).Count(&n).Error; err != nil {
			return err
		}
		if n == 0 {
			return utils.ErrNotFound
		}
		var current []string
		if err := tx.Model(&models.InterviewPanelMember{}).Where("cycle_id = ? AND user_nuid = ?", cycleID, nuid).
			Pluck("panel_id", &current).Error; err != nil {
			return err
		}
		switch {
		case slices.Contains(current, panelID):
			return nil
		case len(current) > 0:
			return errOnAnotherPanel
		}
		return insertMembers(tx, cycleID, panelID, []string{nuid})
	})
}

func (d *InterviewPanelDB) RemoveMember(ctx context.Context, cycleID, panelID, nuid string) error {
	return d.db.WithContext(ctx).Where("panel_id = ? AND cycle_id = ? AND user_nuid = ?", panelID, cycleID, nuid).
		Delete(&models.InterviewPanelMember{}).Error
}

// AutoCreate makes panels of size from interview-eligible staff who aren't on
// a panel yet, keeping people with the same meeting slot together.
func (d *InterviewPanelDB) AutoCreate(ctx context.Context, cycleID, roleID, by string, size int) ([]string, error) {
	var ids []string
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext('interview_panels:' || ?))", cycleID).Error; err != nil {
			return err
		}
		pool, err := eligibleInterviewers(tx, cycleID, roleID)
		if err != nil {
			return err
		}
		var taken []string
		if err := tx.Model(&models.InterviewPanelMember{}).Where("cycle_id = ?", cycleID).Pluck("user_nuid", &taken).Error; err != nil {
			return err
		}
		pool = slices.DeleteFunc(pool, func(n string) bool { return slices.Contains(taken, n) })
		var slots []models.StaffSlot
		if err := tx.Where("cycle_id = ?", cycleID).Find(&slots).Error; err != nil {
			return err
		}
		slotOf := make(map[string]string, len(slots))
		for _, s := range slots {
			slotOf[s.UserNUID] = s.SlotID
		}
		var names []string
		if err := tx.Model(&models.InterviewPanel{}).Where("cycle_id = ?", cycleID).Pluck("name", &names).Error; err != nil {
			return err
		}
		next := 1
		for _, members := range interviewplan.Panels(pool, slotOf, size) {
			name := ""
			for name == "" || slices.Contains(names, name) {
				name = fmt.Sprintf("Panel %d", next)
				next++
			}
			id, err := insertPanel(tx, cycleID, name, by, members)
			if err != nil {
				return err
			}
			ids = append(ids, id)
		}
		return nil
	})
	return ids, utils.DBErr(err)
}

func eligibleInterviewers(tx *gorm.DB, cycleID, roleID string) ([]string, error) {
	o, err := staffing.LoadOpenings(tx, cycleID)
	if err != nil {
		return nil, err
	}
	if roleID != "" {
		return o.Eligible(roleID, models.KindInterviewer), nil
	}
	var roles []string
	if err := tx.Model(&models.Role{}).Where("cycle_id = ?", cycleID).Pluck("id", &roles).Error; err != nil {
		return nil, err
	}
	if len(roles) == 0 {
		return o.Staff, nil
	}
	in := map[string]bool{}
	for _, r := range roles {
		for _, n := range o.Eligible(r, models.KindInterviewer) {
			in[n] = true
		}
	}
	return slices.DeleteFunc(slices.Clone(o.Staff), func(n string) bool { return !in[n] }), nil
}
