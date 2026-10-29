package draft

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type DraftDB struct {
	db *gorm.DB
}

func NewDraftDB(db *gorm.DB) *DraftDB {
	return &DraftDB{db: db}
}

// ErrDraftSlotTaken is returned when the requested slot already holds a pick —
// two operators submitting at once, or a stale board.
var ErrDraftSlotTaken = errors.New("draft slot already filled")

// ErrNoChange means the write asked for the state the row is already in.
var ErrNoChange = errors.New("nothing to change")

// ErrDraftAlreadyPicked is returned when the applicant is already claimed in
// another slot on the same board.
var ErrDraftAlreadyPicked = errors.New("applicant already drafted on this board")

// SnakePosition maps a 1-based pick number to a 0-based seat in the order.
// Odd rounds run down the order, even rounds back up it — so the team in the
// last seat picks the end of one round and the start of the next.
func SnakePosition(pickNumber, teamCount int) int {
	if teamCount <= 0 || pickNumber <= 0 {
		return 0
	}
	index := (pickNumber - 1) % teamCount
	if round := (pickNumber-1)/teamCount + 1; round%2 == 0 {
		return teamCount - 1 - index
	}
	return index
}

// SlotOwners maps every slot on the board to the team that owns it.
//
// With no picks made this is the plain snake. It can't stay that way once a
// chief reorders a live board: a pick already made belongs to whoever made
// it, not to whoever now sits in that seat. So each round keeps its made
// picks with their pickers and hands that round's remaining slots to the
// teams yet to pick in it, in the new order.
func SlotOwners(teams []models.DraftTeamDetail, picks []models.DraftPickDetail, rounds int) []models.DraftSlot {
	count := len(teams)
	if count == 0 || rounds <= 0 {
		return nil
	}
	pickerBySlot := make(map[int]string, len(picks))
	for _, p := range picks {
		pickerBySlot[p.PickNumber] = p.DraftTeamID
	}

	owners := make([]models.DraftSlot, 0, rounds*count)
	for round := 1; round <= rounds; round++ {
		first := (round-1)*count + 1

		// The seats this round runs through, in pick order — down the order
		// on odd rounds, back up it on even ones.
		seats := make([]string, count)
		for k := range seats {
			seats[k] = teams[SnakePosition(first+k, count)].ID
		}

		assigned := make([]string, count)
		picked := make(map[string]bool, count)
		open := make([]int, 0, count)
		for k := 0; k < count; k++ {
			if teamID, ok := pickerBySlot[first+k]; ok {
				assigned[k] = teamID
				picked[teamID] = true
				continue
			}
			open = append(open, k)
		}

		next := 0
		for _, teamID := range seats {
			if picked[teamID] || next >= len(open) {
				continue
			}
			assigned[open[next]] = teamID
			next++
		}

		for k, teamID := range assigned {
			owners = append(owners, models.DraftSlot{
				PickNumber:  first + k,
				DraftTeamID: teamID,
			})
		}
	}
	return owners
}

// ownerOf is the team holding a given slot, or "" if the board has no such
// slot.
func ownerOf(owners []models.DraftSlot, slot int) string {
	for _, o := range owners {
		if o.PickNumber == slot {
			return o.DraftTeamID
		}
	}
	return ""
}

func (d *DraftDB) GetDraft(ctx context.Context, cycleID string, role models.Role) (models.Draft, error) {
	var draft models.Draft
	err := d.db.WithContext(ctx).Where("cycle_id = ? AND application_role = ?", cycleID, role).Take(&draft).Error
	return draft, utils.DBErr(err)
}

func (d *DraftDB) GetDraftByID(ctx context.Context, id string) (models.Draft, error) {
	var draft models.Draft
	err := d.db.WithContext(ctx).Where("id = ?", id).Take(&draft).Error
	return draft, utils.DBErr(err)
}

