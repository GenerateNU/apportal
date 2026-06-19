package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// AnswerInput is one answer in a bulk upsert.
type AnswerInput struct {
	QuestionID    string
	AnswerText    *string
	AnswerOptions json.RawMessage
}

const answerColumns = `id, application_id, question_id, answer_text, answer_options, submitted_at`

// UpsertAnswers writes all answers for an application in a single transaction,
// keyed on the (application_id, question_id) unique constraint, and returns the
// full current answer set.
func (s *Store) UpsertAnswers(ctx context.Context, applicationID string, inputs []AnswerInput) ([]models.WrittenAnswer, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const q = `
		INSERT INTO written_answers (application_id, question_id, answer_text, answer_options)
		VALUES ($1, $2, $3, $4::jsonb)
		ON CONFLICT (application_id, question_id) DO UPDATE SET
			answer_text    = EXCLUDED.answer_text,
			answer_options = EXCLUDED.answer_options,
			submitted_at   = NOW()`
	for _, in := range inputs {
		if _, err := tx.Exec(ctx, q, applicationID, in.QuestionID,
			in.AnswerText, jsonArg(in.AnswerOptions)); err != nil {
			if uniqueViolation(err) {
				return nil, ErrConflict
			}
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListAnswers(ctx, applicationID)
}

func (s *Store) ListAnswers(ctx context.Context, applicationID string) ([]models.WrittenAnswer, error) {
	const q = `SELECT ` + answerColumns + ` FROM written_answers WHERE application_id = $1 ORDER BY submitted_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.WrittenAnswer])
}
