package store

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ApplicationCreate struct {
	CycleID      string
	UserNUID     string
	Role         models.Role
	Availability json.RawMessage
	ResumeURL    *string
}

type ApplicationUpdate struct {
	Stage        *models.ApplicationStage
	Availability json.RawMessage
	ResumeURL    *string
}

// ApplicationFilter holds optional list filters; empty fields are ignored.
type ApplicationFilter struct {
	CycleID  string
	UserNUID string
	Role     *models.Role
	Stage    *models.ApplicationStage
}

const applicationColumns = `id, cycle_id, user_nuid, application_role, stage, availability, resume_url, submitted_at, updated_at`

func (s *Store) CreateApplication(ctx context.Context, in ApplicationCreate) (models.Application, error) {
	const q = `
		INSERT INTO applications (cycle_id, user_nuid, application_role, availability, resume_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + applicationColumns
	rows, err := s.db.Query(ctx, q, in.CycleID, in.UserNUID, in.Role,
		jsonArg(in.Availability), in.ResumeURL)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) GetApplication(ctx context.Context, id string) (models.Application, error) {
	const q = `SELECT ` + applicationColumns + ` FROM applications WHERE id = $1`
	rows, err := s.db.Query(ctx, q, id)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

func (s *Store) ListApplications(ctx context.Context, f ApplicationFilter) ([]models.Application, error) {
	query := `SELECT ` + applicationColumns + ` FROM applications WHERE 1 = 1`
	args := []any{}
	if f.CycleID != "" {
		args = append(args, f.CycleID)
		query += ` AND cycle_id = $` + strconv.Itoa(len(args))
	}
	if f.UserNUID != "" {
		args = append(args, f.UserNUID)
		query += ` AND user_nuid = $` + strconv.Itoa(len(args))
	}
	if f.Role != nil {
		args = append(args, *f.Role)
		query += ` AND application_role = $` + strconv.Itoa(len(args))
	}
	if f.Stage != nil {
		args = append(args, *f.Stage)
		query += ` AND stage = $` + strconv.Itoa(len(args))
	}
	query += ` ORDER BY submitted_at DESC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.Application])
}

func (s *Store) UpdateApplication(ctx context.Context, id string, in ApplicationUpdate) (models.Application, error) {
	const q = `
		UPDATE applications SET
			stage        = COALESCE($2, stage),
			availability = COALESCE($3::jsonb, availability),
			resume_url   = COALESCE($4, resume_url)
		WHERE id = $1
		RETURNING ` + applicationColumns
	rows, err := s.db.Query(ctx, q, id, in.Stage, jsonArg(in.Availability), in.ResumeURL)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}