// CreateDraft opens the board for a (cycle, role). A second call returns the
// existing board, so two chiefs opening the page at once don't race.
func (d *DraftDB) CreateDraft(ctx context.Context, cycleID string, role models.Role, rounds int, createdBy string) (models.Draft, error) {
	draft := models.Draft{CycleID: cycleID, ApplicationRole: role, Rounds: rounds, CreatedBy: createdBy}
	res := d.db.WithContext(ctx).Select("cycle_id", "application_role", "rounds", "created_by").
		Clauses(clause.OnConflict{DoNothing: true}, clause.Returning{}).Create(&draft)
	if res.Error != nil {
		return models.Draft{}, res.Error
	}
	if res.RowsAffected == 0 {
		return d.GetDraft(ctx, cycleID, role)
	}
	return draft, nil
}

func (d *DraftDB) UpdateDraft(ctx context.Context, id string, in DraftUpdate) (models.Draft, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "status", in.Status)
	utils.SetIf(updates, "rounds", in.Rounds)
	return utils.UpdateReturning[models.Draft](d.db.WithContext(ctx), updates, "id = ?", id)
}

// SetDraftTeams replaces the order with the given preference lists. Teams
// that drop out take their picks with them (cascade), which is why the
// handler fixes the team set once picking starts.
func (d *DraftDB) SetDraftTeams(ctx context.Context, draftID string, preferenceListIDs []string) error {
	return d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		dropped := tx.Where("draft_id = ?", draftID)
		if len(preferenceListIDs) > 0 {
			dropped = dropped.Where("preference_list_id NOT IN ?", preferenceListIDs)
		}
		if err := dropped.Delete(&models.DraftTeam{}).Error; err != nil {
			return err
		}
		if len(preferenceListIDs) == 0 {
			return nil
		}
		teams := make([]models.DraftTeam, len(preferenceListIDs))
		for i, id := range preferenceListIDs {
			teams[i] = models.DraftTeam{DraftID: draftID, PreferenceListID: id, Position: i}
		}
		return tx.Select("draft_id", "preference_list_id", "position").
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "draft_id"}, {Name: "preference_list_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"position"}),
			}).
			Create(&teams).Error
	})
}

func (d *DraftDB) ListDraftTeams(ctx context.Context, draftID string) ([]models.DraftTeamDetail, error) {
	teams := []models.DraftTeamDetail{}
	err := d.db.WithContext(ctx).Table("draft_teams t").
		Select("t.*, pl.name, COALESCE((SELECT array_agg(u.full_name ORDER BY u.full_name) "+
			"FROM preference_list_members m JOIN users u ON u.nuid = m.lead_nuid "+
			"WHERE m.preference_list_id = pl.id), '{}') AS member_names").
		Joins("JOIN preference_lists pl ON pl.id = t.preference_list_id").
		Where("t.draft_id = ?", draftID).
		Order("t.position").
		Find(&teams).Error
	return teams, err
}

func (d *DraftDB) ListDraftPicks(ctx context.Context, draftID string) ([]models.DraftPickDetail, error) {
	picks := []models.DraftPickDetail{}
	err := d.db.WithContext(ctx).Table("draft_picks p").
		Select("p.*, COALESCE(u.full_name, '') AS full_name, COALESCE(u.email, '') AS email").
		Joins("JOIN applications a ON a.id = p.application_id").
		Joins("LEFT JOIN users u ON u.nuid = a.user_nuid").
		Where("p.draft_id = ?", draftID).
		Order("p.pick_number").
		Find(&picks).Error
	return picks, err
}

// DraftBoard assembles the order, the picks, and which slot is on the clock.
func (d *DraftDB) DraftBoard(ctx context.Context, draft models.Draft) (models.DraftBoard, error) {
	board := models.DraftBoard{Draft: draft}
	teams, err := d.ListDraftTeams(ctx, draft.ID)
	if err != nil {
		return board, err
	}
	picks, err := d.ListDraftPicks(ctx, draft.ID)
	if err != nil {
		return board, err
	}
	board.Teams = teams
	board.Picks = picks
	board.Slots = SlotOwners(teams, picks, draft.Rounds)
	if draft.Status != models.DraftActive || len(teams) == 0 {
		return board, nil
	}
	slot := nextOpenSlot(pickNumbers(picks), draft.Rounds*len(teams))
	if slot == 0 {
		return board, nil
	}
	board.OnTheClock = slot
	board.OnTheClockTeamID = ownerOf(board.Slots, slot)
	return board, nil
}

