package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// CycleCreate carries the fields needed to create a cycle.
type CycleCreate struct {
	Name     string
	Status   models.CycleStatus
	OpensAt  *time.Time
	ClosesAt *time.Time
}

// CycleUpdate carries partial-update fields; nil pointers are left unchanged.
type CycleUpdate struct {
	Name     *string
	Status   *models.CycleStatus
	OpensAt  *time.Time
	ClosesAt *time.Time
}

const cycleColumns = `id, name, status, opens_at, closes_at, created_at`

func (s *Store) CreateCycle(ctx context.Context, in CycleCreate) (models.Cycle, error) {
	const q = `
		INSERT INTO cycles (name, status, opens_at, closes_at)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + cycleColumns
	rows, err := s.db.Query(ctx, q, in.Name, in.Status, in.OpensAt, in.ClosesAt)
	if err != nil {
		return models.Cycle{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Cycle])
}

func (s *Store) ListCycles(ctx context.Context) ([]models.Cycle, error) {
	const q = `SELECT ` + cycleColumns + ` FROM cycles ORDER BY created_at DESC`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.Cycle])
}

func (s *Store) GetCycle(ctx context.Context, id string) (models.Cycle, error) {
	const q = `SELECT ` + cycleColumns + ` FROM cycles WHERE id = $1`
	rows, err := s.db.Query(ctx, q, id)
	if err != nil {
		return models.Cycle{}, err
	}
	c, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Cycle])
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}

func (s *Store) UpdateCycle(ctx context.Context, id string, in CycleUpdate) (models.Cycle, error) {
	// COALESCE keeps the existing value when the corresponding input is NULL.
	const q = `
		UPDATE cycles SET
			name      = COALESCE($2, name),
			status    = COALESCE($3, status),
			opens_at  = COALESCE($4, opens_at),
			closes_at = COALESCE($5, closes_at)
		WHERE id = $1
		RETURNING ` + cycleColumns
	rows, err := s.db.Query(ctx, q, id, in.Name, in.Status, in.OpensAt, in.ClosesAt)
	if err != nil {
		return models.Cycle{}, err
	}
	c, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Cycle])
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}
