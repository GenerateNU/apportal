package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ReviewQuestionCreate struct {
	CycleID      string
	Role         *models.Role // nil = global (shown for all roles)
	QuestionText string
	QuestionType models.QuestionType
	IsRequired   bool
	DisplayOrder int
	Options      json.RawMessage
	Description  *string
}

type ReviewQuestionUpdate struct {
	QuestionText     *string
	QuestionType     *models.QuestionType
	IsRequired       *bool
	DisplayOrder     *int
	Options          json.RawMessage
	Description      *string
	ClearDescription bool
}

const reviewQuestionColumns = `id, cycle_id, application_role, question_text, question_type, is_required, display_order, options, description, created_at`

func (s *Store) CreateReviewQuestion(ctx context.Context, in ReviewQuestionCreate) (models.ReviewQuestion, error) {
	const q = `
		INSERT INTO review_questions (cycle_id, application_role, question_text, question_type, is_required, display_order, options, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING ` + reviewQuestionColumns
	rows, err := s.db.Query(ctx, q, in.CycleID, in.Role, in.QuestionText,
		in.QuestionType, in.IsRequired, in.DisplayOrder, jsonArg(in.Options), in.Description)
	if err != nil {
		return models.ReviewQuestion{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ReviewQuestion])
}

// ListReviewQuestions returns a cycle's review questions ordered for display.
// When role is non-nil, it returns that role's questions plus global ones
// (role IS NULL).
func (s *Store) ListReviewQuestions(ctx context.Context, cycleID string, role *models.Role) ([]models.ReviewQuestion, error) {
	query := `SELECT ` + reviewQuestionColumns + ` FROM review_questions WHERE cycle_id = $1`
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
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.ReviewQuestion])
}

func (s *Store) UpdateReviewQuestion(ctx context.Context, id string, in ReviewQuestionUpdate) (models.ReviewQuestion, error) {
	const q = `
		UPDATE review_questions SET
			question_text = COALESCE($2, question_text),
			question_type = COALESCE($3, question_type),
			is_required   = COALESCE($4, is_required),
			display_order = COALESCE($5, display_order),
			options       = COALESCE($6::jsonb, options),
			description   = CASE
				WHEN $7 THEN NULL
				WHEN $8::text IS NOT NULL THEN $8
				ELSE description
			END
		WHERE id = $1
		RETURNING ` + reviewQuestionColumns
	rows, err := s.db.Query(ctx, q, id, in.QuestionText, in.QuestionType,
		in.IsRequired, in.DisplayOrder, jsonArg(in.Options), in.ClearDescription, in.Description)
	if err != nil {
		return models.ReviewQuestion{}, err
	}
	result, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ReviewQuestion])
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrNotFound
	}
	return result, err
}

func (s *Store) DeleteReviewQuestion(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM review_questions WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
