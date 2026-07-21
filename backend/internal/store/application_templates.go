package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ApplicationTemplateUpdate carries partial-update fields; nil pointers are
// left unchanged.
type ApplicationTemplateUpdate struct {
	Title        *string
	Description  *string
	Instructions *string
	OpensAt      *time.Time
	ClosesAt     *time.Time
	Status       *models.CycleStatus
}

const applicationTemplateColumns = `id, cycle_id, application_role, title, description, instructions, opens_at, closes_at, status, created_at, updated_at`

// defaultTemplateTitle seeds a new template's title before an admin has
// customized it.
func defaultTemplateTitle(role models.Role) string {
	switch role {
	case models.RoleSoftwareEngineer:
		return "Software Engineer Application"
	case models.RoleSoftwareDesigner:
		return "Software Designer Application"
	default:
		return "Application"
	}
}

// GetOrCreateApplicationTemplate fetches the (cycle, role) template, creating
// one with a default title on first access so callers never have to handle a
// missing row.
func (s *Store) GetOrCreateApplicationTemplate(ctx context.Context, cycleID string, role models.Role) (models.ApplicationTemplate, error) {
	const selectQ = `SELECT ` + applicationTemplateColumns + ` FROM application_templates WHERE cycle_id = $1 AND application_role = $2`

	rows, err := s.db.Query(ctx, selectQ, cycleID, role)
	if err != nil {
		return models.ApplicationTemplate{}, err
	}
	existing, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ApplicationTemplate])
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.ApplicationTemplate{}, err
	}

	const insertQ = `
		INSERT INTO application_templates (cycle_id, application_role, title)
		VALUES ($1, $2, $3)
		ON CONFLICT (cycle_id, application_role) DO NOTHING
		RETURNING ` + applicationTemplateColumns
	rows, err = s.db.Query(ctx, insertQ, cycleID, role, defaultTemplateTitle(role))
	if err != nil {
		return models.ApplicationTemplate{}, err
	}
	created, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ApplicationTemplate])
	if err == nil {
		return created, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.ApplicationTemplate{}, err
	}

	// Lost a race with a concurrent create; fetch what the other writer inserted.
	rows, err = s.db.Query(ctx, selectQ, cycleID, role)
	if err != nil {
		return models.ApplicationTemplate{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ApplicationTemplate])
}

func (s *Store) UpdateApplicationTemplate(ctx context.Context, cycleID string, role models.Role, in ApplicationTemplateUpdate) (models.ApplicationTemplate, error) {
	// COALESCE keeps the existing value when the corresponding input is NULL.
	const q = `
		UPDATE application_templates SET
			title        = COALESCE($3, title),
			description  = COALESCE($4, description),
			instructions = COALESCE($5, instructions),
			opens_at     = COALESCE($6, opens_at),
			closes_at    = COALESCE($7, closes_at),
			status       = COALESCE($8, status)
		WHERE cycle_id = $1 AND application_role = $2
		RETURNING ` + applicationTemplateColumns
	rows, err := s.db.Query(ctx, q, cycleID, role,
		in.Title, in.Description, in.Instructions, in.OpensAt, in.ClosesAt, in.Status)
	if err != nil {
		return models.ApplicationTemplate{}, err
	}
	t, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ApplicationTemplate])
	if errors.Is(err, pgx.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}
