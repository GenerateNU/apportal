package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ChallengeCreate struct {
	CycleID      string
	Role         models.Role
	Name         string
	ChallengeURL *string
	Instructions *string
	DueAt        *time.Time
}

const challengeColumns = `id, cycle_id, application_role, name, challenge_url, instructions, due_at, created_at`

func (s *Store) CreateChallenge(ctx context.Context, in ChallengeCreate) (models.CodeChallenge, error) {
	const q = `
		INSERT INTO code_challenges (cycle_id, application_role, name, challenge_url, instructions, due_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + challengeColumns
	rows, err := s.db.Query(ctx, q, in.CycleID, in.Role, in.Name,
		in.ChallengeURL, in.Instructions, in.DueAt)
	if err != nil {
		return models.CodeChallenge{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.CodeChallenge])
}

// ListChallenges returns a cycle's challenges, optionally filtered to one role.
func (s *Store) ListChallenges(ctx context.Context, cycleID string, role *models.Role) ([]models.CodeChallenge, error) {
	query := `SELECT ` + challengeColumns + ` FROM code_challenges WHERE cycle_id = $1`
	args := []any{cycleID}
	if role != nil {
		query += ` AND application_role = $2`
		args = append(args, *role)
	}
	query += ` ORDER BY created_at`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.CodeChallenge])
}
