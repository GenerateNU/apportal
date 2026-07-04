package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const leadAssignmentColumns = `id, application_id, lead_nuid, assigned_by, assigned_at`

// CreateLeadAssignment assigns a lead to write-review an application. Chiefs
// assign 3 leads per application (enforced against cycle_stages elsewhere).
func (s *Store) CreateLeadAssignment(ctx context.Context, applicationID, leadNUID, assignedBy string) (models.LeadAssignment, error) {
	const q = `
		INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by)
		VALUES ($1, $2, $3)
		RETURNING ` + leadAssignmentColumns
	rows, err := s.db.Query(ctx, q, applicationID, leadNUID, assignedBy)
	if err != nil {
		return models.LeadAssignment{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.LeadAssignment])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) ListLeadAssignments(ctx context.Context, applicationID string) ([]models.LeadAssignment, error) {
	const q = `SELECT ` + leadAssignmentColumns + ` FROM lead_assignments WHERE application_id = $1 ORDER BY assigned_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.LeadAssignment])
}

func (s *Store) DeleteLeadAssignment(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM lead_assignments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
