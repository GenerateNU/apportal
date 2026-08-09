package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// AnswerInput is one answer in a bulk upsert.
type AnswerInput struct {
	QuestionID     string
	AnswerText     *string
	AnswerOptions  json.RawMessage
	AnswerFilePath *string
	AnswerFileName *string
}

// isEmpty reports whether this answer has no real content. Autosave calls
// UpsertAnswers repeatedly with the form's current full state (unlike a
// one-shot final submit, which just omits blank answers), so a field that's
// been cleared after an earlier autosave needs to actually delete the old
// row rather than silently no-op — otherwise the stale value would reappear
// when the draft is resumed.
func (in AnswerInput) isEmpty() bool {
	if in.AnswerText != nil && strings.TrimSpace(*in.AnswerText) != "" {
		return false
	}
	if in.AnswerFilePath != nil && strings.TrimSpace(*in.AnswerFilePath) != "" {
		return false
	}
	if len(in.AnswerOptions) == 0 {
		return true
	}
	var opts []string
	if err := json.Unmarshal(in.AnswerOptions, &opts); err == nil {
		return len(opts) == 0
	}
	return false
}

const answerColumns = `id, application_id, question_id, answer_text, answer_options, answer_file_path, answer_file_name, submitted_at`

// prefixedAnswerColumns is answerColumns qualified for queries that join
// applications, where the bare names would be ambiguous.
const prefixedAnswerColumns = `wa.id, wa.application_id, wa.question_id, wa.answer_text, wa.answer_options, wa.answer_file_path, wa.answer_file_name, wa.submitted_at`

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
		INSERT INTO written_answers (application_id, question_id, answer_text, answer_options, answer_file_path, answer_file_name)
		VALUES ($1, $2, $3, $4::jsonb, $5, $6)
		ON CONFLICT (application_id, question_id) DO UPDATE SET
			answer_text      = EXCLUDED.answer_text,
			answer_options   = EXCLUDED.answer_options,
			answer_file_path = EXCLUDED.answer_file_path,
			answer_file_name = EXCLUDED.answer_file_name,
			submitted_at     = NOW()`
	const del = `DELETE FROM written_answers WHERE application_id = $1 AND question_id = $2`
	for _, in := range inputs {
		if in.isEmpty() {
			if _, err := tx.Exec(ctx, del, applicationID, in.QuestionID); err != nil {
				return nil, err
			}
			continue
		}
		if _, err := tx.Exec(ctx, q, applicationID, in.QuestionID,
			in.AnswerText, jsonArg(in.AnswerOptions), in.AnswerFilePath, in.AnswerFileName); err != nil {
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

// ListAnswersForApplications fetches answers for many applications in one
// round trip, for callers rendering a page of applications at once — the
// per-application ListAnswers below turns into a request per row there.
//
// Draft answers are private autosave content, so they are excluded outright
// rather than filtered per caller: this exists for reviewer-facing lists,
// which never show drafts anyway.
func (s *Store) ListAnswersForApplications(ctx context.Context, applicationIDs []string) ([]models.WrittenAnswer, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	const q = `SELECT ` + prefixedAnswerColumns + `
		FROM written_answers wa
		JOIN applications a ON a.id = wa.application_id
		WHERE wa.application_id = ANY($1::uuid[]) AND a.stage != 'draft'
		ORDER BY wa.application_id, wa.submitted_at`
	rows, err := s.db.Query(ctx, q, applicationIDs)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.WrittenAnswer])
}

func (s *Store) ListAnswers(ctx context.Context, applicationID string) ([]models.WrittenAnswer, error) {
	const q = `SELECT ` + answerColumns + ` FROM written_answers WHERE application_id = $1 ORDER BY submitted_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.WrittenAnswer])
}

// GetAnswer fetches a single answer by (application, question), or
// ErrNotFound if the applicant hasn't answered that question.
func (s *Store) GetAnswer(ctx context.Context, applicationID, questionID string) (models.WrittenAnswer, error) {
	const q = `SELECT ` + answerColumns + ` FROM written_answers WHERE application_id = $1 AND question_id = $2`
	rows, err := s.db.Query(ctx, q, applicationID, questionID)
	if err != nil {
		return models.WrittenAnswer{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.WrittenAnswer])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}