// nextOpenSlot is the lowest unfilled pick number, so undoing a pick mid-board
// puts that slot back on the clock instead of the end of the board. 0 when
// every slot is filled.
func nextOpenSlot(taken []int, total int) int {
	filled := make(map[int]bool, len(taken))
	for _, n := range taken {
		filled[n] = true
	}
	for n := 1; n <= total; n++ {
		if !filled[n] {
			return n
		}
	}
	return 0
}

func pickNumbers(picks []models.DraftPickDetail) []int {
	out := make([]int, len(picks))
	for i, p := range picks {
		out[i] = p.PickNumber
	}
	return out
}

// lockDraft serializes picks on one board, so two operators can't both read
// the same open slot and race to fill it.
func lockDraft(tx *gorm.DB, draftID string) error {
	var draft models.Draft
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").Where("id = ?", draftID).Take(&draft).Error
}

// boardStage reads an applicant's stage, requiring them to be in the board's
// cycle and role, so an undo has somewhere to put them back.
func boardStage(tx *gorm.DB, draft models.Draft, applicationID string) (string, error) {
	var app models.Application
	err := tx.Select("stage").
		Where("id = ? AND cycle_id = ? AND application_role = ?", applicationID, draft.CycleID, draft.ApplicationRole).
		Take(&app).Error
	return string(app.Stage), utils.DBErr(err)
}

func setStage(tx *gorm.DB, applicationID string, stage any) *gorm.DB {
	return tx.Model(&models.Application{}).Where("id = ?", applicationID).UpdateColumn("stage", stage)
}

// MakeDraftPick fills the slot (0 means whichever is on the clock) and moves
// the applicant to accepted, recording their old stage for undo.
func (d *DraftDB) MakeDraftPick(ctx context.Context, draft models.Draft, slot int, applicationID, pickedBy string) (models.DraftPick, error) {
	var pick models.DraftPick
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockDraft(tx, draft.ID); err != nil {
			return utils.DBErr(err)
		}
		teams, err := d.ListDraftTeams(ctx, draft.ID)
		if err != nil {
			return err
		}
		if len(teams) == 0 {
			return utils.ErrNotFound
		}
		picks, err := d.ListDraftPicks(ctx, draft.ID)
		if err != nil {
			return err
		}
		total := draft.Rounds * len(teams)
		if slot == 0 {
			slot = nextOpenSlot(pickNumbers(picks), total)
		}
		if slot < 1 || slot > total {
			return utils.ErrNotFound
		}
		for _, p := range picks {
			if p.PickNumber == slot {
				return ErrDraftSlotTaken
			}
		}

		previousStage, err := boardStage(tx, draft, applicationID)
		if err != nil {
			return err
		}
		pick = models.DraftPick{
			DraftID:       draft.ID,
			PickNumber:    slot,
			DraftTeamID:   ownerOf(SlotOwners(teams, picks, draft.Rounds), slot),
			ApplicationID: applicationID,
			PreviousStage: previousStage,
			PickedBy:      pickedBy,
		}
		err = utils.Insert(tx, &pick, "draft_id", "pick_number", "draft_team_id", "application_id", "previous_stage", "picked_by")
		if err != nil {
			return err
		}
		return setStage(tx, applicationID, models.StageAccepted).Error
	})
	return pick, err
}

// ReplaceDraftPick swaps the applicant in a filled slot in place. Removing and
// re-picking would open the slot, putting the board back on the clock there.
// The outgoing applicant returns to their old stage.
func (d *DraftDB) ReplaceDraftPick(ctx context.Context, draft models.Draft, pickNumber int, applicationID, pickedBy string) (models.DraftPick, error) {
	var pick models.DraftPick
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockDraft(tx, draft.ID); err != nil {
			return utils.DBErr(err)
		}
		var current models.DraftPick
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("draft_id = ? AND pick_number = ?", draft.ID, pickNumber).Take(&current).Error
		if err != nil {
			return utils.DBErr(err)
		}
		if current.ApplicationID == applicationID {
			return ErrNoChange
		}

		// The unique constraint would catch this, but a named error tells the
		// operator what actually happened.
		var elsewhere int64
		err = tx.Model(&models.DraftPick{}).
			Where("draft_id = ? AND application_id = ? AND pick_number <> ?", draft.ID, applicationID, pickNumber).
			Count(&elsewhere).Error
		if err != nil {
			return err
		}
		if elsewhere > 0 {
			return ErrDraftAlreadyPicked
		}

		newPreviousStage, err := boardStage(tx, draft, applicationID)
		if err != nil {
			return err
		}
		// Restore the outgoing applicant first, so a swap between two rows
		// can't leave both in the same stage.
		err = tx.Model(&models.Application{}).
			Where("id = ? AND stage = ?", current.ApplicationID, models.StageAccepted).
			UpdateColumn("stage", current.PreviousStage).Error
		if err != nil {
			return err
		}

		err = tx.Model(&pick).Clauses(clause.Returning{}).
			Where("draft_id = ? AND pick_number = ?", draft.ID, pickNumber).
			UpdateColumns(map[string]any{
				"application_id": applicationID,
				"previous_stage": newPreviousStage,
				"picked_by":      pickedBy,
				"picked_at":      gorm.Expr("NOW()"),
			}).Error
		if err != nil {
			return err
		}
		return setStage(tx, applicationID, models.StageAccepted).Error
	})
	return pick, err
}

