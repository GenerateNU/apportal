package store

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// CycleCreate carries the fields needed to create a cycle.
type CycleCreate struct {
	Name            string
	Status          models.CycleStatus
	ApplicationType models.ApplicationType
	OpensAt         *time.Time
	ClosesAt        *time.Time
}

// CycleUpdate carries partial-update fields; nil pointers are left unchanged.
type CycleUpdate struct {
	Name            *string
	Status          *models.CycleStatus
	ApplicationType *models.ApplicationType
	OpensAt         *time.Time
	ClosesAt        *time.Time
}

const cycleColumns = `id, name, status, application_type, opens_at, closes_at, created_at`

func (s *Store) CreateCycle(ctx context.Context, in CycleCreate) (models.Cycle, error) {
	const q = `
		INSERT INTO cycles (name, status, application_type, opens_at, closes_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + cycleColumns
	rows, err := s.db.Query(ctx, q, in.Name, in.Status, in.ApplicationType, in.OpensAt, in.ClosesAt)
	if err != nil {
		return models.Cycle{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Cycle])
}

// CycleFilter holds optional list filters; empty fields are ignored.
type CycleFilter struct {
	Status models.CycleStatus
}

func (s *Store) ListCycles(ctx context.Context, f CycleFilter) ([]models.Cycle, error) {
	query := `SELECT ` + cycleColumns + ` FROM cycles WHERE 1 = 1`
	args := []any{}
	if f.Status != "" {
		args = append(args, f.Status)
		query += ` AND status = $` + strconv.Itoa(len(args))
	}
	query += ` ORDER BY created_at DESC`

	rows, err := s.db.Query(ctx, query, args...)
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

// CycleRoleSummary reports one applicant role's template counts within a
// cycle via COUNT queries, rather than requiring the caller to fetch every
// question/challenge/application row just to take its length.
func (s *Store) CycleRoleSummary(ctx context.Context, cycleID string, role models.Role) (models.CycleRoleSummary, error) {
	summary := models.CycleRoleSummary{Role: role}
	const q = `
		SELECT
			(SELECT COUNT(*) FROM questions
				WHERE cycle_id = $1 AND (application_role = $2 OR application_role IS NULL)),
			(SELECT COUNT(*) FROM code_challenges
				WHERE cycle_id = $1 AND application_role = $2),
			(SELECT COUNT(*) FROM applications
				WHERE cycle_id = $1 AND application_role = $2)`
	err := s.db.QueryRow(ctx, q, cycleID, role).Scan(
		&summary.QuestionCount, &summary.ChallengeCount, &summary.SubmissionCount)
	return summary, err
}

func (s *Store) UpdateCycle(ctx context.Context, id string, in CycleUpdate) (models.Cycle, error) {
	// COALESCE keeps the existing value when the corresponding input is NULL.
	const q = `
		UPDATE cycles SET
			name             = COALESCE($2, name),
			status           = COALESCE($3, status),
			application_type = COALESCE($4, application_type),
			opens_at         = COALESCE($5, opens_at),
			closes_at        = COALESCE($6, closes_at)
		WHERE id = $1
		RETURNING ` + cycleColumns
	rows, err := s.db.Query(ctx, q, id, in.Name, in.Status, in.ApplicationType, in.OpensAt, in.ClosesAt)
	if err != nil {
		return models.Cycle{}, err
	}
	c, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Cycle])
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}
