package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const interviewCommentColumns = `id, application_id, author_nuid, body, created_at, updated_at`

// CreateInterviewComment adds a comment. Any reviewer may leave any number of
// these on an application — there's no one-per-reviewer limit.
func (s *Store) CreateInterviewComment(ctx context.Context, applicationID, authorNUID, body string) (models.InterviewCommentDetail, error) {
	var detail models.InterviewCommentDetail
	const q = `
		INSERT INTO interview_comments (application_id, author_nuid, body)
		VALUES ($1, $2, $3)
		RETURNING ` + interviewCommentColumns
	rows, err := s.db.Query(ctx, q, applicationID, authorNUID, body)
	if err != nil {
		return detail, err
	}
	comment, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewComment])
	if err != nil {
		return detail, err
	}
	names, err := s.namesByNUIDs(ctx, []string{comment.AuthorNUID})
	if err != nil {
		return detail, err
	}
	detail.InterviewComment = comment
	detail.AuthorName = names[comment.AuthorNUID]
	return detail, nil
}

// UpdateInterviewComment edits a comment's body. Scoped to authorNUID so a
// reviewer can only edit their own comments — ErrNotFound covers both
// "doesn't exist" and "isn't yours" without distinguishing the two to the caller.
func (s *Store) UpdateInterviewComment(ctx context.Context, commentID, authorNUID, body string) (models.InterviewCommentDetail, error) {
	var detail models.InterviewCommentDetail
	const q = `
		UPDATE interview_comments SET body = $3, updated_at = NOW()
		WHERE id = $1 AND author_nuid = $2
		RETURNING ` + interviewCommentColumns
	rows, err := s.db.Query(ctx, q, commentID, authorNUID, body)
	if err != nil {
		return detail, err
	}
	comment, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewComment])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return detail, ErrNotFound
		}
		return detail, err
	}
	names, err := s.namesByNUIDs(ctx, []string{comment.AuthorNUID})
	if err != nil {
		return detail, err
	}
	detail.InterviewComment = comment
	detail.AuthorName = names[comment.AuthorNUID]
	return detail, nil
}

// ListInterviewComments returns every comment on an application, oldest first.
func (s *Store) ListInterviewComments(ctx context.Context, applicationID string) ([]models.InterviewCommentDetail, error) {
	const q = `SELECT ` + interviewCommentColumns + ` FROM interview_comments WHERE application_id = $1 ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	comments, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewComment])
	if err != nil {
		return nil, err
	}

	nuids := make([]string, len(comments))
	for i, c := range comments {
		nuids[i] = c.AuthorNUID
	}
	names, err := s.namesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}

	details := make([]models.InterviewCommentDetail, len(comments))
	for i, c := range comments {
		details[i].InterviewComment = c
		details[i].AuthorName = names[c.AuthorNUID]
	}
	return details, nil
}
