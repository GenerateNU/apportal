package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const tlAssignmentColumns = `id, application_id, tl_nuid, assigned_by, assigned_at`

// CreateTLAssignment assigns a TL to write-review an application.
func (s *Store) CreateTLAssignment(ctx context.Context, applicationID, tlNUID, assignedBy string) (models.TLAssignment, error) {
	const q = `
		INSERT INTO tl_assignments (application_id, tl_nuid, assigned_by)
		VALUES ($1, $2, $3)
		RETURNING ` + tlAssignmentColumns
	rows, err := s.db.Query(ctx, q, applicationID, tlNUID, assignedBy)
	if err != nil {
		return models.TLAssignment{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.TLAssignment])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) ListTLAssignments(ctx context.Context, applicationID string) ([]models.TLAssignment, error) {
	const q = `SELECT ` + tlAssignmentColumns + ` FROM tl_assignments WHERE application_id = $1 ORDER BY assigned_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.TLAssignment])
}

func (s *Store) DeleteTLAssignment(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM tl_assignments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
