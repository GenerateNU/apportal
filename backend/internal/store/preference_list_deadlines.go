package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const preferenceListDeadlineColumns = `id, cycle_id, application_role, closes_at, updated_at, updated_by`

// GetOrCreatePreferenceListDeadline fetches the (cycle, role) deadline
// setting, creating an unset (closes_at = NULL, meaning editable
// indefinitely) row on first access — mirrors GetOrCreateInterviewScript's
// select -> insert-on-conflict-do-nothing -> re-select-on-lost-race shape,
// just without any default content to seed.
func (s *Store) GetOrCreatePreferenceListDeadline(ctx context.Context, cycleID string, role models.Role) (models.PreferenceListDeadline, error) {
	const selectQ = `SELECT ` + preferenceListDeadlineColumns + ` FROM preference_list_deadlines WHERE cycle_id = $1 AND application_role = $2`

	rows, err := s.db.Query(ctx, selectQ, cycleID, role)
	if err != nil {
		return models.PreferenceListDeadline{}, err
	}
	existing, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListDeadline])
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.PreferenceListDeadline{}, err
	}

	const insertQ = `
		INSERT INTO preference_list_deadlines (cycle_id, application_role)
		VALUES ($1, $2)
		ON CONFLICT (cycle_id, application_role) DO NOTHING
		RETURNING ` + preferenceListDeadlineColumns
	rows, err = s.db.Query(ctx, insertQ, cycleID, role)
	if err != nil {
		return models.PreferenceListDeadline{}, err
	}
	created, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListDeadline])
	if err == nil {
		return created, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.PreferenceListDeadline{}, err
	}

	// Lost a race with a concurrent create; fetch what the other writer inserted.
	rows, err = s.db.Query(ctx, selectQ, cycleID, role)
	if err != nil {
		return models.PreferenceListDeadline{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListDeadline])
}

// UpsertPreferenceListDeadline sets (or clears, if closesAt is nil) the
// (cycle, role) deadline, creating the settings row if this is the first
// time it's been touched. Chief-only at the handler layer.
func (s *Store) UpsertPreferenceListDeadline(ctx context.Context, cycleID string, role models.Role, closesAt *time.Time, updatedBy string) (models.PreferenceListDeadline, error) {
	const q = `
		INSERT INTO preference_list_deadlines (cycle_id, application_role, closes_at, updated_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (cycle_id, application_role) DO UPDATE SET
			closes_at  = EXCLUDED.closes_at,
			updated_at = NOW(),
			updated_by = EXCLUDED.updated_by
		RETURNING ` + preferenceListDeadlineColumns
	rows, err := s.db.Query(ctx, q, cycleID, role, closesAt, updatedBy)
	if err != nil {
		return models.PreferenceListDeadline{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListDeadline])
}
