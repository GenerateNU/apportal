package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type UserCreate struct {
	NUID           string
	Email          string
	FullName       string
	ReviewerRole   *models.ReviewerRole
	GithubUsername *string
}

type UserUpdate struct {
	Email          *string
	FullName       *string
	ReviewerRole   *models.ReviewerRole
	GithubUsername *string
}

const userColumns = `nuid, email, full_name, reviewer_role, github_username, created_at, updated_at`

func (s *Store) CreateUser(ctx context.Context, in UserCreate) (models.User, error) {
	const q = `
		INSERT INTO users (nuid, email, full_name, reviewer_role, github_username)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + userColumns
	rows, err := s.db.Query(ctx, q, in.NUID, in.Email, in.FullName,
		in.ReviewerRole, in.GithubUsername)
	if err != nil {
		return models.User{}, err
	}
	u, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.User])
	if uniqueViolation(err) {
		return u, ErrConflict
	}
	return u, err
}

func (s *Store) ListUsers(ctx context.Context, reviewerRole *models.ReviewerRole) ([]models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users`
	args := []any{}
	if reviewerRole != nil {
		query += ` WHERE reviewer_role = $1`
		args = append(args, *reviewerRole)
	}
	query += ` ORDER BY full_name`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.User])
}

func (s *Store) GetUser(ctx context.Context, nuid string) (models.User, error) {
	const q = `SELECT ` + userColumns + ` FROM users WHERE nuid = $1`
	rows, err := s.db.Query(ctx, q, nuid)
	if err != nil {
		return models.User{}, err
	}
	u, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.User])
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) UpdateUser(ctx context.Context, nuid string, in UserUpdate) (models.User, error) {
	const q = `
		UPDATE users SET
			email           = COALESCE($2, email),
			full_name       = COALESCE($3, full_name),
			reviewer_role   = COALESCE($4, reviewer_role),
			github_username = COALESCE($5, github_username)
		WHERE nuid = $1
		RETURNING ` + userColumns
	rows, err := s.db.Query(ctx, q, nuid, in.Email, in.FullName,
		in.ReviewerRole, in.GithubUsername)
	if err != nil {
		return models.User{}, err
	}
	u, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.User])
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrNotFound
	}
	if uniqueViolation(err) {
		return u, ErrConflict
	}
	return u, err
}
