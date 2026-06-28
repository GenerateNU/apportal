package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type CycleStageCreate struct {
	CycleID             string
	Stage               models.ApplicationStage
	DisplayOrder        int
	IsActive            bool
	RequiredAssignments int
	Label               *string
}

// CycleStageUpdate carries partial-update fields; nil pointers are left unchanged.
type CycleStageUpdate struct {
	DisplayOrder        *int
	IsActive            *bool
	RequiredAssignments *int
	Label               *string
}

const cycleStageColumns = `id, cycle_id, stage, display_order, is_active, required_assignments, label, created_at`

// CreateCycleStage adds a stage to a cycle's flow template. The unique
// (cycle_id, stage) pair makes a duplicate stage a conflict.
func (s *Store) CreateCycleStage(ctx context.Context, in CycleStageCreate) (models.CycleStage, error) {
	const q = `
		INSERT INTO cycle_stages (cycle_id, stage, display_order, is_active, required_assignments, label)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + cycleStageColumns
	rows, err := s.db.Query(ctx, q, in.CycleID, in.Stage, in.DisplayOrder,
		in.IsActive, in.RequiredAssignments, in.Label)
	if err != nil {
		return models.CycleStage{}, err
	}
	cs, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.CycleStage])
	if uniqueViolation(err) {
		return cs, ErrConflict
	}
	return cs, err
}

// ListCycleStages returns a cycle's stages ordered for display.
func (s *Store) ListCycleStages(ctx context.Context, cycleID string) ([]models.CycleStage, error) {
	const q = `SELECT ` + cycleStageColumns + ` FROM cycle_stages WHERE cycle_id = $1 ORDER BY display_order`
	rows, err := s.db.Query(ctx, q, cycleID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.CycleStage])
}

func (s *Store) UpdateCycleStage(ctx context.Context, id string, in CycleStageUpdate) (models.CycleStage, error) {
	const q = `
		UPDATE cycle_stages SET
			display_order        = COALESCE($2, display_order),
			is_active            = COALESCE($3, is_active),
			required_assignments = COALESCE($4, required_assignments),
			label                = COALESCE($5, label)
		WHERE id = $1
		RETURNING ` + cycleStageColumns
	rows, err := s.db.Query(ctx, q, id, in.DisplayOrder, in.IsActive,
		in.RequiredAssignments, in.Label)
	if err != nil {
		return models.CycleStage{}, err
	}
	cs, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.CycleStage])
	if errors.Is(err, pgx.ErrNoRows) {
		return cs, ErrNotFound
	}
	return cs, err
}
