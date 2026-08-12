package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const chiefReviewCommentColumns = `id, application_id, author_nuid, body, created_at, updated_at`

// CreateChiefReviewComment adds a comment. A chief may leave any number of
// these on an application — unlike the vote, there's no one-per-chief limit.
func (s *Store) CreateChiefReviewComment(ctx context.Context, applicationID, authorNUID, body string) (models.ChiefReviewCommentDetail, error) {
	var detail models.ChiefReviewCommentDetail
	const q = `
		INSERT INTO chief_review_comments (application_id, author_nuid, body)
		VALUES ($1, $2, $3)
		RETURNING ` + chiefReviewCommentColumns
	rows, err := s.db.Query(ctx, q, applicationID, authorNUID, body)
	if err != nil {
		return detail, err
	}
	comment, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ChiefReviewComment])
	if err != nil {
		return detail, err
	}
	names, err := s.namesByNUIDs(ctx, []string{comment.AuthorNUID})
	if err != nil {
		return detail, err
	}
	detail.ChiefReviewComment = comment
	detail.AuthorName = names[comment.AuthorNUID]
	return detail, nil
}

// UpdateChiefReviewComment edits a comment's body. Scoped to authorNUID so a
// chief can only edit their own comments — ErrNotFound covers both "doesn't
// exist" and "isn't yours" without distinguishing the two to the caller.
func (s *Store) UpdateChiefReviewComment(ctx context.Context, commentID, authorNUID, body string) (models.ChiefReviewCommentDetail, error) {
	var detail models.ChiefReviewCommentDetail
	const q = `
		UPDATE chief_review_comments SET body = $3, updated_at = NOW()
		WHERE id = $1 AND author_nuid = $2
		RETURNING ` + chiefReviewCommentColumns
	rows, err := s.db.Query(ctx, q, commentID, authorNUID, body)
	if err != nil {
		return detail, err
	}
	comment, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ChiefReviewComment])
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
	detail.ChiefReviewComment = comment
	detail.AuthorName = names[comment.AuthorNUID]
	return detail, nil
}

// ListChiefReviewComments returns every comment on an application, oldest first.
func (s *Store) ListChiefReviewComments(ctx context.Context, applicationID string) ([]models.ChiefReviewCommentDetail, error) {
	const q = `SELECT ` + chiefReviewCommentColumns + ` FROM chief_review_comments WHERE application_id = $1 ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	comments, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.ChiefReviewComment])
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

	details := make([]models.ChiefReviewCommentDetail, len(comments))
	for i, c := range comments {
		details[i].ChiefReviewComment = c
		details[i].AuthorName = names[c.AuthorNUID]
	}
	return details, nil
}
