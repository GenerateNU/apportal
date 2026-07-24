package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type QuestionCreate struct {
	CycleID      string
	Role         *models.Role // nil = global (shown to all roles)
	QuestionText string
	QuestionType models.QuestionType
	IsRequired   bool
	DisplayOrder int
	Options      json.RawMessage
	PageTitle    *string
}

type QuestionUpdate struct {
	QuestionText *string
	QuestionType *models.QuestionType
	IsRequired   *bool
	DisplayOrder *int
	Options      json.RawMessage
	// PageTitle sets a new page title; ClearPageTitle explicitly clears it.
	// Both nil/false means "leave page_title untouched" — a plain COALESCE
	// can't distinguish "not provided" from "clear to NULL", so this needs
	// its own flag rather than reusing the Options-style nullable pattern.
	PageTitle      *string
	ClearPageTitle bool
}

const questionColumns = `id, cycle_id, application_role, question_text, question_type, is_required, display_order, options, page_title, created_at`

func (s *Store) CreateQuestion(ctx context.Context, in QuestionCreate) (models.Question, error) {
	const q = `
		INSERT INTO questions (cycle_id, application_role, question_text, question_type, is_required, display_order, options, page_title)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING ` + questionColumns
	rows, err := s.db.Query(ctx, q, in.CycleID, in.Role, in.QuestionText,
		in.QuestionType, in.IsRequired, in.DisplayOrder, jsonArg(in.Options), in.PageTitle)
	if err != nil {
		return models.Question{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Question])
}

// ListQuestions returns a cycle's questions ordered for display. When role is
// non-nil, it returns that role's questions plus global ones (role IS NULL).
func (s *Store) ListQuestions(ctx context.Context, cycleID string, role *models.Role) ([]models.Question, error) {
	query := `SELECT ` + questionColumns + ` FROM questions WHERE cycle_id = $1`
	args := []any{cycleID}
	if role != nil {
		query += ` AND (application_role = $2 OR application_role IS NULL)`
		args = append(args, *role)
	}
	query += ` ORDER BY display_order, created_at`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.Question])
}

func (s *Store) UpdateQuestion(ctx context.Context, id string, in QuestionUpdate) (models.Question, error) {
	const q = `
		UPDATE questions SET
			question_text = COALESCE($2, question_text),
			question_type = COALESCE($3, question_type),
			is_required   = COALESCE($4, is_required),
			display_order = COALESCE($5, display_order),
			options       = COALESCE($6::jsonb, options),
			page_title    = CASE
				WHEN $7 THEN NULL
				WHEN $8::text IS NOT NULL THEN $8
				ELSE page_title
			END
		WHERE id = $1
		RETURNING ` + questionColumns
	rows, err := s.db.Query(ctx, q, id, in.QuestionText, in.QuestionType,
		in.IsRequired, in.DisplayOrder, jsonArg(in.Options), in.ClearPageTitle, in.PageTitle)
	if err != nil {
		return models.Question{}, err
	}
	result, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Question])
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrNotFound
	}
	return result, err
}

func (s *Store) DeleteQuestion(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM questions WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
