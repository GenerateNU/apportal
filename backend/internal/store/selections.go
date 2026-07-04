package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const leadSelectionColumns = `id, cycle_id, lead_nuid, application_id, note, created_at, updated_at`

// UpsertSelection records (or updates) a lead's pick of an application. The
// cycle is derived from the application, so an unknown application yields
// ErrNotFound.
func (s *Store) UpsertSelection(ctx context.Context, applicationID, leadNUID string, note *string) (models.LeadSelection, error) {
	const q = `
		INSERT INTO lead_selections (cycle_id, lead_nuid, application_id, note)
		SELECT a.cycle_id, $2, $1, $3 FROM applications a WHERE a.id = $1
		ON CONFLICT (cycle_id, lead_nuid, application_id) DO UPDATE SET
			note       = EXCLUDED.note,
			updated_at = NOW()
		RETURNING ` + leadSelectionColumns
	rows, err := s.db.Query(ctx, q, applicationID, leadNUID, note)
	if err != nil {
		return models.LeadSelection{}, err
	}
	sel, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.LeadSelection])
	if errors.Is(err, pgx.ErrNoRows) {
		return sel, ErrNotFound // application does not exist
	}
	return sel, err
}

// DeleteSelection removes a lead's pick of an application.
func (s *Store) DeleteSelection(ctx context.Context, applicationID, leadNUID string) error {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM lead_selections WHERE application_id = $1 AND lead_nuid = $2`, applicationID, leadNUID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListSelections returns a cycle's selections, optionally filtered to one lead.
func (s *Store) ListSelections(ctx context.Context, cycleID string, leadNUID string) ([]models.LeadSelection, error) {
	query := `SELECT ` + leadSelectionColumns + ` FROM lead_selections WHERE cycle_id = $1`
	args := []any{cycleID}
	if leadNUID != "" {
		query += ` AND lead_nuid = $2`
		args = append(args, leadNUID)
	}
	query += ` ORDER BY created_at`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.LeadSelection])
}
