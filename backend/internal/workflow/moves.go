package workflow

import (
	"context"
	"slices"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type Move struct {
	ApplicationID string
	To            models.ApplicationStage
	Restore       bool
}

type guardedApp struct {
	ID      string
	CycleID string
	RoleID  string
	Stage   models.ApplicationStage
}

// GuardMoves must run in the transaction that writes the moves; it locks each cycle before the rows, as Advance does.
func GuardMoves(ctx context.Context, tx *gorm.DB, moves ...Move) error {
	if len(moves) == 0 {
		return nil
	}
	ids := make([]string, 0, len(moves))
	for _, m := range moves {
		ids = append(ids, m.ApplicationID)
	}
	var cycles []string
	if err := tx.Model(&models.Application{}).Where("id IN ?", ids).Distinct().Pluck("cycle_id", &cycles).Error; err != nil {
		return err
	}
	slices.Sort(cycles)
	facts := map[string]*CycleState{}
	for _, c := range cycles {
		if err := lockCycle(tx, c); err != nil {
			return err
		}
		f, err := Load(tx, c)
		if err != nil {
			return err
		}
		facts[c] = f
	}
	var apps []guardedApp
	if err := tx.Model(&models.Application{}).Select("id, cycle_id, role_id, stage").Where("id IN ?", ids).
		Order("id").Clauses(clause.Locking{Strength: "UPDATE"}).Scan(&apps).Error; err != nil {
		return err
	}
	byID := make(map[string]guardedApp, len(apps))
	for _, a := range apps {
		byID[a.ID] = a
	}
	actors := map[string]Caller{}
	for c := range facts {
		a, err := CallerOn(ctx, tx, c)
		if err != nil {
			return err
		}
		actors[c] = a
	}
	ops := map[string][]Operation{}
	for _, m := range moves {
		a, ok := byID[m.ApplicationID]
		if !ok {
			return utils.ErrNotFound
		}
		f := facts[a.CycleID]
		if f == nil {
			return utils.ErrNotFound
		}
		op, err := f.moveOp(a.RoleID, a.Stage, m.To, m.Restore, actors[a.CycleID])
		if err != nil {
			return err
		}
		if op.Op != "" {
			ops[a.CycleID] = append(ops[a.CycleID], op)
		}
	}
	for _, c := range cycles {
		if err := Authorize(tx, facts[c], ops[c]...); err != nil {
			return err
		}
	}
	return nil
}
