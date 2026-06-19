package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const tlSelectionColumns = `id, cycle_id, tl_nuid, application_id, note, created_at, updated_at`

// UpsertSelection records (or updates) a TL's pick of an application. The
// cycle is derived from the application, so an unknown application yields
// ErrNotFound.
func (s *Store) UpsertSelection(ctx context.Context, applicationID, tlNUID string, note *string) (models.TLSelection, error) {
	const q = `
		INSERT INTO tl_selections (cycle_id, tl_nuid, application_id, note)
		SELECT a.cycle_id, $2, $1, $3 FROM applications a WHERE a.id = $1
		ON CONFLICT (cycle_id, tl_nuid, application_id) DO UPDATE SET
			note       = EXCLUDED.note,
			updated_at = NOW()
		RETURNING ` + tlSelectionColumns
	rows, err := s.db.Query(ctx, q, applicationID, tlNUID, note)
	if err != nil {
		return models.TLSelection{}, err
	}
	sel, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.TLSelection])
	if errors.Is(err, pgx.ErrNoRows) {
		return sel, ErrNotFound // application does not exist
	}
	return sel, err
}

// DeleteSelection removes a TL's pick of an application.
func (s *Store) DeleteSelection(ctx context.Context, applicationID, tlNUID string) error {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM tl_selections WHERE application_id = $1 AND tl_nuid = $2`, applicationID, tlNUID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListSelections returns a cycle's selections, optionally filtered to one TL.
func (s *Store) ListSelections(ctx context.Context, cycleID string, tlNUID string) ([]models.TLSelection, error) {
	query := `SELECT ` + tlSelectionColumns + ` FROM tl_selections WHERE cycle_id = $1`
	args := []any{cycleID}
	if tlNUID != "" {
		query += ` AND tl_nuid = $2`
		args = append(args, tlNUID)
	}
	query += ` ORDER BY created_at`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.TLSelection])
}