// RemoveDraftPick empties a slot and restores the applicant's old stage, but
// only while they're still accepted, so a later deliberate move survives.
func (d *DraftDB) RemoveDraftPick(ctx context.Context, draftID string, pickNumber int) error {
	return d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var pick models.DraftPick
		res := tx.Clauses(clause.Returning{}).Where("draft_id = ? AND pick_number = ?", draftID, pickNumber).Delete(&pick)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return utils.ErrNotFound
		}
		return tx.Model(&models.Application{}).
			Where("id = ? AND stage = ?", pick.ApplicationID, models.StageAccepted).
			UpdateColumn("stage", pick.PreviousStage).Error
	})
}

// restoreDraftedStages returns every applicant the board claimed to their old
// stage, skipping any moved since, as RemoveDraftPick does for one pick.
func restoreDraftedStages(tx *gorm.DB, draftID string) error {
	picked := tx.Model(&models.DraftPick{}).Select("application_id").Where("draft_id = ?", draftID)
	return tx.Model(&models.Application{}).
		Where("stage = ? AND id IN (?)", models.StageAccepted, picked).
		UpdateColumn("stage", gorm.Expr(
			"(SELECT p.previous_stage FROM draft_picks p WHERE p.draft_id = ? AND p.application_id = applications.id)", draftID)).
		Error
}

// ResetDraft clears every pick and returns the board to setup, undoing the
// stage changes. The team order survives, so a rehearsal is cheap to wipe.
func (d *DraftDB) ResetDraft(ctx context.Context, draftID string) error {
	return d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := restoreDraftedStages(tx, draftID); err != nil {
			return err
		}
		if err := tx.Where("draft_id = ?", draftID).Delete(&models.DraftPick{}).Error; err != nil {
			return err
		}
		res := tx.Model(&models.Draft{}).Where("id = ?", draftID).UpdateColumn("status", models.DraftSetup)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return utils.ErrNotFound
		}
		return nil
	})
}

// DeleteDraft removes the board. Picks cascade, so their stage changes are
// undone first or applicants would sit in accepted with no record of why.
func (d *DraftDB) DeleteDraft(ctx context.Context, draftID string) error {
	return d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := restoreDraftedStages(tx, draftID); err != nil {
			return err
		}
		res := tx.Where("id = ?", draftID).Delete(&models.Draft{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return utils.ErrNotFound
		}
		return nil
	})
}

// DraftedApplicationIDs maps every application claimed on any board in the
// cycle to its team name, for greying them out on preference lists.
func (d *DraftDB) DraftedApplicationIDs(ctx context.Context, cycleID string) (map[string]string, error) {
	var rows []struct {
		ApplicationID string
		Name          string
	}
	err := d.db.WithContext(ctx).Table("draft_picks p").
		Select("p.application_id, pl.name").
		Joins("JOIN drafts d ON d.id = p.draft_id").
		Joins("JOIN draft_teams t ON t.id = p.draft_team_id").
		Joins("JOIN preference_lists pl ON pl.id = t.preference_list_id").
		Where("d.cycle_id = ?", cycleID).
		Scan(&rows).Error
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.ApplicationID] = r.Name
	}
	return out, err
}
