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
	Roles          []models.UserRole
	GraduationYear *int
	Major          *string
	GithubUsername *string
}

type UserUpdate struct {
	Email          *string
	FullName       *string
	Roles          []models.UserRole
	GraduationYear *int
	Major          *string
	GithubUsername *string
}

// roles is selected as text[] so pgx scans the custom user_role[] reliably; on
// write the parameter is cast back to user_role[].
const userColumns = `nuid, email, full_name, roles::text[] AS roles, graduation_year, major, github_username, created_at, updated_at`

// rolesText converts typed roles to the []string pgx encodes as a text array.
// A nil slice stays nil so COALESCE leaves the existing value untouched.
func rolesText(roles []models.UserRole) []string {
	if roles == nil {
		return nil
	}
	out := make([]string, len(roles))
	for i, r := range roles {
		out[i] = string(r)
	}
	return out
}

func (s *Store) CreateUser(ctx context.Context, in UserCreate) (models.User, error) {
	const q = `
		INSERT INTO users (nuid, email, full_name, roles, graduation_year, major, github_username)
		VALUES ($1, $2, $3, COALESCE($4::user_role[], '{applicant}'), $5, $6, $7)
		RETURNING ` + userColumns
	rows, err := s.db.Query(ctx, q, in.NUID, in.Email, in.FullName,
		rolesText(in.Roles), in.GraduationYear, in.Major, in.GithubUsername)
	if err != nil {
		return models.User{}, err
	}
	u, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.User])
	if uniqueViolation(err) {
		return u, ErrConflict
	}
	return u, err
}

// ListUsers returns all users, optionally filtered to those holding a role.
func (s *Store) ListUsers(ctx context.Context, role *models.UserRole) ([]models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users`
	args := []any{}
	if role != nil {
		query += ` WHERE $1::user_role = ANY(roles)`
		args = append(args, string(*role))
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
			roles           = COALESCE($4::user_role[], roles),
			graduation_year = COALESCE($5, graduation_year),
			major           = COALESCE($6, major),
			github_username = COALESCE($7, github_username)
		WHERE nuid = $1
		RETURNING ` + userColumns
	rows, err := s.db.Query(ctx, q, nuid, in.Email, in.FullName,
		rolesText(in.Roles), in.GraduationYear, in.Major, in.GithubUsername)
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
